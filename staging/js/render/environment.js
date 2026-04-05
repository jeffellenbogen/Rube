import { cmToPx } from '../canvas.js';

export function renderEnvironment(state, layer) {
  // Preserve the floor line (added by main.js via prepend) before clearing
  const floorLine = layer.querySelector('.floor-line');
  layer.innerHTML = '';
  if (floorLine) layer.prepend(floorLine);

  // Floor is rendered in main.js, skip here
  for (const item of state.environment) {
    const g = makeEnvItem(item);
    if (g) layer.appendChild(g);
  }
}

function makeEnvItem(item) {
  const NS = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(NS, 'g');
  g.dataset.id = item.id;
  g.dataset.envtype = item.subtype;

  const x = cmToPx(item.x), y = cmToPx(item.y);
  const w = cmToPx(item.width), h = cmToPx(item.height);

  switch (item.subtype) {
    case 'desk': drawDesk(g, x, y, w, h); break;
    case 'chair': drawChair(g, x, y, w, h); break;
    case 'stairs': drawStairs(g, x, y, w, h, item.stepCount || 6); break;
    case 'bookshelf': drawBookshelf(g, x, y, w, h); break;
    case 'couch': drawCouch(g, x, y, w, h, item.couchColor); break;
    case 'wall': drawWall(g, x, y, w, h, item); break;
  }
  const cx = x + w / 2, cy = y + h / 2;
  const rotation = item.rotation || 0;
  if (item.flipped && !rotation) {
    g.setAttribute('transform', `translate(${cx},0) scale(-1,1) translate(${-cx},0)`);
  } else if (rotation) {
    g.setAttribute('transform', `rotate(${rotation},${cx},${cy})`);
  }
  return g;
}

function svgRect(g, x, y, w, h, fill, stroke) {
  const NS = 'http://www.w3.org/2000/svg';
  const r = document.createElementNS(NS, 'rect');
  r.setAttribute('x', x); r.setAttribute('y', y);
  r.setAttribute('width', w); r.setAttribute('height', h);
  r.setAttribute('fill', fill || 'none');
  r.setAttribute('stroke', stroke || '#4a7a9a');
  r.setAttribute('stroke-width', 2);
  g.appendChild(r);
  return r;
}

function svgLine(g, x1, y1, x2, y2, stroke, width) {
  const NS = 'http://www.w3.org/2000/svg';
  const l = document.createElementNS(NS, 'line');
  l.setAttribute('x1',x1); l.setAttribute('y1',y1);
  l.setAttribute('x2',x2); l.setAttribute('y2',y2);
  l.setAttribute('stroke', stroke || '#4a7a9a');
  l.setAttribute('stroke-width', width || 2);
  g.appendChild(l);
}

// Mulberry32 seeded PRNG — returns function yielding [0,1) floats
function seededRand(seed) {
  let s = (seed >>> 0) || 1;
  return function() {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Creates/replaces a <clipPath id=clipId> in SVG defs containing a rect at (x,y,w,h)
function ensureClipPath(svgEl, clipId, x, y, w, h, NS) {
  let defs = svgEl.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(NS, 'defs');
    svgEl.insertBefore(defs, svgEl.firstChild);
  }
  const old = svgEl.getElementById(clipId);
  if (old) old.remove();
  const clip = document.createElementNS(NS, 'clipPath');
  clip.setAttribute('id', clipId);
  const cr = document.createElementNS(NS, 'rect');
  cr.setAttribute('x', x); cr.setAttribute('y', y);
  cr.setAttribute('width', w); cr.setAttribute('height', h);
  clip.appendChild(cr);
  defs.appendChild(clip);
}

function drawWallCream(g, x, y, w, h) {
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = g.ownerSVGElement;
  if (svgEl && !svgEl.getElementById('wall-orange-peel')) {
    let defs = svgEl.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(NS, 'defs');
      svgEl.insertBefore(defs, svgEl.firstChild);
    }
    const filter = document.createElementNS(NS, 'filter');
    filter.setAttribute('id', 'wall-orange-peel');
    filter.setAttribute('x', '0%'); filter.setAttribute('y', '0%');
    filter.setAttribute('width', '100%'); filter.setAttribute('height', '100%');

    // Fractal noise as bump map
    const turb = document.createElementNS(NS, 'feTurbulence');
    turb.setAttribute('type', 'fractalNoise');
    turb.setAttribute('baseFrequency', '0.65');
    turb.setAttribute('numOctaves', '3');
    turb.setAttribute('stitchTiles', 'stitch');
    turb.setAttribute('result', 'noise');
    filter.appendChild(turb);

    // Specular lighting gives the bump/sheen look
    const spec = document.createElementNS(NS, 'feSpecularLighting');
    spec.setAttribute('in', 'noise');
    spec.setAttribute('surfaceScale', '4');
    spec.setAttribute('specularConstant', '1');
    spec.setAttribute('specularExponent', '20');
    spec.setAttribute('lighting-color', 'white');
    spec.setAttribute('result', 'specular');
    const light = document.createElementNS(NS, 'feDistantLight');
    light.setAttribute('azimuth', '45');
    light.setAttribute('elevation', '65');
    spec.appendChild(light);
    filter.appendChild(spec);

    // Composite specular over source graphic — preserves cream color
    const comp = document.createElementNS(NS, 'feComposite');
    comp.setAttribute('in', 'specular');
    comp.setAttribute('in2', 'SourceGraphic');
    comp.setAttribute('operator', 'in');
    comp.setAttribute('result', 'textured');
    filter.appendChild(comp);

    // Blend textured highlight at low opacity onto source
    const blend = document.createElementNS(NS, 'feBlend');
    blend.setAttribute('in', 'SourceGraphic');
    blend.setAttribute('in2', 'textured');
    blend.setAttribute('mode', 'screen');
    blend.setAttribute('result', 'blended');
    filter.appendChild(blend);

    // Crop to source shape
    const crop = document.createElementNS(NS, 'feComposite');
    crop.setAttribute('in', 'blended');
    crop.setAttribute('in2', 'SourceGraphic');
    crop.setAttribute('operator', 'in');
    filter.appendChild(crop);

    defs.appendChild(filter);
  }

  // Wall body with texture filter
  const r = document.createElementNS(NS, 'rect');
  r.setAttribute('x', x); r.setAttribute('y', y);
  r.setAttribute('width', w); r.setAttribute('height', h);
  r.setAttribute('fill', '#c8b8a0'); r.setAttribute('stroke', '#8a7a60');
  r.setAttribute('stroke-width', 1.5);
  r.setAttribute('filter', 'url(#wall-orange-peel)');
  g.appendChild(r);

  // Subtle ledge line at top
  const ledgeY = y + Math.min(3, h * 0.05);
  const l = document.createElementNS(NS, 'line');
  l.setAttribute('x1', x); l.setAttribute('y1', ledgeY);
  l.setAttribute('x2', x + w); l.setAttribute('y2', ledgeY);
  l.setAttribute('stroke', '#8a7a60'); l.setAttribute('stroke-width', 1);
  l.setAttribute('opacity', 0.5);
  g.appendChild(l);
}

function drawWall(g, x, y, w, h, item = {}) {
  switch (item.wallStyle || 'cream') {
    case 'botanical': drawWallBotanical(g, x, y, w, h, item.wallSeed || 0, item.id || 'icon'); break;
    case 'clapboard': drawWallClapboard(g, x, y, w, h); break;
    case 'disco':     drawWallDisco(g, x, y, w, h, item.wallSeed || 0, item.id || 'icon'); break;
    default:          drawWallCream(g, x, y, w, h); break;
  }
}

function drawWallClapboard(g, x, y, w, h) {
  const NS = 'http://www.w3.org/2000/svg';
  // White background
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('x', x); bg.setAttribute('y', y);
  bg.setAttribute('width', w); bg.setAttribute('height', h);
  bg.setAttribute('fill', '#f0f0ee'); bg.setAttribute('stroke', '#b0b0aa');
  bg.setAttribute('stroke-width', 1.5);
  g.appendChild(bg);

  // Vertical board lines at fixed 50px spacing
  const spacing = 50;
  for (let lx = x + spacing; lx < x + w; lx += spacing) {
    // Board edge line
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', lx); line.setAttribute('y1', y);
    line.setAttribute('x2', lx); line.setAttribute('y2', y + h);
    line.setAttribute('stroke', '#909090'); line.setAttribute('stroke-width', 1.5);
    g.appendChild(line);
    // Shadow accent just left of edge
    const shadow = document.createElementNS(NS, 'line');
    shadow.setAttribute('x1', lx - 2); shadow.setAttribute('y1', y);
    shadow.setAttribute('x2', lx - 2); shadow.setAttribute('y2', y + h);
    shadow.setAttribute('stroke', '#a8a8a4'); shadow.setAttribute('stroke-width', 0.75);
    shadow.setAttribute('opacity', '0.6');
    g.appendChild(shadow);
  }

  // Top ledge
  const ledgeY = y + Math.min(3, h * 0.05);
  const l = document.createElementNS(NS, 'line');
  l.setAttribute('x1', x); l.setAttribute('y1', ledgeY);
  l.setAttribute('x2', x + w); l.setAttribute('y2', ledgeY);
  l.setAttribute('stroke', '#b0b0aa'); l.setAttribute('stroke-width', 1);
  l.setAttribute('opacity', '0.5');
  g.appendChild(l);
}

// Draws one arching pinnate fern frond with a fiddlehead spiral at the tip.
// x0,y0: base position (px). angleDeg: direction angle (0=right, -90=up, 180=left).
// lengthPx: total frond length in px. color: CSS color string.
function drawFernFrond(cg, x0, y0, angleDeg, lengthPx, color, NS) {
  const angle = angleDeg * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const pCos = Math.cos(angle + Math.PI / 2);
  const pSin = Math.sin(angle + Math.PI / 2);

  // Tip of stem
  const tipX = x0 + cos * lengthPx;
  const tipY = y0 + sin * lengthPx;
  // Control point arches slightly perpendicular (organic curve)
  const ctlX = x0 + cos * lengthPx * 0.5 + pCos * lengthPx * 0.08;
  const ctlY = y0 + sin * lengthPx * 0.5 + pSin * lengthPx * 0.08;

  // Main stem
  const stem = document.createElementNS(NS, 'path');
  stem.setAttribute('d', `M ${x0},${y0} Q ${ctlX},${ctlY} ${tipX},${tipY}`);
  stem.setAttribute('stroke', color); stem.setAttribute('stroke-width', 1.7);
  stem.setAttribute('fill', 'none'); stem.setAttribute('stroke-linecap', 'round');
  cg.appendChild(stem);

  // Pinnate leaflets: 8 pairs along the bezier
  const numPairs = 8;
  for (let i = 1; i <= numPairs; i++) {
    const t = i / (numPairs + 1);
    // Point on quadratic bezier at t
    const bx = (1-t)*(1-t)*x0 + 2*t*(1-t)*ctlX + t*t*tipX;
    const by = (1-t)*(1-t)*y0 + 2*t*(1-t)*ctlY + t*t*tipY;
    // Leaflet length: wider in the middle, tapering toward tip
    const scale = Math.sin(t * Math.PI) * 0.85 + 0.15;
    const lLen = lengthPx * 0.22 * scale;

    for (const side of [-1, 1]) {
      const lx = bx + pCos * lLen * side;
      const ly = by + pSin * lLen * side;
      // Slight forward lean along stem direction
      const mx = (bx + lx) / 2 + cos * lLen * 0.15;
      const my = (by + ly) / 2 + sin * lLen * 0.15;
      const leaf = document.createElementNS(NS, 'path');
      leaf.setAttribute('d', `M ${bx},${by} Q ${mx},${my} ${lx},${ly}`);
      leaf.setAttribute('stroke', color); leaf.setAttribute('stroke-width', 0.9);
      leaf.setAttribute('fill', 'none');
      cg.appendChild(leaf);
    }
  }

  // Fiddlehead spiral at tip: small outward-curling hook
  const sr = lengthPx * 0.055;
  const spiral = document.createElementNS(NS, 'path');
  spiral.setAttribute('d', [
    `M ${tipX},${tipY}`,
    `Q ${tipX + pCos*sr*2 - cos*sr},${tipY + pSin*sr*2 - sin*sr}`,
    `  ${tipX + pCos*sr*3},${tipY + pSin*sr*3}`,
    `Q ${tipX + pCos*sr*2 + cos*sr*2},${tipY + pSin*sr*2 + sin*sr*2}`,
    `  ${tipX + pCos*sr*0.5 + cos*sr*2},${tipY + pSin*sr*0.5 + sin*sr*2}`,
  ].join(' '));
  spiral.setAttribute('stroke', color); spiral.setAttribute('stroke-width', 1.2);
  spiral.setAttribute('fill', 'none'); spiral.setAttribute('stroke-linecap', 'round');
  cg.appendChild(spiral);
}

// Draws a 5-petal flower. size: petal reach from center in px.
// petalColor/centerColor: CSS color strings.
function drawCoralFlower(cg, cx, cy, size, petalColor, centerColor, NS) {
  const fg = document.createElementNS(NS, 'g');
  fg.setAttribute('transform', `translate(${cx},${cy})`);
  for (let i = 0; i < 5; i++) {
    const petal = document.createElementNS(NS, 'ellipse');
    // Each petal: ellipse above center, rotated i*72° around the flower center
    petal.setAttribute('cx', 0); petal.setAttribute('cy', -size);
    petal.setAttribute('rx', size * 0.5); petal.setAttribute('ry', size * 0.8);
    petal.setAttribute('transform', `rotate(${i * 72})`);
    petal.setAttribute('fill', petalColor);
    petal.setAttribute('stroke', '#2a2a2a'); petal.setAttribute('stroke-width', 0.8);
    fg.appendChild(petal);
  }
  const ctr = document.createElementNS(NS, 'circle');
  ctr.setAttribute('cx', 0); ctr.setAttribute('cy', 0); ctr.setAttribute('r', size * 0.42);
  ctr.setAttribute('fill', centerColor);
  ctr.setAttribute('stroke', '#2a2a2a'); ctr.setAttribute('stroke-width', 0.8);
  fg.appendChild(ctr);
  cg.appendChild(fg);
}

function drawWallBotanical(g, x, y, w, h, seed, id) {
  const NS = 'http://www.w3.org/2000/svg';
  const rnd = seededRand(seed);
  const sc = 15; // fixed px scale — pattern renders at 450×375px regardless of cm scale

  // Clip to wall bounds — clipPath lives inside g so it works before g is in the DOM
  const clipId = `wp-clip-${id}`;
  const localDefs = document.createElementNS(NS, 'defs');
  const clip = document.createElementNS(NS, 'clipPath');
  clip.setAttribute('id', clipId);
  const cr = document.createElementNS(NS, 'rect');
  cr.setAttribute('x', x); cr.setAttribute('y', y);
  cr.setAttribute('width', w); cr.setAttribute('height', h);
  clip.appendChild(cr);
  localDefs.appendChild(clip);
  g.appendChild(localDefs);

  const cg = document.createElementNS(NS, 'g');
  cg.setAttribute('clip-path', `url(#${clipId})`);

  // Background fills the full wall; motifs are drawn at fixed scale anchored at top-left
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('x', x); bg.setAttribute('y', y);
  bg.setAttribute('width', w); bg.setAttribute('height', h);
  bg.setAttribute('fill', '#f5f0e4');
  cg.appendChild(bg);

  // Seeded fern greens (3 slight variations)
  const fernH = 110 + rnd() * 20;
  const fernS = 35 + rnd() * 15;
  const fernL = 28 + rnd() * 12;
  const fern1 = `hsl(${fernH | 0},${fernS | 0}%,${fernL | 0}%)`;
  const fern2 = `hsl(${(fernH + 8*rnd()) | 0},${(fernS - 5) | 0}%,${(fernL + 5) | 0}%)`;
  const fern3 = `hsl(${(fernH - 5*rnd()) | 0},${(fernS + 8) | 0}%,${(fernL - 4) | 0}%)`;

  // Seeded flower colors (pastel coral/rose/peach range)
  const fh1 = rnd() * 22;
  const flower1  = `hsl(${fh1 | 0},${(72 + rnd()*14) | 0}%,${(66 + rnd()*10) | 0}%)`;
  const flower1c = `hsl(${fh1 | 0},${(50 + rnd()*15) | 0}%,${(80 + rnd()*8) | 0}%)`;
  const fh2 = rnd() * 18;
  const flower2  = `hsl(${fh2 | 0},${(68 + rnd()*14) | 0}%,${(63 + rnd()*12) | 0}%)`;
  const flower2c = `hsl(${fh2 | 0},${(45 + rnd()*15) | 0}%,${(78 + rnd()*8) | 0}%)`;

  // Branch helper
  const px = (dx, dy) => `${x + dx*sc},${y + dy*sc}`;
  function branch(d, sw) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d); p.setAttribute('stroke', '#2a2a2a');
    p.setAttribute('stroke-width', sw); p.setAttribute('fill', 'none');
    p.setAttribute('stroke-linecap', 'round');
    cg.appendChild(p);
  }

  // Two thin branch structures
  branch(`M ${px(1.5,25)} Q ${px(1,15)} ${px(2,5)} Q ${px(2.5,1)} ${px(4,-1)}`, 3.5);
  branch(`M ${px(1.8,18)} Q ${px(-0.5,15)} ${px(-2.5,13)}`, 2);
  branch(`M ${px(2.2,12)} Q ${px(6,9)} ${px(10,7)}`, 2);
  branch(`M ${px(18,25)} Q ${px(19,15)} ${px(18,5)} Q ${px(17,1)} ${px(16,-1)}`, 3);
  branch(`M ${px(18.5,18)} Q ${px(21,15)} ${px(24,13)}`, 1.8);
  branch(`M ${px(18,12)} Q ${px(14,9)} ${px(11,7)}`, 1.8);
  branch(`M ${px(11,7)} Q ${px(14,5)} ${px(16,3)}`, 1.5);

  // Fern fronds (angle: 0=right, -90=up, 180=left, 270=down)
  const fl = sc * 8; // 8cm frond length
  drawFernFrond(cg, x - 2*sc,  y + 13*sc, -40,  fl * 1.1, fern1, NS); // sweeps upper-left
  drawFernFrond(cg, x - 2*sc,  y + 13*sc, -10,  fl * 0.9, fern2, NS); // sweeps up from left
  drawFernFrond(cg, x + 2.2*sc,y + 12*sc, -70,  fl * 0.95,fern1, NS); // right from branch
  drawFernFrond(cg, x + 4*sc,  y - 1*sc,  -50,  fl * 0.8, fern3, NS); // trunk tip
  drawFernFrond(cg, x + 24*sc, y + 13*sc, -140, fl * 1.05,fern2, NS); // right side upper-right
  drawFernFrond(cg, x + 24*sc, y + 13*sc, -160, fl * 0.9, fern1, NS); // right side up
  drawFernFrond(cg, x + 18*sc, y + 12*sc, -110, fl * 0.9, fern3, NS); // left from right branch
  drawFernFrond(cg, x + 1.5*sc,y + 25*sc,  200, fl * 0.65,fern2, NS); // base left
  drawFernFrond(cg, x + 18*sc, y + 25*sc,  160, fl * 0.65,fern1, NS); // base right
  if (rnd() > 0.3) {
    drawFernFrond(cg, x + 11*sc, y + 8*sc, -90, fl * 0.7, fern3, NS); // optional center frond
  }

  // Coral flowers
  drawCoralFlower(cg, x + 12*sc, y + 10*sc, sc * 1.6, flower1, flower1c, NS);
  drawCoralFlower(cg, x + 7*sc,  y + 17*sc, sc * 1.2, flower2, flower2c, NS);
  if (rnd() > 0.4) {
    drawCoralFlower(cg, x + 20*sc, y + 16*sc, sc * 1.1, flower1, flower1c, NS);
  }

  // Small line-art daisies scattered in negative space
  function daisy(dcx, dcy, dsize) {
    for (let i = 0; i < 5; i++) {
      const a = (i * 72 - 90) * Math.PI / 180;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', dcx + Math.cos(a) * dsize);
      c.setAttribute('cy', dcy + Math.sin(a) * dsize);
      c.setAttribute('r', dsize * 0.55);
      c.setAttribute('fill', 'none'); c.setAttribute('stroke', '#2a2a2a'); c.setAttribute('stroke-width', 0.75);
      cg.appendChild(c);
    }
    const cc = document.createElementNS(NS, 'circle');
    cc.setAttribute('cx', dcx); cc.setAttribute('cy', dcy); cc.setAttribute('r', dsize * 0.35);
    cc.setAttribute('fill', 'none'); cc.setAttribute('stroke', '#2a2a2a'); cc.setAttribute('stroke-width', 0.75);
    cg.appendChild(cc);
  }
  daisy(x + 5*sc,  y + 8*sc,  sc * 0.70);
  daisy(x + 15*sc, y + 5*sc,  sc * 0.65);
  daisy(x + 22*sc, y + 9*sc,  sc * 0.60);
  daisy(x + 9*sc,  y + 20*sc, sc * 0.55);

  g.appendChild(cg);

  // Wall border and ledge drawn on top (not clipped)
  const border = document.createElementNS(NS, 'rect');
  border.setAttribute('x', x); border.setAttribute('y', y);
  border.setAttribute('width', w); border.setAttribute('height', h);
  border.setAttribute('fill', 'none'); border.setAttribute('stroke', '#8a7a60');
  border.setAttribute('stroke-width', 1.5);
  g.appendChild(border);

  const ledgeY = y + Math.min(3, h * 0.05);
  const ledge = document.createElementNS(NS, 'line');
  ledge.setAttribute('x1', x); ledge.setAttribute('y1', ledgeY);
  ledge.setAttribute('x2', x + w); ledge.setAttribute('y2', ledgeY);
  ledge.setAttribute('stroke', '#8a7a60'); ledge.setAttribute('stroke-width', 1);
  ledge.setAttribute('opacity', '0.5');
  g.appendChild(ledge);
}

function drawWallDisco(g, x, y, w, h, seed, id) {
  const NS = 'http://www.w3.org/2000/svg';
  const rnd = seededRand(seed);
  const sc = 15; // fixed px scale — pattern renders at 450×375px regardless of cm scale

  // clipPath and glow filter live inside g so they work before g is in the DOM
  const clipId = `wp-clip-${id}`;
  const glowId = `wp-glow-${id}`;
  const localDefs = document.createElementNS(NS, 'defs');
  const clip = document.createElementNS(NS, 'clipPath');
  clip.setAttribute('id', clipId);
  const cr = document.createElementNS(NS, 'rect');
  cr.setAttribute('x', x); cr.setAttribute('y', y);
  cr.setAttribute('width', w); cr.setAttribute('height', h);
  clip.appendChild(cr);
  localDefs.appendChild(clip);
  const filt = document.createElementNS(NS, 'filter');
  filt.setAttribute('id', glowId);
  filt.setAttribute('x', '-30%'); filt.setAttribute('y', '-30%');
  filt.setAttribute('width', '160%'); filt.setAttribute('height', '160%');
  const blur = document.createElementNS(NS, 'feGaussianBlur');
  blur.setAttribute('stdDeviation', '5'); blur.setAttribute('result', 'b');
  const merge = document.createElementNS(NS, 'feMerge');
  const mn1 = document.createElementNS(NS, 'feMergeNode'); mn1.setAttribute('in', 'b');
  const mn2 = document.createElementNS(NS, 'feMergeNode'); mn2.setAttribute('in', 'SourceGraphic');
  merge.appendChild(mn1); merge.appendChild(mn2);
  filt.appendChild(blur); filt.appendChild(merge);
  localDefs.appendChild(filt);
  g.appendChild(localDefs);

  const cg = document.createElementNS(NS, 'g');
  cg.setAttribute('clip-path', `url(#${clipId})`);

  // Scene always fills the full wall — beams use fractions of w/h so any size looks right
  const W = w, H = h;

  // Seed-derived colors: two complementary hues
  const hue1 = rnd() * 360;
  const hue2 = (hue1 + 115 + rnd() * 90) % 360;
  // Beam count: 4-8 per side (8-16 total)
  const beamCount = Math.floor(4 + rnd() * 5);
  // Small angle variation for organic feel (fraction of W)
  const angleVar = rnd() * 0.06; // fraction of W (was 0.18 * sc / 30*sc)

  // Background fills full wall
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('x', x); bg.setAttribute('y', y);
  bg.setAttribute('width', W); bg.setAttribute('height', H);
  bg.setAttribute('fill', `hsl(${hue1 | 0},20%,4%)`);
  cg.appendChild(bg);

  // Beams with glow — all positions as fractions of W and H
  const beamGroup = document.createElementNS(NS, 'g');
  beamGroup.setAttribute('filter', `url(#${glowId})`);
  const bwSrc = W * 0.01;  // half-width at source
  const bwDst = W * 0.017; // half-width at destination (slight fan)

  // Left-origin beams: sources across left 47% of W, raking to right
  for (let i = 0; i < beamCount; i++) {
    const t = beamCount > 1 ? i / (beamCount - 1) : 0.5;
    const srcX = x + t * 0.467 * W;
    const dstX = x + (0.267 + t * (0.467 + angleVar)) * W;
    const alpha = (0.48 - i * 0.02).toFixed(2);
    const beam = document.createElementNS(NS, 'polygon');
    beam.setAttribute('points',
      `${srcX - bwSrc},${y} ${srcX + bwSrc},${y} ${dstX + bwDst},${y + H} ${dstX - bwDst},${y + H}`);
    beam.setAttribute('fill', `hsla(${hue1 | 0},90%,62%,${alpha})`);
    beamGroup.appendChild(beam);
  }

  // Right-origin beams: sources across right 47% of W, raking to left
  for (let i = 0; i < beamCount; i++) {
    const t = beamCount > 1 ? i / (beamCount - 1) : 0.5;
    const srcX = x + (0.533 + t * 0.467) * W;
    const dstX = x + (0.067 + t * (0.467 - angleVar)) * W;
    const alpha = (0.48 - i * 0.02).toFixed(2);
    const beam = document.createElementNS(NS, 'polygon');
    beam.setAttribute('points',
      `${srcX - bwSrc},${y} ${srcX + bwSrc},${y} ${dstX + bwDst},${y + H} ${dstX - bwDst},${y + H}`);
    beam.setAttribute('fill', `hsla(${hue2 | 0},90%,62%,${alpha})`);
    beamGroup.appendChild(beam);
  }

  // Crossing-zone glow at center
  const glow = document.createElementNS(NS, 'ellipse');
  glow.setAttribute('cx', x + 0.5 * W); glow.setAttribute('cy', y + 0.72 * H);
  glow.setAttribute('rx', 0.133 * W);   glow.setAttribute('ry', 0.1 * H);
  glow.setAttribute('fill', `hsla(${((hue1 + hue2) / 2) | 0},60%,90%,0.15)`);
  beamGroup.appendChild(glow);

  cg.appendChild(beamGroup);

  // Fixture dots: left group (hue1 tinted)
  for (let i = 0; i < beamCount; i++) {
    const t = beamCount > 1 ? i / (beamCount - 1) : 0.5;
    const srcX = x + t * 0.467 * W;
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', srcX); dot.setAttribute('cy', y + 3);
    dot.setAttribute('r', '2.5');
    dot.setAttribute('fill', `hsl(${(hue1 + 40) | 0},90%,80%)`);
    dot.setAttribute('opacity', '0.9');
    cg.appendChild(dot);
  }
  // Fixture dots: right group (hue2 tinted)
  for (let i = 0; i < beamCount; i++) {
    const t = beamCount > 1 ? i / (beamCount - 1) : 0.5;
    const srcX = x + (0.533 + t * 0.467) * W;
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', srcX); dot.setAttribute('cy', y + 3);
    dot.setAttribute('r', '2.5');
    dot.setAttribute('fill', `hsl(${(hue2 + 40) | 0},90%,80%)`);
    dot.setAttribute('opacity', '0.9');
    cg.appendChild(dot);
  }

  g.appendChild(cg);

  // Wall border (colored with hue1 for atmosphere)
  const border = document.createElementNS(NS, 'rect');
  border.setAttribute('x', x); border.setAttribute('y', y);
  border.setAttribute('width', w); border.setAttribute('height', h);
  border.setAttribute('fill', 'none');
  border.setAttribute('stroke', `hsl(${hue1 | 0},55%,35%)`);
  border.setAttribute('stroke-width', '1.5');
  g.appendChild(border);

  // Top ledge
  const ledgeY = y + Math.min(3, h * 0.05);
  const ledge = document.createElementNS(NS, 'line');
  ledge.setAttribute('x1', x); ledge.setAttribute('y1', ledgeY);
  ledge.setAttribute('x2', x + w); ledge.setAttribute('y2', ledgeY);
  ledge.setAttribute('stroke', `hsl(${hue1 | 0},55%,35%)`);
  ledge.setAttribute('stroke-width', '1'); ledge.setAttribute('opacity', '0.5');
  g.appendChild(ledge);
}

function drawDesk(g, x, y, w, h) {
  // Tabletop
  svgRect(g, x, y, w, h * 0.12, '#8B4513', '#5a3010');
  // Legs (two vertical lines)
  const legW = w * 0.04, legH = h * 0.88;
  svgRect(g, x + w*0.05, y + h*0.12, legW, legH, '#6B3410', '#5a3010');
  svgRect(g, x + w*0.91, y + h*0.12, legW, legH, '#6B3410', '#5a3010');
}

function drawChair(g, x, y, w, h) {
  // Seat
  svgRect(g, x, y + h*0.4, w, h*0.1, '#4a90d9', '#2a6ab9');
  // Back
  svgRect(g, x, y, w*0.1, h*0.45, '#4a90d9', '#2a6ab9');
  // Legs
  const legW = w * 0.1;
  svgRect(g, x + w*0.1, y+h*0.5, legW, h*0.5, '#4a90d9', '#2a6ab9');
  svgRect(g, x + w*0.9 - legW, y+h*0.5, legW, h*0.5, '#4a90d9', '#2a6ab9');
}

function drawStairs(g, x, y, w, h, steps) {
  const sw = w / steps, sh = h / steps;
  for (let i = 0; i < steps; i++) {
    svgRect(g, x + i*sw, y + (steps-1-i)*sh, sw, h - (steps-1-i)*sh, '#888', '#555');
  }
  // Railing: diagonal handrail parallel to stair slope + vertical posts at each end
  const railH = h * 0.30;
  const railColor = '#bbb', postColor = '#999';
  const railW = 2.5;
  // Vertical post at bottom-left (base of lowest step)
  svgLine(g, x,   y+h,         x,   y+h-railH,   postColor, railW);
  // Vertical post at top-right (top of highest step)
  svgLine(g, x+w, y,           x+w, y-railH,      postColor, railW);
  // Diagonal handrail connecting tops of both posts
  svgLine(g, x,   y+h-railH,   x+w, y-railH,      railColor, railW + 0.5);
}

function drawBookshelf(g, x, y, w, h, borderWidth = 6) {
  const outer = svgRect(g, x, y, w, h, '#8B4513', '#5a3010');
  outer.setAttribute('stroke-width', borderWidth);
  // 1 shelf line (2 sections)
  svgLine(g, x+w*0.05, y+h*0.5, x+w*0.95, y+h*0.5, '#5a3010', 3);
}

function getCouchPalette(theme) {
  switch (theme) {
    case 'silver':  return { fabric: '#b0bcc8', shadow: '#7a8a9a', btn: '#909dab', wood: '#7a7a7a', woodDk: '#5a5a5a' };
    case 'pink':    return { fabric: '#e8a0b4', shadow: '#c07080', btn: '#d0889c', wood: '#7a5230', woodDk: '#5a3a20' };
    case 'purple':  return { fabric: '#9a7bc0', shadow: '#705898', btn: '#8568b0', wood: '#5a3a5a', woodDk: '#3a2040' };
    case 'gold':    return { fabric: '#c8a050', shadow: '#9a7030', btn: '#b08840', wood: '#7a5230', woodDk: '#5a3a20' };
    case 'rainbow': return {
      rainbow: true,
      armL: '#e85a5a', armR: '#9a5ae8',
      backL: '#e8a050', backR: '#e8e050',
      seatL: '#5ab860', seatR: '#5a90e8',
      skirt: '#d060c0', btn: '#e85aa0',
      shadow: '#2a3a5a', wood: '#7a5230', woodDk: '#5a3a20',
    };
    default:        return { fabric: '#7a9bb5', shadow: '#5a7a94', btn: '#5e7d96', wood: '#7a5230', woodDk: '#5a3a20' };
  }
}

function drawCouch(g, x, y, w, h, theme = 'blue') {
  const NS = 'http://www.w3.org/2000/svg';
  const p = getCouchPalette(theme);

  const armW   = w * 0.08;
  const legH   = h * 0.16;
  const bodyH  = h - legH;

  // Vertical zones (proportions of bodyH, bottom-up):
  const skirtH = bodyH * 0.10;
  const seatH  = bodyH * 0.30;
  const upperH = bodyH - seatH - skirtH; // above-seat zone = where back & arm heights are measured

  const seatY     = y + upperH;           // top of seat cushions in SVG coords
  // Back cushions are 15% taller than upperH; arms reduced 15% from previous height
  const backH     = upperH * 1.15;
  const armAbove  = upperH / 1.15 * 0.85;         // arm height above seat
  const armTopY   = seatY - armAbove;

  const innerX = x + armW;
  const innerW = w - armW * 2;
  const gap    = innerW * 0.025;
  const cushW  = (innerW - gap) / 2;

  // — Legs —
  const legW = w * 0.042;
  function drawLeg(lx) {
    const poly = document.createElementNS(NS, 'polygon');
    const top = y + bodyH, bot = y + h;
    poly.setAttribute('points', `${lx},${top} ${lx+legW},${top} ${lx+legW*0.7},${bot} ${lx+legW*0.3},${bot}`);
    poly.setAttribute('fill', p.wood); poly.setAttribute('stroke', p.woodDk); poly.setAttribute('stroke-width', 1);
    g.appendChild(poly);
  }
  drawLeg(x + armW * 0.3);
  drawLeg(x + w - armW * 0.3 - legW);

  // — Arms —
  svgRect(g, x,            armTopY, armW, bodyH - (armTopY - y), p.rainbow ? p.armL  : p.fabric, p.shadow);
  svgRect(g, x + w - armW, armTopY, armW, bodyH - (armTopY - y), p.rainbow ? p.armR  : p.fabric, p.shadow);

  // — Back cushions —
  svgRect(g, innerX,           y, cushW, backH, p.rainbow ? p.backL : p.fabric, p.shadow);
  svgRect(g, innerX+cushW+gap, y, cushW, backH, p.rainbow ? p.backR : p.fabric, p.shadow);

  // — Cushion buttons —
  const btnR = cushW * 0.044;
  function drawButton(cx, cy) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', btnR);
    c.setAttribute('fill', p.btn); c.setAttribute('stroke', p.shadow); c.setAttribute('stroke-width', 0.5);
    g.appendChild(c);
  }
  drawButton(innerX + cushW / 2,           y + backH * 0.50);
  drawButton(innerX+cushW+gap + cushW / 2, y + backH * 0.50);

  // — Seat cushions —
  svgRect(g, innerX,           seatY, cushW, seatH, p.rainbow ? p.seatL : p.fabric, p.shadow);
  svgRect(g, innerX+cushW+gap, seatY, cushW, seatH, p.rainbow ? p.seatR : p.fabric, p.shadow);

  // — Skirt —
  svgRect(g, innerX, seatY + seatH, innerW, skirtH, p.rainbow ? p.skirt : p.shadow, p.shadow);
}

// Returns array of { x1, x2, y } surface segments (top of each surface on this item)
// Coordinates are in cm (not px)
export function getSurfaces(item) {
  const surfaces = [];
  const x = item.x, y = item.y, w = item.width, h = item.height;
  switch (item.subtype) {
    case 'desk': surfaces.push({ x1: x, x2: x+w, y: y }); break;
    case 'wall': surfaces.push({ x1: x, x2: x+w, y: y }); break;
    case 'chair':
      surfaces.push({ x1: x, x2: x+w, y: y+h*0.4 }); // seat
      break;
    case 'stairs': {
      const steps = item.stepCount || 6;
      const sw = w / steps;
      for (let i = 0; i < steps; i++) {
        const stepY = y + h * (steps - 1 - i) / steps;
        if (item.flipped) {
          surfaces.push({ x1: x + (steps-1-i)*sw, x2: x + (steps-i)*sw, y: stepY });
        } else {
          surfaces.push({ x1: x + i*sw, x2: x + (i+1)*sw, y: stepY });
        }
      }
      break;
    }
    case 'bookshelf': {
      const rotation = item.rotation || 0;
      if (rotation === 90 || rotation === 270) {
        // Horizontal orientation: top of rotated shape is the only useful snap surface
        const bsCx = x + w / 2, bsCy = y + h / 2;
        surfaces.push({ x1: bsCx - h/2, x2: bsCx + h/2, y: bsCy - w/2 }); // top face
      } else {
        surfaces.push({ x1: x, x2: x+w, y: y });        // top
        surfaces.push({ x1: x, x2: x+w, y: y+h*0.5 }); // mid shelf
        surfaces.push({ x1: x, x2: x+w, y: y+h });      // bottom shelf floor
      }
      break;
    }
    case 'couch': {
      const armW  = w * 0.08;
      const bodyH = h * 0.84; // legH=16%
      const skirtH = bodyH * 0.10, seatH = bodyH * 0.30;
      const upperH = bodyH - seatH - skirtH;
      const armAbove = upperH / 1.15 * 0.85;
      const armTopOffset = upperH - armAbove;
      surfaces.push({ x1: x + armW, x2: x + w - armW, y: y + upperH }); // seat top
      surfaces.push({ x1: x, x2: x + armW, y: y + armTopOffset });       // left arm top
      surfaces.push({ x1: x + w - armW, x2: x + w, y: y + armTopOffset }); // right arm top
      break;
    }
  }
  return surfaces;
}

export function drawEnvIcon(subtype, g, x, y, w, h) {
  switch (subtype) {
    case 'desk':      drawDesk(g, x, y, w, h); break;
    case 'chair':     drawChair(g, x, y, w, h); break;
    case 'stairs':    drawStairs(g, x, y, w, h, 6); break;
    case 'bookshelf': drawBookshelf(g, x, y, w, h, Math.max(1, Math.min(w, h) * 0.05)); break;
    case 'couch':     drawCouch(g, x, y, w, h, 'blue'); break;
    case 'wall':      drawWall(g, x, y, w, h, { wallStyle: 'cream', wallSeed: 0, id: 'icon' }); break;
  }
}
