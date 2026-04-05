import { updateComponent, updateEnvItem, getState, addComponent, addEnvItem, addConnection } from './state.js';
import { screenToCanvas, cmToPx, pxToCm, getFloorPx, getRoomDimensions } from './canvas.js';
import { push as undoPush } from './undo.js';
import { render } from './render/index.js';
import { findNearestAttachment, createConnection, deleteConnection } from './connections.js';
import { getSurfaces } from './render/environment.js';
import { getAttachPx, getSnapPx } from './render/attachPoints.js';
import { getItemsInRect } from './multi-select.js';

// Subtypes that must keep their aspect ratio when resized
const CORD_POINTS = new Set(['cordLeft', 'cordRight', 'end1', 'end2']);

const LOCK_ASPECT = new Set([
  'domino', 'ball', 'toyCar', 'bucket', 'cup',
  'yardstick', 'box', 'pulley', 'wheelAxle', 'screw',
  'protractor', 'book', 'flag',
  'fan', 'rubiksCube', 'dumpTruck', 'funnel', 'spring', 'person',
]);

// Subtypes that only allow horizontal resizing (height is locked)
const LOCK_HEIGHT = new Set(['matchboxTrack']);

// Subtypes with custom min/max fractions of their default size (overrides global 7× max and MIN floor)
const SPECIAL_LIMITS = {
  yardstick:    { min: 0.5, max: 3.5 },
  matchboxTrack: { min: 0.5, max: 5 },
  flag:         { min: 0.75, max: 3 },
  dumpTruck:    { min: 0.8, max: 8 },
  fan:          { min: 0.5, max: 4 },
  spring:       { min: 0.8, max: 5 },
  funnel:       { min: 0.5, max: 4 },
  rubiksCube:   { min: 1, max: 5 },
  person:       { min: 1, max: 5 },
};

const MIN = 11; // cm — keeps components large enough to click on

// Default dimensions (cm) per subtype — max resize = 7× these values
const DEFAULTS = {
  lever: { w: 60, h: 16 }, pulley: { w: 15, h: 20 }, inclinedPlane: { w: 80, h: 40 },
  wheelAxle: { w: 20, h: 20 }, wedge: { w: 20, h: 15 }, screw: { w: 10, h: 20 },
  domino: { w: 12, h: 24 }, ball: { w: 18, h: 18 }, toyCar: { w: 30, h: 18 },
  string: { w: 40, h: 2 }, cup: { w: 22, h: 16 }, bucket: { w: 20, h: 24 },
  tube: { w: 40, h: 10 }, box: { w: 24, h: 24 }, cardboard: { w: 120, h: 60 },
  yardstick: { w: 108, h: 6 }, protractor: { w: 20, h: 10 }, matchboxTrack: { w: 40, h: 8 },
  book: { w: 10, h: 30 }, custom: { w: 24, h: 24 }, flag: { w: 8, h: 24 },
  dumpTruck: { w: 50, h: 24 }, funnel: { w: 15, h: 20 }, rubiksCube: { w: 24, h: 24 },
  fan: { w: 36, h: 40 }, spring: { w: 10, h: 20 }, person: { w: 40, h: 60 },
};

let dragging   = null;    // component drag: { id, isEnv, startCanvasX, startCanvasY, compX, compY }
let connDrag   = null;    // connection drag: { fromId, fromPoint, curPx, curPy }
let handleDrag = null;    // { type, compId, startPx, startPy, origValue }
let selectedIds = [];     // replaces selected — 0=none, 1=single-select, 2+=multi-select
let rubberBand  = null;   // { startX, startY, currentX, currentY } in canvas cm, or null
let groupDrag   = null;   // { startX, startY, startPositions: Map<id,{x,y,...}> } or null
let hasMoved = false;     // tracks whether current drag has actually moved
let clipboard   = null;   // { items: Array<{data, isEnv, originalId}>, connections: Array } or null
let pasteOffset = 0;      // increments each paste without a new copy; resets on copySelection()

// Backward-compatible single-select accessors (action buttons, handles still use these)
export function getSelected()       { return selectedIds[0] ?? null; }
export function setSelected(id)     { selectedIds = id ? [id] : []; }

// Multi-select accessors
export function getSelectedIds()    { return selectedIds; }
export function setSelectedIds(ids) { selectedIds = [...ids]; }

// Rubber-band rect for renderer (cm coordinates, or null)
export function getRubberBand()     { return rubberBand; }

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

    // Symbolic connection line click — add/remove conn ID from selectedIds
    const connEl = e.target.closest('[data-conn-id]');
    if (connEl) {
      const connId = connEl.dataset.connId;
      const state = getState();
      const conn = state.connections.find(c => c.id === connId);
      if (conn && !conn.snap && !CORD_POINTS.has(conn.fromPoint) && !CORD_POINTS.has(conn.toPoint)) {
        if (e.shiftKey) {
          const idx = selectedIds.indexOf(connId);
          selectedIds = idx >= 0 ? selectedIds.filter(s => s !== connId) : [...selectedIds, connId];
        } else {
          selectedIds = [connId];
        }
        render();
        e.stopPropagation();
        return;
      }
    }

    // Check for sub-part/resize handle (use closest so grouped handles like free-rotate work)
    const handleEl = e.target.closest('[data-handle]');
    if (handleEl) {
      const handle = handleEl.dataset.handle;
      const compId = handleEl.dataset.compId;
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
          lockHeight: LOCK_HEIGHT.has(comp.subtype),
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
      if (!comp) {
        const envId = handleEl.dataset.envId;
        const envItem = envId && state.environment.find(e => e.id === envId);
        if (envItem && handle.startsWith('resize-')) {
          const rect = svgEl.getBoundingClientRect();
          handleDrag = {
            type: handle,
            compId: envId,
            isEnv: true,
            startPx: e.clientX - rect.left,
            startPy: e.clientY - rect.top,
            origSubParts: {},
            compX: cmToPx(envItem.x), compY: cmToPx(envItem.y),
            compW: cmToPx(envItem.width), compH: cmToPx(envItem.height),
            origW: envItem.width, origH: envItem.height,
            origX: envItem.x, origY: envItem.y,
            lockAspect: false,
            maxW: envItem.subtype === 'wall' ? Infinity : envItem.width * 7,
            maxH: envItem.subtype === 'wall' ? Infinity : envItem.height * 7,
            centerX: envItem.x + envItem.width / 2,
            centerY: envItem.y + envItem.height / 2,
            origRotation: 0,
            startAngle: 0,
          };
          hasMoved = false;
          e.stopPropagation();
          return;
        }
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

    // No component hit — start rubber-band (or clear selection if no shift)
    if (!comp) {
      if (!e.shiftKey) selectedIds = [];
      const pos = screenToCanvas(e.clientX, e.clientY);
      rubberBand = { startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y };
      render();
      return;
    }

    const id = comp.dataset.id;
    const state = getState();
    const item = state.components.find(c => c.id === id) || state.environment.find(ev => ev.id === id);
    if (!item) return;

    // Shift-click: toggle this component in/out of selectedIds
    if (e.shiftKey) {
      const idx = selectedIds.indexOf(id);
      selectedIds = idx >= 0 ? selectedIds.filter(s => s !== id) : [...selectedIds, id];
      render();
      e.stopPropagation();
      return;
    }

    // Pulley: clicks near cord ends start a cord handle drag (not body drag),
    // even when the pulley is part of a multi-selection.
    if (item.subtype === 'pulley') {
      const rect = svgEl.getBoundingClientRect();
      const clickCanvas = screenToCanvas(e.clientX, e.clientY);
      const clickSvgX = cmToPx(clickCanvas.x);
      const clickSvgY = cmToPx(clickCanvas.y);
      const pts = getAttachPx(item);
      for (const name of ['cordLeft', 'cordRight']) {
        const pt = pts[name];
        if (pt && Math.hypot(clickSvgX - pt.x, clickSvgY - pt.y) < 20) {
          selectedIds = [id];
          render();
          handleDrag = {
            type: name,
            compId: id,
            startPx: e.clientX - rect.left,
            startPy: e.clientY - rect.top,
            origSubParts: { ...item.subParts },
            compX: cmToPx(item.x), compY: cmToPx(item.y),
            compW: cmToPx(item.width), compH: cmToPx(item.height),
            origW: item.width, origH: item.height,
            origX: item.x, origY: item.y,
            disconnected: false,
          };
          hasMoved = false;
          e.stopPropagation();
          return;
        }
      }
    }

    // String: clicks near end handles start an end handle drag (not body drag),
    // even when the string is part of a multi-selection.
    if (item.subtype === 'string') {
      const svgRect = svgEl.getBoundingClientRect();
      const clickCanvas = screenToCanvas(e.clientX, e.clientY);
      const clickSvgX = cmToPx(clickCanvas.x);
      const clickSvgY = cmToPx(clickCanvas.y);
      const sp = item.subParts || {};
      const ex1 = cmToPx(sp.x1 ?? item.x);
      const ey1 = cmToPx(sp.y1 ?? (item.y + item.height / 2));
      const ex2 = cmToPx(sp.x2 ?? (item.x + item.width));
      const ey2 = cmToPx(sp.y2 ?? (item.y + item.height / 2));
      for (const [name, ex, ey] of [['end1', ex1, ey1], ['end2', ex2, ey2]]) {
        if (Math.hypot(clickSvgX - ex, clickSvgY - ey) < 20) {
          selectedIds = [id];
          render();
          handleDrag = {
            type: name,
            compId: id,
            startPx: e.clientX - svgRect.left,
            startPy: e.clientY - svgRect.top,
            origSubParts: { ...sp },
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

    // Group drag: component is already part of a multi-selection
    if (selectedIds.length > 1 && selectedIds.includes(id)) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const startPositions = new Map();
      for (const sid of selectedIds) {
        // Connections follow their endpoint components — skip conn IDs, no position to track
        if (state.connections.find(c => c.id === sid)) continue;
        const sc = state.components.find(c => c.id === sid) || state.environment.find(e => e.id === sid);
        if (!sc) continue;
        if (sc.wallLocked) continue; // locked walls don't move in group drag
        const entry = { x: sc.x, y: sc.y, isEnv: !!state.environment.find(e => e.id === sid) };
        if (sc.subtype === 'string' && sc.subParts) {
          entry.isString = true;
          entry.origSubParts = { ...sc.subParts };
          entry.strX1 = sc.subParts.x1 ?? sc.x;
          entry.strY1 = sc.subParts.y1 ?? (sc.y + sc.height / 2);
          entry.strX2 = sc.subParts.x2 ?? (sc.x + sc.width);
          entry.strY2 = sc.subParts.y2 ?? (sc.y + sc.height / 2);
        }
        startPositions.set(sid, entry);
      }
      groupDrag = { startX: pos.x, startY: pos.y, startPositions };
      hasMoved = false;
      window.__dragActive = true;
      e.stopPropagation();
      return;
    }

    // Normal single-select
    selectedIds = [id];
    render();
    // Locked walls: select on click so user can access swatches/unlock, but don't drag
    if (item.wallLocked) {
      e.stopPropagation();
      return;
    }
    const pos = screenToCanvas(e.clientX, e.clientY);
    const isEnvItem = !!state.environment.find(ev => ev.id === id);
    dragging = { id, isEnv: isEnvItem, startCanvasX: pos.x, startCanvasY: pos.y, compX: item.x, compY: item.y };
    // String: store original endpoint positions so body drag shifts them correctly
    if (!isEnvItem && item.subtype === 'string') {
      const sp = item.subParts || {};
      dragging.origSubParts = { ...sp };
      dragging.strX1 = sp.x1 ?? item.x;
      dragging.strY1 = sp.y1 ?? (item.y + item.height / 2);
      dragging.strX2 = sp.x2 ?? (item.x + item.width);
      dragging.strY2 = sp.y2 ?? (item.y + item.height / 2);
    }
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
      const envItem = handleDrag.isEnv ? state.environment.find(e => e.id === handleDrag.compId) : null;
      if (!comp && !envItem) { handleDrag = null; return; }

      if (handleDrag.type === 'end1' || handleDrag.type === 'end2') {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const sp = comp.subParts || {};
        if (handleDrag.type === 'end1') {
          updateComponent(handleDrag.compId, { subParts: { ...sp, x1: canvasPos.x, y1: canvasPos.y } });
        } else {
          updateComponent(handleDrag.compId, { subParts: { ...sp, x2: canvasPos.x, y2: canvasPos.y } });
        }
      } else if (handleDrag.type === 'free-rotate') {
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
      } else if (handleDrag.type === 'cordLeft' || handleDrag.type === 'cordRight') {
        // Disconnect existing connection on first move so the cord follows the mouse
        if (!handleDrag.disconnected) {
          handleDrag.disconnected = true;
          const existing = getState().connections.find(c =>
            (c.fromId === handleDrag.compId && c.fromPoint === handleDrag.type) ||
            (c.toId   === handleDrag.compId && c.toPoint   === handleDrag.type)
          );
          if (existing) deleteConnection(existing.id);
        }
        const isLeft = handleDrag.type === 'cordLeft';
        const mousePos = screenToCanvas(e.clientX, e.clientY);
        const rCm = Math.min(comp.width, comp.height) * 0.35;
        const originXcm = comp.x + comp.width / 2 + (isLeft ? -rCm * 0.7 : rCm * 0.7);
        const originYcm = comp.y + comp.height * 0.3;
        const dxCm = mousePos.x - originXcm;
        const dyCm = mousePos.y - originYcm;
        const newAngle = Math.atan2(dxCm, dyCm) * 180 / Math.PI;
        const newLen = Math.max(5, Math.hypot(dxCm, dyCm));
        const key = isLeft
          ? { leftCordAngle: newAngle, leftCordLength: newLen }
          : { rightCordAngle: newAngle, rightCordLength: newLen };
        updateComponent(handleDrag.compId, { subParts: { ...comp.subParts, ...key } });
      } else if (handleDrag.type.startsWith('resize-')) {
        const corner = handleDrag.type.slice(7); // 'nw', 'ne', 'sw', 'se'
        // Project screen drag delta onto component's local axes so resize works
        // correctly at any rotation angle (pulling outward always grows the component).
        const rad = handleDrag.isEnv ? 0 : (comp.rotation || 0) * Math.PI / 180;
        const fX = handleDrag.isEnv ? 1 : (comp.flipped ? -1 : 1);
        const dxCm = pxToCm(dx * fX * Math.cos(rad) + dy * Math.sin(rad));
        const dyCm = pxToCm(-dx * fX * Math.sin(rad) + dy * Math.cos(rad));
        let newW = handleDrag.origW, newH = handleDrag.origH;
        let newX = handleDrag.origX, newY = handleDrag.origY;

        const { maxW, maxH } = handleDrag;
        // MIN is defined at module level (const MIN = 11)

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

        // Lock height for components that only resize horizontally
        if (handleDrag.lockHeight) {
          newH = handleDrag.origH;
          newY = handleDrag.origY;
        }

        // Lock aspect ratio for components that have a fixed physical shape.
        // Drive from width; height follows. Do NOT enforce height MIN — for wide
        // items (yardstick) the height is naturally smaller than 11cm
        // and forcing it up causes the width to jump to unreasonably large values.
        if (handleDrag.lockAspect) {
          newW = Math.max(handleDrag.minW, Math.min(maxW, newW));
          newH = newW * handleDrag.aspectRatio;
          if (newH > maxH) { newH = maxH; newW = newH / handleDrag.aspectRatio; }
          // Recalculate anchor-edge positions after aspect-ratio correction
          if (corner === 'sw' || corner === 'nw') newX = handleDrag.origX + handleDrag.origW - newW;
          if (corner === 'ne' || corner === 'nw') newY = handleDrag.origY + handleDrag.origH - newH;
        }

        if (handleDrag.isEnv) {
          updateEnvItem(handleDrag.compId, { x: newX, y: newY, width: newW, height: newH });
        } else {
          updateComponent(handleDrag.compId, { x: newX, y: newY, width: newW, height: newH });
        }
      }
      render();
      return;
    }

    if (connDrag) {
      if (e.buttons === 0) { connDrag = null; rubberBand = null; render(); return; }
      const movePos = screenToCanvas(e.clientX, e.clientY);
      connDrag.curPx = cmToPx(movePos.x);
      connDrag.curPy = cmToPx(movePos.y);
      render();
      return;
    }

    if (rubberBand) {
      if (e.buttons === 0) { rubberBand = null; render(); return; }
      const pos = screenToCanvas(e.clientX, e.clientY);
      rubberBand.currentX = pos.x;
      rubberBand.currentY = pos.y;
      render();
      return;
    }

    if (groupDrag) {
      if (!hasMoved) { undoPush(); hasMoved = true; }
      const pos = screenToCanvas(e.clientX, e.clientY);
      const dx = pos.x - groupDrag.startX;
      const dy = pos.y - groupDrag.startY;
      for (const [sid, orig] of groupDrag.startPositions) {
        if (orig.isString) {
          updateComponent(sid, {
            x: orig.x + dx, y: orig.y + dy,
            subParts: {
              ...orig.origSubParts,
              x1: orig.strX1 + dx, y1: orig.strY1 + dy,
              x2: orig.strX2 + dx, y2: orig.strY2 + dy,
            },
          });
        } else if (orig.isEnv) {
          updateEnvItem(sid, { x: orig.x + dx, y: orig.y + dy });
        } else {
          updateComponent(sid, { x: orig.x + dx, y: orig.y + dy });
        }
      }
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
      // Strings float freely — skip surface snapping
      const skipSnap = dragging.isEnv || !comp || comp.subtype === 'string';
      snapped = skipSnap ? { x: newX, y: newY } : snapToSurface(comp, newX, newY, e.shiftKey);
    }
    if (dragging.isEnv) {
      updateEnvItem(dragging.id, { x: snapped.x, y: snapped.y });
    } else if (dragging.strX1 !== undefined) {
      // String body drag: shift both endpoints by the same delta as the component
      const dxCm = snapped.x - dragging.compX;
      const dyCm = snapped.y - dragging.compY;
      updateComponent(dragging.id, {
        x: snapped.x, y: snapped.y,
        subParts: {
          ...dragging.origSubParts,
          x1: dragging.strX1 + dxCm, y1: dragging.strY1 + dyCm,
          x2: dragging.strX2 + dxCm, y2: dragging.strY2 + dyCm,
        },
      });
    } else {
      updateComponent(dragging.id, { x: snapped.x, y: snapped.y });
    }
    render();
  });

  window.addEventListener('mouseup', e => {
    const rect = svgEl.getBoundingClientRect();
    const upX = e.clientX - rect.left, upY = e.clientY - rect.top;

    if (handleDrag) {
      // String ends: snap to nearest connector on release
      if (handleDrag.type === 'end1' || handleDrag.type === 'end2') {
        const state = getState();
        const comp = state.components.find(c => c.id === handleDrag.compId);
        // Remove existing connection for this end
        const existing = state.connections.find(c =>
          (c.fromId === handleDrag.compId && c.fromPoint === handleDrag.type) ||
          (c.toId   === handleDrag.compId && c.toPoint   === handleDrag.type)
        );
        if (existing) deleteConnection(existing.id);
        // Fix: use world-pixel coordinates (matches getSnapPx space at any zoom level)
        const upCanvas = screenToCanvas(e.clientX, e.clientY);
        const nearest = findNearestAttachment(state, cmToPx(upCanvas.x), cmToPx(upCanvas.y), handleDrag.compId, 20);
        if (nearest && comp) {
          const targetComp = [...state.components, ...(state.environment || [])].find(c => c.id === nearest.compId);
          if (targetComp) {
            const sp = comp.subParts || {};
            const isEnd1 = handleDrag.type === 'end1';
            // When connecting to a pulley cord end: keep string end where user dropped it,
            // then aim the pulley cord toward that position.
            if (targetComp.subtype === 'pulley' && (nearest.pointName === 'cordLeft' || nearest.pointName === 'cordRight')) {
              // String end stays at its current drag position (upCanvas)
              // Aim target pulley cord from its wheel origin toward the string end
              const isLeft = nearest.pointName === 'cordLeft';
              const rCm = Math.min(targetComp.width, targetComp.height) * 0.35;
              const originXcm = targetComp.x + targetComp.width  / 2 + (isLeft ? -rCm * 0.7 : rCm * 0.7);
              const originYcm = targetComp.y + targetComp.height * 0.3;
              const endXcm = isEnd1 ? (sp.x1 ?? comp.x) : (sp.x2 ?? comp.x + comp.width);
              const endYcm = isEnd1 ? (sp.y1 ?? comp.y) : (sp.y2 ?? comp.y);
              const dxCm = endXcm - originXcm;
              const dyCm = endYcm - originYcm;
              const newAngle = Math.atan2(dxCm, dyCm) * 180 / Math.PI;
              const newLen   = Math.max(5, Math.hypot(dxCm, dyCm));
              const cordKey  = isLeft
                ? { leftCordAngle: newAngle,  leftCordLength:  newLen }
                : { rightCordAngle: newAngle, rightCordLength: newLen };
              updateComponent(targetComp.id, { subParts: { ...targetComp.subParts, ...cordKey } });
              createConnection(handleDrag.compId, handleDrag.type, nearest.compId, nearest.pointName);
            } else {
              // Normal case: snap string end to the target's snap position
              const targetPos = getSnapPx(targetComp)[nearest.pointName];
              if (targetPos) {
                if (isEnd1) {
                  updateComponent(handleDrag.compId, { subParts: { ...sp, x1: pxToCm(targetPos.x), y1: pxToCm(targetPos.y) } });
                } else {
                  updateComponent(handleDrag.compId, { subParts: { ...sp, x2: pxToCm(targetPos.x), y2: pxToCm(targetPos.y) } });
                }
                createConnection(handleDrag.compId, handleDrag.type, nearest.compId, nearest.pointName);
              }
            }
          }
        }
        render();
        handleDrag = null; hasMoved = false; return;
      }
      // Cord ends: snap-connect to nearest attachment point on release
      if (handleDrag.type === 'cordLeft' || handleDrag.type === 'cordRight') {
        const state = getState();
        const comp = state.components.find(c => c.id === handleDrag.compId);
        const upCanvas = screenToCanvas(e.clientX, e.clientY);
        const nearest = findNearestAttachment(state, cmToPx(upCanvas.x), cmToPx(upCanvas.y), handleDrag.compId, 20);
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

          // Aim SOURCE cord toward the target's snap position (wheel rim for pulleys)
          const targetComp = state.components.find(c => c.id === nearest.compId);
          if (targetComp) {
            const targetSnapPos = getSnapPx(targetComp)[nearest.pointName];
            if (targetSnapPos) {
              const r = Math.min(handleDrag.compW, handleDrag.compH) * 0.35;
              const isLeft = handleDrag.type === 'cordLeft';
              const ox = handleDrag.compX + handleDrag.compW / 2 + (isLeft ? -r * 0.7 : r * 0.7);
              const oy = handleDrag.compY + handleDrag.compH * 0.3;
              const angle = Math.atan2(targetSnapPos.x - ox, targetSnapPos.y - oy) * 180 / Math.PI;
              const len   = Math.max(5, pxToCm(Math.hypot(targetSnapPos.x - ox, targetSnapPos.y - oy)));
              const key   = isLeft
                ? { leftCordAngle: angle,  leftCordLength:  len }
                : { rightCordAngle: angle, rightCordLength: len };
              updateComponent(handleDrag.compId, { subParts: { ...comp.subParts, ...key } });

              // If target is also a pulley cord end, aim its cord back toward the source wheel
              if (targetComp.subtype === 'pulley' &&
                  (nearest.pointName === 'cordLeft' || nearest.pointName === 'cordRight')) {
                const isTargetLeft  = nearest.pointName === 'cordLeft';
                const rTarget = Math.min(targetComp.width, targetComp.height) * 0.35;
                const toxCm = targetComp.x + targetComp.width  / 2 + (isTargetLeft ? -rTarget * 0.7 : rTarget * 0.7);
                const toyCm = targetComp.y + targetComp.height * 0.3;
                // Source wheel origin in cm
                const rSrcCm = Math.min(handleDrag.origW, handleDrag.origH) * 0.35;
                const soxCm  = handleDrag.origX + handleDrag.origW / 2 + (isLeft ? -rSrcCm * 0.7 : rSrcCm * 0.7);
                const soyCm  = handleDrag.origY + handleDrag.origH * 0.3;
                const dxT = soxCm - toxCm;
                const dyT = soyCm - toyCm;
                const angleT = Math.atan2(dxT, dyT) * 180 / Math.PI;
                const lenT   = Math.max(5, Math.hypot(dxT, dyT));
                const keyT   = isTargetLeft
                  ? { leftCordAngle: angleT,  leftCordLength:  lenT }
                  : { rightCordAngle: angleT, rightCordLength: lenT };
                updateComponent(targetComp.id, { subParts: { ...targetComp.subParts, ...keyT } });
              }
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
        const fromComp = state.components.find(c => c.id === connDrag.fromId) || (state.environment || []).find(e => e.id === connDrag.fromId);
        const toComp   = state.components.find(c => c.id === nearest.compId)  || (state.environment || []).find(e => e.id === nearest.compId);
        const involvesString = fromComp?.subtype === 'string' || toComp?.subtype === 'string';
        if (!involvesString) {
          undoPush();
          createConnection(connDrag.fromId, connDrag.fromPoint, nearest.compId, nearest.pointName);
        }
      }
      connDrag = null;
      rubberBand = null;
      render();
      return;
    }
    if (rubberBand) {
      const rb = rubberBand;
      rubberBand = null;
      const dx = Math.abs(rb.currentX - rb.startX);
      const dy = Math.abs(rb.currentY - rb.startY);
      if (dx > 2 || dy > 2) {
        const rect = {
          x: Math.min(rb.startX, rb.currentX),
          y: Math.min(rb.startY, rb.currentY),
          width: Math.abs(rb.currentX - rb.startX),
          height: Math.abs(rb.currentY - rb.startY),
        };
        const s = getState();
        const found = getItemsInRect(s.components, s.environment, s.connections, rect)
          .filter(fid => { const ev = s.environment.find(e => e.id === fid); return !(ev && ev.wallLocked); });
        if (e.shiftKey) {
          const combined = new Set([...selectedIds, ...found]);
          selectedIds = [...combined];
        } else {
          selectedIds = found;
        }
      } else if (!e.shiftKey) {
        selectedIds = [];
      }
      render();
      return;
    }

    if (groupDrag) {
      groupDrag = null; hasMoved = false; window.__dragActive = false;
      return;
    }

    if (dragging) {
      dragging = null; window.__dragActive = false; hasMoved = false;
    }
  });
}

export function getConnDrag() { return connDrag; }
export function getHandleDrag() { return handleDrag; }

export function copySelection() {
  const state = getState();
  if (selectedIds.length === 0) return;

  const items = [];
  const copiedIdSet = new Set();

  for (const id of selectedIds) {
    const comp = state.components.find(c => c.id === id);
    if (comp) {
      if (comp.subtype === 'start' || comp.subtype === 'finish') continue;
      const { id: _id, ...data } = comp;
      items.push({ data, isEnv: false, originalId: id });
      copiedIdSet.add(id);
      continue;
    }
    const env = state.environment.find(e => e.id === id);
    if (env) {
      const { id: _id, ...data } = env;
      items.push({ data, isEnv: true, originalId: id });
      copiedIdSet.add(id);
    }
  }

  // Only copy connections where both endpoints are in the selection
  const connections = state.connections.filter(
    c => copiedIdSet.has(c.fromId) && copiedIdSet.has(c.toId)
  );

  clipboard = { items, connections };
  pasteOffset = 0;
}

export function pasteSelection() {
  if (!clipboard) return;

  undoPush();
  pasteOffset += 1;
  const offset = pasteOffset * 4; // cm — stacks with each successive paste

  const idMap = new Map(); // originalId → newId

  for (const { data, isEnv, originalId } of clipboard.items) {
    const copy = { ...data, x: data.x + offset, y: data.y + offset };
    // String endpoints stored in subParts must also be offset
    if (copy.subtype === 'string' && copy.subParts) {
      copy.subParts = { ...copy.subParts };
      if (copy.subParts.x1 != null) copy.subParts.x1 += offset;
      if (copy.subParts.y1 != null) copy.subParts.y1 += offset;
      if (copy.subParts.x2 != null) copy.subParts.x2 += offset;
      if (copy.subParts.y2 != null) copy.subParts.y2 += offset;
    }
    const newId = isEnv ? addEnvItem(copy) : addComponent(copy);
    idMap.set(originalId, newId);
  }

  // Re-create connections between pasted items using new IDs
  for (const conn of clipboard.connections) {
    const newFromId = idMap.get(conn.fromId);
    const newToId   = idMap.get(conn.toId);
    if (newFromId && newToId) {
      addConnection({ fromId: newFromId, fromPoint: conn.fromPoint, toId: newToId, toPoint: conn.toPoint });
    }
  }

  selectedIds = [...idMap.values()];
  render();
}
