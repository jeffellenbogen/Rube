import { cmToPx } from '../canvas.js';
import { getSelected } from '../drag.js';

const NS = 'http://www.w3.org/2000/svg';

// Attachment point positions per subtype (fractions of width/height)
export const ATTACH_POINTS = {
  lever:         { left: [0, 0.4], right: [1, 0.4] },
  pulley:        { cordLeft: [0.3, 0.55], cordRight: [0.7, 0.55], mountTop: [0.5, 0] },
  inclinedPlane: { top: [0, 0], bottom: [1, 1] },
  wheelAxle:     { axleLeft: [0, 0.5], axleRight: [1, 0.5] },
  wedge:         { thinEnd: [0, 0.5], thickBase: [1, 1] },
  screw:         { top: [0.5, 0], tip: [0.5, 1] },
  yardstick:     { left: [0, 0.5], center: [0.5, 0.5], right: [1, 0.5] },
  protractor:    { base: [0.5, 1] },
  matchboxTrack: { left: [0, 0.5], right: [1, 0.5] },
  start:         { output: [1, 0.5] },
  finish:        { input: [0, 0.5] },
};
const DEFAULT_ATTACH = { input: [0, 0.5], output: [1, 0.5] };

export function getAttachPx(comp) {
  const pts = ATTACH_POINTS[comp.subtype] || DEFAULT_ATTACH;
  const x = cmToPx(comp.x), y = cmToPx(comp.y);
  const w = cmToPx(comp.width), h = cmToPx(comp.height);
  const result = {};
  for (const [name, [fx, fy]] of Object.entries(pts)) {
    result[name] = { x: x + w * fx, y: y + h * fy };
  }
  return result;
}

export function renderUI(state, layer) {
  layer.innerHTML = '';
  const selId = getSelected();
  if (!selId) return;
  const comp = [...state.components, ...state.environment].find(c => c.id === selId);
  if (!comp) return;

  const x = cmToPx(comp.x), y = cmToPx(comp.y), w = cmToPx(comp.width), h = cmToPx(comp.height);
  const pad = 4;

  // Selection ring
  const ring = document.createElementNS(NS, 'rect');
  ring.setAttribute('x', x - pad); ring.setAttribute('y', y - pad);
  ring.setAttribute('width', w + pad * 2); ring.setAttribute('height', h + pad * 2);
  ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#ff7b2e');
  ring.setAttribute('stroke-width', 1.5); ring.setAttribute('stroke-dasharray', '4 3');
  ring.setAttribute('rx', 3);
  layer.appendChild(ring);

  // Delete button (skip markers)
  if (comp.subtype !== 'start' && comp.subtype !== 'finish') {
    const btn = document.createElementNS(NS, 'g');
    btn.dataset.action = 'delete';
    btn.dataset.targetId = selId;
    btn.setAttribute('cursor', 'pointer');
    const bg = document.createElementNS(NS, 'circle');
    bg.setAttribute('cx', x + w + pad); bg.setAttribute('cy', y - pad);
    bg.setAttribute('r', 8); bg.setAttribute('fill', '#ef476f');
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x + w + pad); t.setAttribute('y', y - pad);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('fill', '#fff'); t.setAttribute('font-size', 10); t.textContent = '×';
    btn.appendChild(bg); btn.appendChild(t);
    layer.appendChild(btn);
  }

  // Comment bubble button
  const commentBtn = document.createElementNS(NS, 'g');
  commentBtn.dataset.action = 'comment';
  commentBtn.dataset.targetId = selId;
  commentBtn.setAttribute('cursor', 'pointer');
  const cbg = document.createElementNS(NS, 'circle');
  cbg.setAttribute('cx', x - pad - 8); cbg.setAttribute('cy', y - pad);
  cbg.setAttribute('r', 8);
  cbg.setAttribute('fill', comp.comment ? '#ff7b2e' : '#1a3a5c');
  cbg.setAttribute('stroke', '#ff7b2e'); cbg.setAttribute('stroke-width', 1);
  const ct = document.createElementNS(NS, 'text');
  ct.setAttribute('x', x - pad - 8); ct.setAttribute('y', y - pad);
  ct.setAttribute('text-anchor', 'middle'); ct.setAttribute('dominant-baseline', 'middle');
  ct.setAttribute('fill', '#fff'); ct.setAttribute('font-size', 9); ct.textContent = '💬';
  commentBtn.appendChild(cbg); commentBtn.appendChild(ct);
  layer.appendChild(commentBtn);

  // Attachment point dots (for selected component only)
  if (state.components.find(c => c.id === selId)) {
    const pts = getAttachPx(comp);
    for (const [name, pos] of Object.entries(pts)) {
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', pos.x); dot.setAttribute('cy', pos.y);
      dot.setAttribute('r', 5); dot.setAttribute('fill', '#00c9a7');
      dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', 1.5);
      dot.dataset.attachPoint = name; dot.dataset.compId = selId;
      dot.setAttribute('cursor', 'crosshair');
      layer.appendChild(dot);
    }
  }
}
