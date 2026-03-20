import { updateComponent, updateEnvItem, getState } from './state.js';
import { screenToCanvas, cmToPx, pxToCm } from './canvas.js';
import { push as undoPush } from './undo.js';
import { render } from './render/index.js';
import { findNearestAttachment, createConnection } from './connections.js';
import { getSurfaces } from './render/environment.js';

let dragging = null;      // component drag: { id, isEnv, startCanvasX, startCanvasY, compX, compY }
let connDrag = null;      // connection drag: { fromId, fromPoint, curPx, curPy }
let handleDrag = null;    // { type, compId, startPx, startPy, origValue }
let selected = null;
let hasMoved = false;     // tracks whether current drag has actually moved

export function getSelected() { return selected; }
export function setSelected(id) { selected = id; }

function snapToSurface(comp, newX, newY, shiftHeld) {
  if (shiftHeld) return { x: newX, y: newY };
  const state = getState();
  const allSurfaces = state.environment.flatMap(item => getSurfaces(item));
  // Add top edges of other machine components as snap surfaces
  for (const other of state.components) {
    if (other.id === comp.id) continue;
    if (other.subtype === 'start' || other.subtype === 'finish' || other.subtype === 'marker') continue;
    allSurfaces.push({ x1: other.x, x2: other.x + other.width, y: other.y });
  }
  allSurfaces.push({ x1: 0, x2: 99999, y: 300 });
  const compBottom = newY + comp.height;
  const compMidX = newX + comp.width / 2;
  const snapDist = 10;
  const nearby = allSurfaces.filter(s =>
    s.x1 <= compMidX && s.x2 >= compMidX &&
    s.y >= compBottom - snapDist && s.y <= compBottom + snapDist
  ).sort((a, b) => Math.abs(a.y - compBottom) - Math.abs(b.y - compBottom));
  if (nearby.length > 0) return { x: newX, y: nearby[0].y - comp.height };
  return { x: newX, y: newY };
}

export function initDrag(svgEl) {
  svgEl.addEventListener('mousedown', e => {
    // Let action buttons (delete, comment, spin) be handled by the click event
    if (e.target.closest('[data-action]')) return;

    // Check for sub-part/resize handle
    if (e.target.dataset.handle) {
      const handle = e.target.dataset.handle;
      const compId = e.target.dataset.compId;
      const state = getState();
      const comp = state.components.find(c => c.id === compId);
      if (comp) {
        const rect = svgEl.getBoundingClientRect();
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
    if (item.subtype === 'start' || item.subtype === 'finish') { selected = id; render(); return; }
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

      if (handleDrag.type === 'fulcrum') {
        const newOffset = Math.max(0.05, Math.min(0.95, (curPx - handleDrag.compX) / handleDrag.compW));
        updateComponent(handleDrag.compId, { subParts: { ...comp.subParts, fulcrumOffset: newOffset } });
      } else if (handleDrag.type === 'angle' || handleDrag.type === 'trackAngle') {
        const dyCm = pxToCm(dy);
        const wCm = comp.width;
        const newAngle = Math.max(5, Math.min(80, Math.atan2(-dyCm, wCm) * 180 / Math.PI));
        updateComponent(handleDrag.compId, { subParts: { ...comp.subParts, angle: newAngle } });
      } else if (handleDrag.type === 'cordLeft') {
        const newLen = Math.max(5, pxToCm(handleDrag.origSubParts.leftCordLength * 4 + dy));
        updateComponent(handleDrag.compId, { subParts: { ...comp.subParts, leftCordLength: newLen } });
      } else if (handleDrag.type === 'cordRight') {
        const newLen = Math.max(5, pxToCm(handleDrag.origSubParts.rightCordLength * 4 + dy));
        updateComponent(handleDrag.compId, { subParts: { ...comp.subParts, rightCordLength: newLen } });
      } else if (handleDrag.type.startsWith('resize-')) {
        const corner = handleDrag.type.slice(7); // 'nw', 'ne', 'sw', 'se'
        const dxCm = pxToCm(dx), dyCm = pxToCm(dy);
        let newW = handleDrag.origW, newH = handleDrag.origH;
        let newX = handleDrag.origX, newY = handleDrag.origY;
        if (corner === 'se') { newW = Math.max(3, handleDrag.origW + dxCm); newH = Math.max(3, handleDrag.origH + dyCm); }
        else if (corner === 'sw') { newW = Math.max(3, handleDrag.origW - dxCm); newH = Math.max(3, handleDrag.origH + dyCm); newX = handleDrag.origX + dxCm; }
        else if (corner === 'ne') { newW = Math.max(3, handleDrag.origW + dxCm); newH = Math.max(3, handleDrag.origH - dyCm); newY = handleDrag.origY + dyCm; }
        else if (corner === 'nw') { newW = Math.max(3, handleDrag.origW - dxCm); newH = Math.max(3, handleDrag.origH - dyCm); newX = handleDrag.origX + dxCm; newY = handleDrag.origY + dyCm; }
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
    const snapped = (!dragging.isEnv && comp) ? snapToSurface(comp, newX, newY, e.shiftKey) : { x: newX, y: newY };
    if (dragging.isEnv) updateEnvItem(dragging.id, { x: snapped.x, y: snapped.y });
    else updateComponent(dragging.id, { x: snapped.x, y: snapped.y });
    render();
  });

  window.addEventListener('mouseup', e => {
    if (handleDrag) { handleDrag = null; hasMoved = false; return; }
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
    if (dragging) { dragging = null; window.__dragActive = false; hasMoved = false; }
  });
}

export function getConnDrag() { return connDrag; }
