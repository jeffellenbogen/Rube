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
    case 'stairs': drawStairs(g, x, y, w, h, item.stepCount || 4); break;
    case 'bookshelf': drawBookshelf(g, x, y, w, h); break;
    case 'couch': drawCouch(g, x, y, w, h); break;
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
  svgLine(g, x+w*0.1, y+h*0.5, x+w*0.1, y+h, '#2a6ab9', 3);
  svgLine(g, x+w*0.9, y+h*0.5, x+w*0.9, y+h, '#2a6ab9', 3);
}

function drawStairs(g, x, y, w, h, steps) {
  const sw = w / steps, sh = h / steps;
  for (let i = 0; i < steps; i++) {
    svgRect(g, x + i*sw, y + (steps-1-i)*sh, sw, h - (steps-1-i)*sh, '#888', '#555');
  }
  // Railing
  svgLine(g, x, y, x+w, y, '#aaa', 3);
}

function drawBookshelf(g, x, y, w, h) {
  svgRect(g, x, y, w, h, '#8B4513', '#5a3010');
  // 3 shelf lines
  for (let i = 1; i <= 3; i++) {
    svgLine(g, x+w*0.05, y+h*(i/4), x+w*0.95, y+h*(i/4), '#5a3010', 3);
  }
}

function drawCouch(g, x, y, w, h) {
  const NS = 'http://www.w3.org/2000/svg';
  const fabric = '#7a9bb5';
  const shadow = '#5a7a94';
  const wood   = '#7a5230';
  const woodDk = '#5a3a20';

  const armW   = w * 0.08;
  const legH   = h * 0.16;
  const bodyH  = h - legH;

  // Vertical zones (proportions of bodyH, bottom-up):
  const skirtH = bodyH * 0.10;
  const seatH  = bodyH * 0.30;
  const upperH = bodyH - seatH - skirtH; // above-seat zone = where back & arm heights are measured

  const seatY     = y + upperH;           // top of seat cushions in SVG coords
  // Back cushions fill the full upper zone; arms are 15% shorter (top flush to y)
  const armTopY   = y + upperH * (1 - 1 / 1.15); // arms start this far below top

  const innerX = x + armW;
  const innerW = w - armW * 2;
  const gap    = innerW * 0.025;
  const cushW  = (innerW - gap) / 2;

  // — Legs —
  const legW = w * 0.028;
  function drawLeg(lx) {
    const poly = document.createElementNS(NS, 'polygon');
    const top = y + bodyH, bot = y + h;
    poly.setAttribute('points', `${lx},${top} ${lx+legW},${top} ${lx+legW*0.55},${bot} ${lx+legW*0.45},${bot}`);
    poly.setAttribute('fill', wood); poly.setAttribute('stroke', woodDk); poly.setAttribute('stroke-width', 1);
    g.appendChild(poly);
  }
  drawLeg(x + armW * 0.3);
  drawLeg(x + w - armW * 0.3 - legW);
  drawLeg(x + armW + innerW * 0.22);
  drawLeg(x + armW + innerW * 0.78 - legW);

  // — Arms: boxy, shorter than back cushions by 15% —
  svgRect(g, x,           armTopY, armW, bodyH - (armTopY - y), fabric, shadow);
  svgRect(g, x + w - armW, armTopY, armW, bodyH - (armTopY - y), fabric, shadow);

  // — Back cushions: full upper zone height, poke above arms —
  svgRect(g, innerX,            y, cushW, upperH, fabric, shadow);
  svgRect(g, innerX+cushW+gap,  y, cushW, upperH, fabric, shadow);

  // — Seat cushions —
  svgRect(g, innerX,            seatY, cushW, seatH, fabric, shadow);
  svgRect(g, innerX+cushW+gap,  seatY, cushW, seatH, fabric, shadow);

  // — Skirt —
  svgRect(g, innerX, seatY + seatH, innerW, skirtH, shadow, shadow);
}

// Returns array of { x1, x2, y } surface segments (top of each surface on this item)
// Coordinates are in cm (not px)
export function getSurfaces(item) {
  const surfaces = [];
  const x = item.x, y = item.y, w = item.width, h = item.height;
  switch (item.subtype) {
    case 'desk': surfaces.push({ x1: x, x2: x+w, y: y }); break;
    case 'chair':
      surfaces.push({ x1: x, x2: x+w, y: y+h*0.4 }); // seat
      break;
    case 'stairs':
      for (let i = 0; i < (item.stepCount||4); i++) {
        const sw = w/(item.stepCount||4);
        surfaces.push({ x1: x+i*sw, x2: x+(i+1)*sw, y: y+h*((item.stepCount||4)-1-i)/(item.stepCount||4) });
      }
      break;
    case 'bookshelf':
      [1,2,3].forEach(i => surfaces.push({ x1: x, x2: x+w, y: y+h*(i/4) }));
      break;
    case 'couch': {
      const armW  = w * 0.08;
      const bodyH = h * 0.84; // legH=16%
      const skirtH = bodyH * 0.10, seatH = bodyH * 0.30;
      const upperH = bodyH - seatH - skirtH;
      const armTopOffset = upperH * (1 - 1 / 1.15);
      surfaces.push({ x1: x + armW, x2: x + w - armW, y: y + upperH }); // seat top
      surfaces.push({ x1: x, x2: x + armW, y: y + armTopOffset });       // left arm top
      surfaces.push({ x1: x + w - armW, x2: x + w, y: y + armTopOffset }); // right arm top
      break;
    }
  }
  return surfaces;
}
