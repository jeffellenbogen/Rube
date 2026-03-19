/* ============================================================
   RUBE GOLDBERG MACHINE PLANNER — APP LOGIC
   ============================================================ */

// ============================================================
// COMPONENT DEFINITIONS
// ============================================================

const SIMPLE_MACHINES = [
  { subtype: 'lever',          name: 'Lever',          icon: '⚖️',  type: 'simple_machine' },
  { subtype: 'pulley',         name: 'Pulley',         icon: '🔄',  type: 'simple_machine' },
  { subtype: 'wedge',          name: 'Wedge',          icon: '🔺',  type: 'simple_machine' },
  { subtype: 'wheel_axle',     name: 'Wheel & Axle',   icon: '☸️',  type: 'simple_machine' },
  { subtype: 'inclined_plane', name: 'Inclined Plane', icon: '📐',  type: 'simple_machine' },
  { subtype: 'screw',          name: 'Screw',          icon: '🔩',  type: 'simple_machine' },
];

const MATERIALS = [
  { subtype: 'tube',      name: 'Tube',      icon: '🧪', type: 'material' },
  { subtype: 'bucket',    name: 'Bucket',    icon: '🪣', type: 'material' },
  { subtype: 'toy_car',   name: 'Toy Car',   icon: '🚗', type: 'material' },
  { subtype: 'string',    name: 'String',    icon: '🧵', type: 'material' },
  { subtype: 'cup',       name: 'Cup',       icon: '🥤', type: 'material' },
  { subtype: 'dominoes',  name: 'Dominoes',  icon: '🎲', type: 'material' },
  { subtype: 'magnet',    name: 'Magnet',    icon: '🧲', type: 'material' },
  { subtype: 'track',     name: 'Track',     icon: '🛤️', type: 'material' },
  { subtype: 'cardboard', name: 'Cardboard', icon: '📦', type: 'material' },
  { subtype: 'tape',      name: 'Tape',      icon: '🩹', type: 'material' },
  { subtype: 'box',       name: 'Box',       icon: '🗃️', type: 'material' },
];

const MARKERS = [
  { subtype: 'start',  name: 'START',  icon: '🟢', type: 'marker' },
  { subtype: 'finish', name: 'FINISH', icon: '🔴', type: 'marker' },
];

// ============================================================
// CONSTANTS
// ============================================================

const GRID    = 40;
const COMP_W  = 100;
const COMP_H  = 82; // approximate card height used for node fallback positions

// ============================================================
// STATE
// ============================================================

let state = {
  components:  [],   // { id, type, subtype, name, icon, x, y, label }
  connections: [],   // { id, fromId, fromSide, toId, toSide }
};

let _nextId = 1;
const genId = () => `c${_nextId++}`;
const snap  = v => Math.round(v / GRID) * GRID;

let dragState         = null; // { compId, startMouseX, startMouseY, startCompX, startCompY }
let activePopover     = null;
let _lastRecalc       = 0;

// ============================================================
// INIT
// ============================================================

function init() {
  renderLibrary();
  setupCanvasEvents();
  setupToolbarEvents();
  if (state.components.length === 0) {
    placeDefaultMarkers();
  }
  render();

  const wrapper = document.getElementById('canvas-wrapper');
  wrapper.scrollLeft = 0;
  wrapper.scrollTop = Math.max(0, (900 - wrapper.clientHeight) / 2);
}

function placeDefaultMarkers() {
  state.components.push({
    id: genId(), type: 'marker', subtype: 'start',
    name: 'START', icon: '🟢',
    x: 40, y: Math.round((900 - COMP_H) / 2 / GRID) * GRID, label: '',
  });
  state.components.push({
    id: genId(), type: 'marker', subtype: 'finish',
    name: 'FINISH', icon: '🔴',
    x: 1440, y: Math.round((900 - COMP_H) / 2 / GRID) * GRID, label: '',
  });
}

// ============================================================
// LIBRARY
// ============================================================

function renderLibrary() {
  const machinesEl  = document.getElementById('library-machines');
  const materialsEl = document.getElementById('library-materials');
  SIMPLE_MACHINES.forEach(def => machinesEl.appendChild(makeLibItem(def)));
  MATERIALS.forEach(def => materialsEl.appendChild(makeLibItem(def)));
}

function makeLibItem(def) {
  const div = document.createElement('div');
  div.className = `lib-item ${def.type === 'simple_machine' ? 'machine' : 'material'}`;
  div.draggable = true;
  const iconHtml = (typeof ICONS !== 'undefined' && ICONS[def.subtype])
    ? `<span class="lib-icon">${ICONS[def.subtype]}</span>`
    : `<span class="lib-icon">${def.icon}</span>`;
  div.innerHTML = `${iconHtml}<span class="lib-name">${def.name}</span>`;
  div.addEventListener('dragstart', e => {
    e.dataTransfer.setData('application/json', JSON.stringify(def));
    e.dataTransfer.effectAllowed = 'copy';
  });
  return div;
}

// ============================================================
// CANVAS EVENTS
// ============================================================

function setupCanvasEvents() {
  const canvas  = document.getElementById('canvas-area');
  const wrapper = document.getElementById('canvas-wrapper');

  // ---- Drop from library ----
  canvas.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  canvas.addEventListener('drop', e => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    let def;
    try { def = JSON.parse(raw); } catch { return; }

    const canvasRect = canvas.getBoundingClientRect();
    const rawX = e.clientX - canvasRect.left + wrapper.scrollLeft - COMP_W / 2;
    const rawY = e.clientY - canvasRect.top  + wrapper.scrollTop  - COMP_H / 2;

    state.components.push({
      id:      genId(),
      type:    def.type,
      subtype: def.subtype,
      name:    def.name,
      icon:    def.icon,
      x:       Math.max(0, snap(rawX)),
      y:       Math.max(0, snap(rawY)),
      label:   '',
    });
    recalcConnections();
    render();
  });

  // ---- Global mouse move / up for card dragging ----
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup',   handleMouseUp);
}

function handleMouseMove(e) {
  if (!dragState) return;
  const comp = state.components.find(c => c.id === dragState.compId);
  if (!comp) return;

  const dx = e.clientX - dragState.startMouseX;
  const dy = e.clientY - dragState.startMouseY;

  comp.x = Math.max(0, dragState.startCompX + dx);
  comp.y = Math.max(0, dragState.startCompY + dy);

  // Move the DOM card directly (avoids full re-render during drag)
  const card = document.getElementById(`comp-${dragState.compId}`);
  if (card) {
    card.style.left = `${comp.x}px`;
    card.style.top  = `${comp.y}px`;
  }
  recalcThrottled();
}

function handleMouseUp() {
  if (!dragState) return;
  const comp = state.components.find(c => c.id === dragState.compId);
  if (comp) {
    comp.x = snap(Math.max(0, comp.x));
    comp.y = snap(Math.max(0, comp.y));
  }
  dragState = null;
  recalcConnections();
  render(); // snap + re-render connections
}

function startDrag(e, compId) {
  closePopover();
  // Don't start drag when clicking node or delete button
  if (e.target.classList.contains('conn-node') ||
      e.target.classList.contains('comp-delete')) return;
  e.stopPropagation();
  const comp = state.components.find(c => c.id === compId);
  if (!comp) return;
  dragState = {
    compId,
    startMouseX: e.clientX,
    startMouseY: e.clientY,
    startCompX:  comp.x,
    startCompY:  comp.y,
  };
}

/**
 * Returns the center {x, y} of a connection node in canvas-area coordinates.
 * Prefers live DOM measurement; falls back to geometry calculation.
 */
function getNodePos(compId, side) {
  const nodeEl = document.querySelector(
    `.conn-node[data-comp-id="${compId}"][data-side="${side}"]`
  );
  if (nodeEl) {
    const canvasRect = document.getElementById('canvas-area').getBoundingClientRect();
    const nodeRect   = nodeEl.getBoundingClientRect();
    return {
      x: nodeRect.left - canvasRect.left + nodeRect.width  / 2,
      y: nodeRect.top  - canvasRect.top  + nodeRect.height / 2,
    };
  }
  // Fallback
  const comp = state.components.find(c => c.id === compId);
  if (!comp) return null;
  switch (side) {
    case 'n': return { x: comp.x + COMP_W / 2, y: comp.y };
    case 's': return { x: comp.x + COMP_W / 2, y: comp.y + COMP_H };
    case 'e': return { x: comp.x + COMP_W,     y: comp.y + COMP_H / 2 };
    case 'w': return { x: comp.x,              y: comp.y + COMP_H / 2 };
  }
  return null;
}

// ============================================================
// PROXIMITY-BASED AUTO-LINKING
// ============================================================

/**
 * Compute edge-to-edge distance between two component bounding boxes.
 * Returns { distance, fromSide, toSide } where sides indicate closest edges.
 */
function getProximity(a, b) {
  const aRight  = a.x + COMP_W;
  const aBottom = a.y + COMP_H;
  const bRight  = b.x + COMP_W;
  const bBottom = b.y + COMP_H;

  const gapRight = b.x - aRight;
  const gapLeft  = a.x - bRight;
  const gapDown  = b.y - aBottom;
  const gapUp    = a.y - bBottom;

  const candidates = [
    { gap: gapRight, fromSide: 'e', toSide: 'w' },
    { gap: gapLeft,  fromSide: 'w', toSide: 'e' },
    { gap: gapDown,  fromSide: 's', toSide: 'n' },
    { gap: gapUp,    fromSide: 'n', toSide: 's' },
  ];

  const hOverlap = !(aBottom <= b.y || bBottom <= a.y);
  const vOverlap = !(aRight <= b.x || bRight <= a.x);

  const valid = candidates.filter(c => {
    if (c.fromSide === 'e' || c.fromSide === 'w') return hOverlap && c.gap >= 0;
    return vOverlap && c.gap >= 0;
  });

  if (valid.length === 0) return null;

  valid.sort((a, b) => a.gap - b.gap);
  return {
    distance: valid[0].gap,
    fromSide: valid[0].fromSide,
    toSide:   valid[0].toSide,
  };
}

const LINK_THRESHOLD = 50;

function recalcConnections() {
  const newConns = [];

  for (let i = 0; i < state.components.length; i++) {
    for (let j = i + 1; j < state.components.length; j++) {
      const a = state.components[i];
      const b = state.components[j];
      const prox = getProximity(a, b);
      if (!prox || prox.distance > LINK_THRESHOLD) continue;

      let fromId = a.id, toId = b.id;
      let fromSide = prox.fromSide, toSide = prox.toSide;

      const existing = state.connections.find(c =>
        (c.fromId === a.id && c.toId === b.id) ||
        (c.fromId === b.id && c.toId === a.id)
      );
      if (existing && existing.reversed) {
        fromId = b.id; toId = a.id;
        fromSide = prox.toSide; toSide = prox.fromSide;
      }

      newConns.push({
        id: existing ? existing.id : genId(),
        fromId, fromSide, toId, toSide,
        reversed: existing ? existing.reversed : false,
      });
    }
  }

  state.connections = newConns;
}

function recalcThrottled() {
  const now = Date.now();
  if (now - _lastRecalc > 80) {
    _lastRecalc = now;
    recalcConnections();
  }
  renderConnections();
}

// ============================================================
// DELETE
// ============================================================

function deleteComponent(id) {
  state.components  = state.components.filter(c => c.id !== id);
  state.connections = state.connections.filter(c => c.fromId !== id && c.toId !== id);
  recalcConnections();
  render();
}

// ============================================================
// ANNOTATION (double-click)
// ============================================================

function closePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}

function startAnnotation(e, compId) {
  e.stopPropagation();
  closePopover();

  const comp = state.components.find(c => c.id === compId);
  if (!comp) return;

  // Position popover below the card
  const popX = comp.x;
  const popY = comp.y + COMP_H + 8;

  const popover = document.createElement('div');
  popover.className = 'annotation-popover';
  popover.style.left = `${popX}px`;
  popover.style.top  = `${popY}px`;

  popover.innerHTML = `
    <div class="pop-title">Step Annotation</div>
    <textarea class="pop-textarea" placeholder="Describe what happens at this step…"
              rows="3">${comp.label || ''}</textarea>
    <div class="pop-actions">
      <button class="pop-btn pop-save">Save</button>
      <button class="pop-btn pop-cancel">Cancel</button>
    </div>
  `;

  const canvas = document.getElementById('canvas-area');
  canvas.appendChild(popover);
  activePopover = popover;

  const textarea = popover.querySelector('.pop-textarea');
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  const save = () => {
    comp.label = textarea.value.trim();
    closePopover();
    render();
  };

  const cancel = () => {
    closePopover();
  };

  popover.querySelector('.pop-save').addEventListener('click', save);
  popover.querySelector('.pop-cancel').addEventListener('click', cancel);

  textarea.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); save(); }
    if (ev.key === 'Escape') cancel();
  });

  // Close when clicking outside
  setTimeout(() => {
    document.addEventListener('mousedown', function handler(ev) {
      if (!popover.contains(ev.target)) {
        save();
        document.removeEventListener('mousedown', handler);
      }
    });
  }, 0);
}

// ============================================================
// RENDER PIPELINE
// ============================================================

function render() {
  renderComponents();
  renderConnections();
  renderTracker();
}

// ---- Components ----

function renderComponents() {
  const canvas = document.getElementById('canvas-area');

  // Remove existing cards
  canvas.querySelectorAll('.component-card').forEach(el => el.remove());

  // Empty-state hint
  let hint = document.getElementById('canvas-hint');
  const nonMarkers = state.components.filter(c => c.type !== 'marker');
  if (nonMarkers.length === 0) {
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'canvas-hint';
      hint.innerHTML = `
        <div class="hint-headline">Drag components between START and FINISH</div>
        <div class="hint-sub">Place them close together to auto-connect your chain reaction</div>
      `;
      canvas.appendChild(hint);
    }
  } else {
    if (hint) hint.remove();
  }

  state.components.forEach(comp => {
    const card = document.createElement('div');
    card.className = `component-card ${comp.type} ${comp.subtype || ''}`;
    card.id        = `comp-${comp.id}`;
    card.style.left = `${comp.x}px`;
    card.style.top  = `${comp.y}px`;

    // Delete button (not for markers)
    if (comp.type !== 'marker') {
      const del = document.createElement('button');
      del.className = 'comp-delete';
      del.title     = 'Remove component';
      del.textContent = '×';
      del.addEventListener('click', e => { e.stopPropagation(); deleteComponent(comp.id); });
      card.appendChild(del);
    }

    // Connection nodes (N/S/E/W) — non-interactive, light up when connected
    ['n', 's', 'e', 'w'].forEach(side => {
      const node = document.createElement('div');
      node.className            = `conn-node node-${side}`;
      node.dataset.compId       = comp.id;
      node.dataset.side         = side;
      const hasConn = state.connections.some(c =>
        (c.fromId === comp.id && c.fromSide === side) ||
        (c.toId === comp.id && c.toSide === side)
      );
      if (hasConn) node.classList.add('node-active');
      card.appendChild(node);
    });

    // Icon
    const icon = document.createElement('div');
    icon.className = 'comp-icon';
    if (typeof ICONS !== 'undefined' && ICONS[comp.subtype]) {
      icon.innerHTML = ICONS[comp.subtype];
    } else {
      icon.textContent = comp.icon;
    }
    card.appendChild(icon);

    // Name
    const name = document.createElement('div');
    name.className   = 'comp-name';
    name.textContent = comp.name;
    card.appendChild(name);

    // Label / annotation preview
    const label = document.createElement('div');
    label.className = 'comp-label';
    if (comp.label) {
      label.textContent = comp.label.length > 20
        ? comp.label.substring(0, 18) + '\u2026'
        : comp.label;
      label.title = comp.label;
    } else {
      label.textContent = '';
      label.title = 'Double-click to add a note';
    }
    card.appendChild(label);

    // Events
    card.addEventListener('mousedown', e => startDrag(e, comp.id));
    card.addEventListener('dblclick',  e => startAnnotation(e, comp.id));

    canvas.appendChild(card);
  });
}

// ---- SVG Connections ----

function renderConnections() {
  const svg = document.getElementById('connections-svg');
  svg.querySelectorAll('.conn-group').forEach(el => el.remove());

  state.connections.forEach(conn => {
    const from = getNodePos(conn.fromId, conn.fromSide);
    const to   = getNodePos(conn.toId,   conn.toSide);
    if (!from || !to) return;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'conn-group');

    // Wide invisible hit area for clicking
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hit.setAttribute('x1', from.x); hit.setAttribute('y1', from.y);
    hit.setAttribute('x2', to.x);   hit.setAttribute('y2', to.y);
    hit.setAttribute('stroke', 'transparent');
    hit.setAttribute('stroke-width', '16');
    hit.style.cursor = 'pointer';
    hit.style.pointerEvents = 'stroke';
    // Left-click: reverse direction
    hit.addEventListener('click', () => {
      conn.reversed = !conn.reversed;
      const tmpId = conn.fromId; conn.fromId = conn.toId; conn.toId = tmpId;
      const tmpSide = conn.fromSide; conn.fromSide = conn.toSide; conn.toSide = tmpSide;
      render();
    });
    // Right-click: delete connection
    hit.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      state.connections = state.connections.filter(c => c.id !== conn.id);
      render();
    });

    // Soft glow background line
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    bg.setAttribute('x1', from.x); bg.setAttribute('y1', from.y);
    bg.setAttribute('x2', to.x);   bg.setAttribute('y2', to.y);
    bg.setAttribute('class', 'energy-line-bg');

    // Animated dashed energy line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
    line.setAttribute('x2', to.x);   line.setAttribute('y2', to.y);
    line.setAttribute('class', 'energy-line');
    line.setAttribute('filter', 'url(#glow-filter)');

    // Arrowhead at the "to" end
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowLen = 10;
    const ax = to.x - arrowLen * Math.cos(angle - 0.4);
    const ay = to.y - arrowLen * Math.sin(angle - 0.4);
    const bx = to.x - arrowLen * Math.cos(angle + 0.4);
    const by = to.y - arrowLen * Math.sin(angle + 0.4);
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrow.setAttribute('points', `${to.x},${to.y} ${ax},${ay} ${bx},${by}`);
    arrow.setAttribute('fill', 'var(--orange)');
    arrow.setAttribute('filter', 'url(#glow-filter)');

    g.appendChild(hit);
    g.appendChild(bg);
    g.appendChild(line);
    g.appendChild(arrow);
    svg.appendChild(g);
  });
}

// ============================================================
// REQUIREMENTS TRACKER
// ============================================================

function getStats() {
  const machineTypes = new Set(
    state.components
      .filter(c => c.type === 'simple_machine')
      .map(c => c.subtype)
  );
  return { machineTypes, stepCount: state.connections.length };
}

function renderTracker() {
  renderChecklist();
  renderStepCounter();
  renderBOM();
}

function renderChecklist() {
  const el = document.getElementById('machine-checklist');
  const { machineTypes } = getStats();
  const count = machineTypes.size;
  const met   = count >= 3;

  el.innerHTML = '';

  // Summary progress block
  const block = document.createElement('div');
  block.className = 'stat-block';
  block.innerHTML = `
    <div class="stat-row">
      <span class="stat-big ${met ? 'met' : ''}">${count}</span>
      <span class="stat-target">/ 3 types</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${Math.min(100, (count / 3) * 100)}%"></div>
    </div>
    <div class="stat-message ${met ? 'good' : ''}">
      ${met ? '✓ Requirement met!' : `Need ${3 - count} more type${3 - count !== 1 ? 's' : ''}`}
    </div>
  `;
  el.appendChild(block);

  // Per-machine checkboxes
  SIMPLE_MACHINES.forEach(m => {
    const checked = machineTypes.has(m.subtype);
    const item = document.createElement('div');
    item.className = `check-item ${checked ? 'checked' : ''}`;
    const svgIcon = (typeof ICONS !== 'undefined' && ICONS[m.subtype]) ? ICONS[m.subtype] : m.icon;
    item.innerHTML = `
      <div class="check-box ${checked ? 'checked' : ''}">${checked ? '✓' : ''}</div>
      <span class="check-icon">${svgIcon}</span>
      <span class="check-label">${m.name}</span>
    `;
    el.appendChild(item);
  });
}

function renderStepCounter() {
  const el = document.getElementById('step-counter');
  const { stepCount } = getStats();
  const met  = stepCount >= 5;
  const pct  = Math.min(100, (stepCount / 5) * 100);
  const need = Math.max(0, 5 - stepCount);

  el.innerHTML = `
    <div class="stat-block">
      <div class="stat-row">
        <span class="stat-big ${met ? 'met' : ''}">${stepCount}</span>
        <span class="stat-target">/ 5 steps</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="stat-message ${met ? 'good' : ''}">
        ${met
          ? '✓ Requirement met!'
          : `Need ${need} more connection${need !== 1 ? 's' : ''}`}
      </div>
    </div>
  `;
}

function renderBOM() {
  const el = document.getElementById('bill-of-materials');
  if (state.components.filter(c => c.type !== 'marker').length === 0) {
    el.innerHTML = '<div class="bom-empty">No components placed yet</div>';
    return;
  }

  const counts   = {};
  const subtypes = {};
  const icons    = {};
  state.components.filter(c => c.type !== 'marker').forEach(c => {
    counts[c.name]   = (counts[c.name] || 0) + 1;
    subtypes[c.name] = c.subtype;
    icons[c.name]    = c.icon;
  });

  el.innerHTML = '';
  Object.keys(counts).sort().forEach(name => {
    const row = document.createElement('div');
    row.className = 'bom-row';
    const svgIcon = (typeof ICONS !== 'undefined' && ICONS[subtypes[name]]) ? ICONS[subtypes[name]] : icons[name];
    row.innerHTML = `
      <div class="bom-name">
        <span class="bom-icon">${svgIcon}</span>
        <span>${name}</span>
      </div>
      <span class="bom-qty">×${counts[name]}</span>
    `;
    el.appendChild(row);
  });
}

// ============================================================
// TOOLBAR
// ============================================================

function setupToolbarEvents() {
  document.getElementById('btn-new').addEventListener('click', () => {
    if (state.components.length <= 2 ||
        confirm('Start a new plan? Your current work will be lost.')) {
      closePopover();
      state = { components: [], connections: [] };
      _nextId = 1;
      dragState = null;
      placeDefaultMarkers();
      render();
    }
  });

  document.getElementById('btn-save').addEventListener('click', saveJSON);

  const fileInput = document.getElementById('file-input');
  document.getElementById('btn-load-label').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', loadJSON);

  document.getElementById('btn-export').addEventListener('click', exportPNG);
}

// ============================================================
// SAVE / LOAD JSON
// ============================================================

function saveJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'rube-goldberg-plan.json' });
  a.click();
  URL.revokeObjectURL(url);
}

function loadJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!Array.isArray(parsed.components) || !Array.isArray(parsed.connections)) {
        alert('Invalid plan file — missing components or connections.');
        return;
      }
      // Sync ID counter to avoid collisions
      const allIds = [...parsed.components, ...parsed.connections]
        .map(x => parseInt((x.id || '').replace('c', ''), 10))
        .filter(n => !isNaN(n));
      _nextId = allIds.length > 0 ? Math.max(...allIds) + 1 : 1;

      // Ensure markers exist (compat with pre-marker save files)
      const hasStart  = parsed.components.some(c => c.subtype === 'start');
      const hasFinish = parsed.components.some(c => c.subtype === 'finish');
      if (!hasStart) {
        parsed.components.unshift({
          id: genId(), type: 'marker', subtype: 'start',
          name: 'START', icon: '🟢', x: 40, y: 360, label: '',
        });
      }
      if (!hasFinish) {
        parsed.components.push({
          id: genId(), type: 'marker', subtype: 'finish',
          name: 'FINISH', icon: '🔴', x: 1440, y: 360, label: '',
        });
      }

      state = parsed;
      dragState = null;
      render();
    } catch {
      alert('Could not parse the file. Make sure it is a valid Rube Goldberg plan JSON.');
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // allow re-loading same file
}

// ============================================================
// EXPORT PNG
// ============================================================

async function exportPNG() {
  const btn = document.getElementById('btn-export');
  btn.textContent = 'Exporting…';
  btn.disabled = true;

  try {
    const canvasEl = document.getElementById('canvas-area');
    const snapshot = await html2canvas(canvasEl, {
      backgroundColor: '#0b1929',
      scale:    1,
      useCORS:  true,
      logging:  false,
    });
    const url = snapshot.toDataURL('image/png');
    const a   = Object.assign(document.createElement('a'), { href: url, download: 'rube-goldberg-blueprint.png' });
    a.click();
  } catch (err) {
    console.error('PNG export failed:', err);
    alert('Export failed. Make sure you are serving via http:// (not file://).');
  } finally {
    btn.textContent = 'Export PNG';
    btn.disabled = false;
  }
}

// ============================================================
// START
// ============================================================

document.addEventListener('DOMContentLoaded', init);
