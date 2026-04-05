# Rubik's Cube Color Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4 fixed Rubik's cube color themes with 3 state-based modes: Mixed (scrambled), Partially Solved (bottom row solved), and Solved (one color per face).

**Architecture:** A seeded PRNG derives deterministic cell colors from `colorSeed` stored in `subParts`. Solved mode stores 3 face color indices in `faceColors`, regenerated each time the user cycles to solved. Old `colorIndex` saves fall back to mixed mode.

**Tech Stack:** Vanilla JS ES modules, SVG rendering, no dependencies.

---

### Task 1: Add seeded PRNG and color constants to `materials.js`

**Files:**
- Modify: `js/render/materials.js:466-469`

- [ ] **Step 1: Replace the old theme arrays with standard colors + PRNG**

In `js/render/materials.js`, replace lines 466–469:

```js
// OLD — remove these four lines:
const RUBIKS_CLASSIC = ['#e5383b', '#3a86ff', '#38b000', '#ffd166', '#ffffff', '#fb5607'];
const RUBIKS_PASTEL  = ['#ffb3c1', '#a9c4eb', '#b5ead7', '#fef9c7', '#e8d5f5', '#ffd8b1'];
const RUBIKS_NEON    = ['#ff006e', '#3a86ff', '#80b918', '#ffbe0b', '#00f5d4', '#ff4800'];
const RUBIKS_THEMES  = [RUBIKS_CLASSIC, RUBIKS_PASTEL, RUBIKS_NEON];
// Solved theme: one solid color per face [front, top, right]
const RUBIKS_SOLVED  = ['#3a86ff', '#38b000', '#ffd166'];
```

Replace with:

```js
const RUBIKS_COLORS = ['#e5383b', '#3a86ff', '#38b000', '#ffd166', '#f5f5f5', '#fb5607'];

function rubiksRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/render/materials.js
git commit -m "refactor: replace Rubiks theme arrays with standard colors + seeded PRNG"
```

---

### Task 2: Rewrite `drawRubiksCube` to support 3 modes

**Files:**
- Modify: `js/render/materials.js:471-538`

The function signature changes from `(g, x, y, w, h, colorIndex)` to `(g, x, y, w, h, subParts)`.

- [ ] **Step 1: Replace the `drawRubiksCube` function**

Replace the entire `drawRubiksCube` function (lines 471–538) with:

```js
function drawRubiksCube(g, x, y, w, h, subParts) {
  const mode = subParts?.colorMode ?? 0;
  const seed = subParts?.colorSeed ?? (subParts?.colorIndex ?? 0);
  const faceColors = subParts?.faceColors ?? [1, 2, 3];

  // Build per-cell color arrays for front, top, right (9 cells each)
  const frontColors = [], topColors = [], rightColors = [];
  const rand = rubiksRand(seed);

  if (mode === 2) {
    // Solved: each face one solid color
    for (let i = 0; i < 9; i++) frontColors.push(RUBIKS_COLORS[faceColors[0]]);
    for (let i = 0; i < 9; i++) topColors.push(RUBIKS_COLORS[faceColors[1]]);
    for (let i = 0; i < 9; i++) rightColors.push(RUBIKS_COLORS[faceColors[2]]);
  } else {
    // Mixed and Partial: scramble top 2 rows from seed
    for (let i = 0; i < 9; i++) frontColors.push(RUBIKS_COLORS[Math.floor(rand() * 6)]);
    for (let i = 0; i < 9; i++) topColors.push(RUBIKS_COLORS[Math.floor(rand() * 6)]);
    for (let i = 0; i < 9; i++) rightColors.push(RUBIKS_COLORS[Math.floor(rand() * 6)]);

    if (mode === 1) {
      // Partial: override bottom row (cells 6,7,8) of each face with solid colors
      const randB = rubiksRand(seed + 1);
      const bFront = RUBIKS_COLORS[Math.floor(randB() * 6)];
      const bTop   = RUBIKS_COLORS[Math.floor(randB() * 6)];
      const bRight = RUBIKS_COLORS[Math.floor(randB() * 6)];
      frontColors[6] = frontColors[7] = frontColors[8] = bFront;
      topColors[6]   = topColors[7]   = topColors[8]   = bTop;
      rightColors[6] = rightColors[7] = rightColors[8] = bRight;
    }
  }

  // Geometry
  const fw = w * 0.70, fh = h * 0.75;
  const fx = x, fy = y + h * 0.25;
  const cellW = fw / 3, cellH = fh / 3;
  const rw = w * 0.30, topH = h * 0.25;
  const topCellW = fw / 3, topCellSlantX = rw / 3, topCellSlantY = topH / 3;

  // Top face background
  el('path', {
    d: `M${fx},${fy} L${fx+fw},${fy} L${fx+fw+rw},${fy-topH} L${fx+rw},${fy-topH} Z`,
    fill: '#f5f5f5', stroke: '#333', 'stroke-width': 1,
  }, g);

  // Top face cells
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const bx = fx + col * topCellW + row * topCellSlantX;
      const by = fy - row * topCellSlantY;
      el('path', {
        d: `M${bx},${by} L${bx+topCellW},${by} L${bx+topCellW+topCellSlantX},${by-topCellSlantY} L${bx+topCellSlantX},${by-topCellSlantY} Z`,
        fill: topColors[row * 3 + col], stroke: '#333', 'stroke-width': 0.5,
      }, g);
    }
  }

  // Front face cells
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      el('rect', {
        x: fx + col * cellW + 1, y: fy + row * cellH + 1,
        width: cellW - 2, height: cellH - 2,
        fill: frontColors[row * 3 + col],
        stroke: '#333', 'stroke-width': 0.5, rx: 1,
      }, g);
    }
  }
  el('rect', { x: fx, y: fy, width: fw, height: fh, fill: 'none', stroke: '#333', 'stroke-width': 1 }, g);

  // Right face cells
  const rightCellH = fh / 3, rightSlantY = topH / 3;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const bx = fx + fw + col * (rw / 3);
      const by = fy - col * (topH / 3) + row * rightCellH;
      el('path', {
        d: `M${bx},${by} L${bx+rw/3},${by-rightSlantY} L${bx+rw/3},${by-rightSlantY+rightCellH} L${bx},${by+rightCellH} Z`,
        fill: rightColors[row * 3 + col], stroke: '#333', 'stroke-width': 0.5,
      }, g);
    }
  }
  el('path', {
    d: `M${fx+fw},${fy} L${fx+fw+rw},${fy-topH} L${fx+fw+rw},${fy-topH+fh} L${fx+fw},${fy+fh} Z`,
    fill: 'none', stroke: '#333', 'stroke-width': 1,
  }, g);
}
```

- [ ] **Step 2: Update the two call sites to pass `comp.subParts` instead of `colorIndex`**

In `drawMaterialComp` (around line 103):
```js
// OLD:
case 'rubiksCube': drawRubiksCube(g, x, y, w, h, comp.subParts?.colorIndex ?? 0); break;
// NEW:
case 'rubiksCube': drawRubiksCube(g, x, y, w, h, comp.subParts); break;
```

In `drawLibraryIcon` (around line 646):
```js
// OLD:
case 'rubiksCube':    drawRubiksCube(g, x, y, w, h, 0); break;
// NEW:
case 'rubiksCube':    drawRubiksCube(g, x, y, w, h, null); break;
```

- [ ] **Step 3: Commit**

```bash
git add js/render/materials.js
git commit -m "feat: rewrite drawRubiksCube with mixed/partial/solved mode support"
```

---

### Task 3: Update `main.js` — defaults and cycle action

**Files:**
- Modify: `js/main.js:159-162` (defaults), `js/main.js:327-335` (cycle action)

- [ ] **Step 1: Update default subParts for rubiksCube**

Find (around line 162):
```js
rubiksCube: { colorIndex: Math.floor(Math.random() * 4) },
```

Replace with:
```js
rubiksCube: { colorMode: 0, colorSeed: Math.floor(Math.random() * 1e9), faceColors: [1, 2, 3] },
```

- [ ] **Step 2: Update cycle action**

Find (around line 327):
```js
if (action === 'rubiks-color') {
  undoPush();
  const comp = getState().components.find(c => c.id === targetId);
  if (comp) {
    const ci = (comp.subParts?.colorIndex ?? 0);
    updateComponent(targetId, { subParts: { ...comp.subParts, colorIndex: (ci + 1) % 4 } });
    render();
  }
  return;
}
```

Replace with:
```js
if (action === 'rubiks-color') {
  undoPush();
  const comp = getState().components.find(c => c.id === targetId);
  if (comp) {
    const nextMode = ((comp.subParts?.colorMode ?? 0) + 1) % 3;
    const newParts = { ...comp.subParts, colorMode: nextMode };
    if (nextMode === 2) {
      // Regenerate solved face colors: pick 3 distinct from 6
      const indices = [0,1,2,3,4,5].sort(() => Math.random() - 0.5).slice(0, 3);
      newParts.faceColors = indices;
    }
    updateComponent(targetId, { subParts: newParts });
    render();
  }
  return;
}
```

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: update rubiksCube default subParts and cycle action for 3-mode system"
```

---

### Task 4: Update `ui.js` — button icon

**Files:**
- Modify: `js/render/ui.js:669-671`

- [ ] **Step 1: Update colorNames and modulo**

Find (around line 669):
```js
const colorNames = ['🎨', '🌸', '⚡', '✅']; // classic, pastel, neon, solved
const ci = (selComp.subParts?.colorIndex ?? 0);
const icon = colorNames[ci % 4];
```

Replace with:
```js
const colorNames = ['🎲', '🔄', '✅']; // mixed, partial, solved
const ci = (selComp.subParts?.colorMode ?? 0);
const icon = colorNames[ci % 3];
```

- [ ] **Step 2: Commit**

```bash
git add js/render/ui.js
git commit -m "feat: update Rubiks color button icons for mixed/partial/solved modes"
```

---

### Task 5: Bump version and push

**Files:**
- Modify: `index.html` (version label)

- [ ] **Step 1: Bump version**

In `index.html`, change:
```html
<div id="version-label">v2.9.8</div>
```
to:
```html
<div id="version-label">v2.9.9</div>
```

- [ ] **Step 2: Commit and push**

```bash
git add index.html
git commit -m "feat: Rubik's cube mixed/partial/solved color modes (v2.9.9)"
git push origin New-Features
```

- [ ] **Step 3: Manual verification**

Open `https://jeffellenbogen.github.io/Rube/staging/` after the Action completes.
- Drop a Rubik's cube — should show a scrambled cube (🎲 mixed)
- Click 🎲 → 🔄 partial: top 2 rows scrambled, bottom row of each face solid
- Click 🔄 → ✅ solved: each face one solid color
- Click ✅ → 🎲 mixed: back to scramble
- Click ✅ again: solved colors should be different from previous solved state
- Upload an old PNG — cube should render in mixed mode without crashing
