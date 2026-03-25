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

function drawLever(g, x, y, w, h, { fulcrumOffset = 0.5, tiltSide = 'none' } = {}) {
  const barCy = y + h * 0.4;
  const tiltAmt = h * 0.25;
  const thick = h * 0.1;

  let leftY, rightY;
  if (tiltSide === 'left') {
    leftY = barCy - tiltAmt;
    rightY = barCy + tiltAmt;
  } else if (tiltSide === 'right') {
    leftY = barCy + tiltAmt;
    rightY = barCy - tiltAmt;
  } else {
    leftY = rightY = barCy;
  }

  // Bar as polygon (works for both flat and tilted)
  const dx = w, dy = rightY - leftY;
  const len = Math.hypot(dx, dy);
  // Normal pointing "above" bar surface (toward smaller y = top of screen)
  const tnx = thick * dy / len;
  const tny = -thick * dx / len;
  el('polygon', {
    points: [
      [x + tnx,     leftY  + tny],
      [x + w + tnx, rightY + tny],
      [x + w - tnx, rightY - tny],
      [x - tnx,     leftY  - tny],
    ].map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' '),
    fill: BROWN,
  }, g);

  // Fulcrum triangle — tip touches bottom of bar at fulcrum X
  const fx = x + w * fulcrumOffset;
  const barCenterAtFulcrum = leftY + dy * fulcrumOffset;
  const fulcrumTipY = barCenterAtFulcrum + thick * dx / len;
  el('polygon', { points: `${fx},${fulcrumTipY} ${fx-h*0.4},${y+h} ${fx+h*0.4},${y+h}`, fill: ORANGE }, g);
}

function drawPulley(g, x, y, w, h, { leftCordLength = 20, rightCordLength = 20, leftCordAngle = 0, rightCordAngle = 0 } = {}) {
  const cx = x + w/2, cy = y + h*0.3, r = Math.min(w,h)*0.35;
  // Wheel
  el('circle', { cx, cy, r, fill: '#888', stroke: ORANGE, 'stroke-width': 3 }, g);
  el('circle', { cx, cy, r: r*0.3, fill: ORANGE }, g);
  // Hanger — from wheel center up to 10% of diameter past the wheel top
  const hangerW = r * 0.45;
  const hangerTop = cy - r * 1.2;
  el('rect', { x: cx - hangerW/2, y: hangerTop, width: hangerW, height: r * 1.2, fill: '#777', stroke: '#555', 'stroke-width': 1 }, g);
  // Cords — angled from wheel origin
  const lcl = cmToPx(leftCordLength), rcl = cmToPx(rightCordLength);
  const lRad = leftCordAngle * Math.PI / 180;
  const rRad = rightCordAngle * Math.PI / 180;
  const lox = cx - r*0.7, loy = cy;
  const rox = cx + r*0.7, roy = cy;
  const lex = lox + lcl * Math.sin(lRad), ley = loy + lcl * Math.cos(lRad);
  const rex = rox + rcl * Math.sin(rRad), rey = roy + rcl * Math.cos(rRad);
  el('line', { x1: lox, y1: loy, x2: lex, y2: ley, stroke: '#ccc', 'stroke-width': 2 }, g);
  el('line', { x1: rox, y1: roy, x2: rex, y2: rey, stroke: '#ccc', 'stroke-width': 2 }, g);
  // Yellow balls at cord ends — visible when not selected; replaced by teal when selected
  el('circle', { cx: lex, cy: ley, r: 5, fill: '#ffd166', stroke: '#fff', 'stroke-width': 1.5 }, g);
  el('circle', { cx: rex, cy: rey, r: 5, fill: '#ffd166', stroke: '#fff', 'stroke-width': 1.5 }, g);
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
