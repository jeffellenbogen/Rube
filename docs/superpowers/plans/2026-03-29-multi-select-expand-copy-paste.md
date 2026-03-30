# Multi-Select Expand + Copy/Paste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand rubber-band and shift-click selection to include environment items and step-flag markers, and add Cmd+C / Cmd+V copy/paste for any selection.

**Architecture:** `getComponentsInRect` gains an `environment` parameter so rubber-band captures both arrays. Group drag stores an `isEnv` flag per item so it calls the right update function. Clipboard state (`clipboard`, `pasteOffset`) lives in `drag.js` alongside `selectedIds`; `copySelection()` and `pasteSelection()` are exported and called from `main.js` keydown handlers.

**Tech Stack:** Vanilla ES modules, plain JS objects, no libraries.

---

## File Map

| File | Change |
|---|---|
| `js/multi-select.js` | Add `environment` param; remove type filter so all items in both arrays are eligible |
| `js/test/multi-select.test.js` | Update all calls to new 3-arg signature; flip env/marker exclusion tests to inclusion tests |
| `js/drag.js` | Remove shift-click guard; fix group drag to look up env items + call `updateEnvItem`; fix rubber-band call; add clipboard state + `copySelection` + `pasteSelection` exports; add imports |
| `js/main.js` | Fix multi-delete to call `removeEnvItem` for env items; add Cmd+C/V handlers; import copy/paste functions; version bump |

---

## Task 1: Update `getComponentsInRect` + tests

**Files:**
- Modify: `js/multi-select.js`
- Modify: `js/test/multi-select.test.js`

- [ ] **Step 1: Update `js/multi-select.js`**

Replace the entire file:

```js
/**
 * Pure utilities for multi-select with no browser dependencies (testable in Node.js).
 */

/**
 * Returns the IDs of all components and environment items whose axis-aligned
 * bounding box overlaps the given rectangle. Ignores rotation.
 * Touching edges (strict less-than) do not count as overlap.
 *
 * @param {Array} components - state.components array (machines, materials, markers)
 * @param {Array} environment - state.environment array (desks, chairs, etc.)
 * @param {{ x: number, y: number, width: number, height: number }} rect - in cm
 * @returns {string[]}
 */
export function getComponentsInRect(components, environment, rect) {
  const overlaps = item =>
    item.x < rect.x + rect.width &&
    item.x + item.width  > rect.x  &&
    item.y < rect.y + rect.height &&
    item.y + item.height > rect.y;
  return [...components, ...environment].filter(overlaps).map(c => c.id);
}
```

- [ ] **Step 2: Run test to verify it fails (old signature)**

```bash
node --input-type=module --eval "import './js/test/run.js'; import './js/test/multi-select.test.js';"
```

Expected: failures because tests still pass the old 2-arg signature.

- [ ] **Step 3: Rewrite `js/test/multi-select.test.js`**

Replace the entire file:

```js
import { test, assertEqual, assert } from './run.js';
import { getComponentsInRect } from '../multi-select.js';

test('empty components and environment returns empty array', () => {
  const result = getComponentsInRect([], [], { x: 0, y: 0, width: 100, height: 100 });
  assertEqual(result.length, 0);
});

test('simple_machine fully inside rect is included', () => {
  const components = [{ id: 'a', type: 'simple_machine', subtype: 'lever', x: 10, y: 10, width: 20, height: 10 }];
  const result = getComponentsInRect(components, [], { x: 5, y: 5, width: 50, height: 30 });
  assertEqual(result.length, 1);
  assertEqual(result[0], 'a');
});

test('material partially overlapping rect is included', () => {
  const components = [{ id: 'a', type: 'material', subtype: 'ball', x: 45, y: 10, width: 20, height: 20 }];
  const result = getComponentsInRect(components, [], { x: 0, y: 0, width: 50, height: 50 });
  assertEqual(result.length, 1);
});

test('component fully outside rect is excluded', () => {
  const components = [{ id: 'a', type: 'simple_machine', subtype: 'lever', x: 200, y: 200, width: 20, height: 10 }];
  const result = getComponentsInRect(components, [], { x: 0, y: 0, width: 50, height: 50 });
  assertEqual(result.length, 0);
});

test('touching edge only is excluded', () => {
  // Component starts exactly where rect ends — strict < means no overlap
  const components = [{ id: 'a', type: 'material', subtype: 'domino', x: 50, y: 0, width: 10, height: 20 }];
  const result = getComponentsInRect(components, [], { x: 0, y: 0, width: 50, height: 50 });
  assertEqual(result.length, 0);
});

test('environment item inside rect is included', () => {
  const environment = [{ id: 'env1', type: 'environment', subtype: 'desk', x: 10, y: 10, width: 50, height: 30 }];
  const result = getComponentsInRect([], environment, { x: 0, y: 0, width: 100, height: 100 });
  assertEqual(result.length, 1);
  assertEqual(result[0], 'env1');
});

test('marker component inside rect is included', () => {
  const components = [
    { id: 'm1',    type: 'marker',   subtype: 'start', x: 10, y: 10, width: 20, height: 20 },
    { id: 'ball1', type: 'material', subtype: 'ball',  x: 10, y: 10, width: 18, height: 18 },
  ];
  const result = getComponentsInRect(components, [], { x: 0, y: 0, width: 100, height: 100 });
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
  const result = getComponentsInRect(components, [], { x: 0, y: 0, width: 60, height: 40 });
  assertEqual(result.length, 2);
  assert(result.includes('a'));
  assert(result.includes('b'));
});
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
node --input-type=module --eval "import './js/test/run.js'; import './js/test/multi-select.test.js';"
```

Expected: `8 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add js/multi-select.js js/test/multi-select.test.js
git commit -m "feat: expand getComponentsInRect to include env items and markers"
```

---

## Task 2: Update drag.js — shift-click, group drag, rubber-band

**Files:**
- Modify: `js/drag.js`

Three targeted changes. Make them one at a time.

- [ ] **Step 1: Remove shift-click type guard**

Find this block (around line 196):
```js
    // Shift-click: toggle this component in/out of selectedIds
    if (e.shiftKey) {
      if (item.type === 'environment' || item.type === 'marker') return; // exclude from multi-selection
```

Replace with (remove the exclusion line):
```js
    // Shift-click: toggle this component in/out of selectedIds
    if (e.shiftKey) {
```

- [ ] **Step 2: Update group drag `startPositions` builder**

Find this block (around line 239):
```js
      for (const sid of selectedIds) {
        const sc = state.components.find(c => c.id === sid);
        if (!sc) continue;
        const entry = { x: sc.x, y: sc.y };
        if (sc.subtype === 'string' && sc.subParts) {
          entry.isString = true;
          entry.origSubParts = { ...sc.subParts };
          entry.strX1 = sc.subParts.x1 ?? sc.x;
          entry.strY1 = sc.subParts.y1 ?? (sc.y + sc.height / 2);
          entry.strX2 = sc.subParts.x2 ?? (sc.x + sc.width);
          entry.strY2 = sc.subParts.y2 ?? (sc.y + sc.height / 2);
        }
        startPositions.set(sid, entry);
      }
```

Replace with:
```js
      for (const sid of selectedIds) {
        const sc = state.components.find(c => c.id === sid) || state.environment.find(e => e.id === sid);
        if (!sc) continue;
        const entry = { x: sc.x, y: sc.y, isEnv: sc.type === 'environment' };
        if (sc.subtype === 'string' && sc.subParts) {
          entry.isString = true;
          entry.origSubParts = { ...sc.subParts };
          entry.strX1 = sc.subParts.x1 ?? sc.x;
          entry.strY1 = sc.subParts.y1 ?? (sc.y + sc.height / 2);
          entry.strX2 = sc.subParts.x2 ?? (sc.x + sc.width);
          entry.strY2 = sc.subParts.y2 ?? (sc.y + sc.height / 2);
        }
        startPositions.set(sid, entry);
      }
```

- [ ] **Step 3: Update group drag mousemove to call `updateEnvItem` for env items**

Find this block (around line 402):
```js
      for (const [sid, orig] of groupDrag.startPositions) {
        if (orig.isString) {
          updateComponent(sid, {
            x: orig.x + dx, y: orig.y + dy,
            subParts: {
              ...orig.origSubParts,
              x1: orig.strX1 + dx, y1: orig.strY1 + dy,
              x2: orig.strX2 + dx, y2: orig.strY2 + dy,
            },
          });
        } else {
          updateComponent(sid, { x: orig.x + dx, y: orig.y + dy });
        }
      }
```

Replace with:
```js
      for (const [sid, orig] of groupDrag.startPositions) {
        if (orig.isString) {
          updateComponent(sid, {
            x: orig.x + dx, y: orig.y + dy,
            subParts: {
              ...orig.origSubParts,
              x1: orig.strX1 + dx, y1: orig.strY1 + dy,
              x2: orig.strX2 + dx, y2: orig.strY2 + dy,
            },
          });
        } else if (orig.isEnv) {
          updateEnvItem(sid, { x: orig.x + dx, y: orig.y + dy });
        } else {
          updateComponent(sid, { x: orig.x + dx, y: orig.y + dy });
        }
      }
```

- [ ] **Step 4: Update rubber-band call to pass environment**

Find this line (around line 565):
```js
        const found = getComponentsInRect(getState().components, rect);
```

Replace with:
```js
        const s = getState();
        const found = getComponentsInRect(s.components, s.environment, rect);
```

- [ ] **Step 5: Verify tests still pass**

```bash
node --input-type=module --eval "import './js/test/run.js'; import './js/test/multi-select.test.js';"
```

Expected: `8 passed, 0 failed`

- [ ] **Step 6: Commit**

```bash
git add js/drag.js
git commit -m "feat: expand multi-select to include env items and markers in shift-click and group drag"
```

---

## Task 3: Fix multi-delete in main.js to handle env items

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Update the multi-select delete block**

Find this block (around line 312):
```js
    // Multi-select delete
    const ids = getSelectedIds();
    if (ids.length > 1) { // > 1 so single-item selections fall through to the getSelected() single-select path below
      undoPush();
      const s = getState();
      // Safe to call removeComponent unconditionally: selectedIds only ever contains simple_machine/material types
      // because getComponentsInRect (rubber-band) and shift-click both exclude environment items by design.
      ids.forEach(id => {
        if (s.components.find(c => c.id === id && (c.subtype === 'start' || c.subtype === 'finish'))) return;
        removeComponent(id);
      });
      setSelectedIds([]);
      render(); updateUndoButtons(); updateTrackerUI();
      return;
    }
```

Replace with:
```js
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
```

- [ ] **Step 2: Verify tests still pass**

```bash
node --input-type=module --eval "import './js/test/run.js'; import './js/test/multi-select.test.js';"
```

Expected: `8 passed, 0 failed`

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "fix: multi-delete calls removeEnvItem for environment items"
```

---

## Task 4: Add clipboard state + copySelection + pasteSelection to drag.js

**Files:**
- Modify: `js/drag.js`

- [ ] **Step 1: Update the import from `./state.js` at the top of `js/drag.js`**

Find:
```js
import { updateComponent, updateEnvItem, getState } from './state.js';
```

Replace with:
```js
import { updateComponent, updateEnvItem, getState, addComponent, addEnvItem, addConnection } from './state.js';
```

- [ ] **Step 2: Add clipboard state variables**

Find the block of `let` declarations near the top (around line 37):
```js
let dragging   = null;    // component drag: { id, isEnv, startCanvasX, startCanvasY, compX, compY }
let connDrag   = null;    // connection drag: { fromId, fromPoint, curPx, curPy }
let handleDrag = null;    // { type, compId, startPx, startPy, origValue }
let selectedIds = [];     // replaces selected — 0=none, 1=single-select, 2+=multi-select
let rubberBand  = null;   // { startX, startY, currentX, currentY } in canvas cm, or null
let groupDrag   = null;   // { startX, startY, startPositions: Map<id,{x,y,...}> } or null
let hasMoved = false;     // tracks whether current drag has actually moved
```

Replace with (add clipboard lines at the end):
```js
let dragging   = null;    // component drag: { id, isEnv, startCanvasX, startCanvasY, compX, compY }
let connDrag   = null;    // connection drag: { fromId, fromPoint, curPx, curPy }
let handleDrag = null;    // { type, compId, startPx, startPy, origValue }
let selectedIds = [];     // replaces selected — 0=none, 1=single-select, 2+=multi-select
let rubberBand  = null;   // { startX, startY, currentX, currentY } in canvas cm, or null
let groupDrag   = null;   // { startX, startY, startPositions: Map<id,{x,y,...}> } or null
let hasMoved = false;     // tracks whether current drag has actually moved
let clipboard   = null;   // { items: Array<{data, isEnv, originalId}>, connections: Array } or null
let pasteOffset = 0;      // increments each paste without a new copy; resets on copySelection()
```

- [ ] **Step 3: Add `copySelection` and `pasteSelection` exports**

Find the last export in the file:
```js
export function getConnDrag() { return connDrag; }
```

After that line, add:

```js
export function copySelection() {
  const state = getState();
  if (selectedIds.length === 0) return;

  const items = [];
  const copiedIdSet = new Set();

  for (const id of selectedIds) {
    const comp = state.components.find(c => c.id === id);
    if (comp) {
      if (comp.subtype === 'start' || comp.subtype === 'finish') continue;
      const { id: _id, ...data } = comp;
      items.push({ data, isEnv: false, originalId: id });
      copiedIdSet.add(id);
      continue;
    }
    const env = state.environment.find(e => e.id === id);
    if (env) {
      const { id: _id, ...data } = env;
      items.push({ data, isEnv: true, originalId: id });
      copiedIdSet.add(id);
    }
  }

  // Only copy connections where both endpoints are in the selection
  const connections = state.connections.filter(
    c => copiedIdSet.has(c.fromId) && copiedIdSet.has(c.toId)
  );

  clipboard = { items, connections };
  pasteOffset = 0;
}

export function pasteSelection() {
  if (!clipboard) return;

  undoPush();
  pasteOffset += 1;
  const offset = pasteOffset * 2; // cm — stacks with each successive paste

  const idMap = new Map(); // originalId → newId

  for (const { data, isEnv, originalId } of clipboard.items) {
    const copy = { ...data, x: data.x + offset, y: data.y + offset };
    // String endpoints stored in subParts must also be offset
    if (copy.subtype === 'string' && copy.subParts) {
      copy.subParts = { ...copy.subParts };
      if (copy.subParts.x1 != null) copy.subParts.x1 += offset;
      if (copy.subParts.y1 != null) copy.subParts.y1 += offset;
      if (copy.subParts.x2 != null) copy.subParts.x2 += offset;
      if (copy.subParts.y2 != null) copy.subParts.y2 += offset;
    }
    const newId = isEnv ? addEnvItem(copy) : addComponent(copy);
    idMap.set(originalId, newId);
  }

  // Re-create connections between pasted items using new IDs
  for (const conn of clipboard.connections) {
    const newFromId = idMap.get(conn.fromId);
    const newToId   = idMap.get(conn.toId);
    if (newFromId && newToId) {
      addConnection({ fromId: newFromId, fromPoint: conn.fromPoint, toId: newToId, toPoint: conn.toPoint });
    }
  }

  selectedIds = [...idMap.values()];
  render();
}
```

- [ ] **Step 4: Verify tests still pass**

```bash
node --input-type=module --eval "import './js/test/run.js'; import './js/test/multi-select.test.js';"
```

Expected: `8 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add js/drag.js
git commit -m "feat: add clipboard state and copySelection/pasteSelection to drag.js"
```

---

## Task 5: Add Cmd+C / Cmd+V handlers to main.js + version bump

**Files:**
- Modify: `js/main.js`
- Modify: `index.html`

- [ ] **Step 1: Update the import from `./drag.js` in `js/main.js`**

Find:
```js
import { initDrag, getSelected, setSelected, getSelectedIds, setSelectedIds } from './drag.js';
```

Replace with:
```js
import { initDrag, getSelected, setSelected, getSelectedIds, setSelectedIds, copySelection, pasteSelection } from './drag.js';
```

- [ ] **Step 2: Add Cmd+C and Cmd+V handlers**

Find the Escape handler block (around line 299):
```js
  if (e.key === 'Escape') {
    setSelectedIds([]);
    render();
  }
```

After it, add:

```js
  if (e.metaKey && e.key === 'c') {
    e.preventDefault();
    copySelection();
  }

  if (e.metaKey && e.key === 'v') {
    e.preventDefault();
    pasteSelection();
    updateUndoButtons();
    updateTrackerUI();
  }
```

- [ ] **Step 3: Bump version in `index.html`**

Find:
```html
<div id="version-label">v2.5.39</div>
```

Replace with:
```html
<div id="version-label">v2.5.40</div>
```

- [ ] **Step 4: Verify tests still pass**

```bash
node --input-type=module --eval "import './js/test/run.js'; import './js/test/multi-select.test.js';"
```

Expected: `8 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add js/main.js index.html
git commit -m "feat: add Cmd+C/V copy-paste for multi-select, expand selection to env items and markers (v2.5.40)"
```
