import { canvasToScreen } from './canvas.js';
import { updateComponent, getState } from './state.js';
import { push as undoPush } from './undo.js';

const overlays = new Map(); // compId → div

export function toggleComment(compId) {
  const comp = getState().components.find(c => c.id === compId);
  if (!comp) return;
  undoPush();
  updateComponent(compId, { commentVisible: !comp.commentVisible });
  syncOverlays();
}

export function syncOverlays() {
  const state = getState();
  const container = document.getElementById('comment-overlays');
  if (!container) return;

  for (const [id, div] of overlays) {
    if (!state.components.find(c => c.id === id)) { div.remove(); overlays.delete(id); }
  }

  for (const comp of state.components) {
    if (!comp.commentVisible) {
      if (overlays.has(comp.id)) { overlays.get(comp.id).remove(); overlays.delete(comp.id); }
      continue;
    }
    let div = overlays.get(comp.id);
    if (!div) {
      div = document.createElement('div');
      div.className = 'comment-overlay';
      const ta = document.createElement('textarea');
      ta.maxLength = 200;
      ta.value = comp.comment || '';
      ta.placeholder = 'Describe this step...';
      ta.addEventListener('input', () => {
        updateComponent(comp.id, { comment: ta.value });
      });
      div.appendChild(ta);
      container.appendChild(div);
      overlays.set(comp.id, div);
    }
    const screen = canvasToScreen(comp.x + comp.width / 2, comp.y);
    div.style.left = `${screen.x - 70}px`;
    div.style.top = `${screen.y - 100}px`;
  }
}

export function repositionOverlays() {
  let rafPending = false;
  return () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { syncOverlays(); rafPending = false; });
  };
}
