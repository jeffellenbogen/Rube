import { canvasToScreen, getViewport } from './canvas.js';
import { updateComponent, updateEnvItem, getState } from './state.js';
import { push as undoPush } from './undo.js';

const overlays = new Map(); // id → div

export function toggleComment(id) {
  const state = getState();
  const comp = state.components.find(c => c.id === id);
  const envItem = !comp && (state.environment || []).find(e => e.id === id);
  const item = comp || envItem;
  if (!item) return;
  undoPush();
  if (comp) updateComponent(id, { commentVisible: !item.commentVisible });
  else updateEnvItem(id, { commentVisible: !item.commentVisible });
  syncOverlays();
}

export function syncOverlays() {
  const state = getState();
  const container = document.getElementById('comment-overlays');
  if (!container) return;

  const allItems = [...state.components, ...(state.environment || [])];
  const allIds = new Set(allItems.map(c => c.id));

  for (const [id, div] of overlays) {
    if (!allIds.has(id)) { div.remove(); overlays.delete(id); }
  }

  for (const item of allItems) {
    if (!item.commentVisible) {
      if (overlays.has(item.id)) { overlays.get(item.id).remove(); overlays.delete(item.id); }
      continue;
    }
    const isEnv = !state.components.find(c => c.id === item.id);
    let div = overlays.get(item.id);
    if (!div) {
      div = document.createElement('div');
      div.className = 'comment-overlay';
      const ta = document.createElement('textarea');
      ta.maxLength = 200;
      ta.value = item.comment || '';
      ta.placeholder = 'Describe this step...';
      ta.addEventListener('input', () => {
        if (isEnv) updateEnvItem(item.id, { comment: ta.value });
        else updateComponent(item.id, { comment: ta.value });
      });
      div.appendChild(ta);
      container.appendChild(div);
      overlays.set(item.id, div);
    }
    const wrapperRect = container.getBoundingClientRect();
    const screen = canvasToScreen(item.x + item.width / 2, item.y);
    const { zoom } = getViewport();
    div.style.left = `${screen.x - wrapperRect.left - 70}px`;
    div.style.top = `${screen.y - wrapperRect.top - 130}px`;
    div.style.transform = `scale(${zoom})`;
    div.style.transformOrigin = 'bottom center';
    // Connector line: offset 130px, bubble ~80px → 50px gap. Leave 10px visual on each side.
    // Divide by zoom since ::after lives inside the scaled element.
    const bubbleH = div.offsetHeight;
    const gap = 130 - bubbleH;
    const lineH = Math.max(0, (gap - 20) / zoom);
    const lineOffset = 10 / zoom;
    div.style.setProperty('--line-h', `${lineH}px`);
    div.style.setProperty('--line-offset', `-${lineOffset}px`);
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
