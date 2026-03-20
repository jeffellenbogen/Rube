import { updateComponent, updateEnvItem, getState } from './state.js';
import { screenToCanvas, getSvg } from './canvas.js';
import { push as undoPush } from './undo.js';
import { render } from './render/index.js';
import { findNearestAttachment, createConnection } from './connections.js';

let dragging = null;      // component drag: { id, isEnv, startCanvasX, startCanvasY, compX, compY }
let connDrag = null;      // connection drag: { fromId, fromPoint, curPx, curPy }
let selected = null;

export function getSelected() { return selected; }
export function setSelected(id) { selected = id; }

export function initDrag(svgEl) {
  svgEl.addEventListener('mousedown', e => {
    // Check for attachment point drag first
    if (e.target.dataset.attachPoint) {
      const compId = e.target.dataset.compId;
      const pointName = e.target.dataset.attachPoint;
      const rect = svgEl.getBoundingClientRect();
      connDrag = { fromId: compId, fromPoint: pointName, curPx: e.clientX - rect.left, curPy: e.clientY - rect.top };
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
    const pos = screenToCanvas(e.clientX, e.clientY);
    dragging = { id, isEnv: !!state.environment.find(ev => ev.id === id), startCanvasX: pos.x, startCanvasY: pos.y, compX: item.x, compY: item.y };
    e.stopPropagation();
  });

  window.addEventListener('mousemove', e => {
    if (connDrag) {
      const rect = svgEl.getBoundingClientRect();
      connDrag.curPx = e.clientX - rect.left;
      connDrag.curPy = e.clientY - rect.top;
      render();
      return;
    }
    if (!dragging) return;
    const pos = screenToCanvas(e.clientX, e.clientY);
    const dx = pos.x - dragging.startCanvasX, dy = pos.y - dragging.startCanvasY;
    const newX = dragging.compX + dx, newY = dragging.compY + dy;
    if (dragging.isEnv) updateEnvItem(dragging.id, { x: newX, y: newY });
    else updateComponent(dragging.id, { x: newX, y: newY });
    render();
  });

  window.addEventListener('mouseup', e => {
    if (connDrag) {
      const rect = svgEl.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const state = getState();
      const nearest = findNearestAttachment(state, px, py, connDrag.fromId);
      if (nearest) {
        undoPush();
        createConnection(connDrag.fromId, connDrag.fromPoint, nearest.compId, nearest.pointName);
        render();
      }
      connDrag = null;
      render();
      return;
    }
    if (dragging) { undoPush(); dragging = null; }
  });
}

export function getConnDrag() { return connDrag; }
