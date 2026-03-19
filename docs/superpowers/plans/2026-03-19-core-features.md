# Core Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four core features decided during brainstorming: required START/FINISH markers, proximity-based auto-linking, pop-up annotations, and hybrid SVG component icons.

**Architecture:** Single-page HTML/JS/CSS app with no build step. All state lives in a global `state` object (`app.js`). Rendering is imperative DOM manipulation. Components are positioned absolutely on a scrollable canvas. Connections rendered as SVG lines. No test framework — verify via browser preview.

**Tech Stack:** Vanilla HTML5, CSS3, JavaScript (ES6+), html2canvas for PNG export. No frameworks, no build tools. Served via `npx serve`.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `app.js` | All application logic: state, rendering, events, save/load, export |
| `style.css` | All styling: layout, components, canvas, tracker, animations |
| `index.html` | DOM structure (rarely changes) |
| `icons.js` | **NEW** — SVG icon definitions for all components (keeps app.js focused) |

---

### Task 1: Add START and FINISH Marker Components

**Files:**
- Modify: `app.js` (component definitions, init, rendering, validation)
- Modify: `style.css` (marker-specific styles)

The START and FINISH markers are special components that:
- Auto-place on canvas when a new project starts (START at left, FINISH at right)
- Cannot be deleted (no × button)
- Cannot be duplicated (not in the component library)
- Have distinct visual style (green START, red FINISH)
- Are included in the energy link chain validation

- [ ] **Step 1: Add START/FINISH to component definitions in app.js**

Add marker definitions after the existing `MATERIALS` array:

```javascript
const MARKERS = [
  { subtype: 'start',  name: 'START',  icon: '🟢', type: 'marker' },
  { subtype: 'finish', name: 'FINISH', icon: '🔴', type: 'marker' },
];
```

- [ ] **Step 2: Auto-place markers on init**

Modify the `init()` function to place START and FINISH when the canvas is empty:

```javascript
function init() {
  renderLibrary();
  setupCanvasEvents();
  setupToolbarEvents();
  if (state.components.length === 0) {
    placeDefaultMarkers();
  }
  render();
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
```

- [ ] **Step 3: Prevent marker deletion**

In `renderComponents()`, skip creating the delete button for markers:

```javascript
// Inside state.components.forEach(comp => { ... })
if (comp.type !== 'marker') {
  const del = document.createElement('button');
  del.className = 'comp-delete';
  del.title     = 'Remove component';
  del.textContent = '×';
  del.addEventListener('click', e => { e.stopPropagation(); deleteComponent(comp.id); });
  card.appendChild(del);
}
```

- [ ] **Step 4: Update the "New" button to re-place markers**

In the `btn-new` click handler, call `placeDefaultMarkers()` after resetting state:

```javascript
document.getElementById('btn-new').addEventListener('click', () => {
  if (state.components.length <= 2 ||
      confirm('Start a new plan? Your current work will be lost.')) {
    state = { components: [], connections: [] };
    _nextId = 1;
    pendingConnection = null;
    dragState = null;
    placeDefaultMarkers();
    render();
  }
});
```

- [ ] **Step 5: Add marker styles in style.css**

```css
.component-card.marker {
  border-top: 3px solid var(--yellow);
  background: rgba(255, 209, 102, 0.08);
  border-color: rgba(255, 209, 102, 0.35);
}

.component-card.marker.start {
  border-top-color: var(--green);
  background: rgba(6, 214, 160, 0.08);
  border-color: rgba(6, 214, 160, 0.35);
}

.component-card.marker.finish {
  border-top-color: var(--red);
  background: rgba(239, 71, 111, 0.08);
  border-color: rgba(239, 71, 111, 0.35);
}
```

- [ ] **Step 6: Add subtype class to card rendering**

In `renderComponents()`, add the subtype as a class on the card:

```javascript
card.className = `component-card ${comp.type} ${comp.subtype || ''}`;
```

- [ ] **Step 7: Verify in preview**

Open http://localhost:3000 in the preview panel. Confirm:
- START appears at left side of canvas, FINISH at right
- Both have distinct green/red styling
- Neither has a delete (×) button
- Both are draggable
- Clicking "New" resets canvas but START/FINISH reappear
- Both have connection nodes visible on hover

- [ ] **Step 8: Commit**

```bash
git add app.js style.css
git commit -m "feat: add required START and FINISH marker components"
```

---

### Task 2: Proximity-Based Auto-Linking

**Files:**
- Modify: `app.js` (replace manual node connection with proximity detection)
- Modify: `style.css` (remove manual node hover styles, add auto-link arrow styles)

Replace the current "click node to start connection, click another node to complete" system with automatic proximity linking. When a component is placed or moved within 1 grid cell (40px gap) of another component, they auto-link with a visible directional arrow.

Key design decisions:
- Proximity threshold: edge-to-edge distance ≤ 40px (one grid cell)
- Direction: determined by which sides are closest (left→right, top→bottom)
- Auto-links update on every drag/drop
- Links are directional — arrow shows energy flow direction
- Users can click an arrow to reverse its direction or delete it
- Connection nodes are removed (no more manual connecting)

- [ ] **Step 1: Add proximity detection function**

Add after the existing `getNodePos` function:

```javascript
/**
 * Compute edge-to-edge distance between two component bounding boxes.
 * Returns { distance, fromSide, toSide } where sides indicate closest edges.
 */
function getProximity(a, b) {
  const aRight  = a.x + COMP_W;
  const aBottom = a.y + COMP_H;
  const bRight  = b.x + COMP_W;
  const bBottom = b.y + COMP_H;

  // Horizontal and vertical gaps (negative = overlap)
  const gapRight = b.x - aRight;   // a's right edge to b's left edge
  const gapLeft  = a.x - bRight;   // b's right edge to a's left edge
  const gapDown  = b.y - aBottom;  // a's bottom edge to b's top edge
  const gapUp    = a.y - bBottom;  // b's bottom edge to a's top edge

  // Find the smallest non-negative gap (or largest negative = most overlap)
  const candidates = [
    { gap: gapRight, fromSide: 'e', toSide: 'w' },
    { gap: gapLeft,  fromSide: 'w', toSide: 'e' },
    { gap: gapDown,  fromSide: 's', toSide: 'n' },
    { gap: gapUp,    fromSide: 'n', toSide: 's' },
  ];

  // Check vertical/horizontal overlap for each direction
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

const LINK_THRESHOLD = 50; // px — slightly more than one grid cell for forgiveness
```

- [ ] **Step 2: Add auto-link recalculation function**

```javascript
/**
 * Recalculate all connections based on component proximity.
 * Preserves manually-set direction overrides stored in connection metadata.
 */
function recalcConnections() {
  const newConns = [];

  for (let i = 0; i < state.components.length; i++) {
    for (let j = i + 1; j < state.components.length; j++) {
      const a = state.components[i];
      const b = state.components[j];
      const prox = getProximity(a, b);
      if (!prox || prox.distance > LINK_THRESHOLD) continue;

      // Determine direction: default is left-to-right / top-to-bottom
      let fromId = a.id, toId = b.id;
      let fromSide = prox.fromSide, toSide = prox.toSide;

      // Check if there's an existing connection with a user-reversed direction
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
```

- [ ] **Step 3: Call recalcConnections on drop and drag-end**

In the `drop` event handler (canvas `addEventListener('drop', ...)`), add `recalcConnections()` before `render()`:

```javascript
// After state.components.push({...})
recalcConnections();
render();
```

In `handleMouseUp()`:

```javascript
function handleMouseUp() {
  if (!dragState) return;
  const comp = state.components.find(c => c.id === dragState.compId);
  if (comp) {
    comp.x = snap(Math.max(0, comp.x));
    comp.y = snap(Math.max(0, comp.y));
  }
  dragState = null;
  recalcConnections();
  render();
}
```

Also call during drag for live feedback — in `handleMouseMove()`, replace `renderConnections()` with a throttled recalc (avoids O(n²) on every pixel move, important for Chromebooks):

```javascript
// At the top of app.js, add a throttle helper:
let _lastRecalc = 0;
function recalcThrottled() {
  const now = Date.now();
  if (now - _lastRecalc > 80) { // ~12fps for link recalc
    _lastRecalc = now;
    recalcConnections();
  }
  renderConnections();
}
```

Then in `handleMouseMove()`, replace `renderConnections()` with `recalcThrottled()`.

- [ ] **Step 4: Remove manual connection node click handling**

Remove the `pendingConnection` variable and the `handleNodeClick()` function entirely.

Remove the `pendingConnection` checks in `renderComponents()` (the `node-active` class logic).

Remove the bare canvas click handler that cancels pending connections.

Keep the connection node DOM elements but make them purely visual indicators (no click handler). Or better yet, remove them entirely since proximity linking doesn't need visible nodes.

Actually — **keep the nodes but make them non-interactive visual indicators**. They show students where energy flows in/out. Remove the `cursor: crosshair` and click handlers.

```javascript
// In renderComponents(), replace the node creation block:
['n', 's', 'e', 'w'].forEach(side => {
  const node = document.createElement('div');
  node.className            = `conn-node node-${side}`;
  node.dataset.compId       = comp.id;
  node.dataset.side         = side;
  // Show nodes that have active connections
  const hasConn = state.connections.some(c =>
    (c.fromId === comp.id && c.fromSide === side) ||
    (c.toId === comp.id && c.toSide === side)
  );
  if (hasConn) node.classList.add('node-active');
  card.appendChild(node);
});
```

- [ ] **Step 5: Update CSS for non-interactive nodes and fix SVG pointer-events**

```css
.conn-node {
  cursor: default; /* was crosshair */
}

/* Allow click events on connection arrows while keeping SVG from blocking canvas drag */
#connections-svg {
  pointer-events: none; /* keep this */
}
#connections-svg .conn-group {
  pointer-events: auto; /* children receive click events */
}
```

- [ ] **Step 6: Add click-to-reverse on connection arrows**

Make the SVG connection lines clickable to reverse direction:

```javascript
// In renderConnections(), make the background line clickable
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
```

- [ ] **Step 7: Update deleteComponent to recalc**

```javascript
function deleteComponent(id) {
  state.components = state.components.filter(c => c.id !== id);
  state.connections = state.connections.filter(c => c.fromId !== id && c.toId !== id);
  recalcConnections();
  render();
}
```

- [ ] **Step 8: Verify in preview**

Open http://localhost:3000. Test:
- Drag a Lever near START — an arrow auto-appears between them
- Drag the Lever away — arrow disappears
- Place 3 components in a row, each within ~40px — arrows chain through them
- Click an arrow — it reverses direction
- Drag to reposition — connections update live
- Step counter in tracker reflects connection count

- [ ] **Step 9: Commit**

```bash
git add app.js style.css
git commit -m "feat: replace manual connections with proximity-based auto-linking"
```

---

### Task 3: Pop-Up Annotations

**Files:**
- Modify: `app.js` (replace inline input with popover)
- Modify: `style.css` (popover styles)

Replace the current inline text input (on double-click) with a floating popover tooltip. The component card shows a truncated preview of the annotation text. Hovering reveals full text. Double-clicking opens an editable popover.

- [ ] **Step 1: Update component card label rendering**

In `renderComponents()`, replace the label div with a truncated preview that shows full text on hover via title attribute:

```javascript
// Label / annotation preview
const label = document.createElement('div');
label.className = 'comp-label';
if (comp.label) {
  // Show truncated text, full text on hover
  label.textContent = comp.label.length > 20
    ? comp.label.substring(0, 18) + '…'
    : comp.label;
  label.title = comp.label;
} else {
  label.textContent = '';
  label.title = 'Double-click to add a note';
}
card.appendChild(label);
```

- [ ] **Step 2: Replace startAnnotation with popover**

Replace the `startAnnotation` function:

```javascript
let activePopover = null;

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
```

- [ ] **Step 3: Add popover styles in style.css**

```css
/* ---- Annotation Popover ---- */
.annotation-popover {
  position: absolute;
  z-index: 100;
  width: 200px;
  background: #0e2038;
  border: 1px solid var(--teal);
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 201, 167, 0.15);
}

.pop-title {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--teal);
  margin-bottom: 6px;
}

.pop-textarea {
  font-family: var(--font-mono);
  font-size: 10px;
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-bright);
  padding: 6px 8px;
  resize: vertical;
  outline: none;
  line-height: 1.5;
}

.pop-textarea:focus {
  border-color: var(--teal);
}

.pop-textarea::placeholder {
  color: var(--text-dim);
}

.pop-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  justify-content: flex-end;
}

.pop-btn {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: var(--bg-panel-alt);
  color: var(--text-mid);
  transition: all 0.12s;
}

.pop-btn:hover {
  background: rgba(52, 140, 215, 0.15);
  color: var(--text-bright);
}

.pop-save {
  background: var(--teal);
  color: #000;
  border-color: var(--teal);
}

.pop-save:hover {
  background: #00e0b8;
}
```

- [ ] **Step 4: Close popover when starting a drag**

In `startDrag()`, add `closePopover()` at the top:

```javascript
function startDrag(e, compId) {
  closePopover();
  if (e.target.classList.contains('conn-node') ||
      e.target.classList.contains('comp-delete')) return;
  // ... rest unchanged
}
```

- [ ] **Step 5: Verify in preview**

Test:
- Double-click a component → popover appears below it with textarea
- Type text, press Enter → saves, popover closes, truncated text shows on card
- Hover card → full text appears in tooltip
- Press Escape → cancels without saving
- Click outside popover → saves
- Double-click START/FINISH → can annotate them too

- [ ] **Step 6: Commit**

```bash
git add app.js style.css
git commit -m "feat: add pop-up annotation popovers on double-click"
```

---

### Task 4: Hybrid SVG Component Icons

**Files:**
- Create: `icons.js` (SVG icon definitions)
- Modify: `index.html` (add script tag for icons.js)
- Modify: `app.js` (use SVG icons instead of emoji)
- Modify: `style.css` (icon sizing adjustments)

Replace emoji icons with flat-color SVGs that have a blueprint outline style. Each icon is a small inline SVG string. Colors: machines use orange tones, materials use teal tones. All have a subtle stroke for the "schematic" feel.

- [ ] **Step 1: Create icons.js with SVG definitions**

Create `icons.js` with an `ICONS` object mapping subtypes to SVG strings:

```javascript
/**
 * Hybrid SVG icons: flat color fill + blueprint-style stroke
 * Machines = orange palette, Materials = teal palette
 */
const ICONS = {
  // ---- Simple Machines ----
  lever: `<svg viewBox="0 0 32 32" width="28" height="28">
    <polygon points="16,22 12,28 20,28" fill="none" stroke="#ff7b2e" stroke-width="1.5"/>
    <line x1="4" y1="20" x2="28" y2="20" stroke="#ff7b2e" stroke-width="2" stroke-linecap="round"/>
    <circle cx="8" cy="18" r="3" fill="rgba(255,123,46,0.3)" stroke="#ff7b2e" stroke-width="1.2"/>
  </svg>`,

  pulley: `<svg viewBox="0 0 32 32" width="28" height="28">
    <circle cx="16" cy="12" r="7" fill="rgba(255,123,46,0.15)" stroke="#ff7b2e" stroke-width="1.5"/>
    <circle cx="16" cy="12" r="2" fill="#ff7b2e"/>
    <line x1="16" y1="4" x2="16" y2="2" stroke="#ff7b2e" stroke-width="1.5"/>
    <line x1="9" y1="14" x2="6" y2="28" stroke="#ff7b2e" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="23" y1="14" x2="26" y2="28" stroke="#ff7b2e" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  wedge: `<svg viewBox="0 0 32 32" width="28" height="28">
    <polygon points="4,28 28,28 28,12" fill="rgba(255,123,46,0.2)" stroke="#ff7b2e" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`,

  wheel_axle: `<svg viewBox="0 0 32 32" width="28" height="28">
    <circle cx="16" cy="16" r="10" fill="rgba(255,123,46,0.12)" stroke="#ff7b2e" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="3" fill="rgba(255,123,46,0.3)" stroke="#ff7b2e" stroke-width="1.2"/>
    <line x1="6" y1="16" x2="26" y2="16" stroke="#ff7b2e" stroke-width="1" stroke-dasharray="2 2"/>
    <line x1="16" y1="6" x2="16" y2="26" stroke="#ff7b2e" stroke-width="1" stroke-dasharray="2 2"/>
  </svg>`,

  inclined_plane: `<svg viewBox="0 0 32 32" width="28" height="28">
    <polygon points="2,28 30,28 30,8" fill="rgba(255,123,46,0.15)" stroke="#ff7b2e" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="12" cy="21" r="3" fill="rgba(255,123,46,0.4)" stroke="#ff7b2e" stroke-width="1"/>
  </svg>`,

  screw: `<svg viewBox="0 0 32 32" width="28" height="28">
    <line x1="16" y1="2" x2="16" y2="28" stroke="#ff7b2e" stroke-width="2" stroke-linecap="round"/>
    <path d="M10,8 Q16,11 22,8" fill="none" stroke="#ff7b2e" stroke-width="1.3"/>
    <path d="M10,14 Q16,17 22,14" fill="none" stroke="#ff7b2e" stroke-width="1.3"/>
    <path d="M10,20 Q16,23 22,20" fill="none" stroke="#ff7b2e" stroke-width="1.3"/>
  </svg>`,

  // ---- Materials ----
  tube: `<svg viewBox="0 0 32 32" width="28" height="28">
    <rect x="8" y="4" width="16" height="24" rx="8" fill="rgba(0,201,167,0.12)" stroke="#00c9a7" stroke-width="1.5"/>
    <ellipse cx="16" cy="4" rx="8" ry="3" fill="rgba(0,201,167,0.2)" stroke="#00c9a7" stroke-width="1.2"/>
  </svg>`,

  bucket: `<svg viewBox="0 0 32 32" width="28" height="28">
    <path d="M6,10 L9,28 L23,28 L26,10 Z" fill="rgba(0,201,167,0.15)" stroke="#00c9a7" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse cx="16" cy="10" rx="10" ry="3" fill="rgba(0,201,167,0.2)" stroke="#00c9a7" stroke-width="1.2"/>
    <path d="M8,6 Q16,0 24,6" fill="none" stroke="#00c9a7" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  toy_car: `<svg viewBox="0 0 32 32" width="28" height="28">
    <rect x="4" y="12" width="24" height="10" rx="3" fill="rgba(0,201,167,0.15)" stroke="#00c9a7" stroke-width="1.5"/>
    <path d="M8,12 L12,6 L22,6 L24,12" fill="rgba(0,201,167,0.1)" stroke="#00c9a7" stroke-width="1.2"/>
    <circle cx="9" cy="24" r="3" fill="rgba(0,201,167,0.3)" stroke="#00c9a7" stroke-width="1.2"/>
    <circle cx="23" cy="24" r="3" fill="rgba(0,201,167,0.3)" stroke="#00c9a7" stroke-width="1.2"/>
  </svg>`,

  string: `<svg viewBox="0 0 32 32" width="28" height="28">
    <path d="M4,8 Q12,20 16,12 Q20,4 24,16 Q28,28 28,24" fill="none" stroke="#00c9a7" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  cup: `<svg viewBox="0 0 32 32" width="28" height="28">
    <path d="M6,6 L8,26 L24,26 L26,6" fill="rgba(0,201,167,0.12)" stroke="#00c9a7" stroke-width="1.5" stroke-linejoin="round"/>
    <line x1="6" y1="6" x2="26" y2="6" stroke="#00c9a7" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  dominoes: `<svg viewBox="0 0 32 32" width="28" height="28">
    <rect x="4" y="8" width="8" height="18" rx="1.5" fill="rgba(0,201,167,0.2)" stroke="#00c9a7" stroke-width="1.2" transform="rotate(-8 8 17)"/>
    <rect x="14" y="6" width="8" height="18" rx="1.5" fill="rgba(0,201,167,0.15)" stroke="#00c9a7" stroke-width="1.2" transform="rotate(-4 18 15)"/>
    <rect x="23" y="5" width="8" height="18" rx="1.5" fill="rgba(0,201,167,0.1)" stroke="#00c9a7" stroke-width="1.2"/>
  </svg>`,

  magnet: `<svg viewBox="0 0 32 32" width="28" height="28">
    <path d="M8,18 L8,12 Q8,4 16,4 Q24,4 24,12 L24,18" fill="none" stroke="#00c9a7" stroke-width="3" stroke-linecap="round"/>
    <rect x="5" y="18" width="6" height="6" rx="1" fill="#ef476f" stroke="#ef476f" stroke-width="0.5"/>
    <rect x="21" y="18" width="6" height="6" rx="1" fill="#348cd7" stroke="#348cd7" stroke-width="0.5"/>
  </svg>`,

  track: `<svg viewBox="0 0 32 32" width="28" height="28">
    <line x1="6" y1="10" x2="6" y2="26" stroke="#00c9a7" stroke-width="2"/>
    <line x1="26" y1="10" x2="26" y2="26" stroke="#00c9a7" stroke-width="2"/>
    <line x1="6" y1="14" x2="26" y2="14" stroke="#00c9a7" stroke-width="1.2"/>
    <line x1="6" y1="18" x2="26" y2="18" stroke="#00c9a7" stroke-width="1.2"/>
    <line x1="6" y1="22" x2="26" y2="22" stroke="#00c9a7" stroke-width="1.2"/>
  </svg>`,

  cardboard: `<svg viewBox="0 0 32 32" width="28" height="28">
    <rect x="4" y="8" width="24" height="18" rx="1" fill="rgba(0,201,167,0.12)" stroke="#00c9a7" stroke-width="1.5"/>
    <line x1="4" y1="14" x2="28" y2="14" stroke="#00c9a7" stroke-width="1" stroke-dasharray="3 2"/>
    <line x1="16" y1="14" x2="16" y2="26" stroke="#00c9a7" stroke-width="1" stroke-dasharray="3 2"/>
  </svg>`,

  tape: `<svg viewBox="0 0 32 32" width="28" height="28">
    <circle cx="16" cy="16" r="10" fill="rgba(0,201,167,0.1)" stroke="#00c9a7" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="4" fill="none" stroke="#00c9a7" stroke-width="1.2"/>
    <line x1="26" y1="16" x2="30" y2="20" stroke="#00c9a7" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  box: `<svg viewBox="0 0 32 32" width="28" height="28">
    <rect x="4" y="10" width="24" height="18" rx="1.5" fill="rgba(0,201,167,0.12)" stroke="#00c9a7" stroke-width="1.5"/>
    <polyline points="4,10 16,4 28,10" fill="rgba(0,201,167,0.08)" stroke="#00c9a7" stroke-width="1.5" stroke-linejoin="round"/>
    <line x1="16" y1="4" x2="16" y2="10" stroke="#00c9a7" stroke-width="1"/>
  </svg>`,

  // ---- Markers ----
  start: `<svg viewBox="0 0 32 32" width="28" height="28">
    <circle cx="16" cy="16" r="12" fill="rgba(6,214,160,0.15)" stroke="#06d6a0" stroke-width="2"/>
    <polygon points="12,8 24,16 12,24" fill="#06d6a0"/>
  </svg>`,

  finish: `<svg viewBox="0 0 32 32" width="28" height="28">
    <circle cx="16" cy="16" r="12" fill="rgba(239,71,111,0.15)" stroke="#ef476f" stroke-width="2"/>
    <rect x="10" y="10" width="12" height="12" rx="2" fill="#ef476f"/>
  </svg>`,
};
```

- [ ] **Step 2: Add icons.js script tag to index.html**

Add before app.js:

```html
<script src="icons.js"></script>
<script src="app.js"></script>
```

- [ ] **Step 3: Update component definitions to reference SVG icons**

In `app.js`, keep the emoji `icon` field as a fallback but use SVG when rendering. Update `renderComponents()`:

```javascript
// Replace the icon div creation:
const icon = document.createElement('div');
icon.className = 'comp-icon';
if (ICONS[comp.subtype]) {
  icon.innerHTML = ICONS[comp.subtype];
} else {
  icon.textContent = comp.icon;
}
card.appendChild(icon);
```

Update `makeLibItem()` in the library rendering:

```javascript
function makeLibItem(def) {
  const div = document.createElement('div');
  div.className = `lib-item ${def.type === 'simple_machine' ? 'machine' : 'material'}`;
  div.draggable = true;
  const iconHtml = ICONS[def.subtype]
    ? `<span class="lib-icon">${ICONS[def.subtype]}</span>`
    : `<span class="lib-icon">${def.icon}</span>`;
  div.innerHTML = `${iconHtml}<span class="lib-name">${def.name}</span>`;
  div.addEventListener('dragstart', e => {
    e.dataTransfer.setData('application/json', JSON.stringify(def));
    e.dataTransfer.effectAllowed = 'copy';
  });
  return div;
}
```

Also update `renderBOM()`:

Update the BOM to track subtypes for SVG icon lookup, and exclude markers:

```javascript
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
    const svgIcon = ICONS[subtypes[name]];
    row.innerHTML = `
      <div class="bom-name">
        <span class="bom-icon">${svgIcon || icons[name]}</span>
        <span>${name}</span>
      </div>
      <span class="bom-qty">×${counts[name]}</span>
    `;
    el.appendChild(row);
  });
}
```

- [ ] **Step 4: Adjust icon sizing in CSS**

```css
.lib-icon {
  font-size: 16px;
  flex-shrink: 0;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lib-icon svg {
  width: 20px;
  height: 20px;
}

.comp-icon svg {
  width: 28px;
  height: 28px;
}

.bom-icon {
  font-size: 12px;
  display: flex;
  align-items: center;
}

.bom-icon svg {
  width: 16px;
  height: 16px;
}
```

- [ ] **Step 5: Update renderChecklist to use SVG icons too**

```javascript
// In renderChecklist(), update the per-machine checkboxes:
SIMPLE_MACHINES.forEach(m => {
  const checked = machineTypes.has(m.subtype);
  const item = document.createElement('div');
  item.className = `check-item ${checked ? 'checked' : ''}`;
  const svgIcon = ICONS[m.subtype];
  item.innerHTML = `
    <div class="check-box ${checked ? 'checked' : ''}">${checked ? '✓' : ''}</div>
    <span class="check-icon">${svgIcon || m.icon}</span>
    <span class="check-label">${m.name}</span>
  `;
  el.appendChild(item);
});
```

Add CSS for the check icon:

```css
.check-icon {
  display: flex;
  align-items: center;
}

.check-icon svg {
  width: 14px;
  height: 14px;
}
```

- [ ] **Step 6: Verify in preview**

Check:
- All library items show SVG icons (orange for machines, teal for materials)
- Canvas component cards show larger SVG icons
- START shows green play triangle, FINISH shows red stop square
- Tracker checklist shows small SVG icons next to each machine name
- Bill of materials shows tiny SVG icons
- Icons look clean and "blueprint-like" with visible strokes

- [ ] **Step 7: Commit**

```bash
git add icons.js index.html app.js style.css
git commit -m "feat: replace emoji with hybrid SVG blueprint-style icons"
```

---

### Task 5: Integration Polish & Edge Cases

**Files:**
- Modify: `app.js` (edge case fixes)
- Modify: `style.css` (visual tweaks)

Final polish to make everything work together smoothly.

- [ ] **Step 1: Update empty-state hint text**

Since START/FINISH are always present, the canvas is never truly "empty." Update the hint logic:

```javascript
// In renderComponents(), change empty-state logic:
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
```

- [ ] **Step 2: Exclude markers from BOM and machine count**

Already handled in Task 4's BOM update. Verify the machine checklist also excludes markers (it should since markers have `type: 'marker'` not `type: 'simple_machine'`).

- [ ] **Step 3: Handle load JSON with markers**

When loading a saved project, ensure markers are present. If the saved file predates markers, add them. **This code goes AFTER the `_nextId` sync block** to avoid ID collisions:

```javascript
// In loadJSON, AFTER the _nextId sync block:
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
```

- [ ] **Step 4: Canvas scrolls to center on init**

Center the canvas viewport so START is visible on load:

```javascript
// At end of init():
const wrapper = document.getElementById('canvas-wrapper');
wrapper.scrollLeft = 0;
wrapper.scrollTop = Math.max(0, (900 - wrapper.clientHeight) / 2);
```

- [ ] **Step 5: Close popover on "New"**

Add `closePopover()` to the New button handler, before resetting state.

- [ ] **Step 6: Verify full flow in preview**

Complete end-to-end test:
1. Page loads → START and FINISH visible, hint text shows
2. Drag a Lever near START → auto-links, step count goes to 1, Lever checkbox ticks
3. Drag a Pulley near the Lever → auto-links, step count = 2, Pulley checkbox ticks
4. Drag an Inclined Plane near Pulley → auto-links, step count = 3, "3/3 met!" for machines
5. Add more components to reach 5 steps → step requirement turns green
6. Double-click a component → popover appears, type text, press Enter
7. Hover the component → see full annotation in tooltip
8. Click Save JSON → downloads file
9. Click New → resets, markers reappear
10. Load the saved JSON → everything restores including annotations
11. Click Export PNG → downloads image

- [ ] **Step 7: Commit**

```bash
git add app.js style.css
git commit -m "feat: integration polish — hints, load compat, scroll position"
```
