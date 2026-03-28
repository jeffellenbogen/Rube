import { updateComponent, updateEnvItem, getState } from './state.js';
import { screenToCanvas, cmToPx, pxToCm, getFloorPx, getRoomDimensions } from './canvas.js';
import { push as undoPush } from './undo.js';
import { render } from './render/index.js';
import { findNearestAttachment, createConnection, deleteConnection } from './connections.js';
import { getSurfaces } from './render/environment.js';
import { getAttachPx } from './render/attachPoints.js';

// Subtypes that must keep their aspect ratio when resized
const LOCK_ASPECT = new Set([
  'domino', 'ball', 'toyCar', 'bucket', 'cup',
  'yardstick', 'box', 'pulley', 'wheelAxle', 'screw',
  'protractor', 'book', 'matchboxTrack',
]);

// Subtypes with custom min/max fractions of their default size (overrides global 7× max and MIN floor)
const SPECIAL_LIMITS = {
  yardstick:    { min: 0.5, max: 3.5 },
  matchboxTrack: { min: 0.5, max: 3.5 },
};

// Default dimensions (cm) per subtype — max resize = 7× these values
const DEFAULTS = {
  lever: { w: 60, h: 16 }, pulley: { w: 15, h: 20 }, inclinedPlane: { w: 80, h: 40 },
  wheelAxle: { w: 20, h: 20 }, wedge: { w: 20, h: 15 }, screw: { w: 10, h: 20 },
  domino: { w: 12, h: 24 }, ball: { w: 18, h: 18 }, toyCar: { w: 30, h: 18 },
  string: { w: 40, h: 2 }, cup: { w: 22, h: 16 }, bucket: { w: 20, h: 24 },
  tube: { w: 40, h: 10 }, box: { w: 24, h: 24 }, cardboard: { w: 120, h: 60 },
  yardstick: { w: 108, h: 6 }, protractor: { w: 20, h: 10 }, matchboxTrack: { w: 40, h: 8 },
  book: { w: 10, h: 30 }, custom: { w: 24, h: 24 },
};

let dragging = null;      // component drag: { id, isEnv, startCanvasX, startCanvasY, compX, compY }
let connDrag = null;      // connection drag: { fromId, fromPoint, curPx, curPy }
let handleDrag = null;    // { type, compId, startPx, startPy, origValue }
let selected = null;
let hasMoved = false;     // tracks whether current drag has actually moved

export function getSelected() { return selected; }
export function setSelected(id) { selected = id; }

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
  return lever.y + fy * lever.height - thick; // top surface of bar at this X
}

function snapToSurface(comp, newX, newY, shiftHeld) {
  if (shiftHeld) return { x: newX, y: newY };
  const state = getState();
  const allSurfaces = state.environment.flatMap(item => getSurfaces(item));
  // Add top edges of other components as snap surfaces — but skip same-subtype
  // books so they don't stack on each other vertically
  for (const other of state.components) {
    if (other.id === comp.id) continue;
    if (other.subtype === 'start' || other.subtype === 'finish' || other.subtype === 'marker') continue;
    if (comp.subtype === 'book' && other.subtype === 'book') continue;
    allSurfaces.push({ x1: other.x, x2: other.x + other.width, y: other.y });
  }
  allSurfaces.push({ x1: 0, x2: 99999, y: pxToCm(getFloorPx()) });

  const compBottom = newY + comp.height;
  const compMidX = newX + comp.width / 2;
  const snapDist = 5;

  // Check lever bar surface (tilted) — uses interpolated Y at compMidX
  for (const other of state.components) {
    if (other.id === comp.id || other.subtype !== 'lever') continue;
    if (compMidX < other.x || compMidX > other.x + other.width) continue;
    const leverY = getLeverBarTopY(other, compMidX);
    allSurfaces.push({ x1: other.x, x2: other.x + other.width, y: leverY });
  }

  const nearby = allSurfaces.filter(s =>
    s.x1 <= compMidX && s.x2 >= compMidX &&
    s.y >= compBottom - snapDist && s.y <= compBottom + snapDist
  ).sort((a, b) => Math.abs(a.y - compBottom) - Math.abs(b.y - compBottom));

  let snappedX = newX;
  let snappedY = nearby.length > 0 ? nearby[0].y - comp.height : newY;

  // Side-by-side snap for books: align flush horizontally, no overlap
  if (comp.subtype === 'book') {
    const sideDist = comp.width * 1.2; // snap zone roughly one book-width
    for (const other of state.components) {
      if (other.id === comp.id || other.subtype !== 'book') continue;
      if (Math.abs(snappedY - other.y) > snapDist) continue; // must be on same shelf level
      const gapRight = Math.abs(snappedX - (other.x + other.width)); // my left near their right
      const gapLeft  = Math.abs((snappedX + comp.width) - other.x);  // my right near their left
      if (gapRight < sideDist && gapRight <= gapLeft) {
        snappedX = other.x + other.width;
        snappedY = other.y;
        break;
      } else if (gapLeft < sideDist) {
        snappedX = other.x - comp.width;
        snappedY = other.y;
        break;
      }
    }
  }

  return { x: snappedX, y: snappedY };
}

export function initDrag(svgEl) {
  svgEl.addEventListener('mousedown', e => {
    // Let action buttons (delete, comment) be handled by the click event
    if (e.target.closest('[data-action]')) return;

    // Check for sub-part/resize handle
    if (e.target.dataset.handle) {
      const handle = e.target.dataset.handle;
      const compId = e.target.dataset.compId;
      const state = getState();
      const comp = state.components.find(c => c.id === compId);
      if (comp) {
        const rect = svgEl.getBoundingClientRect();
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const centerX = comp.x + comp.width / 2;
        const centerY = comp.y + comp.height / 2;
        handleDrag = {
          type: handle,
          compId,
          startPx: e.clientX - rect.left,
          startPy: e.clientY - rect.top,
          origSubParts: { ...comp.subParts },
          compX: cmToPx(comp.x), compY: cmToPx(comp.y),
          compW: cmToPx(comp.width), compH: cmToPx(comp.height),
          origW: comp.width, origH: comp.height,
          origX: comp.x, origY: comp.y,
          lockAspect: LOCK_ASPECT.has(comp.subtype),
          aspectRatio: comp.height / comp.width,
          minW: SPECIAL_LIMITS[comp.subtype] ? (DEFAULTS[comp.subtype]?.w ?? 0) * SPECIAL_LIMITS[comp.subtype].min : MIN,
          maxW: (DEFAULTS[comp.subtype]?.w ?? Infinity) * (SPECIAL_LIMITS[comp.subtype]?.max ?? 7),
          maxH: (DEFAULTS[comp.subtype]?.h ?? Infinity) * (SPECIAL_LIMITS[comp.subtype]?.max ?? 7),
          // free-rotate fields
          centerX, centerY,
          origRotation: comp.rotation || 0,
          startAngle: Math.atan2(canvasPos.y - centerY, canvasPos.x - centerX) * 180 / Math.PI,
        };
        hasMoved = false;
        e.stopPropagation();
        return;
      }
    }

    // Check for attachment point drag first
    if (e.target.dataset.attachPoint) {
      const compId = e.target.dataset.compId;
      const pointName = e.target.dataset.attachPoint;
      const startPos = screenToCanvas(e.clientX, e.clientY);
      connDrag = { fromId: compId, fromPoint: pointName, curPx: cmToPx(startPos.x), curPy: cmToPx(startPos.y) };
      e.stopPropagation();
      return;
    }

    const comp = e.target.closest('[data-id]');
    if (!comp) { selected = null; render(); return; }
    const id = comp.dataset.id;
    const state = getState();
    const item = state.components.find(c => c.id === id) || state.environment.find(ev => ev.id === id);
    if (!item) return;

    // Pulley: clicks near cord ends start a cord handle drag (not body drag)
    if (item.subtype === 'pulley') {
      const rect = svgEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left, clickY = e.clientY - rect.top;
      const pts = getAttachPx(item);
      for (const name of ['cordLeft', 'cordRight']) {
        const pt = pts[name];
        if (pt && Math.hypot(clickX - pt.x, clickY - pt.y) < 20) {
          selected = id;
          render();
          handleDrag = {
            type: name,
            compId: id,
            startPx: clickX,
            startPy: clickY,
            origSubParts: { ...item.subParts },
            compX: cmToPx(item.x), compY: cmToPx(item.y),
            compW: cmToPx(item.width), compH: cmToPx(item.height),
            origW: item.width, origH: item.height,
            origX: item.x, origY: item.y,
          };
          hasMoved = false;
          e.stopPropagation();
          return;
        }
      }
    }

    selected = id;
    render();
    const pos = screenToCanvas(e.clientX, e.clientY);
    dragging = { id, isEnv: !!state.environment.find(ev => ev.id === id), startCanvasX: pos.x, startCanvasY: pos.y, compX: item.x, compY: item.y };
    hasMoved = false;
    window.__dragActive = true;
    e.stopPropagation();
  });

  window.addEventListener('mousemove', e => {
    if (handleDrag) {
      if (!hasMoved) { undoPush(); hasMoved = true; }
      const rect = svgEl.getBoundingClientRect();
      const curPx = e.clientX - rect.left;
      const curPy = e.clientY - rect.top;
      const dx = curPx - handleDrag.startPx;
      const dy = curPy - handleDrag.startPy;

      const state = getState();
      const comp = state.components.find(c => c.id === handleDrag.compId);
      if (!comp) { handleDrag = null; return; }

      if (handleDrag.type === 'free-rotate') {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const currentAngle = Math.atan2(canvasPos.y - handleDrag.centerY, canvasPos.x - handleDrag.centerX) * 180 / Math.PI;
        const newRotation = (handleDrag.origRotation + currentAngle - handleDrag.startAngle) % 360;
        updateComponent(handleDrag.compId, { rotation: newRotation });
      } else if (handleDrag.type === 'fulcrum') {
        const newOffset = Math.max(0.05, Math.min(0.95, (curPx - handleDrag.compX) / handleDrag.compW));
        updateComponent(handleDrag.compId, { subParts: { ...comp.subParts, fulcrumOffset: newOffset } });
      } else if (handleDrag.type === 'angle') {
        const dyCm = pxToCm(dy);
        const wCm = comp.width;
        const newAngle = Math.max(5, Math.min(80, Math.atan2(-dyCm, wCm) * 180 / Math.PI));
        updateComponent(handleDrag.compId, { subParts: { ...comp.subParts, angle: newAngle } });
      } else if (handleDrag.type === 'cordLeft') {
        const r = Math.min(handleDrag.compW, handleDrag.compH) * 0.35;
        const originX = handleDrag.compX + handleDrag.compW / 2 - r * 0.7;
        const originY = handleDrag.compY + handleDrag.compH * 0.3;
        const dx2 = curPx - originX, dy2 = curPy - originY;
        const newAngle = Math.atan2(dx2, dy2) * 180 / Math.PI;
        const newLen = Math.max(5, pxToCm(Math.hypot(dx2, dy2)));
        updateComponent(handleDrag.compId, { subParts: { ...comp.subParts, leftCordAngle: newAngle, leftCordLength: newLen } });
      } else if (handleDrag.type === 'cordRight') {
        const r = Math.min(handleDrag.compW, handleDrag.compH) * 0.35;
        const originX = handleDrag.compX + handleDrag.compW / 2 + r * 0.7;
        const originY = handleDrag.compY + handleDrag.compH * 0.3;
        const dx2 = curPx - originX, dy2 = curPy - originY;
        const newAngle = Math.atan2(dx2, dy2) * 180 / Math.PI;
        const newLen = Math.max(5, pxToCm(Math.hypot(dx2, dy2)));
        updateComponent(handleDrag.compId, { subParts: { ...comp.subParts, rightCordAngle: newAngle, rightCordLength: newLen } });
      } else if (handleDrag.type.startsWith('resize-')) {
        const corner = handleDrag.type.slice(7); // 'nw', 'ne', 'sw', 'se'
        const dxCm = pxToCm(dx), dyCm = pxToCm(dy);
        let newW = handleDrag.origW, newH = handleDrag.origH;
        let newX = handleDrag.origX, newY = handleDrag.origY;
        const MIN = 11; // cm — keeps components large enough to click on

        const { maxW, maxH } = handleDrag;

        if (corner === 'se') {
          newW = Math.min(maxW, Math.max(MIN, handleDrag.origW + dxCm));
          newH = Math.min(maxH, Math.max(MIN, handleDrag.origH + dyCm));
        } else if (corner === 'sw') {
          newW = Math.min(maxW, Math.max(MIN, handleDrag.origW - dxCm));
          newH = Math.min(maxH, Math.max(MIN, handleDrag.origH + dyCm));
          newX = handleDrag.origX + handleDrag.origW - newW;
        } else if (corner === 'ne') {
          newW = Math.min(maxW, Math.max(MIN, handleDrag.origW + dxCm));
          newH = Math.min(maxH, Math.max(MIN, handleDrag.origH - dyCm));
          newY = handleDrag.origY + handleDrag.origH - newH;
        } else if (corner === 'nw') {
          newW = Math.min(maxW, Math.max(MIN, handleDrag.origW - dxCm));
          newH = Math.min(maxH, Math.max(MIN, handleDrag.origH - dyCm));
          newX = handleDrag.origX + handleDrag.origW - newW;
          newY = handleDrag.origY + handleDrag.origH - newH;
        }

        // Lock aspect ratio for components that have a fixed physical shape.
        // Drive from width; height follows. Do NOT enforce height MIN — for wide
        // items (car track, yardstick) the height is naturally smaller than 11cm
        // and forcing it up causes the width to jump to unreasonably large values.
        if (handleDrag.lockAspect) {
          newW = Math.max(handleDrag.minW, Math.min(maxW, newW));
          newH = newW * handleDrag.aspectRatio;
          if (newH > maxH) { newH = maxH; newW = newH / handleDrag.aspectRatio; }
          // Recalculate anchor-edge positions after aspect-ratio correction
          if (corner === 'sw' || corner === 'nw') newX = handleDrag.origX + handleDrag.origW - newW;
          if (corner === 'ne' || corner === 'nw') newY = handleDrag.origY + handleDrag.origH - newH;
        }

        updateComponent(handleDrag.compId, { x: newX, y: newY, width: newW, height: newH });
      }
      render();
      return;
    }

    if (connDrag) {
      const movePos = screenToCanvas(e.clientX, e.clientY);
      connDrag.curPx = cmToPx(movePos.x);
      connDrag.curPy = cmToPx(movePos.y);
      render();
      return;
    }
    if (!dragging) return;
    if (!hasMoved) { undoPush(); hasMoved = true; }
    const pos = screenToCanvas(e.clientX, e.clientY);
    const dx = pos.x - dragging.startCanvasX, dy = pos.y - dragging.startCanvasY;
    const newX = dragging.compX + dx, newY = dragging.compY + dy;
    const state = getState();
    const comp = state.components.find(c => c.id === dragging.id);
    let snapped;
    if (comp && (comp.subtype === 'start' || comp.subtype === 'finish')) {
      const { roomW } = getRoomDimensions();
      const maxY = pxToCm(getFloorPx());
      snapped = {
        x: Math.max(0, Math.min(roomW - comp.width, newX)),
        y: Math.max(0, Math.min(maxY - comp.height, newY)),
      };
    } else {
      snapped = (!dragging.isEnv && comp) ? snapToSurface(comp, newX, newY, e.shiftKey) : { x: newX, y: newY };
    }
    if (dragging.isEnv) updateEnvItem(dragging.id, { x: snapped.x, y: snapped.y });
    else updateComponent(dragging.id, { x: snapped.x, y: snapped.y });
    render();
  });

  window.addEventListener('mouseup', e => {
    const rect = svgEl.getBoundingClientRect();
    const upX = e.clientX - rect.left, upY = e.clientY - rect.top;

    if (handleDrag) {
      // Cord ends: snap-connect to nearest attachment point on release
      if (handleDrag.type === 'cordLeft' || handleDrag.type === 'cordRight') {
        const state = getState();
        const comp = state.components.find(c => c.id === handleDrag.compId);
        const nearest = findNearestAttachment(state, upX, upY, handleDrag.compId, 20);
        // If released without connecting, clear any existing cord connection
      if (!nearest) {
        const existing = state.connections.find(c =>
          (c.fromId === handleDrag.compId && c.fromPoint === handleDrag.type) ||
          (c.toId   === handleDrag.compId && c.toPoint   === handleDrag.type)
        );
        if (existing) { undoPush(); deleteConnection(existing.id); render(); }
      }
      if (nearest && comp) {
          // Remove any existing connection for this cord end
          const existing = state.connections.find(c =>
            (c.fromId === handleDrag.compId && c.fromPoint === handleDrag.type) ||
            (c.toId   === handleDrag.compId && c.toPoint   === handleDrag.type)
          );
          if (existing) deleteConnection(existing.id);
          createConnection(handleDrag.compId, handleDrag.type, nearest.compId, nearest.pointName);
          // Sync cord angle/length to the connected position so the ball renders correctly
          const targetComp = state.components.find(c => c.id === nearest.compId);
          if (targetComp) {
            const targetPos = getAttachPx(targetComp)[nearest.pointName];
            if (targetPos) {
              const r = Math.min(handleDrag.compW, handleDrag.compH) * 0.35;
              const isLeft = handleDrag.type === 'cordLeft';
              const ox = handleDrag.compX + handleDrag.compW / 2 + (isLeft ? -r * 0.7 : r * 0.7);
              const oy = handleDrag.compY + handleDrag.compH * 0.3;
              const angle = Math.atan2(targetPos.x - ox, targetPos.y - oy) * 180 / Math.PI;
              const len = Math.max(5, pxToCm(Math.hypot(targetPos.x - ox, targetPos.y - oy)));
              const key = isLeft
                ? { leftCordAngle: angle, leftCordLength: len }
                : { rightCordAngle: angle, rightCordLength: len };
              updateComponent(handleDrag.compId, { subParts: { ...comp.subParts, ...key } });
            }
          }
          render();
        }
      }
      handleDrag = null;
      hasMoved = false;
      return;
    }
    if (connDrag) {
      const upPos = screenToCanvas(e.clientX, e.clientY);
      const state = getState();
      const nearest = findNearestAttachment(state, cmToPx(upPos.x), cmToPx(upPos.y), connDrag.fromId);
      if (nearest) {
        undoPush();
        createConnection(connDrag.fromId, connDrag.fromPoint, nearest.compId, nearest.pointName);
        render();
      }
      connDrag = null;
      render();
      return;
    }
    if (dragging) {
      const dragId = dragging.id;
      const wasEnv = dragging.isEnv;
      dragging = null; window.__dragActive = false; hasMoved = false;
      // Component body drag: check mouse release position against all attachment points (40px radius).
      // Find target connector near where the user dropped, then pair with closest point on dragged comp.
      if (!wasEnv) {
        const state = getState();
        const nearest = findNearestAttachment(state, upX, upY, dragId, 16);
        if (nearest) {
          const comp = state.components.find(c => c.id === dragId);
          const targetComp = state.components.find(c => c.id === nearest.compId);
          if (comp && targetComp) {
            const targetPos = getAttachPx(targetComp)[nearest.pointName];
            const myPts = getAttachPx(comp);
            let bestPt = null, bestDist = Infinity;
            for (const [ptName, ptPos] of Object.entries(myPts)) {
              const d = Math.hypot(ptPos.x - targetPos.x, ptPos.y - targetPos.y);
              if (d < bestDist) { bestDist = d; bestPt = ptName; }
            }
            if (bestPt) {
              // Shift the component so its attach point aligns exactly with the target connector
              const fromPos = myPts[bestPt];
              updateComponent(dragId, {
                x: comp.x + pxToCm(targetPos.x - fromPos.x),
                y: comp.y + pxToCm(targetPos.y - fromPos.y),
              });
              createConnection(dragId, bestPt, nearest.compId, nearest.pointName, true);
              render();
            }
          }
        }
      }
    }
  });
}

export function getConnDrag() { return connDrag; }
