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

  // Vertical board lines at fixed 0.7 cm spacing (windowing: spacing is fixed, wall width is the viewport)
  const spacing = cmToPx(0.7);
  for (let lx = x + spacing; lx < x + w; lx += spacing) {
    // Board edge line
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', lx); line.setAttribute('y1', y);
    line.setAttribute('x2', lx); line.setAttribute('y2', y + h);
    line.setAttribute('stroke', '#c0c0bc'); line.setAttribute('stroke-width', 1.5);
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
