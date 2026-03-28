import { drawMachineIcon } from './render/machines.js';
import { drawMaterialIcon } from './render/materials.js';
import { drawEnvIcon } from './render/environment.js';

const NS = 'http://www.w3.org/2000/svg';
let currentCard = 0;
let currentTab  = 'guide';

// ── SVG helper ────────────────────────────────────────────────────────
function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// ── Illustrations ─────────────────────────────────────────────────────
function drawWelcomeIllustration(svg) {
  svg.setAttribute('viewBox', '0 0 140 110');
  svg.setAttribute('width', '280'); svg.setAttribute('height', '220');
  el('rect', { x:0, y:0, width:140, height:110, fill:'#060e1a' }, svg);
  // Left panel
  el('rect', { x:2, y:2, width:24, height:106, fill:'#0d1f35', stroke:'#1a3a5c', 'stroke-width':1 }, svg);
  for (let i = 0; i < 4; i++)
    el('rect', { x:5, y:8+i*14, width:18, height:10, fill:'#1a3a5c', rx:2 }, svg);
  // Canvas area
  el('rect', { x:28, y:2, width:80, height:106, fill:'#060e1a', stroke:'#1a3a5c', 'stroke-width':0.5 }, svg);
  el('line', { x1:28, y1:98, x2:108, y2:98, stroke:'#4a7a9a', 'stroke-width':1.5 }, svg);
  // Right panel
  el('rect', { x:110, y:2, width:28, height:106, fill:'#0d1f35', stroke:'#1a3a5c', 'stroke-width':1 }, svg);
  el('rect', { x:113, y:8, width:22, height:6, fill:'#1a3a5c', rx:1 }, svg);
  for (let i = 0; i < 3; i++)
    el('rect', { x:113, y:18+i*10, width:14, height:5, fill:'#1a3a5c', rx:1 }, svg);
  // Labels
  function txt(t, x, y, fill = '#5a7a9a') {
    const e = document.createElementNS(NS, 'text');
    e.setAttribute('x', x); e.setAttribute('y', y); e.setAttribute('fill', fill);
    e.setAttribute('font-size', '6'); e.setAttribute('font-family', 'monospace');
    e.setAttribute('text-anchor', 'middle'); e.textContent = t; svg.appendChild(e);
  }
  txt('PARTS',  14,  80); txt('CANVAS', 68, 108); txt('TRACKER', 124, 80);
  el('line', { x1:14,  y1:76, x2:14,  y2:72, stroke:'#ff7b2e', 'stroke-width':1 }, svg);
  el('line', { x1:68,  y1:104,x2:68,  y2:100,stroke:'#ff7b2e', 'stroke-width':1 }, svg);
  el('line', { x1:124, y1:76, x2:124, y2:72, stroke:'#ff7b2e', 'stroke-width':1 }, svg);
}

function drawAddingIllustration(svg) {
  svg.setAttribute('viewBox', '0 0 140 110');
  svg.setAttribute('width', '280'); svg.setAttribute('height', '220');
  el('rect', { x:0, y:0, width:140, height:110, fill:'#060e1a' }, svg);
  // Left panel
  el('rect', { x:2, y:2, width:26, height:106, fill:'#0d1f35', stroke:'#1a3a5c', 'stroke-width':1 }, svg);
  for (let i = 0; i < 4; i++)
    el('rect', { x:5, y:8+i*14, width:20, height:11, fill: i === 1 ? '#2a4a6c' : '#1a3a5c', rx:2 }, svg);
  el('rect', { x:5, y:22, width:20, height:11, fill:'none', stroke:'#ff7b2e', 'stroke-width':1.5, rx:2 }, svg);
  // Canvas
  el('rect', { x:30, y:2, width:108, height:106, fill:'#060e1a', stroke:'#1a3a5c', 'stroke-width':0.5 }, svg);
  el('line', { x1:30, y1:98, x2:138, y2:98, stroke:'#4a7a9a', 'stroke-width':1.5 }, svg);
  // Desk on canvas
  el('rect', { x:65, y:48, width:46, height:8,  fill:'#8B4513', stroke:'#5a3010', 'stroke-width':1, rx:1 }, svg);
  el('rect', { x:68, y:56, width:4,  height:20, fill:'#6B3410', stroke:'#5a3010', 'stroke-width':1 }, svg);
  el('rect', { x:103,y:56, width:4,  height:20, fill:'#6B3410', stroke:'#5a3010', 'stroke-width':1 }, svg);
  // Drag arrow (line + explicit arrowhead)
  el('line', { x1:28, y1:22, x2:58, y2:50, stroke:'#ff7b2e', 'stroke-width':1.5,
    'stroke-dasharray':'3 2' }, svg);
  el('polygon', { points:'54,46 64,50 58,56', fill:'#ff7b2e' }, svg);
}

function drawConnectingIllustration(svg) {
  svg.setAttribute('viewBox', '0 0 140 110');
  svg.setAttribute('width', '280'); svg.setAttribute('height', '220');
  el('rect', { x:0, y:0, width:140, height:110, fill:'#060e1a' }, svg);
  el('line', { x1:0, y1:100, x2:140, y2:100, stroke:'#4a7a9a', 'stroke-width':1.5 }, svg);
  // Lever
  el('rect',    { x:10, y:54, width:44, height:8, fill:'#8B4513', stroke:'#5a3010', 'stroke-width':1, rx:1 }, svg);
  el('polygon', { points:'32,62 36,72 28,72', fill:'#8B4513', stroke:'#5a3010', 'stroke-width':1 }, svg);
  // Ball
  el('circle',  { cx:100, cy:48, r:12, fill:'#f5f5f5', stroke:'#ccc', 'stroke-width':1 }, svg);
  // Connector dots
  el('circle',  { cx:54, cy:58, r:5, fill:'#00c9a7', stroke:'#009a80', 'stroke-width':1 }, svg);
  el('circle',  { cx:88, cy:48, r:5, fill:'#00c9a7', stroke:'#009a80', 'stroke-width':1 }, svg);
  // Link line
  el('line', { x1:54, y1:58, x2:88, y2:48, stroke:'#00c9a7', 'stroke-width':2, 'stroke-dasharray':'4 2' }, svg);
  const lbl = document.createElementNS(NS, 'text');
  lbl.setAttribute('x', 71); lbl.setAttribute('y', 44); lbl.setAttribute('fill', '#00c9a7');
  lbl.setAttribute('font-size', '7'); lbl.setAttribute('font-family', 'monospace');
  lbl.setAttribute('text-anchor', 'middle'); lbl.textContent = '1 step'; svg.appendChild(lbl);
}

function drawChecklistIllustration(svg) {
  svg.setAttribute('viewBox', '0 0 140 110');
  svg.setAttribute('width', '280'); svg.setAttribute('height', '220');
  el('rect', { x:0, y:0, width:140, height:110, fill:'#060e1a' }, svg);
  el('rect', { x:10, y:6, width:120, height:98, fill:'#0d1f35', stroke:'#1a3a5c', 'stroke-width':1, rx:3 }, svg);
  const h = document.createElementNS(NS, 'text');
  h.setAttribute('x', 70); h.setAttribute('y', 20); h.setAttribute('fill', '#5a7a9a');
  h.setAttribute('font-size', '8'); h.setAttribute('font-family', 'monospace');
  h.setAttribute('text-anchor', 'middle'); h.textContent = 'REQUIREMENTS'; svg.appendChild(h);
  [
    { label: '3+ machine types', done: true },
    { label: '5+ steps', done: true },
    { label: 'Lever used', done: true },
    { label: 'Pulley used', done: false },
  ].forEach((item, i) => {
    const y = 34 + i * 16;
    el('rect', { x:18, y:y-7, width:8, height:8,
      fill: item.done ? '#06d6a0' : '#1a3a5c',
      stroke: item.done ? '#06d6a0' : '#4a7a9a', 'stroke-width':1, rx:1 }, svg);
    if (item.done) {
      const ck = document.createElementNS(NS, 'text');
      ck.setAttribute('x', 22); ck.setAttribute('y', y); ck.setAttribute('fill', '#060e1a');
      ck.setAttribute('font-size', '7'); ck.setAttribute('font-family', 'monospace');
      ck.setAttribute('text-anchor', 'middle'); ck.textContent = '✓'; svg.appendChild(ck);
    }
    const lbl = document.createElementNS(NS, 'text');
    lbl.setAttribute('x', 30); lbl.setAttribute('y', y);
    lbl.setAttribute('fill', item.done ? '#c8d8e8' : '#5a7a9a');
    lbl.setAttribute('font-size', '7'); lbl.setAttribute('font-family', 'monospace');
    lbl.textContent = item.label; svg.appendChild(lbl);
  });
  el('rect', { x:18, y:100, width:104, height:6, fill:'#1a3a5c', rx:3 }, svg);
  el('rect', { x:18, y:100, width:80,  height:6, fill:'#ff7b2e', rx:3 }, svg);
}

function drawSavingIllustration(svg) {
  svg.setAttribute('viewBox', '0 0 140 110');
  svg.setAttribute('width', '280'); svg.setAttribute('height', '220');
  el('rect', { x:0, y:0, width:140, height:110, fill:'#060e1a' }, svg);
  // Download button
  el('rect', { x:10, y:28, width:54, height:22, fill:'#0d1f35', stroke:'#1a3a5c', 'stroke-width':1.5, rx:3 }, svg);
  const dl = document.createElementNS(NS, 'text');
  dl.setAttribute('x', 37); dl.setAttribute('y', 43); dl.setAttribute('fill', '#c8d8e8');
  dl.setAttribute('font-size', '9'); dl.setAttribute('font-family', 'monospace');
  dl.setAttribute('text-anchor', 'middle'); dl.textContent = '↓ Download'; svg.appendChild(dl);
  // Upload button
  el('rect', { x:76, y:28, width:54, height:22, fill:'#0d1f35', stroke:'#ff7b2e', 'stroke-width':1.5, rx:3 }, svg);
  const ul = document.createElementNS(NS, 'text');
  ul.setAttribute('x', 103); ul.setAttribute('y', 43); ul.setAttribute('fill', '#ff7b2e');
  ul.setAttribute('font-size', '9'); ul.setAttribute('font-family', 'monospace');
  ul.setAttribute('text-anchor', 'middle'); ul.textContent = '↑ Upload'; svg.appendChild(ul);
  // PNG file icon
  el('rect',    { x:24, y:62, width:24, height:28, fill:'#1a3a5c', stroke:'#4a7a9a', 'stroke-width':1, rx:2 }, svg);
  el('polygon', { points:'38,62 48,62 48,72 38,72', fill:'#0d1f35', stroke:'#4a7a9a', 'stroke-width':1 }, svg);
  const fn = document.createElementNS(NS, 'text');
  fn.setAttribute('x', 36); fn.setAttribute('y', 84); fn.setAttribute('fill', '#5a7a9a');
  fn.setAttribute('font-size', '6'); fn.setAttribute('font-family', 'monospace');
  fn.setAttribute('text-anchor', 'middle'); fn.textContent = 'plan.png'; svg.appendChild(fn);
  // Arrow from upload to file (line + explicit arrowhead)
  el('line', { x1:100, y1:50, x2:56, y2:70, stroke:'#ff7b2e', 'stroke-width':1.5,
    'stroke-dasharray':'3 2' }, svg);
  el('polygon', { points:'60,65 52,74 64,74', fill:'#ff7b2e' }, svg);
}

// ── Guide content ─────────────────────────────────────────────────────
const GUIDE_CARDS = [
  {
    title: 'Welcome',
    description: 'The <em>Rube Goldberg Planner</em> lets you design your machine on screen before you build it. Use the <em>left panel</em> to pick parts, the <em>canvas</em> to place them, and the <em>right panel</em> to track your requirements.',
    draw(svg) { drawWelcomeIllustration(svg); }
  },
  {
    title: 'Adding Components',
    description: 'Drag any item from the left panel onto the canvas. <em>Simple Machines</em> are in the top section. <em>Materials</em> and <em>Environment</em> items are below. Click a placed item to select and move it.',
    draw(svg) { drawAddingIllustration(svg); }
  },
  {
    title: 'Connecting Steps',
    description: 'Click the <em>teal connector dot</em> on one component, then click a dot on another to link them. Each link is one step in your machine. You need at least <em>5 connected steps</em> to meet the goal.',
    draw(svg) { drawConnectingIllustration(svg); }
  },
  {
    title: 'The Checklist',
    description: 'The <em>Requirements</em> panel on the right tracks your progress automatically. Use at least <em>3 different simple machine types</em> and create <em>5 or more connected steps</em> to meet the requirements.',
    draw(svg) { drawChecklistIllustration(svg); }
  },
  {
    title: 'Saving & Loading',
    description: 'Click <em>Download</em> to save your blueprint as a PNG image. To keep working on a saved plan later, click <em>Upload</em> and choose that file — your full plan reloads onto the canvas.',
    draw(svg) { drawSavingIllustration(svg); }
  },
];

// ── Reference icon builder ────────────────────────────────────────────
function makeRefIcon(item) {
  const SIZE = 52, PAD = 5, INNER = SIZE - PAD * 2;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', SIZE); svg.setAttribute('height', SIZE);
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute('overflow', 'hidden');
  svg.style.flexShrink = '0';

  const scale = Math.min(INNER / item.defaultW, INNER / item.defaultH);
  let iw = Math.max(item.defaultW * scale, 8);
  let ih = Math.max(item.defaultH * scale, 8);
  if (item.subtype === 'lever') { ih = INNER * 0.65; iw = INNER; }
  let ox = PAD + (INNER - iw) / 2;
  let oy = PAD + (INNER - ih) / 2;
  if (item.subtype === 'bucket') {
    const OVERHANG = 0.196;
    const bs = Math.min(INNER / item.defaultW, INNER / (item.defaultH * (1 + OVERHANG)));
    iw = item.defaultW * bs; ih = item.defaultH * bs;
    ox = PAD + (INNER - iw) / 2; oy = PAD + ih * OVERHANG;
  }

  const g = document.createElementNS(NS, 'g');
  svg.appendChild(g);
  if (item.type === 'simple_machine')  drawMachineIcon(item.subtype, g, ox, oy, iw, ih);
  else if (item.type === 'material')   drawMaterialIcon(item.subtype, g, ox, oy, iw, ih);
  else if (item.type === 'environment') drawEnvIcon(item.subtype, g, ox, oy, iw, ih);
  return svg;
}

// ── Reference content ─────────────────────────────────────────────────
const QUICK_REF = [
  {
    section: 'SIMPLE MACHINES',
    items: [
      { subtype:'lever',         type:'simple_machine', defaultW:60,  defaultH:16,  label:'Lever',         desc:'A bar that pivots on a fulcrum to lift or launch' },
      { subtype:'pulley',        type:'simple_machine', defaultW:15,  defaultH:20,  label:'Pulley',        desc:'A wheel and rope that redirects force or lifts loads' },
      { subtype:'inclinedPlane', type:'simple_machine', defaultW:80,  defaultH:40,  label:'Inclined Plane',desc:'A sloped surface that objects roll or slide down' },
      { subtype:'wheelAxle',     type:'simple_machine', defaultW:20,  defaultH:20,  label:'Wheel & Axle',  desc:'A wheel on a rod that rolls or transfers rotation' },
      { subtype:'wedge',         type:'simple_machine', defaultW:20,  defaultH:15,  label:'Wedge',         desc:'An angled ramp that splits, lifts, or redirects objects' },
      { subtype:'screw',         type:'simple_machine', defaultW:5,   defaultH:15,  label:'Screw',         desc:'A spiral ramp that converts rotation into linear motion' },
    ]
  },
  {
    section: 'MATERIALS',
    items: [
      { subtype:'domino',        type:'material', defaultW:8,   defaultH:16,  label:'Domino',      desc:'Tips over and knocks into the next object' },
      { subtype:'ball',          type:'material', defaultW:12,  defaultH:12,  label:'Ball',         desc:'Rolls along surfaces and down ramps' },
      { subtype:'toyCar',        type:'material', defaultW:24,  defaultH:14,  label:'Toy Car',      desc:'Rolls along surfaces; can be pushed by other parts' },
      { subtype:'string',        type:'material', defaultW:40,  defaultH:2,   label:'String',       desc:'Connects parts or trips a trigger when pulled' },
      { subtype:'cup',           type:'material', defaultW:22,  defaultH:16,  label:'Cup',          desc:'Tips or transfers contents when weighted' },
      { subtype:'bucket',        type:'material', defaultW:20,  defaultH:24,  label:'Bucket',       desc:'Can hold objects; tips when weighted' },
      { subtype:'tube',          type:'material', defaultW:40,  defaultH:10,  label:'Tube',         desc:'Guides a ball or object through a path' },
      { subtype:'box',           type:'material', defaultW:24,  defaultH:24,  label:'Crate',        desc:'A solid block for stacking or stopping objects' },
      { subtype:'cardboard',     type:'material', defaultW:120, defaultH:60,  label:'Cardboard',    desc:'A flat panel for ramps, walls, or dividers' },
      { subtype:'yardstick',     type:'material', defaultW:108, defaultH:6,   label:'Yardstick',    desc:'A long straight edge for ramps or extended levers' },
      { subtype:'protractor',    type:'material', defaultW:20,  defaultH:10,  label:'Protractor',   desc:'Measures angles; can redirect rolling objects' },
      { subtype:'matchboxTrack', type:'material', defaultW:40,  defaultH:8,   label:'Car Track',    desc:'A channel that guides a toy car in one direction' },
      { subtype:'book',          type:'material', defaultW:10,  defaultH:30,  label:'Book',         desc:'Stacks to build platforms; snaps to bookshelves' },
      { subtype:'custom',        type:'material', defaultW:24,  defaultH:24,  label:'? Custom',     desc:'A labeled placeholder for any item you invent' },
    ]
  },
  {
    section: 'ENVIRONMENT',
    items: [
      { subtype:'desk',      type:'environment', defaultW:80,  defaultH:75,  label:'Desk',      desc:'A wide flat surface to build on' },
      { subtype:'chair',     type:'environment', defaultW:45,  defaultH:80,  label:'Chair',     desc:'Raised seat; components rest on the seat surface' },
      { subtype:'stairs',    type:'environment', defaultW:80,  defaultH:60,  label:'Stairs',    desc:'A stepped surface; use Flip to face left or right' },
      { subtype:'bookshelf', type:'environment', defaultW:40,  defaultH:120, label:'Bookshelf', desc:'Upright or horizontal shelf; books snap to shelves' },
      { subtype:'couch',     type:'environment', defaultW:140, defaultH:55,  label:'Couch',     desc:'Seat and arm surfaces at different heights' },
    ]
  }
];

// ── Reference tab renderer ────────────────────────────────────────────
function renderRefTab() {
  const body = document.getElementById('help-body');
  body.innerHTML = '';
  for (const group of QUICK_REF) {
    const section = document.createElement('div');
    section.className = 'help-ref-section';

    const label = document.createElement('div');
    label.className = 'help-ref-label';
    label.textContent = group.section;

    const grid = document.createElement('div');
    grid.className = 'help-ref-grid';

    for (const item of group.items) {
      const row = document.createElement('div');
      row.className = 'help-ref-item';

      const iconDiv = document.createElement('div');
      iconDiv.className = 'help-ref-icon';
      iconDiv.appendChild(makeRefIcon(item));

      const nameEl = document.createElement('div');
      nameEl.className = 'help-ref-name';
      nameEl.textContent = item.label;

      const descEl = document.createElement('div');
      descEl.className = 'help-ref-desc';
      descEl.textContent = item.desc;

      const info = document.createElement('div');
      info.className = 'help-ref-info';
      info.append(nameEl, descEl);

      row.append(iconDiv, info);
      grid.appendChild(row);
    }

    section.append(label, grid);
    body.appendChild(section);
  }
}

// ── Guide tab renderer ────────────────────────────────────────────────
function renderGuideTab() {
  const body = document.getElementById('help-body');
  const card = GUIDE_CARDS[currentCard];

  const artSvg = document.createElementNS(NS, 'svg');
  card.draw(artSvg);
  const artDiv = document.createElement('div');
  artDiv.className = 'help-card-art';
  artDiv.appendChild(artSvg);

  const stepEl = document.createElement('div');
  stepEl.className = 'help-card-step';
  stepEl.textContent = `STEP ${currentCard + 1} OF ${GUIDE_CARDS.length}`;

  const titleEl = document.createElement('div');
  titleEl.className = 'help-card-title';
  titleEl.textContent = card.title;

  const descEl = document.createElement('div');
  descEl.className = 'help-card-desc';
  descEl.innerHTML = card.description;

  const textDiv = document.createElement('div');
  textDiv.className = 'help-card-text';
  textDiv.append(stepEl, titleEl, descEl);

  const cardDiv = document.createElement('div');
  cardDiv.className = 'help-card';
  cardDiv.append(artDiv, textDiv);

  const prevBtn = document.createElement('button');
  prevBtn.className = 'help-nav-btn';
  prevBtn.textContent = '← Back';
  prevBtn.disabled = currentCard === 0;
  prevBtn.addEventListener('click', () => { currentCard--; renderGuideTab(); });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'help-nav-btn';
  nextBtn.textContent = currentCard === GUIDE_CARDS.length - 1 ? 'Done ✓' : 'Next →';
  nextBtn.addEventListener('click', () => {
    if (currentCard < GUIDE_CARDS.length - 1) { currentCard++; renderGuideTab(); }
    else { closeHelp(); }
  });

  const dotsDiv = document.createElement('div');
  dotsDiv.className = 'help-dots';
  GUIDE_CARDS.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'help-dot' + (i === currentCard ? ' active' : '');
    dotsDiv.appendChild(dot);
  });

  const nav = document.createElement('div');
  nav.className = 'help-nav';
  nav.append(prevBtn, dotsDiv, nextBtn);

  body.innerHTML = '';
  body.append(cardDiv, nav);
}

// ── Public API ────────────────────────────────────────────────────────
export function openHelp() {
  currentCard = 0;
  currentTab  = 'guide';
  document.getElementById('help-modal').classList.remove('help-hidden');
  setTab('guide');
}

export function closeHelp() {
  document.getElementById('help-modal').classList.add('help-hidden');
}

export function initHelp() {
  document.getElementById('btn-help').addEventListener('click', openHelp);
  document.getElementById('help-close').addEventListener('click', closeHelp);
  document.getElementById('help-backdrop').addEventListener('click', closeHelp);
  document.querySelectorAll('.help-tab').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeHelp();
  });
}

// ── Tab switching ─────────────────────────────────────────────────────
function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.help-tab').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === tab)
  );
  if (tab === 'guide') renderGuideTab();
  else renderRefTab();
}
