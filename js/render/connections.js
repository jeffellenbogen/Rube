import { getAttachPx } from './attachPoints.js';
import { getConnDrag } from '../drag.js';
import { getSurfaces } from './environment.js';
import { cmToPx, pxToCm, getFloorPx } from '../canvas.js';

const NS = 'http://www.w3.org/2000/svg';
const CORD_SUBTYPES = new Set(['string', 'matchboxTrack']);
const CORD_POINTS = new Set(['cordLeft', 'cordRight']);

export function renderConnections(state, layer) {
  layer.innerHTML = '';

  for (const conn of state.connections) {
    const from = state.components.find(c => c.id === conn.fromId);
    const to = state.components.find(c => c.id === conn.toId);
    if (!from || !to) continue;
    const fromPts = getAttachPx(from);
    const toPts = getAttachPx(to);
    const p1 = fromPts[conn.fromPoint];
    const p2 = toPts[conn.toPoint];
    if (!p1 || !p2) continue;

    const g = document.createElementNS(NS, 'g');
    g.dataset.connId = conn.id;

    if (conn.snap) {
      // Snap connection: no line — just a red × above the attachment point to detach
      const del = document.createElementNS(NS, 'g');
      del.dataset.action = 'delete-conn';
      del.dataset.connId = conn.id;
      del.setAttribute('cursor', 'pointer');
      const dc = document.createElementNS(NS, 'circle');
      dc.setAttribute('cx', p1.x); dc.setAttribute('cy', p1.y - 12);
      dc.setAttribute('r', 7); dc.setAttribute('fill', '#ef476f');
      dc.setAttribute('stroke', '#fff'); dc.setAttribute('stroke-width', 1);
      const dt = document.createElementNS(NS, 'text');
      dt.setAttribute('x', p1.x); dt.setAttribute('y', p1.y - 12);
      dt.setAttribute('text-anchor', 'middle'); dt.setAttribute('dominant-baseline', 'middle');
      dt.setAttribute('fill', '#fff'); dt.setAttribute('font-size', 11); dt.textContent = '×';
      del.appendChild(dc); del.appendChild(dt);
      g.appendChild(del);
      layer.appendChild(g);
      continue;
    }

    const isCord = CORD_POINTS.has(conn.fromPoint) || CORD_POINTS.has(conn.toPoint)
                 || CORD_SUBTYPES.has(from.subtype) || CORD_SUBTYPES.has(to.subtype);
    if (from.subtype === 'matchboxTrack' && to.subtype === 'matchboxTrack') continue;

    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', p1.x); l.setAttribute('y1', p1.y);
    l.setAttribute('x2', p2.x); l.setAttribute('y2', p2.y);
    if (isCord) {
      l.setAttribute('stroke', '#ccc'); l.setAttribute('stroke-width', 2);
    } else {
      l.setAttribute('stroke', '#ff7b2e'); l.setAttribute('stroke-width', 2);
    }
    g.appendChild(l);

    // Delete button — red × at midpoint
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    const del = document.createElementNS(NS, 'g');
    del.dataset.action = 'delete-conn';
    del.dataset.connId = conn.id;
    del.setAttribute('cursor', 'pointer');
    const dc = document.createElementNS(NS, 'circle');
    dc.setAttribute('cx', mx); dc.setAttribute('cy', my);
    dc.setAttribute('r', 7); dc.setAttribute('fill', '#ef476f');
    dc.setAttribute('stroke', '#fff'); dc.setAttribute('stroke-width', 1);
    const dt = document.createElementNS(NS, 'text');
    dt.setAttribute('x', mx); dt.setAttribute('y', my);
    dt.setAttribute('text-anchor', 'middle'); dt.setAttribute('dominant-baseline', 'middle');
    dt.setAttribute('fill', '#fff'); dt.setAttribute('font-size', 11); dt.textContent = '×';
    del.appendChild(dc); del.appendChild(dt);
    g.appendChild(del);

    layer.appendChild(g);
  }

  // Draw in-progress connection drag
  const cd = getConnDrag();
  if (cd) {
    const fromComp = state.components.find(c => c.id === cd.fromId);
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
