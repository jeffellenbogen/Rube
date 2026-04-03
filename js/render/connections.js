import { getAttachPx } from './attachPoints.js';
import { getConnDrag, getSelectedIds } from '../drag.js';
import { getSurfaces } from './environment.js';
import { cmToPx, pxToCm, getFloorPx } from '../canvas.js';

const NS = 'http://www.w3.org/2000/svg';
const CORD_SUBTYPES = new Set(['string', 'matchboxTrack']);
const CORD_POINTS = new Set(['cordLeft', 'cordRight', 'end1', 'end2']);

function findItem(state, id) {
  return state.components.find(c => c.id === id) || (state.environment || []).find(e => e.id === id);
}

// × delete button at (cx, cy) with the connection ID embedded
function makeTealX(cx, cy, connId, fill = '#00c9a7') {
  const g = document.createElementNS(NS, 'g');
  g.dataset.action = 'delete-conn';
  g.dataset.connId = connId;
  g.setAttribute('cursor', 'pointer');
  const dc = document.createElementNS(NS, 'circle');
  dc.setAttribute('cx', cx); dc.setAttribute('cy', cy);
  dc.setAttribute('r', 7); dc.setAttribute('fill', fill);
  dc.setAttribute('stroke', '#fff'); dc.setAttribute('stroke-width', 1);
  const dt = document.createElementNS(NS, 'text');
  dt.setAttribute('x', cx); dt.setAttribute('y', cy);
  dt.setAttribute('text-anchor', 'middle'); dt.setAttribute('dominant-baseline', 'middle');
  dt.setAttribute('fill', '#fff'); dt.setAttribute('font-size', 11); dt.textContent = '×';
  g.appendChild(dc); g.appendChild(dt);
  return g;
}

export function renderConnections(state, layer) {
  layer.innerHTML = '';
  const selectedSet = new Set(getSelectedIds());

  for (const conn of state.connections) {
    const from = findItem(state, conn.fromId);
    const to = findItem(state, conn.toId);
    if (!from || !to) continue;
    const fromPts = getAttachPx(from);
    const toPts = getAttachPx(to);
    const p1 = fromPts[conn.fromPoint];
    const p2 = toPts[conn.toPoint];
    if (!p1 || !p2) continue;

    const g = document.createElementNS(NS, 'g');
    g.dataset.connId = conn.id;

    const eitherEndpointSelected = selectedSet.has(conn.fromId) || selectedSet.has(conn.toId);

    if (conn.snap) {
      // Physical snap connection: × AT the attachment point, visible only when an endpoint is selected
      if (eitherEndpointSelected) {
        g.appendChild(makeTealX(p1.x, p1.y, conn.id));
      }
      layer.appendChild(g);
      continue;
    }

    if (CORD_POINTS.has(conn.fromPoint) || CORD_POINTS.has(conn.toPoint)) {
      // Physical cord connection: × AT the cord endpoint, visible only when an endpoint is selected
      if (eitherEndpointSelected) {
        g.appendChild(makeTealX(p2.x, p2.y, conn.id));
      }
      layer.appendChild(g);
      continue;
    }

    // Symbolic connection (orange line)
    const isCord = CORD_SUBTYPES.has(from.subtype) || CORD_SUBTYPES.has(to.subtype);
    const isSelected = selectedSet.has(conn.id);

    // Transparent wide hit area so the thin line is easy to click
    const hitLine = document.createElementNS(NS, 'line');
    hitLine.setAttribute('x1', p1.x); hitLine.setAttribute('y1', p1.y);
    hitLine.setAttribute('x2', p2.x); hitLine.setAttribute('y2', p2.y);
    hitLine.setAttribute('stroke', 'transparent');
    hitLine.setAttribute('stroke-width', 16);
    g.appendChild(hitLine);

    // Visible line — brighter and thicker when selected
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', p1.x); l.setAttribute('y1', p1.y);
    l.setAttribute('x2', p2.x); l.setAttribute('y2', p2.y);
    if (isCord) {
      l.setAttribute('stroke', isSelected ? '#e0e0e0' : '#ccc');
      l.setAttribute('stroke-width', isSelected ? 3 : 2);
    } else {
      l.setAttribute('stroke', isSelected ? '#ff9f5e' : '#ff7b2e');
      l.setAttribute('stroke-width', isSelected ? 3 : 2);
    }
    g.appendChild(l);

    // Teal × at midpoint — only when this connection is selected
    if (isSelected) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      g.appendChild(makeTealX(mx, my, conn.id, '#ff7b2e'));
    }

    layer.appendChild(g);
  }

  // Draw in-progress connection drag (ghost line while dragging from attach point)
  const cd = getConnDrag();
  if (cd) {
    const fromComp = findItem(state, cd.fromId);
    if (fromComp) {
      const pts = getAttachPx(fromComp);
      const p1 = pts[cd.fromPoint];
      if (p1) {
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', p1.x); l.setAttribute('y1', p1.y);
        l.setAttribute('x2', cd.curPx); l.setAttribute('y2', cd.curPy);
        l.setAttribute('stroke', '#00c9a7'); l.setAttribute('stroke-width', 1.5);
        l.setAttribute('stroke-dasharray', '5 3');
        layer.appendChild(l);
      }
    }
  }
}

let arrowDefAdded = false;
function ensureArrowDef(svgEl) {
  if (arrowDefAdded || !svgEl) return;
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `<marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#ff7b2e"/></marker>`;
  svgEl.prepend(defs);
  arrowDefAdded = true;
}

function getLeverBarTopY(lever, compMidX) {
  const { tiltSide = 'none' } = lever.subParts || {};
  const barFy = 0.4, tiltAmt = 0.25;
  let leftFy, rightFy;
  if (tiltSide === 'left')       { leftFy = barFy - tiltAmt; rightFy = barFy + tiltAmt; }
  else if (tiltSide === 'right') { leftFy = barFy + tiltAmt; rightFy = barFy - tiltAmt; }
  else                           { leftFy = rightFy = barFy; }
  const t = (compMidX - lever.x) / lever.width;
  const fy = leftFy + (rightFy - leftFy) * t;
  const thick = lever.height * 0.1;
  return lever.y + fy * lever.height - thick;
}

export function renderFallLines(state, layer) {
  const allSurfaces = state.environment.flatMap(item => getSurfaces(item));
  const floorCm = pxToCm(getFloorPx());
  allSurfaces.push({ x1: 0, x2: 99999, y: floorCm }); // floor

  for (const comp of state.components) {
    if (comp.type === 'marker') continue;
    const compBottom = comp.y + comp.height;
    const compLeft = comp.x, compRight = comp.x + comp.width;
    const compMidX = (compLeft + compRight) / 2;

    // Build surface list including lever bar surfaces at this comp's midX
    const surfaces = [...allSurfaces];
    for (const other of state.components) {
      if (other.id === comp.id || other.subtype !== 'lever') continue;
      if (compMidX < other.x || compMidX > other.x + other.width) continue;
      surfaces.push({ x1: other.x, x2: other.x + other.width, y: getLeverBarTopY(other, compMidX) });
    }

    const below = surfaces
      .filter(s => s.y >= compBottom && s.x2 > compLeft && s.x1 < compRight)
      .sort((a, b) => a.y - b.y);

    if (below.some(s => Math.abs(s.y - compBottom) < 2)) continue; // resting
    const target = below[0];
    if (!target) continue;

    const lx = cmToPx((compLeft + compRight) / 2);
    const ly1 = cmToPx(compBottom);
    const ly2 = cmToPx(target.y);

    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', lx); line.setAttribute('y1', ly1);
    line.setAttribute('x2', lx); line.setAttribute('y2', ly2);
    line.setAttribute('stroke', '#ffd166'); line.setAttribute('stroke-width', 1.5);
    line.setAttribute('stroke-dasharray', '5 4'); line.setAttribute('opacity', 0.6);
    layer.appendChild(line);
  }
}
