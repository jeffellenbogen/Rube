import { cmToPx } from '../canvas.js';

const NS = 'http://www.w3.org/2000/svg';
const ORANGE = '#ff7b2e';
const BROWN = '#8B4513';

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

export function renderMachines(state, layer) {
  layer.innerHTML = '';
  for (const comp of state.components) {
    if (comp.type !== 'simple_machine') continue;
    const g = drawMachine(comp);
    if (g) layer.appendChild(g);
  }
}

function applyTransform(g, comp) {
  const deg = comp.rotation || 0;
  const fx = comp.flipped ? -1 : 1;
  if (deg === 0 && fx === 1) return;
  const cx = cmToPx(comp.x + comp.width / 2);
  const cy = cmToPx(comp.y + comp.height / 2);
  g.setAttribute('transform', `translate(${cx},${cy}) scale(${fx},1) rotate(${deg}) translate(${-cx},${-cy})`);
}

function drawMachine(comp) {
  const g = document.createElementNS(NS, 'g');
  g.dataset.id = comp.id;
  g.dataset.type = comp.subtype;

  const x = cmToPx(comp.x), y = cmToPx(comp.y);
  const w = cmToPx(comp.width), h = cmToPx(comp.height);

  switch (comp.subtype) {
    case 'lever':     drawLever(g, x, y, w, h, comp.subParts); break;
    case 'pulley':    drawPulley(g, x, y, w, h, comp.subParts); break;
    case 'inclinedPlane': drawInclinedPlane(g, x, y, w, h, comp.subParts); break;
    case 'wheelAxle': drawWheelAxle(g, x, y, w, h, comp.subParts); break;
    case 'wedge':     drawWedge(g, x, y, w, h); break;
    case 'screw':     drawScrew(g, x, y, w, h, comp.subParts); break;
  }
  applyTransform(g, comp);
  return g;
}

function drawLever(g, x, y, w, h, { fulcrumOffset = 0.5 } = {}) {
  // Lever bar
  el('rect', { x, y: y+h*0.3, width: w, height: h*0.2, fill: BROWN, rx: 2 }, g);
  // Fulcrum (triangle)
  const fx = x + w * fulcrumOffset;
  el('polygon', { points: `${fx},${y+h*0.5} ${fx-h*0.4},${y+h} ${fx+h*0.4},${y+h}`, fill: ORANGE }, g);
}

function drawPulley(g, x, y, w, h, { leftCordLength = 20, rightCordLength = 20 } = {}) {
  const cx = x + w/2, cy = y + h*0.3, r = Math.min(w,h)*0.35;
  // Wheel
  el('circle', { cx, cy, r, fill: '#888', stroke: ORANGE, 'stroke-width': 3 }, g);
  el('circle', { cx, cy, r: r*0.3, fill: ORANGE }, g);
  // Mounting bracket
  el('line', { x1: cx, y1: y, x2: cx, y2: cy-r, stroke: '#666', 'stroke-width': 3 }, g);
  // Cords
  const lcl = cmToPx(leftCordLength), rcl = cmToPx(rightCordLength);
  el('line', { x1: cx-r*0.7, y1: cy, x2: cx-r*0.7, y2: cy+lcl, stroke: '#ccc', 'stroke-width': 2 }, g);
  el('line', { x1: cx+r*0.7, y1: cy, x2: cx+r*0.7, y2: cy+rcl, stroke: '#ccc', 'stroke-width': 2 }, g);
}

function drawInclinedPlane(g, x, y, w, h, { angle = 30 } = {}) {
  const rad = (angle * Math.PI) / 180;
  const y2 = y + h;
  const blockW = w * 0.20;
  const plankSpan = w - blockW * 0.5;
  const blockH = Math.min(h * 0.85, plankSpan * Math.tan(rad));

  // Support block (draw behind plank)
  el('rect', {
    x: x + w - blockW, y: y2 - blockH,
    width: blockW, height: blockH,
    fill: '#a06030', stroke: BROWN, 'stroke-width': 2, rx: 1,
  }, g);

  // Plank: thin board from ground-left to top of block on right
  const px1 = x, py1 = y2;
  const px2 = x + w, py2 = y2 - blockH;
  const dx = px2 - px1, dy = py2 - py1;
  const len = Math.hypot(dx, dy);
  const plankT = Math.max(4, h * 0.08);
  // Normal pointing above the plank surface (CW rotation of direction vector)
  const nx = dy / len, ny = -dx / len;

  el('polygon', {
    points: [
      [px1, py1], [px2, py2],
      [px2 + nx * plankT, py2 + ny * plankT],
      [px1 + nx * plankT, py1 + ny * plankT],
    ].map(([cx, cy]) => `${cx.toFixed(1)},${cy.toFixed(1)}`).join(' '),
    fill: '#c8a87a', stroke: BROWN, 'stroke-width': 2,
  }, g);
}

function drawWheelAxle(g, x, y, w, h, { spinDirection = 'cw' } = {}) {
  const cx = x+w/2, cy = y+h/2, r = Math.min(w,h)*0.45;
  // Axle line
  el('line', { x1: x, y1: cy, x2: x+w, y2: cy, stroke: '#666', 'stroke-width': 4 }, g);
  // Wheel
  el('circle', { cx, cy, r, fill: '#888', stroke: ORANGE, 'stroke-width': 3 }, g);
  // Spokes
  for (let i = 0; i < 4; i++) {
    const a = (i/4)*Math.PI*2;
    el('line', { x1: cx, y1: cy, x2: cx+Math.cos(a)*r, y2: cy+Math.sin(a)*r, stroke: '#aaa', 'stroke-width': 2 }, g);
  }
}

function drawWedge(g, x, y, w, h) {
  el('polygon', { points: `${x},${y+h} ${x+w},${y+h} ${x},${y}`, fill: '#c8a87a', stroke: BROWN, 'stroke-width': 2 }, g);
}

function drawScrew(g, x, y, w, h, { angle = 90, spinDirection = 'cw' } = {}) {
  const rad = ((90-angle)*Math.PI/180);
  const cx = x+w/2, cy = y+h/2;
  const len = Math.min(w,h)*0.8;
  const dx = Math.cos(rad)*len/2, dy = Math.sin(rad)*len/2;
  // Shaft
  el('line', { x1: cx-dx, y1: cy+dy, x2: cx+dx, y2: cy-dy, stroke: '#999', 'stroke-width': w*0.4 }, g);
  // Threads (perpendicular ticks)
  for (let i = 0; i <= 4; i++) {
    const t = i/4;
    const tx = cx-dx+dx*2*t, ty = cy+dy-dy*2*t;
    const perp = { x: -dy*0.3, y: dx*0.3 };
    el('line', { x1: tx-perp.x, y1: ty-perp.y, x2: tx+perp.x, y2: ty+perp.y, stroke: ORANGE, 'stroke-width': 1.5 }, g);
  }
}

export { drawMachine };
