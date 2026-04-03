# Connector UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make connections first-class selectable objects — symbolic orange lines are clickable/selectable with a midpoint × delete button; snap/cord connection ×'s move to the contact point and show only when an endpoint is selected.

**Architecture:** Connection IDs join the existing `selectedIds[]` in `drag.js` (Approach A — unified selection). `renderConnections` reads `getSelectedIds()` to decide what to show. `getComponentsInRect` in `multi-select.js` is renamed `getItemsInRect` and gains a `connections` param so rubber-band automatically captures symbolic connections whose both endpoints are in the rect. `selectedConnId` in `main.js` is removed — the delete key handler is consolidated to route connection IDs to `deleteConnection`.

**Tech Stack:** Vanilla JS ES modules, SVG `document.createElementNS`, Node.js test runner (`node --input-type=module`). No build step.

---

## File Map

| File | Change |
|------|--------|
| `js/multi-select.js` | Rename `getComponentsInRect` → `getItemsInRect`; add `connections` param; return symbolic conn IDs where both endpoints are in rect |
| `js/test/multi-select.test.js` | Update to 4-arg signature; add connection rubber-band tests |
| `js/render/connections.js` | Import `getSelectedIds`; `makeTealX` helper; snap × at p1 (not p1-12), cord × at p2 (not p2-12), both hidden until endpoint selected; orange line: transparent hit area + midpoint × when conn selected; highlight selected line |
| `js/drag.js` | Add `CORD_POINTS` set; connection click detection in mousedown; update rubber-band call to `getItemsInRect`; skip conn IDs in group drag `startPositions` builder |
| `js/main.js` | Remove `selectedConnId`; remove its click-setter; consolidated delete key handler; clean up `selectedIds` in `delete-conn` action |
| `index.html` | Version bump to `v2.7.0` |

---

## Task 1: Update `multi-select.js` + tests

**Files:**
- Modify: `js/multi-select.js`
- Modify: `js/test/multi-select.test.js`

- [ ] **Step 1: Replace the entire contents of `js/multi-select.js`**

```js
/**
 * Pure utilities for multi-select with no browser dependencies (testable in Node.js).
 */

const CORD_POINTS = new Set(['cordLeft', 'cordRight', 'end1', 'end2']);

/**
 * Returns the IDs of all components, environment items, and symbolic connections
 * that fall inside the given rectangle. Connections are included only when both
 * their endpoint components are inside the rect (snap and cord connections excluded).
 * Touching edges (strict less-than) do not count as overlap.
 *
 * @param {Array} components  - state.components array
 * @param {Array} environment - state.environment array
 * @param {Array} connections - state.connections array
 * @param {{ x: number, y: number, width: number, height: number }} rect - in cm
 * @returns {string[]}
 */
export function getItemsInRect(components, environment, connections, rect) {
  const overlaps = item =>
    item.x < rect.x + rect.width &&
    item.x + item.width  > rect.x  &&
    item.y < rect.y + rect.height &&
    item.y + item.height > rect.y;

  const itemIds = [...components, ...environment].filter(overlaps).map(c => c.id);
  const idSet = new Set(itemIds);

  // Symbolic connections: include when both endpoints are inside the rect
  const connIds = (connections || [])
    .filter(c => !c.snap && !CORD_POINTS.has(c.fromPoint) && !CORD_POINTS.has(c.toPoint))
    .filter(c => idSet.has(c.fromId) && idSet.has(c.toId))
    .map(c => c.id);

  return [...itemIds, ...connIds];
}
```

- [ ] **Step 2: Replace the entire contents of `js/test/multi-select.test.js`**

```js
import { test, assertEqual, assert } from './run.js';
import { getItemsInRect } from '../multi-select.js';

test('empty inputs returns empty array', () => {
  const result = getItemsInRect([], [], [], { x: 0, y: 0, width: 100, height: 100 });
  assertEqual(result.length, 0);
});

test('simple_machine fully inside rect is included', () => {
  const components = [{ id: 'a', type: 'simple_machine', subtype: 'lever', x: 10, y: 10, width: 20, height: 10 }];
  const result = getItemsInRect(components, [], [], { x: 5, y: 5, width: 50, height: 30 });
  assertEqual(result.length, 1);
  assertEqual(result[0], 'a');
});

test('material partially overlapping rect is included', () => {
  const components = [{ id: 'a', type: 'material', subtype: 'ball', x: 45, y: 10, width: 20, height: 20 }];
  const result = getItemsInRect(components, [], [], { x: 0, y: 0, width: 50, height: 50 });
  assertEqual(result.length, 1);
});

test('component fully outside rect is excluded', () => {
  const components = [{ id: 'a', type: 'simple_machine', subtype: 'lever', x: 200, y: 200, width: 20, height: 10 }];
  const result = getItemsInRect(components, [], [], { x: 0, y: 0, width: 50, height: 50 });
  assertEqual(result.length, 0);
});

test('touching edge only is excluded', () => {
  const components = [{ id: 'a', type: 'material', subtype: 'domino', x: 50, y: 0, width: 10, height: 20 }];
  const result = getItemsInRect(components, [], [], { x: 0, y: 0, width: 50, height: 50 });
  assertEqual(result.length, 0);
});

test('environment item inside rect is included', () => {
  const environment = [{ id: 'env1', type: 'environment', subtype: 'desk', x: 10, y: 10, width: 50, height: 30 }];
  const result = getItemsInRect([], environment, [], { x: 0, y: 0, width: 100, height: 100 });
  assertEqual(result.length, 1);
  assertEqual(result[0], 'env1');
});

test('marker component inside rect is included', () => {
  const components = [
    { id: 'm1',    type: 'marker',   subtype: 'start', x: 10, y: 10, width: 20, height: 20 },
    { id: 'ball1', type: 'material', subtype: 'ball',  x: 10, y: 10, width: 18, height: 18 },
  ];
  const result = getItemsInRect(components, [], [], { x: 0, y: 0, width: 100, height: 100 });
  assertEqual(result.length, 2);
  assert(result.includes('m1'));
  assert(result.includes('ball1'));
});

test('multiple overlapping components all returned', () => {
  const components = [
    { id: 'a', type: 'simple_machine', subtype: 'lever',  x: 10,  y: 10,  width: 20, height: 10 },
    { id: 'b', type: 'material',       subtype: 'ball',   x: 30,  y: 10,  width: 18, height: 18 },
    { id: 'c', type: 'material',       subtype: 'domino', x: 100, y: 100, width: 12, height: 24 },
  ];
  const result = getItemsInRect(components, [], [], { x: 0, y: 0, width: 60, height: 40 });
  assertEqual(result.length, 2);
  assert(result.includes('a'));
  assert(result.includes('b'));
});

test('symbolic connection included when both endpoints are in rect', () => {
  const components = [
    { id: 'a', type: 'marker',   subtype: 'start', x: 5,  y: 5,  width: 10, height: 10 },
    { id: 'b', type: 'material', subtype: 'ball',  x: 30, y: 30, width: 18, height: 18 },
  ];
  const connections = [
    { id: 'conn1', fromId: 'a', fromPoint: 'output', toId: 'b', toPoint: 'input' },
  ];
  const result = getItemsInRect(components, [], connections, { x: 0, y: 0, width: 100, height: 100 });
  assertEqual(result.length, 3);
  assert(result.includes('conn1'));
});

test('symbolic connection excluded when only one endpoint is in rect', () => {
  const components = [
    { id: 'a', type: 'marker',   subtype: 'start', x: 5,   y: 5,  width: 10, height: 10 },
    { id: 'b', type: 'material', subtype: 'ball',  x: 200, y: 30, width: 18, height: 18 },
  ];
  const connections = [
    { id: 'conn1', fromId: 'a', fromPoint: 'output', toId: 'b', toPoint: 'input' },
  ];
  const result = getItemsInRect(components, [], connections, { x: 0, y: 0, width: 100, height: 100 });
  assert(!result.includes('conn1'));
});

test('snap connection is never included in rubber-band result', () => {
  const components = [
    { id: 'a', type: 'simple_machine', subtype: 'lever', x: 5,  y: 5,  width: 60, height: 16 },
    { id: 'b', type: 'material',       subtype: 'ball',  x: 10, y: 10, width: 18, height: 18 },
  ];
  const connections = [
    { id: 'conn1', fromId: 'b', fromPoint: 'output', toId: 'a', toPoint: 'input', snap: true },
  ];
  const result = getItemsInRect(components, [], connections, { x: 0, y: 0, width: 100, height: 100 });
  assert(!result.includes('conn1'));
});

test('cord connection is never included in rubber-band result', () => {
  const components = [
    { id: 'a', type: 'simple_machine', subtype: 'pulley', x: 5,  y: 5,  width: 15, height: 20 },
    { id: 'b', type: 'material',       subtype: 'bucket', x: 10, y: 50, width: 20, height: 24 },
  ];
  const connections = [
    { id: 'conn1', fromId: 'a', fromPoint: 'cordLeft', toId: 'b', toPoint: 'input' },
  ];
  const result = getItemsInRect(components, [], connections, { x: 0, y: 0, width: 100, height: 100 });
  assert(!result.includes('conn1'));
});
```

- [ ] **Step 3: Run the tests — expect them all to pass**

```bash
node --input-type=module --eval "import './js/test/run.js'; import './js/test/multi-select.test.js';"
```

Expected output:
```
  ✓ empty inputs returns empty array
  ✓ simple_machine fully inside rect is included
  ✓ material partially overlapping rect is included
  ✓ component fully outside rect is excluded
  ✓ touching edge only is excluded
  ✓ environment item inside rect is included
  ✓ marker component inside rect is included
  ✓ multiple overlapping components all returned
  ✓ symbolic connection included when both endpoints are in rect
  ✓ symbolic connection excluded when only one endpoint is in rect
  ✓ snap connection is never included in rubber-band result
  ✓ cord connection is never included in rubber-band result

12 passed, 0 failed
```

- [ ] **Step 4: Commit**

```bash
git add js/multi-select.js js/test/multi-select.test.js
git commit -m "feat: getItemsInRect includes symbolic connections in rubber-band selection"
```

---

## Task 2: Rewrite `renderConnections` — × positioning and selection highlighting

**Files:**
- Modify: `js/render/connections.js`

- [ ] **Step 1: Replace the entire contents of `js/render/connections.js`**

Keep `renderFallLines` exactly as-is. Replace only the top section through the end of `renderConnections`.

```js
import { getAttachPx } from './attachPoints.js';
import { getConnDrag, getSelectedIds } from '../drag.js';
import { getSurfaces } from './environment.js';
import { cmToPx, pxToCm, getFloorPx } from '../canvas.js';

const NS = 'http://www.w3.org/2000/svg';
const CORD_SUBTYPES = new Set(['string', 'matchboxTrack']);
const CORD_POINTS = new Set(['cordLeft', 'cordRight', 'end1', 'end2']);

function findItem(state, id) {
  return state.components.find(c => c.id === id) || (state.environment || []).find(e => e.id === id);
}

// Teal × delete button at (cx, cy) with the connection ID embedded
function makeTealX(cx, cy, connId) {
  const g = document.createElementNS(NS, 'g');
  g.dataset.action = 'delete-conn';
  g.dataset.connId = connId;
  g.setAttribute('cursor', 'pointer');
  const dc = document.createElementNS(NS, 'circle');
  dc.setAttribute('cx', cx); dc.setAttribute('cy', cy);
  dc.setAttribute('r', 7); dc.setAttribute('fill', '#00c9a7');
  dc.setAttribute('stroke', '#fff'); dc.setAttribute('stroke-width', 1);
  const dt = document.createElementNS(NS, 'text');
  dt.setAttribute('x', cx); dt.setAttribute('y', cy);
  dt.setAttribute('text-anchor', 'middle'); dt.setAttribute('dominant-baseline', 'middle');
  dt.setAttribute('fill', '#fff'); dt.setAttribute('font-size', 11); dt.textContent = '×';
  g.appendChild(dc); g.appendChild(dt);
  return g;
}

export function renderConnections(state, layer) {
  layer.innerHTML = '';
  const selectedSet = new Set(getSelectedIds());

  for (const conn of state.connections) {
    const from = findItem(state, conn.fromId);
    const to = findItem(state, conn.toId);
    if (!from || !to) continue;
    const fromPts = getAttachPx(from);
    const toPts = getAttachPx(to);
    const p1 = fromPts[conn.fromPoint];
    const p2 = toPts[conn.toPoint];
    if (!p1 || !p2) continue;

    const g = document.createElementNS(NS, 'g');
    g.dataset.connId = conn.id;

    const eitherEndpointSelected = selectedSet.has(conn.fromId) || selectedSet.has(conn.toId);

    if (conn.snap) {
      // Physical snap connection: × AT the attachment point, visible only when an endpoint is selected
      if (eitherEndpointSelected) {
        g.appendChild(makeTealX(p1.x, p1.y, conn.id));
      }
      layer.appendChild(g);
      continue;
    }

    if (CORD_POINTS.has(conn.fromPoint) || CORD_POINTS.has(conn.toPoint)) {
      // Physical cord connection: × AT the cord endpoint, visible only when an endpoint is selected
      if (eitherEndpointSelected) {
        g.appendChild(makeTealX(p2.x, p2.y, conn.id));
      }
      layer.appendChild(g);
      continue;
    }

    // Symbolic connection (orange line)
    const isCord = CORD_SUBTYPES.has(from.subtype) || CORD_SUBTYPES.has(to.subtype);
    const isSelected = selectedSet.has(conn.id);

    // Transparent wide hit area so the thin line is easy to click
    const hitLine = document.createElementNS(NS, 'line');
    hitLine.setAttribute('x1', p1.x); hitLine.setAttribute('y1', p1.y);
    hitLine.setAttribute('x2', p2.x); hitLine.setAttribute('y2', p2.y);
    hitLine.setAttribute('stroke', 'transparent');
    hitLine.setAttribute('stroke-width', 16);
    g.appendChild(hitLine);

    // Visible line — brighter and thicker when selected
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', p1.x); l.setAttribute('y1', p1.y);
    l.setAttribute('x2', p2.x); l.setAttribute('y2', p2.y);
    if (isCord) {
      l.setAttribute('stroke', isSelected ? '#e0e0e0' : '#ccc');
      l.setAttribute('stroke-width', isSelected ? 3 : 2);
    } else {
      l.setAttribute('stroke', isSelected ? '#ff9f5e' : '#ff7b2e');
      l.setAttribute('stroke-width', isSelected ? 3 : 2);
    }
    g.appendChild(l);

    // Teal × at midpoint — only when this connection is selected
    if (isSelected) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      g.appendChild(makeTealX(mx, my, conn.id));
    }

    layer.appendChild(g);
  }

  // Draw in-progress connection drag (ghost line while dragging from attach point)
  const cd = getConnDrag();
  if (cd) {
    const fromComp = findItem(state, cd.fromId);
    if (fromComp) {
      const pts = getAttachPx(fromComp);
      const p1 = pts[cd.fromPoint];
      if (p1) {
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', p1.x); l.setAttribute('y1', p1.y);
        l.setAttribute('x2', cd.curPx); l.setAttribute('y2', cd.curPy);
        l.setAttribute('stroke', '#00c9a7'); l.setAttribute('stroke-width', 1.5);
        l.setAttribute('stroke-dasharray', '5 3');
        layer.appendChild(l);
      }
    }
  }
}
```

After the closing brace of `renderConnections`, keep the rest of the file (`arrowDefAdded`, `ensureArrowDef`, `getLeverBarTopY`, `renderFallLines`) completely unchanged.

- [ ] **Step 2: Commit**

```bash
git add js/render/connections.js
git commit -m "feat: connection × buttons at contact points; orange lines selectable with midpoint ×"
```

---

## Task 3: Update `drag.js` — connection click detection, rubber-band, group drag

**Files:**
- Modify: `js/drag.js`

Three targeted changes — make each edit separately.

- [ ] **Step 1: Add `CORD_POINTS` constant near the top of `drag.js`**

Find the block of `const` declarations near the top (around line 10):
```js
const LOCK_ASPECT = new Set([
```

Immediately before that block, add:
```js
const CORD_POINTS = new Set(['cordLeft', 'cordRight', 'end1', 'end2']);
```

- [ ] **Step 2: Add connection click detection in `mousedown`**

Find the existing early return for action buttons (line ~131):
```js
    // Let action buttons (delete, comment) be handled by the click event
    if (e.target.closest('[data-action]')) return;

    // Check for sub-part/resize handle (use closest so grouped handles like free-rotate work)
    const handleEl = e.target.closest('[data-handle]');
```

Replace with:
```js
    // Let action buttons (delete, comment) be handled by the click event
    if (e.target.closest('[data-action]')) return;

    // Symbolic connection line click — add/remove conn ID from selectedIds
    const connEl = e.target.closest('[data-conn-id]');
    if (connEl) {
      const connId = connEl.dataset.connId;
      const state = getState();
      const conn = state.connections.find(c => c.id === connId);
      if (conn && !conn.snap && !CORD_POINTS.has(conn.fromPoint) && !CORD_POINTS.has(conn.toPoint)) {
        if (e.shiftKey) {
          const idx = selectedIds.indexOf(connId);
          selectedIds = idx >= 0 ? selectedIds.filter(s => s !== connId) : [...selectedIds, connId];
        } else {
          selectedIds = [connId];
        }
        render();
        e.stopPropagation();
        return;
      }
    }

    // Check for sub-part/resize handle (use closest so grouped handles like free-rotate work)
    const handleEl = e.target.closest('[data-handle]');
```

- [ ] **Step 3: Skip connection IDs in group drag `startPositions` builder**

Find this block (around line 243):
```js
      for (const sid of selectedIds) {
        const sc = state.components.find(c => c.id === sid) || state.environment.find(e => e.id === sid);
        if (!sc) continue;
```

Replace with:
```js
      for (const sid of selectedIds) {
        // Connections follow their endpoint components — skip conn IDs, no position to track
        if (state.connections.find(c => c.id === sid)) continue;
        const sc = state.components.find(c => c.id === sid) || state.environment.find(e => e.id === sid);
        if (!sc) continue;
```

- [ ] **Step 4: Update rubber-band to call `getItemsInRect` with connections**

Update the import at the top of `drag.js`:

Find:
```js
import { getComponentsInRect } from './multi-select.js';
```

Replace with:
```js
import { getItemsInRect } from './multi-select.js';
```

Find the rubber-band mouseup block (around line 581):
```js
        const s = getState();
        const found = getComponentsInRect(s.components, s.environment, rect);
```

Replace with:
```js
        const s = getState();
        const found = getItemsInRect(s.components, s.environment, s.connections, rect);
```

- [ ] **Step 5: Commit**

```bash
git add js/drag.js
git commit -m "feat: connection click detection in drag.js; rubber-band captures symbolic connections"
```

---

## Task 4: Update `main.js` — remove `selectedConnId`, consolidate delete handler

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Remove `selectedConnId` variable and its click-setter**

Find and delete this line:
```js
let selectedConnId = null;
```

Find and remove the block at the bottom of the click handler (around line 288) that sets it:
```js
  const connEl = e.target.closest('[data-conn-id]');
  if (connEl) {
    selectedConnId = connEl.dataset.connId;
    return;
  }
```

- [ ] **Step 2: Update `delete-conn` action to clean up `selectedIds`**

Find:
```js
    if (action === 'delete-conn') {
      undoPush();
      deleteConnection(connId);
      render(); updateUndoButtons(); updateTrackerUI();
      return;
    }
```

Replace with:
```js
    if (action === 'delete-conn') {
      undoPush();
      deleteConnection(connId);
      setSelectedIds(getSelectedIds().filter(id => id !== connId));
      render(); updateUndoButtons(); updateTrackerUI();
      return;
    }
```

- [ ] **Step 3: Consolidate the delete key handler**

Find the entire `if (e.key === 'Delete' || e.key === 'Backspace')` block:
```js
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedConnId) {
      undoPush();
      deleteConnection(selectedConnId);
      selectedConnId = null;
      render(); updateUndoButtons(); updateTrackerUI();
      return;
    }
    // Multi-select delete
    const ids = getSelectedIds();
    if (ids.length > 1) { // > 1 so single-item selections fall through to the getSelected() single-select path below
      undoPush();
      const s = getState();
      ids.forEach(id => {
        if (s.components.find(c => c.id === id && (c.subtype === 'start' || c.subtype === 'finish'))) return;
        if (s.environment.find(e => e.id === id)) removeEnvItem(id);
        else removeComponent(id);
      });
      setSelectedIds([]);
      render(); updateUndoButtons(); updateTrackerUI();
      return;
    }
    // Single-select delete (existing)
    const id = getSelected();
    if (!id) return;
    const s = getState();
    if (s.components.find(c => c.id === id && (c.subtype === 'start' || c.subtype === 'finish'))) return;
    undoPush();
    if (s.environment.find(en => en.id === id)) removeEnvItem(id);
    else removeComponent(id);
    setSelected(null);
    render(); updateUndoButtons(); updateTrackerUI();
  }
```

Replace with:
```js
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    undoPush();
    const s = getState();
    const connIds = new Set(s.connections.map(c => c.id));
    ids.forEach(id => {
      if (connIds.has(id)) {
        deleteConnection(id);
      } else if (s.components.find(c => c.id === id && (c.subtype === 'start' || c.subtype === 'finish'))) {
        // skip — start/finish markers cannot be deleted
      } else if (s.environment.find(e => e.id === id)) {
        removeEnvItem(id);
      } else {
        removeComponent(id);
      }
    });
    setSelectedIds([]);
    render(); updateUndoButtons(); updateTrackerUI();
  }
```

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: remove selectedConnId; unified delete handler routes connection IDs"
```

---

## Task 5: Bump version to v2.7.0

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Update the version label**

Find:
```html
      <div id="version-label">v2.6.4</div>
```

Replace with:
```html
      <div id="version-label">v2.7.0</div>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: connector UX overhaul — selectable connections, midpoint ×, contact-point × (v2.7.0)"
```

---

## Task 6: Push and smoke test

- [ ] **Step 1: Push to New-Features**

```bash
git push origin New-Features
```

- [ ] **Step 2: Smoke test checklist**

Open the live site (hard-refresh to clear cache). Confirm version label reads `v2.7.0`.

- [ ] **Click an orange connector line** — it becomes brighter/thicker; a teal × appears at its midpoint
- [ ] **Click the teal × on a selected orange line** — connection is removed
- [ ] **Click empty canvas** — orange line deselects (no ×)
- [ ] **Shift-click a second component while an orange line is selected** — both are in `selectedIds`; Delete key removes the connection and the component
- [ ] **Rubber-band over two connected components** — orange line between them is auto-selected (highlighted); Delete removes components and connection together
- [ ] **Rubber-band over only one endpoint** — orange line is NOT selected
- [ ] **Snap a ball onto a lever** — no × visible until ball or lever is selected; × appears AT the snap point (not 12px above); clicking × disconnects them
- [ ] **Pulley cord connected to another component** — × appears AT the cord endpoint when pulley or target is selected; clicking × disconnects
- [ ] **Delete key with nothing selected** — does nothing (no error)
- [ ] **Undo/redo** — works correctly for all connection changes
