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

  // Sub-part handles for selected component
  const selComp = state.components.find(c => c.id === selId);
  if (selComp && selComp.subParts) {
    const sp = selComp.subParts;

    if (selComp.subtype === 'lever' && sp.fulcrumOffset !== undefined) {
      // Fulcrum drag handle — diamond at fulcrum position on bar
      const fx = x + w * sp.fulcrumOffset;
      const fy = y + h * 0.5;
      const diamond = document.createElementNS(NS, 'polygon');
      diamond.setAttribute('points', `${fx},${fy-6} ${fx+6},${fy} ${fx},${fy+6} ${fx-6},${fy}`);
      diamond.setAttribute('fill', '#ff7b2e'); diamond.setAttribute('stroke', '#fff'); diamond.setAttribute('stroke-width', 1);
      diamond.dataset.handle = 'fulcrum'; diamond.dataset.compId = selId;
      diamond.setAttribute('cursor', 'ew-resize');
      layer.appendChild(diamond);
    }

    if (selComp.subtype === 'inclinedPlane' && sp.angle !== undefined) {
      // Angle handle — circle at the high end of the ramp
      const rad = (sp.angle * Math.PI) / 180;
      const hx = x; const hy = y + h - w * Math.tan(rad);
      const handle = document.createElementNS(NS, 'circle');
      handle.setAttribute('cx', hx); handle.setAttribute('cy', Math.max(y, hy));
      handle.setAttribute('r', 6); handle.setAttribute('fill', '#ffd166'); handle.setAttribute('stroke', '#fff'); handle.setAttribute('stroke-width', 1);
      handle.dataset.handle = 'angle'; handle.dataset.compId = selId;
      handle.setAttribute('cursor', 'ns-resize');
      layer.appendChild(handle);
    }

    if (selComp.subtype === 'matchboxTrack' && sp.angle !== undefined) {
      const handle = document.createElementNS(NS, 'circle');
      handle.setAttribute('cx', x + w); handle.setAttribute('cy', y + h / 2);
      handle.setAttribute('r', 6); handle.setAttribute('fill', '#ffd166'); handle.setAttribute('stroke', '#fff'); handle.setAttribute('stroke-width', 1);
      handle.dataset.handle = 'trackAngle'; handle.dataset.compId = selId;
      handle.setAttribute('cursor', 'ns-resize');
      layer.appendChild(handle);
    }

    if (selComp.subtype === 'pulley') {
      // Cord end handles
      const r = Math.min(w, h) * 0.35;
      const cx = x + w / 2, cy = y + h * 0.3;
      const lcl = (sp.leftCordLength || 20) * 4; // cmToPx approximation
      const rcl = (sp.rightCordLength || 20) * 4;

      const lHandle = document.createElementNS(NS, 'circle');
      lHandle.setAttribute('cx', cx - r * 0.7); lHandle.setAttribute('cy', cy + lcl);
      lHandle.setAttribute('r', 5); lHandle.setAttribute('fill', '#ffd166'); lHandle.setAttribute('stroke', '#fff'); lHandle.setAttribute('stroke-width', 1);
      lHandle.dataset.handle = 'cordLeft'; lHandle.dataset.compId = selId;
      lHandle.setAttribute('cursor', 'ns-resize');
      layer.appendChild(lHandle);

      const rHandle = document.createElementNS(NS, 'circle');
      rHandle.setAttribute('cx', cx + r * 0.7); rHandle.setAttribute('cy', cy + rcl);
      rHandle.setAttribute('r', 5); rHandle.setAttribute('fill', '#ffd166'); rHandle.setAttribute('stroke', '#fff'); rHandle.setAttribute('stroke-width', 1);
      rHandle.dataset.handle = 'cordRight'; rHandle.dataset.compId = selId;
      rHandle.setAttribute('cursor', 'ns-resize');
      layer.appendChild(rHandle);
    }

    if (selComp.subtype === 'wheelAxle' || selComp.subtype === 'screw') {
      // Spin direction toggle button
      const spinBtn = document.createElementNS(NS, 'g');
      spinBtn.dataset.action = 'spin'; spinBtn.dataset.targetId = selId;
      spinBtn.setAttribute('cursor', 'pointer');
      const spinBg = document.createElementNS(NS, 'circle');
      spinBg.setAttribute('cx', x + w / 2); spinBg.setAttribute('cy', y - 14);
      spinBg.setAttribute('r', 9); spinBg.setAttribute('fill', '#1a3a5c'); spinBg.setAttribute('stroke', '#ff7b2e'); spinBg.setAttribute('stroke-width', 1);
      const spinT = document.createElementNS(NS, 'text');
      spinT.setAttribute('x', x + w / 2); spinT.setAttribute('y', y - 14);
      spinT.setAttribute('text-anchor', 'middle'); spinT.setAttribute('dominant-baseline', 'middle');
      spinT.setAttribute('fill', '#ff7b2e'); spinT.setAttribute('font-size', 11);
      spinT.textContent = (sp.spinDirection || 'cw') === 'cw' ? '↻' : '↺';
      spinBtn.appendChild(spinBg); spinBtn.appendChild(spinT);
      layer.appendChild(spinBtn);
    }
  }

  // Resize handles (4 corners) — only for non-env, non-marker components
  if (selComp && selComp.subtype !== 'start' && selComp.subtype !== 'finish') {
    const corners = [
      { name: 'nw', cx: x - pad, cy: y - pad },
      { name: 'ne', cx: x + w + pad, cy: y - pad },
      { name: 'sw', cx: x - pad, cy: y + h + pad },
      { name: 'se', cx: x + w + pad, cy: y + h + pad },
    ];
    for (const { name, cx, cy } of corners) {
      const sq = document.createElementNS(NS, 'rect');
      sq.setAttribute('x', cx - 4); sq.setAttribute('y', cy - 4);
      sq.setAttribute('width', 8); sq.setAttribute('height', 8);
      sq.setAttribute('fill', '#fff'); sq.setAttribute('stroke', '#ff7b2e'); sq.setAttribute('stroke-width', 1.5);
      sq.dataset.handle = `resize-${name}`; sq.dataset.compId = selId;
      sq.setAttribute('cursor', `${name}-resize`);
      layer.appendChild(sq);
    }
  }
}
