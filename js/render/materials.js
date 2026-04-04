import { cmToPx } from '../canvas.js';
import { getStringEndpoints } from './attachPoints.js';
const NS = 'http://www.w3.org/2000/svg';
const TEAL = '#00c9a7';
let _clipUid = 0;

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

export function renderMaterials(state, layer) {
  layer.innerHTML = '';
  // Compute 1-based flag numbers by position in components array
  const flagNums = {};
  let flagCount = 0;
  for (const comp of state.components) {
    if (comp.subtype === 'flag') flagNums[comp.id] = ++flagCount;
  }
  for (const comp of state.components) {
    if (comp.type !== 'material' && comp.type !== 'marker') continue;
    const g = comp.subtype === 'string'
      ? drawStringComp(comp, state)
      : drawMaterial(comp, flagNums[comp.id] ?? 0);
    if (g) layer.appendChild(g);
  }
}

function drawStringComp(comp, state) {
  const g = document.createElementNS(NS, 'g');
  g.dataset.id = comp.id;
  g.dataset.type = comp.subtype;
  const { x1, y1, x2, y2 } = getStringEndpoints(comp, state);
  // Wide transparent line for easy click/drag targeting
  el('line', { x1, y1, x2, y2, stroke: 'transparent', 'stroke-width': 14 }, g);
  // Visible string: dark brown, thicker dashed
  el('line', { x1, y1, x2, y2, stroke: '#7B3F00', 'stroke-width': 3, 'stroke-dasharray': '6 4' }, g);
  return g;
}

function applyTransform(g, comp) {
  const deg = comp.rotation || 0;
  const fx = comp.flipped ? -1 : 1;
  if (deg === 0 && fx === 1) return;
  const cx = cmToPx(comp.x + comp.width / 2);
  const cy = cmToPx(comp.y + comp.height / 2);
  g.setAttribute('transform', `translate(${cx},${cy}) scale(${fx},1) rotate(${deg}) translate(${-cx},${-cy})`);
}

function drawFlag(g, x, y, w, h, flagNumber) {
  const badgeH = h * 0.44;
  const cx = x + w / 2;
  const rx = Math.min(w, badgeH) * 0.18;
  // Pole
  el('line', { x1: cx, y1: y + badgeH * 0.85, x2: cx, y2: y + h - 3, stroke: '#4a7a9a', 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
  // Base dot
  el('circle', { cx, cy: y + h - 3, r: 3, fill: '#4a7a9a' }, g);
  // Badge background
  el('rect', { x, y, width: w, height: badgeH, rx, fill: '#ef476f' }, g);
  // "STEP" label
  const stepEl = document.createElementNS(NS, 'text');
  stepEl.setAttribute('x', cx);
  stepEl.setAttribute('y', y + badgeH * 0.3);
  stepEl.setAttribute('text-anchor', 'middle');
  stepEl.setAttribute('dominant-baseline', 'middle');
  stepEl.setAttribute('font-family', '"Courier New", Courier, monospace');
  stepEl.setAttribute('font-size', Math.max(4, Math.round(badgeH * 0.26)));
  stepEl.setAttribute('fill', 'rgba(255,255,255,0.8)');
  stepEl.textContent = 'STEP';
  g.appendChild(stepEl);
  // Number
  const numEl = document.createElementNS(NS, 'text');
  numEl.setAttribute('x', cx);
  numEl.setAttribute('y', y + badgeH * 0.72);
  numEl.setAttribute('text-anchor', 'middle');
  numEl.setAttribute('dominant-baseline', 'middle');
  numEl.setAttribute('font-family', '"Courier New", Courier, monospace');
  numEl.setAttribute('font-size', Math.max(7, Math.round(badgeH * 0.46)));
  numEl.setAttribute('font-weight', 'bold');
  numEl.setAttribute('fill', 'white');
  numEl.textContent = String(flagNumber);
  g.appendChild(numEl);
}

export function drawFlagIcon(g, x, y, w, h) {
  drawFlag(g, x, y, w, h, '?');
}

function drawMaterial(comp, flagNumber = 0) {
  const g = document.createElementNS(NS, 'g');
  g.dataset.id = comp.id;
  g.dataset.type = comp.subtype;
  const x = cmToPx(comp.x), y = cmToPx(comp.y), w = cmToPx(comp.width), h = cmToPx(comp.height);
  switch (comp.subtype) {
    case 'flag':     drawFlag(g, x, y, w, h, flagNumber); break;
    case 'ball':     drawBall(g, x, y, w, h); break;
    case 'domino':   drawDomino(g, x, y, w, h, comp.subParts?.topValue ?? 0, comp.subParts?.bottomValue ?? 0); break;
    case 'toyCar':   drawCar(g, x, y, w, h); break;
    case 'dumpTruck': drawDumpTruck(g, x, y, w, h); break;
    case 'fan':      drawFan(g, x, y, w, h, comp.subParts); break;
    case 'rubiksCube': drawRubiksCube(g, x, y, w, h, comp.subParts?.colorIndex ?? 0); break;
    case 'string':   break; // handled by drawStringComp above
    case 'cup':      drawCup(g, x, y, w, h); break;
    case 'bucket':   drawBucket(g, x, y, w, h); break;
    case 'funnel':   drawFunnel(g, x, y, w, h, comp.subParts); break;
    case 'tube':     drawTube(g, x, y, w, h); break;
    case 'box':      drawCrate(g, x, y, w, h, comp.subParts?.colorIndex ?? 0); break;
    case 'cardboard':drawCardboard(g, x, y, w, h); break;
    case 'tape':     el('circle', { cx: x+w/2, cy: y+h/2, r: Math.min(w,h)/2, fill: 'none', stroke: '#aaa', 'stroke-width': Math.min(w,h)*0.3 }, g); break;
    case 'track':    el('rect', { x, y, width: w, height: h, fill: '#888', stroke: '#555', 'stroke-width': 2 }, g); break;
    case 'yardstick':drawYardstick(g, x, y, w, h); break;
    case 'protractor':drawProtractor(g, x, y, w, h); break;
    case 'matchboxTrack': drawMatchboxTrack(g, x, y, w, h, comp.subParts); break;
    case 'book':     drawBook(g, x, y, w, h, comp.subParts?.colorIndex ?? 0); break;
    case 'spring':   drawSpring(g, x, y, w, h, comp.subParts); break;
    case 'custom':   drawCustom(g, x, y, w, h, comp.name); break;
    case 'start':    drawMarker(g, x, y, w, h, 'START', '#06d6a0'); break;
    case 'finish':   drawMarker(g, x, y, w, h, 'FINISH', '#ef476f'); break;
    case 'person':   drawPerson(g, x, y, w, h, comp.subParts); break;
    default: break;
  }
  if (comp.subtype !== 'start' && comp.subtype !== 'finish') applyTransform(g, comp);
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
  const wheelCy = y + h * 0.75; // wheel center — bottom of wheel flush with bbox bottom
  const wheelR  = h * 0.25;
  // Body: sits between wheel tops and cab
  el('rect', { x, y: y+h*0.3, width: w, height: h*0.45, fill: '#e74c3c', rx: 3 }, g);
  // Cab
  el('rect', { x: x+w*0.2, y, width: w*0.6, height: h*0.38, fill: '#c0392b', rx: 3 }, g);
  // Wheels — bottom at y+h, flush with bounding box
  el('circle', { cx: x+w*0.2, cy: wheelCy, r: wheelR, fill: '#333' }, g);
  el('circle', { cx: x+w*0.8, cy: wheelCy, r: wheelR, fill: '#333' }, g);
}

function drawBucket(g, x, y, w, h) {
  const bodyY = y + h * 0.22;
  const cx = x + w / 2;
  // Metal handle arc (2× taller) — drawn first so body sits in front
  el('path', {
    d: `M${x+w*0.02},${bodyY} Q${cx},${y-h*0.612} ${x+w*0.98},${bodyY}`,
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

const CRATE_COLORS = [
  { main: '#2276e0', dark: '#0e4a8f' }, // blue
  { main: '#f0c020', dark: '#a07808' }, // yellow
  { main: '#e02222', dark: '#8f0e0e' }, // red
  { main: '#22b822', dark: '#0e7a0e' }, // green
];

function drawCrate(g, x, y, w, h, colorIndex = 0) {
  const blue   = CRATE_COLORS[colorIndex]?.main ?? CRATE_COLORS[0].main;
  const blueDk = CRATE_COLORS[colorIndex]?.dark ?? CRATE_COLORS[0].dark;
  const rimH   = h * 0.13;
  const postW  = Math.max(2, w * 0.09);
  const lx = x + postW, ly = y + rimH;
  const lw = w - postW * 2, lh = h - rimH * 2;

  // Dark interior visible through lattice openings
  el('rect', { x, y, width: w, height: h, fill: blueDk, rx: 2 }, g);

  // Diagonal lattice ribs clipped to the inner panel
  const clipId = `crate${++_clipUid}`;
  const defs = el('defs', {}, g);
  const clip = el('clipPath', { id: clipId }, defs);
  el('rect', { x: lx, y: ly, width: lw, height: lh }, clip);
  const lg = el('g', { 'clip-path': `url(#${clipId})` }, g);
  const sp = Math.min(lw, lh) * 0.26;
  const ribW = Math.max(1, sp * 0.35);
  for (let i = -Math.ceil((lw + lh) / sp) - 1; i <= Math.ceil((lw + lh) / sp) + 1; i++) {
    el('line', { x1: lx+i*sp,      y1: ly,    x2: lx+i*sp+lh,  y2: ly+lh, stroke: blue, 'stroke-width': ribW }, lg);
    el('line', { x1: lx+i*sp+lh,   y1: ly,    x2: lx+i*sp,     y2: ly+lh, stroke: blue, 'stroke-width': ribW }, lg);
  }

  // Solid rim bands (top and bottom)
  el('rect', { x, y,            width: w, height: rimH, fill: blue, rx: 2 }, g);
  el('rect', { x, y: y+h-rimH, width: w, height: rimH, fill: blue }, g);

  // Solid corner posts
  el('rect', { x,            y: ly, width: postW, height: lh, fill: blue }, g);
  el('rect', { x: x+w-postW, y: ly, width: postW, height: lh, fill: blue }, g);

  // Outer border
  el('rect', { x, y, width: w, height: h, fill: 'none', stroke: blueDk, 'stroke-width': 1.5, rx: 2 }, g);
}

function drawCardboard(g, x, y, w, h) {
  const fold = '#b8864a';
  const sw = Math.max(0.75, Math.min(w, h) * 0.03);
  el('rect', { x, y, width: w, height: h, fill: '#d4a96a', stroke: '#999', 'stroke-width': 1 }, g);
  // Vertical fold lines 15% from each edge
  const lx = x + w * 0.15, rx = x + w * 0.85;
  el('line', { x1: lx, y1: y, x2: lx, y2: y+h, stroke: fold, 'stroke-width': sw }, g);
  el('line', { x1: rx, y1: y, x2: rx, y2: y+h, stroke: fold, 'stroke-width': sw }, g);
  // Horizontal midline connecting between the two vertical folds
  const my = y + h * 0.5;
  el('line', { x1: lx, y1: my, x2: rx, y2: my, stroke: fold, 'stroke-width': sw }, g);
}

function drawTube(g, x, y, w, h) {
  const gray = '#b8b8b8';
  const spiralColor = '#949494';
  const clipId = `tc${++_clipUid}`;
  // Clip path keeps spiral lines inside the tube body
  const defs = el('defs', {}, g);
  const clip = el('clipPath', { id: clipId }, defs);
  el('rect', { x, y, width: w, height: h }, clip);
  // Body
  el('rect', { x, y, width: w, height: h, fill: gray, stroke: '#999', 'stroke-width': 1 }, g);
  // Spiral lines clipped to body
  const sg = el('g', { 'clip-path': `url(#${clipId})` }, g);
  const spacing = h * 0.9;
  for (let i = -1; i <= Math.ceil(w / spacing) + 1; i++) {
    el('line', { x1: x+i*spacing, y1: y+h, x2: x+i*spacing+h, y2: y, stroke: spiralColor, 'stroke-width': Math.max(1, h*0.07) }, sg);
  }
  // Dark ellipse on left end showing hollow interior
  el('ellipse', { cx: x, cy: y+h/2, rx: Math.max(2, h*0.18), ry: h*0.46, fill: '#444' }, g);
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
  const cx = x + w / 2, base = y + h;
  const rx = w / 2, ry = h;
  const sw = Math.max(1.5, w * 0.03);

  // Main filled semicircle
  el('path', { d: `M${x},${base} A${rx},${ry} 0 0,1 ${x+w},${base} Z`, fill: 'rgba(100,180,255,0.25)', stroke: '#4a90d9', 'stroke-width': sw }, g);

  // Center void — small semicircle of negative space
  const vr = Math.min(rx, ry) * 0.22;
  el('path', { d: `M${cx - vr},${base} A${vr},${vr} 0 0,1 ${cx + vr},${base} Z`, fill: '#0d1f33', stroke: '#4a90d9', 'stroke-width': Math.max(1, sw * 0.6) }, g);

  // Tick marks along arc at 15° increments (0° = right end, 180° = left end)
  for (let deg = 0; deg <= 180; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    // Point on ellipse arc (measured from right, going counterclockwise in SVG)
    const ex = cx + rx * Math.cos(Math.PI - rad);
    const ey = base - ry * Math.sin(rad);
    // Normal direction pointing outward from center
    const nx = Math.cos(Math.PI - rad);
    const ny = -Math.sin(rad);
    const isMajor = deg % 30 === 0;
    const tickLen = isMajor ? Math.min(w, h) * 0.14 : Math.min(w, h) * 0.08;
    el('line', {
      x1: ex, y1: ey,
      x2: ex - nx * tickLen, y2: ey - ny * tickLen,
      stroke: '#4a90d9', 'stroke-width': Math.max(0.8, sw * 0.5),
    }, g);
  }
}

function drawMatchboxTrack(g, x, y, w, h, { angle = 0 } = {}) {
  const cx = x+w/2, cy = y+h/2;
  g.setAttribute('transform', `rotate(${-angle},${cx},${cy})`);
  el('rect', { x, y, width: w, height: h, fill: '#e67e22', rx: 2 }, g);
  el('rect', { x, y: y+h*0.3, width: w, height: h*0.4, fill: '#c0392b' }, g);
}

const BOOK_COLORS = [
  { cover: '#c0392b', spine: '#7b241c', band: '#f1948a' }, // red
  { cover: '#1a5276', spine: '#0e2f44', band: '#7fb3d3' }, // navy
  { cover: '#1e8449', spine: '#145a32', band: '#7dcea0' }, // green
  { cover: '#784212', spine: '#4a2608', band: '#d4a76a' }, // brown
  { cover: '#6c3483', spine: '#4a235a', band: '#c39bd3' }, // purple
];

function drawBook(g, x, y, w, h, colorIndex = 0) {
  const c = BOOK_COLORS[colorIndex % BOOK_COLORS.length];
  const spineW = w * 0.22;
  const sw = Math.max(1.5, Math.min(w, h) * 0.03);
  // Cover
  el('rect', { x, y, width: w, height: h, fill: c.cover, stroke: c.spine, 'stroke-width': sw, rx: 1 }, g);
  // Spine strip
  el('rect', { x, y, width: spineW, height: h, fill: c.spine, rx: 1 }, g);
  // Title band
  el('rect', { x: x + spineW, y: y + h * 0.2, width: w - spineW, height: h * 0.22, fill: c.band, opacity: 0.7 }, g);
  // Page lines
  const pgX1 = x + spineW + (w - spineW) * 0.1;
  const pgX2 = x + w - (w - spineW) * 0.1;
  for (let i = 0; i < 3; i++) {
    el('line', { x1: pgX1, y1: y + h * (0.58 + i * 0.1), x2: pgX2, y2: y + h * (0.58 + i * 0.1),
      stroke: c.band, 'stroke-width': Math.max(0.5, h * 0.012), opacity: 0.45 }, g);
  }
}

function drawDumpTruck(g, x, y, w, h) {
  const wheelCy = y + h * 0.78;
  const wheelR  = h * 0.22;
  // Cab body (left ~35% of width), darker yellow
  el('rect', { x, y: y + h * 0.25, width: w * 0.38, height: h * 0.53, fill: '#c87820', rx: 2 }, g);
  // Cab roof
  el('rect', { x: x + w * 0.04, y: y + h * 0.08, width: w * 0.28, height: h * 0.22, fill: '#c87820', rx: 2 }, g);
  // Windshield
  el('rect', { x: x + w * 0.06, y: y + h * 0.10, width: w * 0.20, height: h * 0.17, fill: '#a8d4f0', rx: 1 }, g);
  // Dump bed (right ~65% of width) — trapezoid taller at rear
  el('path', {
    d: `M${x+w*0.35},${y+h*0.15} L${x+w},${y+h*0.05} L${x+w},${y+h*0.78} L${x+w*0.35},${y+h*0.78} Z`,
    fill: '#f0a030',
  }, g);
  // Bed outline
  el('path', {
    d: `M${x+w*0.35},${y+h*0.15} L${x+w},${y+h*0.05} L${x+w},${y+h*0.78} L${x+w*0.35},${y+h*0.78} Z`,
    fill: 'none', stroke: '#a06010', 'stroke-width': 1,
  }, g);
  // Wheels
  el('circle', { cx: x + w * 0.22, cy: wheelCy, r: wheelR, fill: '#333' }, g);
  el('circle', { cx: x + w * 0.22, cy: wheelCy, r: wheelR * 0.5, fill: '#666' }, g);
  el('circle', { cx: x + w * 0.80, cy: wheelCy, r: wheelR, fill: '#333' }, g);
  el('circle', { cx: x + w * 0.80, cy: wheelCy, r: wheelR * 0.5, fill: '#666' }, g);
}

function drawFan(g, x, y, w, h, subParts) {
  const cx = x + w / 2;
  const housingR = Math.min(w / 2, h * 0.65);
  const housingCy = y + housingR;
  // Stand (bottom 35% of height, centered ~40% width)
  const standW = w * 0.4;
  const standX = cx - standW / 2;
  const standY = y + h * 0.65;
  const standH = h * 0.35;
  el('rect', { x: standX, y: standY, width: standW, height: standH, fill: '#666', rx: 3 }, g);
  // Housing circle background
  el('circle', { cx, cy: housingCy, r: housingR, fill: '#eee', stroke: '#555', 'stroke-width': Math.max(1.5, housingR * 0.06) }, g);
  // Fan blades — 4 elongated ellipses rotated 90° apart
  const bladeL = housingR * 0.7;
  const bladeW = housingR * 0.28;
  for (let i = 0; i < 4; i++) {
    const angle = i * 90;
    const bx = cx;
    const by = housingCy - bladeL * 0.5;
    const blade = el('ellipse', { cx: bx, cy: by, rx: bladeW, ry: bladeL * 0.5, fill: '#ddd', stroke: '#bbb', 'stroke-width': 0.5 }, g);
    blade.setAttribute('transform', `rotate(${angle},${cx},${housingCy})`);
  }
  // Hub
  el('circle', { cx, cy: housingCy, r: housingR * 0.15, fill: '#888' }, g);
  // Housing ring on top
  el('circle', { cx, cy: housingCy, r: housingR, fill: 'none', stroke: '#555', 'stroke-width': Math.max(1.5, housingR * 0.06) }, g);
  // Direction arrow (right by default, left if direction === 'left')
  const direction = subParts?.direction === 'left' ? 'left' : 'right';
  const arrowR = housingR * 0.15; // 15% of housing radius
  if (direction === 'right') {
    // Right-pointing chevron/arrow: >
    el('path', {
      d: `M${cx - arrowR * 0.4},${housingCy - arrowR * 0.5} L${cx + arrowR * 0.4},${housingCy} L${cx - arrowR * 0.4},${housingCy + arrowR * 0.5}`,
      fill: 'none',
      stroke: '#555',
      'stroke-width': Math.max(1, arrowR * 0.2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }, g);
  } else {
    // Left-pointing chevron/arrow: <
    el('path', {
      d: `M${cx + arrowR * 0.4},${housingCy - arrowR * 0.5} L${cx - arrowR * 0.4},${housingCy} L${cx + arrowR * 0.4},${housingCy + arrowR * 0.5}`,
      fill: 'none',
      stroke: '#555',
      'stroke-width': Math.max(1, arrowR * 0.2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }, g);
  }
}

const RUBIKS_CLASSIC = ['#e5383b', '#3a86ff', '#38b000', '#ffd166', '#ffffff', '#fb5607'];
const RUBIKS_PASTEL  = ['#ffb3c1', '#a9c4eb', '#b5ead7', '#fef9c7', '#e8d5f5', '#ffd8b1'];
const RUBIKS_NEON    = ['#ff006e', '#3a86ff', '#80b918', '#ffbe0b', '#00f5d4', '#ff4800'];
const RUBIKS_THEMES  = [RUBIKS_CLASSIC, RUBIKS_PASTEL, RUBIKS_NEON];

function drawRubiksCube(g, x, y, w, h, colorIndex = 0) {
  const colors = RUBIKS_THEMES[colorIndex % RUBIKS_THEMES.length];
  // Front face: left 70% width, top 75% height
  const fw = w * 0.70;
  const fh = h * 0.75;
  const fx = x;
  const fy = y + h * 0.25; // starts 25% from top (leaves room for top face)
  const cellW = fw / 3;
  const cellH = fh / 3;
  // Top face: parallelogram slanting from (fx, fy) to (fx+fw+rw, fy) at top, offset up
  const rw = w * 0.30; // right face width
  const topH = h * 0.25;
  // Top face corners: bottom-left, bottom-right, top-right, top-left (slant)
  el('path', {
    d: `M${fx},${fy} L${fx+fw},${fy} L${fx+fw+rw},${fy-topH} L${fx+rw},${fy-topH} Z`,
    fill: '#f5f5f5', stroke: '#333', 'stroke-width': 1,
  }, g);
  // Top face 3x3 grid cells
  const topCellW = fw / 3;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const ci = (row * 3 + col) % colors.length;
      const bx = fx + col * topCellW + (2 - row) * (rw / 3);
      const by = fy - (2 - row) * (topH / 3);
      el('path', {
        d: `M${bx},${by} L${bx+topCellW},${by} L${bx+topCellW+(rw/3)},${by+topH/3} L${bx+(rw/3)},${by+topH/3} Z`,
        fill: colors[(ci + 2) % colors.length], stroke: '#333', 'stroke-width': 0.5,
      }, g);
    }
  }
  // Front face 3x3 grid
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const ci = (row * 3 + col) % colors.length;
      el('rect', {
        x: fx + col * cellW + 1,
        y: fy + row * cellH + 1,
        width: cellW - 2,
        height: cellH - 2,
        fill: colors[ci],
        stroke: '#333', 'stroke-width': 0.5, rx: 1,
      }, g);
    }
  }
  // Front face border
  el('rect', { x: fx, y: fy, width: fw, height: fh, fill: 'none', stroke: '#333', 'stroke-width': 1 }, g);
  // Right face: parallelogram from (fx+fw, fy) to (fx+fw+rw, fy-topH) top, down to (fx+fw+rw, fy-topH+fh)
  const rightCellH = fh / 3;
  const rightSlantY = topH / 3;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const ci = (row * 3 + col) % colors.length;
      const bx = fx + fw + col * (rw / 3);
      const by = fy - col * (topH / 3) + row * rightCellH;
      el('path', {
        d: `M${bx},${by} L${bx+rw/3},${by-rightSlantY} L${bx+rw/3},${by-rightSlantY+rightCellH} L${bx},${by+rightCellH} Z`,
        fill: colors[(ci + 4) % colors.length], stroke: '#333', 'stroke-width': 0.5,
      }, g);
    }
  }
  // Right face border
  el('path', {
    d: `M${fx+fw},${fy} L${fx+fw+rw},${fy-topH} L${fx+fw+rw},${fy-topH+fh} L${fx+fw},${fy+fh} Z`,
    fill: 'none', stroke: '#333', 'stroke-width': 1,
  }, g);
}

function drawFunnel(g, x, y, w, h, subParts) {
  const tubeW = w * 0.15;
  const tubeX1 = x + (w - tubeW) / 2;
  const tubeX2 = tubeX1 + tubeW;
  const topOW = w * (subParts?.openingWidth ?? 1.0);
  const topX1 = x + (w - topOW) / 2;
  const topX2 = topX1 + topOW;
  const bodyBottom = y + h * 0.8;
  // Body trapezoid
  el('path', { d: `M${topX1},${y} L${topX2},${y} L${tubeX2},${bodyBottom} L${tubeX1},${bodyBottom} Z`, fill: '#b0b8c0', stroke: '#707880', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, g);
  // Tube
  el('rect', { x: tubeX1, y: bodyBottom, width: tubeW, height: h * 0.2, fill: '#a0a8b0', stroke: '#707880', 'stroke-width': 1.5 }, g);
  // Rim
  el('rect', { x: topX1 - 2, y: y - 2, width: topOW + 4, height: 4, fill: '#909098', rx: 1 }, g);
}

function drawSpring(g, x, y, w, h, subParts) {
  const state = subParts?.state ?? 'compressed';
  const plateH = h * 0.1;
  const coilTop = y + plateH;
  const coilBot = state === 'compressed' ? y + plateH + h * 0.6 : y + h - plateH;
  const coilH = coilBot - coilTop;
  const numCoils = 8;
  const segH = coilH / numCoils;
  const margin = w * 0.08;

  const pts = [`M${x + w/2},${coilTop}`];
  for (let i = 0; i < numCoils; i++) {
    const py = coilTop + (i + 1) * segH;
    const px = i % 2 === 0 ? x + margin : x + w - margin;
    pts.push(`L${px},${py}`);
  }
  pts.push(`L${x + w/2},${coilBot}`);

  el('path', { d: pts.join(' '), fill: 'none', stroke: '#999', 'stroke-width': Math.max(1.5, w * 0.08), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  el('rect', { x, y, width: w, height: plateH, fill: '#ccc', stroke: '#888', 'stroke-width': 1, rx: 1 }, g);
  el('rect', { x, y: y + h - plateH, width: w, height: plateH, fill: '#ccc', stroke: '#888', 'stroke-width': 1, rx: 1 }, g);
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
  t.setAttribute('fill', '#fff'); t.setAttribute('font-size', Math.min(w * 0.25, h * 0.45));
  t.setAttribute('font-family', 'Orbitron,sans-serif'); t.setAttribute('font-weight', 'bold');
  t.textContent = label;
  g.appendChild(t);
}

function drawPerson(g, x, y, w, h, subParts) {
  const pose = subParts?.pose ?? 'push';
  const cx = x + w / 2;
  const sw = Math.max(1.5, w * 0.07);
  const headR = h * 0.12;
  const headCy = y + headR;
  const shoulderY = y + h * 0.30;
  const hipY = y + h * 0.55;
  const footY = y + h;

  // Head
  el('circle', { cx, cy: headCy, r: headR, fill: '#555' }, g);
  // Body
  el('line', { x1: cx, y1: headCy + headR, x2: cx, y2: hipY, stroke: '#555', 'stroke-width': sw, 'stroke-linecap': 'round' }, g);
  // Legs
  el('line', { x1: cx, y1: hipY, x2: x + w * 0.2, y2: footY, stroke: '#555', 'stroke-width': sw, 'stroke-linecap': 'round' }, g);
  el('line', { x1: cx, y1: hipY, x2: x + w * 0.8, y2: footY, stroke: '#555', 'stroke-width': sw, 'stroke-linecap': 'round' }, g);

  // Arms — vary by pose
  if (pose === 'push') {
    // Both arms forward (right), reaching out
    el('line', { x1: cx, y1: shoulderY, x2: x + w * 0.9, y2: shoulderY + h * 0.08, stroke: '#555', 'stroke-width': sw, 'stroke-linecap': 'round' }, g);
    el('line', { x1: cx, y1: shoulderY, x2: x + w * 0.85, y2: shoulderY - h * 0.05, stroke: '#555', 'stroke-width': sw, 'stroke-linecap': 'round' }, g);
    // Fist/hand dot at right
    el('circle', { cx: x + w * 0.9, cy: shoulderY + h * 0.08, r: sw * 1.2, fill: '#555' }, g);
  } else if (pose === 'drop') {
    // One arm down, one arm at side
    el('line', { x1: cx, y1: shoulderY, x2: x + w * 0.8, y2: shoulderY + h * 0.25, stroke: '#555', 'stroke-width': sw, 'stroke-linecap': 'round' }, g);
    el('line', { x1: cx, y1: shoulderY, x2: x + w * 0.2, y2: shoulderY + h * 0.08, stroke: '#555', 'stroke-width': sw, 'stroke-linecap': 'round' }, g);
    // Drop point dot
    el('circle', { cx: x + w * 0.8, cy: shoulderY + h * 0.25, r: sw * 1.2, fill: '#555' }, g);
  } else if (pose === 'pull') {
    // Both arms backward (left)
    el('line', { x1: cx, y1: shoulderY, x2: x + w * 0.1, y2: shoulderY + h * 0.08, stroke: '#555', 'stroke-width': sw, 'stroke-linecap': 'round' }, g);
    el('line', { x1: cx, y1: shoulderY, x2: x + w * 0.15, y2: shoulderY - h * 0.05, stroke: '#555', 'stroke-width': sw, 'stroke-linecap': 'round' }, g);
    el('circle', { cx: x + w * 0.1, cy: shoulderY + h * 0.08, r: sw * 1.2, fill: '#555' }, g);
  }
}

export function drawMaterialIcon(subtype, g, x, y, w, h) {
  switch (subtype) {
    case 'ball':          drawBall(g, x, y, w, h); break;
    case 'domino':        drawDomino(g, x, y, w, h, 2, 3); break;
    case 'toyCar':        drawCar(g, x, y, w, h); break;
    case 'dumpTruck':     drawDumpTruck(g, x, y, w, h); break;
    case 'fan':           drawFan(g, x, y, w, h, null); break;
    case 'rubiksCube':    drawRubiksCube(g, x, y, w, h, 0); break;
    case 'string':        el('line', { x1: x, y1: y+h/2, x2: x+w, y2: y+h/2, stroke: '#7B3F00', 'stroke-width': 3, 'stroke-dasharray': '6 4' }, g); break;
    case 'cup':           drawCup(g, x, y, w, h); break;
    case 'bucket':        drawBucket(g, x, y, w, h); break;
    case 'funnel':        drawFunnel(g, x, y, w, h, null); break;
    case 'tube':          drawTube(g, x, y, w, h); break;
    case 'box':           drawCrate(g, x, y, w, h, 0); break;
    case 'cardboard':     drawCardboard(g, x, y, w, h); break;
    case 'tape':          el('circle', { cx: x+w/2, cy: y+h/2, r: Math.min(w,h)/2, fill: 'none', stroke: '#aaa', 'stroke-width': Math.min(w,h)*0.3 }, g); break;
    case 'track':         el('rect', { x, y, width: w, height: h, fill: '#888', stroke: '#555', 'stroke-width': 2 }, g); break;
    case 'yardstick':     drawYardstick(g, x, y, w, h); break;
    case 'protractor':    drawProtractor(g, x, y, w, h); break;
    case 'matchboxTrack': drawMatchboxTrack(g, x, y, w, h); break;
    case 'book':          drawBook(g, x, y, w, h, 0); break;
    case 'spring':        drawSpring(g, x, y, w, h, null); break;
    case 'custom':        drawCustom(g, x, y, w, h, '?'); break;
    case 'person':        drawPerson(g, x, y, w, h, null); break;
  }
}
