import { cmToPx } from '../canvas.js';
const NS = 'http://www.w3.org/2000/svg';
const TEAL = '#00c9a7';

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

export function renderMaterials(state, layer) {
  layer.innerHTML = '';
  for (const comp of state.components) {
    if (comp.type !== 'material' && comp.type !== 'marker') continue;
    const g = drawMaterial(comp);
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

function drawMaterial(comp) {
  const g = document.createElementNS(NS, 'g');
  g.dataset.id = comp.id;
  g.dataset.type = comp.subtype;
  const x = cmToPx(comp.x), y = cmToPx(comp.y), w = cmToPx(comp.width), h = cmToPx(comp.height);
  switch (comp.subtype) {
    case 'ball':     drawBall(g, x, y, w, h); break;
    case 'domino':   drawDomino(g, x, y, w, h, comp.subParts?.topValue ?? 0, comp.subParts?.bottomValue ?? 0); break;
    case 'toyCar':   drawCar(g, x, y, w, h); break;
    case 'string':   el('rect', { x, y, width: w, height: Math.max(h, 12), fill: 'transparent' }, g);
                     el('line', { x1: x, y1: y+h/2, x2: x+w, y2: y+h/2, stroke: '#f0d080', 'stroke-width': 2, 'stroke-dasharray': '4 2' }, g); break;
    case 'cup':      drawCup(g, x, y, w, h); break;
    case 'bucket':   drawBucket(g, x, y, w, h); break;
    case 'tube':     el('rect', { x, y, width: w, height: h, fill: 'none', stroke: TEAL, 'stroke-width': 2, rx: h/2 }, g); break;
    case 'box':      el('rect', { x, y, width: w, height: h, fill: '#d4a96a', stroke: '#8B4513', 'stroke-width': 2 }, g);
                     el('line', { x1: x, y1: y, x2: x+w, y2: y+h, stroke: '#8B4513', 'stroke-width': 1 }, g); break;
    case 'cardboard':el('rect', { x, y, width: w, height: h, fill: '#d4a96a', stroke: '#999', 'stroke-width': 1 }, g); break;
    case 'tape':     el('circle', { cx: x+w/2, cy: y+h/2, r: Math.min(w,h)/2, fill: 'none', stroke: '#aaa', 'stroke-width': Math.min(w,h)*0.3 }, g); break;
    case 'magnet':   drawMagnet(g, x, y, w, h); break;
    case 'track':    el('rect', { x, y, width: w, height: h, fill: '#888', stroke: '#555', 'stroke-width': 2 }, g); break;
    case 'yardstick':drawYardstick(g, x, y, w, h); break;
    case 'protractor':drawProtractor(g, x, y, w, h); break;
    case 'matchboxTrack': drawMatchboxTrack(g, x, y, w, h, comp.subParts); break;
    case 'custom':   drawCustom(g, x, y, w, h, comp.name); break;
    case 'start':    drawMarker(g, x, y, w, h, 'START', '#06d6a0'); break;
    case 'finish':   drawMarker(g, x, y, w, h, 'FINISH', '#ef476f'); break;
    default: break;
  }
  if (comp.type !== 'marker') applyTransform(g, comp);
  return g;
}

const DOT_PATTERNS = [
  [],
  [[0.5, 0.5]],
  [[0.3, 0.3], [0.7, 0.7]],
  [[0.3, 0.3], [0.5, 0.5], [0.7, 0.7]],
  [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  [[0.3, 0.25], [0.7, 0.25], [0.5, 0.5], [0.3, 0.75], [0.7, 0.75]],
  [[0.3, 0.2], [0.7, 0.2], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
];

function drawBall(g, x, y, w, h) {
  const cx = x + w/2, cy = y + h/2, r = Math.min(w, h) / 2;
  el('circle', { cx, cy, r, fill: '#c8e444' }, g);
  // Classic tennis ball seam: two C-curves with a small gap between endpoints
  const sw = Math.max(1.5, r * 0.18);
  const ex = r * 0.2, ey = r * 0.88; // endpoint offsets from center
  el('path', { d: `M${cx-ex},${cy-ey} Q${cx-r*1.2},${cy} ${cx-ex},${cy+ey}`, fill: 'none', stroke: '#fff', 'stroke-width': sw, 'stroke-linecap': 'round' }, g);
  el('path', { d: `M${cx+ex},${cy-ey} Q${cx+r*1.2},${cy} ${cx+ex},${cy+ey}`, fill: 'none', stroke: '#fff', 'stroke-width': sw, 'stroke-linecap': 'round' }, g);
}

function drawDomino(g, x, y, w, h, topVal, botVal) {
  const halfH = h / 2;
  const dotR = Math.min(w, halfH) * 0.13;
  el('rect', { x, y, width: w, height: h, fill: '#222', stroke: '#fff', 'stroke-width': 1, rx: 2 }, g);
  el('line', { x1: x, y1: y+halfH, x2: x+w, y2: y+halfH, stroke: '#fff', 'stroke-width': 1 }, g);
  for (const [fx, fy] of (DOT_PATTERNS[topVal] || [])) {
    el('circle', { cx: x + fx*w, cy: y + fy*halfH, r: dotR, fill: '#fff' }, g);
  }
  for (const [fx, fy] of (DOT_PATTERNS[botVal] || [])) {
    el('circle', { cx: x + fx*w, cy: y + halfH + fy*halfH, r: dotR, fill: '#fff' }, g);
  }
}

function drawCar(g, x, y, w, h) {
  el('rect', { x, y: y+h*0.4, width: w, height: h*0.6, fill: '#e74c3c', rx: 3 }, g);
  el('rect', { x: x+w*0.2, y, width: w*0.6, height: h*0.5, fill: '#c0392b', rx: 3 }, g);
  el('circle', { cx: x+w*0.2, cy: y+h, r: h*0.25, fill: '#333' }, g);
  el('circle', { cx: x+w*0.8, cy: y+h, r: h*0.25, fill: '#333' }, g);
}

function drawBucket(g, x, y, w, h) {
  const bodyY = y + h * 0.22;
  const cx = x + w / 2;
  // Metal handle arc (2× taller) — drawn first so body sits in front
  el('path', {
    d: `M${x+w*0.11},${bodyY} Q${cx},${y-h*0.196} ${x+w*0.89},${bodyY}`,
    fill: 'none', stroke: '#bbb', 'stroke-width': Math.max(1.5, w*0.05), 'stroke-linecap': 'round',
  }, g);
  // Body: trapezoid wider at top (opening faces up)
  el('path', {
    d: `M${x},${bodyY} L${x+w*0.15},${y+h} L${x+w*0.85},${y+h} L${x+w},${bodyY} Z`,
    fill: '#e67e22', stroke: '#c0392b', 'stroke-width': 1.5,
  }, g);
  // Rim
  el('line', { x1: x, y1: bodyY, x2: x+w, y2: bodyY, stroke: '#c0392b', 'stroke-width': 2 }, g);
}

function drawCup(g, x, y, w, h) {
  const CREAM = '#f5e6c8';
  const bw = w * 0.65; // body width, right portion reserved for handle
  const hx = x + bw;
  const hw = w * 0.30; // how far the handle curves right
  // Body
  el('rect', { x, y, width: bw, height: h, fill: CREAM, rx: 2, stroke: '#c8a060', 'stroke-width': 1 }, g);
  // Rim highlight
  el('line', { x1: x+2, y1: y+2, x2: x+bw-2, y2: y+2, stroke: '#c8a060', 'stroke-width': 2 }, g);
  // Handle: D-curve on right side
  el('path', {
    d: `M${hx},${y+h*0.22} C${hx+hw},${y+h*0.22} ${hx+hw},${y+h*0.75} ${hx},${y+h*0.75}`,
    fill: 'none', stroke: CREAM, 'stroke-width': Math.max(2, w*0.125), 'stroke-linecap': 'butt',
  }, g);
  // Handle outline for definition
  el('path', {
    d: `M${hx},${y+h*0.22} C${hx+hw},${y+h*0.22} ${hx+hw},${y+h*0.75} ${hx},${y+h*0.75}`,
    fill: 'none', stroke: '#c8a060', 'stroke-width': 1,
  }, g);
}

function drawMagnet(g, x, y, w, h) {
  el('path', { d: `M${x+w*0.1},${y} L${x+w*0.1},${y+h*0.7} A${w*0.4},${h*0.4} 0 0,0 ${x+w*0.9},${y+h*0.7} L${x+w*0.9},${y}`, fill: 'none', stroke: '#e74c3c', 'stroke-width': w*0.2 }, g);
  el('line', { x1: x+w*0.1, y1: y, x2: x+w*0.3, y2: y, stroke: '#e74c3c', 'stroke-width': 4 }, g);
  el('line', { x1: x+w*0.7, y1: y, x2: x+w*0.9, y2: y, stroke: '#3498db', 'stroke-width': 4 }, g);
}

function drawYardstick(g, x, y, w, h) {
  el('rect', { x, y, width: w, height: h, fill: '#f0e0a0', stroke: '#c8a040', 'stroke-width': 1 }, g);
  for (let i = 1; i < 36; i++) {
    const tx = x + (i/36)*w;
    const tickH = i%12===0 ? h : i%3===0 ? h*0.7 : h*0.4;
    el('line', { x1: tx, y1: y, x2: tx, y2: y+tickH, stroke: '#888', 'stroke-width': 0.5 }, g);
  }
}

function drawProtractor(g, x, y, w, h) {
  el('path', { d: `M${x},${y+h} A${w/2},${h} 0 0,1 ${x+w},${y+h} Z`, fill: 'rgba(100,180,255,0.3)', stroke: '#4a90d9', 'stroke-width': 2 }, g);
  el('line', { x1: x+w/2-3, y1: y+h, x2: x+w/2+3, y2: y+h, stroke: '#4a90d9', 'stroke-width': 2 }, g);
}

function drawMatchboxTrack(g, x, y, w, h, { angle = 0 } = {}) {
  const cx = x+w/2, cy = y+h/2;
  g.setAttribute('transform', `rotate(${-angle},${cx},${cy})`);
  el('rect', { x, y, width: w, height: h, fill: '#e67e22', rx: 2 }, g);
  el('rect', { x, y: y+h*0.3, width: w, height: h*0.4, fill: '#c0392b' }, g);
}

function drawCustom(g, x, y, w, h, name) {
  el('rect', { x, y, width: w, height: h, fill: '#1a3a5c', stroke: '#ff7b2e', 'stroke-width': 2, rx: 4, 'stroke-dasharray': '6 3' }, g);
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', x+w/2); t.setAttribute('y', y+h*0.45);
  t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
  t.setAttribute('fill', '#ff7b2e'); t.setAttribute('font-size', Math.min(w,h)*0.5);
  t.textContent = name || '?';
  g.appendChild(t);
}

function drawMarker(g, x, y, w, h, label, color) {
  el('rect', { x, y, width: w, height: h, fill: color, rx: 4, opacity: 0.9 }, g);
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', x+w/2); t.setAttribute('y', y+h/2);
  t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
  t.setAttribute('fill', '#fff'); t.setAttribute('font-size', Math.min(w*0.4, 12));
  t.setAttribute('font-family', 'Orbitron,sans-serif'); t.setAttribute('font-weight', 'bold');
  t.textContent = label;
  g.appendChild(t);
}

export function drawMaterialIcon(subtype, g, x, y, w, h) {
  switch (subtype) {
    case 'ball':          drawBall(g, x, y, w, h); break;
    case 'domino':        drawDomino(g, x, y, w, h, 2, 3); break;
    case 'toyCar':        drawCar(g, x, y, w, h); break;
    case 'string':        el('line', { x1: x, y1: y+h/2, x2: x+w, y2: y+h/2, stroke: '#f0d080', 'stroke-width': 2, 'stroke-dasharray': '4 2' }, g); break;
    case 'cup':           drawCup(g, x, y, w, h); break;
    case 'bucket':        drawBucket(g, x, y, w, h); break;
    case 'tube':          el('rect', { x, y, width: w, height: h, fill: 'none', stroke: TEAL, 'stroke-width': 2, rx: h/2 }, g); break;
    case 'box':           el('rect', { x, y, width: w, height: h, fill: '#d4a96a', stroke: '#8B4513', 'stroke-width': 2 }, g);
                          el('line', { x1: x, y1: y, x2: x+w, y2: y+h, stroke: '#8B4513', 'stroke-width': 1 }, g); break;
    case 'cardboard':     el('rect', { x, y, width: w, height: h, fill: '#d4a96a', stroke: '#999', 'stroke-width': 1 }, g); break;
    case 'tape':          el('circle', { cx: x+w/2, cy: y+h/2, r: Math.min(w,h)/2, fill: 'none', stroke: '#aaa', 'stroke-width': Math.min(w,h)*0.3 }, g); break;
    case 'magnet':        drawMagnet(g, x, y, w, h); break;
    case 'track':         el('rect', { x, y, width: w, height: h, fill: '#888', stroke: '#555', 'stroke-width': 2 }, g); break;
    case 'yardstick':     drawYardstick(g, x, y, w, h); break;
    case 'protractor':    drawProtractor(g, x, y, w, h); break;
    case 'matchboxTrack': drawMatchboxTrack(g, x, y, w, h); break;
    case 'custom':        drawCustom(g, x, y, w, h, '?'); break;
  }
}
