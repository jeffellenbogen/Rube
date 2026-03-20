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
    case 'shelf': drawShelf(g, x, y, w, h); break;
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

function drawShelf(g, x, y, w, h) {
  svgRect(g, x, y, w, h, '#D2691E', '#8B4513');
  // Brackets
  svgLine(g, x+w*0.1, y+h, x+w*0.1, y+h+cmToPx(5), '#888', 2);
  svgLine(g, x+w*0.9, y+h, x+w*0.9, y+h+cmToPx(5), '#888', 2);
}

function drawBookshelf(g, x, y, w, h) {
  svgRect(g, x, y, w, h, '#8B4513', '#5a3010');
  // 3 shelf lines
  for (let i = 1; i <= 3; i++) {
    svgLine(g, x+w*0.05, y+h*(i/4), x+w*0.95, y+h*(i/4), '#5a3010', 3);
  }
}

function drawCouch(g, x, y, w, h) {
  // Seat cushion
  svgRect(g, x+w*0.1, y+h*0.5, w*0.8, h*0.3, '#c47a3c', '#8B4513');
  // Back
  svgRect(g, x, y, w*0.1, h*0.8, '#c47a3c', '#8B4513');
  // Arms
  svgRect(g, x, y+h*0.3, w*0.12, h*0.7, '#a0602a', '#8B4513');
  svgRect(g, x+w*0.88, y+h*0.3, w*0.12, h*0.7, '#a0602a', '#8B4513');
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
    case 'shelf': surfaces.push({ x1: x, x2: x+w, y: y }); break;
    case 'bookshelf':
      [1,2,3].forEach(i => surfaces.push({ x1: x, x2: x+w, y: y+h*(i/4) }));
      break;
    case 'couch':
      surfaces.push({ x1: x+w*0.1, x2: x+w*0.9, y: y+h*0.5 }); // seat
      surfaces.push({ x1: x, x2: x+w*0.12, y: y+h*0.3 }); // left arm
      surfaces.push({ x1: x+w*0.88, x2: x+w, y: y+h*0.3 }); // right arm
      break;
  }
  return surfaces;
}
