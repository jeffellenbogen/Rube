# Zoom, Pan & Canvas Standardization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add canvas-only pinch-to-zoom and two-finger pan, standardize the canvas world size, and add a reset-view button — without breaking existing saved PNGs.

**Architecture:** A new `<g id="viewport">` SVG group wraps all layer groups. `canvas.js` gains viewport state (`viewZoom`, `viewPanX`, `viewPanY`) and exposes pure-math coordinate helpers. On every `render()` call, a single SVG transform is applied to the viewport group — all other rendering code is unchanged. Pinch and scroll events are intercepted on the SVG element with `preventDefault()`, routing them to viewport controls rather than the browser.

**Tech Stack:** Vanilla JS ES modules, SVG transforms, browser `wheel` event API. Tests run with `node js/test/<file>.test.js` (Node-compatible pure math only — no DOM).

---

## File Map

| File | Change |
|------|--------|
| `js/canvas.js` | Full rewrite: add viewport state, pure-math helpers, viewport controls, remove `getFloorPx()` |
| `js/render/index.js` | Call `applyViewportTransform()` at end of each render |
| `index.html` | Wrap layers in `<g id="viewport">`, add reset-view button, bump version to v2.6.0 |
| `js/main.js` | Update `drawFloor()`/`initMarkers()` to use `FLOOR_Y`; add wheel listener; wire reset button; clamp markers on PNG load |
| `js/export.js` | Reset viewport before export, restore after |
| `js/test/canvas-viewport.test.js` | New — unit tests for pure-math coordinate functions |

---

## Task 1: Write unit tests for viewport coordinate math

**Files:**
- Create: `js/test/canvas-viewport.test.js`

These test the pure math functions that will be extracted in Task 2. Write them first so Task 2 has a target.

- [ ] **Step 1: Create the test file**

```js
// js/test/canvas-viewport.test.js
import { test, assertEqual, assert } from './run.js';

// Pure math helpers — extracted from canvas.js in Task 2.
// screenToCanvasMath(svgLeft, svgTop, basePx, zoom, panX, panY, screenX, screenY)
// canvasToScreenMath(svgLeft, svgTop, basePx, zoom, panX, panY, cmX, cmY)
// zoomAtPointMath(basePx, zoom, panX, panY, svgX, svgY, delta, minZoom, maxZoom)
// These will be imported from canvas.js once implemented.
import { screenToCanvasMath, canvasToScreenMath, zoomAtPointMath } from '../canvas.js';

// ── screenToCanvasMath ────────────────────────────────────────────────────────

test('screenToCanvasMath: zoom=1, pan=0 — basic conversion', () => {
  // basePx=10, zoom=1, pan=(0,0), svgLeft=0, svgTop=0
  // screenX=100 → cmX = 100 / (10*1) - 0 = 10
  const r = screenToCanvasMath(0, 0, 10, 1, 0, 0, 100, 50);
  assertEqual(r.x, 10);
  assertEqual(r.y, 5);
});

test('screenToCanvasMath: zoom=2, pan=0 — zoom halves cm value', () => {
  // basePx=10, zoom=2, svgLeft=0
  // screenX=100 → cmX = 100 / (10*2) - 0 = 5
  const r = screenToCanvasMath(0, 0, 10, 2, 0, 0, 100, 0);
  assertEqual(r.x, 5);
});

test('screenToCanvasMath: zoom=1, panX=20 — pan shifts result', () => {
  // basePx=10, zoom=1, panX=20
  // screenX=100 → cmX = 100/10 - 20 = -10
  const r = screenToCanvasMath(0, 0, 10, 1, 20, 0, 100, 0);
  assertEqual(r.x, -10);
});

test('screenToCanvasMath: non-zero svgLeft is subtracted', () => {
  // svgLeft=50, basePx=10, zoom=1, pan=0
  // screenX=150 → svgX=100 → cmX=10
  const r = screenToCanvasMath(50, 0, 10, 1, 0, 0, 150, 0);
  assertEqual(r.x, 10);
});

// ── canvasToScreenMath ────────────────────────────────────────────────────────

test('canvasToScreenMath: zoom=1, pan=0 — basic conversion', () => {
  // basePx=10, zoom=1, pan=0, svgLeft=0
  // cmX=10 → screenX = 10*10*1 + 0*10 + 0 = 100
  const r = canvasToScreenMath(0, 0, 10, 1, 0, 0, 10, 5);
  assertEqual(r.x, 100);
  assertEqual(r.y, 50);
});

test('canvasToScreenMath: zoom=2, pan=0 — zoom doubles px value', () => {
  // basePx=10, zoom=2, cmX=10 → screenX = 10*10*2 = 200
  const r = canvasToScreenMath(0, 0, 10, 2, 0, 0, 10, 0);
  assertEqual(r.x, 200);
});

test('canvasToScreenMath: roundtrip with screenToCanvasMath', () => {
  const basePx = 10, zoom = 1.5, panX = 5, panY = -3;
  const origScreen = { x: 234, y: 178 };
  const cm = screenToCanvasMath(0, 0, basePx, zoom, panX, panY, origScreen.x, origScreen.y);
  const back = canvasToScreenMath(0, 0, basePx, zoom, panX, panY, cm.x, cm.y);
  assert(Math.abs(back.x - origScreen.x) < 0.001, `roundtrip x: ${back.x} ≠ ${origScreen.x}`);
  assert(Math.abs(back.y - origScreen.y) < 0.001, `roundtrip y: ${back.y} ≠ ${origScreen.y}`);
});

// ── zoomAtPointMath ───────────────────────────────────────────────────────────

test('zoomAtPointMath: point under cursor stays fixed after zoom', () => {
  // basePx=10, zoom=1, pan=(0,0), svgX=100 (cursor at canvas x=10cm)
  // After zooming to 2×: the point at canvas x=10cm should still be at svgX=100
  const basePx = 10, zoom = 1, panX = 0, panY = 0;
  const svgX = 100, svgY = 50; // cursor in SVG element space
  const result = zoomAtPointMath(basePx, zoom, panX, panY, svgX, svgY, 1, 0.25, 4); // delta=1 → zoom increases
  const newZoom = result.zoom;
  const newPanX = result.panX;
  // The canvas cm coord under cursor: cmX = svgX/(basePx*zoom) - panX = 100/10 - 0 = 10
  // After zoom: screen position of cmX=10 should equal svgX=100
  // svgX = (cmX + newPanX) * basePx * newZoom
  const computedSvgX = (10 + newPanX) * basePx * newZoom;
  assert(Math.abs(computedSvgX - svgX) < 0.001, `cursor fixed: ${computedSvgX} ≠ ${svgX}`);
});

test('zoomAtPointMath: zoom is clamped to maxZoom', () => {
  const result = zoomAtPointMath(10, 3.9, 0, 0, 100, 50, 10, 0.25, 4);
  assert(result.zoom <= 4, `zoom ${result.zoom} exceeds maxZoom 4`);
});

test('zoomAtPointMath: zoom is clamped to minZoom', () => {
  const result = zoomAtPointMath(10, 0.3, 0, 0, 100, 50, -10, 0.25, 4);
  assert(result.zoom >= 0.25, `zoom ${result.zoom} below minZoom 0.25`);
});
```

- [ ] **Step 2: Run the tests — expect them to fail (canvas.js not yet updated)**

```bash
node js/test/canvas-viewport.test.js
```

Expected: errors about `screenToCanvasMath` not being exported from `canvas.js`.

---

## Task 2: Rewrite canvas.js with viewport support

**Files:**
- Modify: `js/canvas.js`

- [ ] **Step 1: Replace the entire contents of canvas.js**

```js
// Canvas state
let svgEl;
let viewportEl;      // <g id="viewport"> — set in initCanvas
let basePx = 1;      // px per cm, computed once at init from wrapper width
const WORLD_W = 800; // cm — fixed world width
const WORLD_H = 450; // cm — fixed world height
export const FLOOR_Y = 400; // cm — floor line Y in world coordinates
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;

let viewZoom = 1;
let viewPanX = 0; // cm
let viewPanY = 0; // cm

let onViewChange = null;
export function setOnViewChange(fn) { onViewChange = fn; }

const LAYERS = {};

export function initCanvas(svg) {
  svgEl = svg;
  viewportEl = svg.querySelector('#viewport');
  LAYERS.environment = svg.querySelector('#layer-environment');
  LAYERS.materials   = svg.querySelector('#layer-materials');
  LAYERS.machines    = svg.querySelector('#layer-machines');
  LAYERS.connections = svg.querySelector('#layer-connections');
  LAYERS.ui          = svg.querySelector('#layer-ui');

  const wrapper = svg.parentElement;
  basePx = (wrapper.clientWidth || 900) / WORLD_W;

  // Size SVG to fill the wrapper
  svg.style.width  = '100%';
  svg.style.height = '100%';
  const w = Math.round(WORLD_W * basePx);
  const h = Math.round(WORLD_H * basePx);
  svg.setAttribute('width',   w);
  svg.setAttribute('height',  h);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
}

// ── Pure math helpers (exported for tests) ────────────────────────────────────

export function screenToCanvasMath(svgLeft, svgTop, bPx, zoom, panX, panY, screenX, screenY) {
  const svgX = screenX - svgLeft;
  const svgY = screenY - svgTop;
  return {
    x: svgX / (bPx * zoom) - panX,
    y: svgY / (bPx * zoom) - panY,
  };
}

export function canvasToScreenMath(svgLeft, svgTop, bPx, zoom, panX, panY, cmX, cmY) {
  return {
    x: (cmX + panX) * bPx * zoom + svgLeft,
    y: (cmY + panY) * bPx * zoom + svgTop,
  };
}

export function zoomAtPointMath(bPx, zoom, panX, panY, svgX, svgY, delta, minZoom, maxZoom) {
  const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * (1 + delta)));
  // Cursor position in cm before zoom
  const cmX = svgX / (bPx * zoom) - panX;
  const cmY = svgY / (bPx * zoom) - panY;
  // Adjust pan so cmX,cmY maps to same svgX,svgY after zoom
  const newPanX = svgX / (bPx * newZoom) - cmX;
  const newPanY = svgY / (bPx * newZoom) - cmY;
  return { zoom: newZoom, panX: newPanX, panY: newPanY };
}

// ── Stateful coordinate API ───────────────────────────────────────────────────

export function screenToCanvas(screenX, screenY) {
  const rect = svgEl.getBoundingClientRect();
  return screenToCanvasMath(rect.left, rect.top, basePx, viewZoom, viewPanX, viewPanY, screenX, screenY);
}

export function canvasToScreen(cmX, cmY) {
  const rect = svgEl.getBoundingClientRect();
  return canvasToScreenMath(rect.left, rect.top, basePx, viewZoom, viewPanX, viewPanY, cmX, cmY);
}

// ── Viewport controls ─────────────────────────────────────────────────────────

export function getViewport() {
  return { zoom: viewZoom, panX: viewPanX, panY: viewPanY };
}

export function setViewport(zoom, panX, panY) {
  viewZoom = zoom;
  viewPanX = panX;
  viewPanY = panY;
  if (typeof onViewChange === 'function') onViewChange();
}

export function resetViewport() {
  setViewport(1, 0, 0);
}

export function zoomAtPoint(screenX, screenY, delta) {
  const rect = svgEl.getBoundingClientRect();
  const svgX = screenX - rect.left;
  const svgY = screenY - rect.top;
  const result = zoomAtPointMath(basePx, viewZoom, viewPanX, viewPanY, svgX, svgY, delta, MIN_ZOOM, MAX_ZOOM);
  setViewport(result.zoom, result.panX, result.panY);
}

export function panBy(dxCm, dyCm) {
  setViewport(viewZoom, viewPanX + dxCm, viewPanY + dyCm);
}

export function applyViewportTransform() {
  if (!viewportEl) return;
  const panXpx = viewPanX * basePx;
  const panYpx = viewPanY * basePx;
  viewportEl.setAttribute('transform', `translate(${panXpx},${panYpx}) scale(${viewZoom})`);
}

// ── Legacy accessors ─────────────────────────────────────────────────────────

export function getLayers()        { return LAYERS; }
export function getSvg()           { return svgEl; }
export function getRoomDimensions(){ return { roomW: WORLD_W, roomH: WORLD_H }; }
export function cmToPx(cm)         { return cm * basePx; }
export function pxToCm(px)         { return px / basePx; }
```

- [ ] **Step 2: Run the viewport tests**

```bash
node js/test/canvas-viewport.test.js
```

Expected output:
```
  ✓ screenToCanvasMath: zoom=1, pan=0 — basic conversion
  ✓ screenToCanvasMath: zoom=2, pan=0 — zoom halves cm value
  ✓ screenToCanvasMath: zoom=1, panX=20 — pan shifts result
  ✓ screenToCanvasMath: non-zero svgLeft is subtracted
  ✓ canvasToScreenMath: zoom=1, pan=0 — basic conversion
  ✓ canvasToScreenMath: zoom=2, pan=0 — zoom doubles px value
  ✓ canvasToScreenMath: roundtrip with screenToCanvasMath
  ✓ zoomAtPointMath: point under cursor stays fixed after zoom
  ✓ zoomAtPointMath: zoom is clamped to maxZoom
  ✓ zoomAtPointMath: zoom is clamped to minZoom

10 passed, 0 failed
```

- [ ] **Step 3: Commit**

```bash
git add js/canvas.js js/test/canvas-viewport.test.js
git commit -m "feat: add viewport state and pure-math helpers to canvas.js (v2.6.0)"
```

---

## Task 3: Add viewport group to index.html and bump version

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Wrap the five layer groups in a viewport group and bump the version**

Find this block in `index.html` (around line 42–48):
```html
      <svg id="canvas" xmlns="http://www.w3.org/2000/svg">
        <g id="layer-environment"></g>
        <g id="layer-materials"></g>
        <g id="layer-machines"></g>
        <g id="layer-connections"></g>
        <g id="layer-ui"></g>
```

Replace with:
```html
      <svg id="canvas" xmlns="http://www.w3.org/2000/svg">
        <g id="viewport">
          <g id="layer-environment"></g>
          <g id="layer-materials"></g>
          <g id="layer-machines"></g>
          <g id="layer-connections"></g>
          <g id="layer-ui"></g>
        </g>
```

- [ ] **Step 2: Bump the version label**

Find (around line 83):
```html
      <div id="version-label">v2.5.46</div>
```

Replace with:
```html
      <div id="version-label">v2.6.0</div>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: wrap SVG layers in viewport group, bump to v2.6.0"
```

---

## Task 4: Apply viewport transform in render/index.js

**Files:**
- Modify: `js/render/index.js`

- [ ] **Step 1: Import `applyViewportTransform` and call it at end of render**

Replace the entire file:
```js
import { renderEnvironment } from './environment.js';
import { renderMachines } from './machines.js';
import { renderMaterials } from './materials.js';
import { renderUI } from './ui.js';
import { renderConnections } from './connections.js';
import { getLayers, applyViewportTransform } from '../canvas.js';
import { getState } from '../state.js';
import { syncOverlays } from '../comments.js';
import { updateTrackerUI } from '../tracker-ui.js';

export function render() {
  const state = getState();
  const layers = getLayers();
  renderEnvironment(state, layers.environment);
  renderMaterials(state, layers.materials);
  layers.machines.innerHTML = '';
  renderMachines(state, layers.machines);
  renderConnections(state, layers.connections);
  renderUI(state, layers.ui);
  applyViewportTransform();
  syncOverlays();
  updateTrackerUI();
}
```

- [ ] **Step 2: Commit**

```bash
git add js/render/index.js
git commit -m "feat: apply viewport transform in render()"
```

---

## Task 5: Update main.js — floor and markers use FLOOR_Y

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Update the import line at the top of main.js**

Find:
```js
import { initCanvas, getLayers, cmToPx, pxToCm, getRoomDimensions, screenToCanvas, setOnViewChange, getFloorPx } from './canvas.js';
```

Replace with:
```js
import { initCanvas, getLayers, cmToPx, pxToCm, getRoomDimensions, screenToCanvas, setOnViewChange, FLOOR_Y, getViewport, setViewport, resetViewport, zoomAtPoint, panBy } from './canvas.js';
```

- [ ] **Step 2: Update `drawFloor()` to use FLOOR_Y**

Find:
```js
function drawFloor() {
  const { roomW } = getRoomDimensions();
  const layers = getLayers();
  const floorY = getFloorPx();
  let floor = layers.environment.querySelector('.floor-line');
  if (!floor) {
    floor = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    floor.classList.add('floor-line');
    floor.setAttribute('stroke', '#4a7a9a');
    floor.setAttribute('stroke-width', '4');
    layers.environment.prepend(floor);
  }
  floor.setAttribute('x1', 0);
  floor.setAttribute('y1', floorY);
  floor.setAttribute('x2', cmToPx(roomW));
  floor.setAttribute('y2', floorY);
}
```

Replace with:
```js
function drawFloor() {
  const { roomW } = getRoomDimensions();
  const layers = getLayers();
  const floorYpx = cmToPx(FLOOR_Y);
  let floor = layers.environment.querySelector('.floor-line');
  if (!floor) {
    floor = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    floor.classList.add('floor-line');
    floor.setAttribute('stroke', '#4a7a9a');
    floor.setAttribute('stroke-width', '4');
    layers.environment.prepend(floor);
  }
  floor.setAttribute('x1', 0);
  floor.setAttribute('y1', floorYpx);
  floor.setAttribute('x2', cmToPx(roomW));
  floor.setAttribute('y2', floorYpx);
}
```

- [ ] **Step 3: Update `initMarkers()` to use FLOOR_Y**

Find:
```js
function initMarkers() {
  const state = getState();
  const { roomW } = getRoomDimensions();
  const markerH = 21, markerW = 27;
  const floorY = pxToCm(getFloorPx()) - markerH;
  if (!state.components.find(c => c.subtype === 'start')) {
    addComponent({ type: 'marker', subtype: 'start', name: '', x: 5, y: floorY, width: markerW, height: markerH, subParts: {}, comment: '', commentVisible: false });
  }
  if (!state.components.find(c => c.subtype === 'finish')) {
    addComponent({ type: 'marker', subtype: 'finish', name: '', x: roomW - markerW - 5, y: floorY, width: markerW, height: markerH, subParts: {}, comment: '', commentVisible: false });
  }
}
```

Replace with:
```js
function initMarkers() {
  const state = getState();
  const { roomW } = getRoomDimensions();
  const markerH = 21, markerW = 27;
  const markerY = FLOOR_Y - markerH;
  if (!state.components.find(c => c.subtype === 'start')) {
    addComponent({ type: 'marker', subtype: 'start', name: '', x: 5, y: markerY, width: markerW, height: markerH, subParts: {}, comment: '', commentVisible: false });
  }
  if (!state.components.find(c => c.subtype === 'finish')) {
    addComponent({ type: 'marker', subtype: 'finish', name: '', x: roomW - markerW - 5, y: markerY, width: markerW, height: markerH, subParts: {}, comment: '', commentVisible: false });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: use FLOOR_Y constant for floor line and marker placement"
```

---

## Task 6: Wire wheel event for zoom and pan

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Add wheel listener after `initDrag(svgEl)` line**

Find:
```js
const svgEl = document.getElementById('canvas');
initCanvas(svgEl);
setOnViewChange(repositionOverlays());
initDrag(svgEl);
```

Replace with:
```js
const svgEl = document.getElementById('canvas');
initCanvas(svgEl);
setOnViewChange(repositionOverlays());
initDrag(svgEl);

svgEl.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey) {
    // Pinch-to-zoom: Mac trackpad fires ctrlKey=true for pinch gesture
    zoomAtPoint(e.clientX, e.clientY, -e.deltaY * 0.01);
  } else {
    // Two-finger scroll → pan canvas
    panBy(-e.deltaX / 100, -e.deltaY / 100);
  }
  render();
}, { passive: false });
```

- [ ] **Step 2: Commit**

```bash
git add js/main.js
git commit -m "feat: intercept wheel event for canvas-only zoom and pan"
```

---

## Task 7: Add reset view button

**Files:**
- Modify: `index.html`
- Modify: `js/main.js`

- [ ] **Step 1: Add the button to index.html inside the canvas-wrapper**

Find (the canvas-wrapper div, around line 41):
```html
    <div id="canvas-wrapper">
```

Replace with:
```html
    <div id="canvas-wrapper">
      <button id="btn-reset-view" title="Reset view" aria-label="Reset view">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="1" width="14" height="14" rx="2"/>
          <path d="M4 8h8M8 4v8"/>
          <circle cx="8" cy="8" r="2.5"/>
        </svg>
      </button>
```

- [ ] **Step 2: Add CSS for the button in index.html**

Find the closing `</style>` tag and add immediately before it:
```css
    #btn-reset-view {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 20;
      width: 32px;
      height: 32px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.9);
      border: 1px solid #b0c8e0;
      border-radius: 6px;
      cursor: pointer;
      color: #4a7a9a;
    }
    #btn-reset-view:hover {
      background: #e8f4fc;
      color: #0d1f35;
    }
```

- [ ] **Step 3: Make sure canvas-wrapper has position: relative**

Find the existing CSS for `#canvas-wrapper`. If it doesn't have `position: relative`, add it. (The absolutely positioned button needs a positioned ancestor.)

Search for `#canvas-wrapper` in the `<style>` block of `index.html` and confirm or add `position: relative;` to its rules.

- [ ] **Step 4: Wire the click handler in main.js**

Add this line after the existing `btnRedo.addEventListener(...)` line:

```js
document.getElementById('btn-reset-view').addEventListener('click', () => {
  resetViewport();
  render();
});
```

- [ ] **Step 5: Commit**

```bash
git add index.html js/main.js
git commit -m "feat: add reset view button to canvas"
```

---

## Task 8: Fix export — reset viewport before rendering PNG

**Files:**
- Modify: `js/export.js`

The export serializes the live SVG element. If a student is zoomed in, the exported PNG would show only the zoomed view. We need to reset the viewport, render, export, then restore.

- [ ] **Step 1: Update the export.js import line**

Find:
```js
import { getState, loadState } from './state.js';
import { cmToPx } from './canvas.js';
import { getRequirements } from './tracker.js';
```

Replace with:
```js
import { getState, loadState } from './state.js';
import { cmToPx, getViewport, setViewport, resetViewport } from './canvas.js';
import { getRequirements } from './tracker.js';
import { render } from './render/index.js';
```

- [ ] **Step 2: Reset viewport at the start of `downloadPNG`, restore after blob is generated**

Find the beginning of `downloadPNG`:
```js
export async function downloadPNG(svgEl) {
  const state = getState();
  if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) throw new Error('Canvas has zero dimensions — SVG may not be visible');
```

Replace with:
```js
export async function downloadPNG(svgEl) {
  const state = getState();
  if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) throw new Error('Canvas has zero dimensions — SVG may not be visible');

  // Temporarily reset viewport so the exported PNG shows the full canvas at zoom=1
  const savedViewport = getViewport();
  resetViewport();
  render();
```

Then find the line that triggers the download:
```js
  const safeName = teamName.replace(/[^a-z0-9\s]/gi, '').trim().replace(/\s+/g, '-') || 'rube-goldberg';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([finalBuf], { type: 'image/png' }));
  a.download = `${safeName}-plan.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
```

Replace with:
```js
  // Restore the student's viewport
  setViewport(savedViewport.zoom, savedViewport.panX, savedViewport.panY);
  render();

  const safeName = teamName.replace(/[^a-z0-9\s]/gi, '').trim().replace(/\s+/g, '-') || 'rube-goldberg';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([finalBuf], { type: 'image/png' }));
  a.download = `${safeName}-plan.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
```

- [ ] **Step 3: Commit**

```bash
git add js/export.js
git commit -m "feat: reset viewport during PNG export so full canvas is captured"
```

---

## Task 9: Backwards compat — clamp marker positions on PNG load

**Files:**
- Modify: `js/main.js`

Old PNGs may have start/finish marker Y positions based on the old dynamic floor height (window height - 50px). After this change, the floor is fixed at `FLOOR_Y=400cm`. We clamp loaded marker positions to keep them on-canvas.

- [ ] **Step 1: Add a clampMarkers helper and call it after loadState**

Find the upload handler in main.js:
```js
document.querySelector('#btn-upload input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const result = await uploadPNG(file);
  if (result.error) { alert(result.error); return; }
  undoReset();
  loadState(result.state);
  const loaded = getState();
  document.getElementById('team-name').value = loaded.meta.title || '';
  drawFloor();
  render(); updateUndoButtons(); updateTrackerUI();
  e.target.value = '';
});
```

Replace with:
```js
document.querySelector('#btn-upload input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const result = await uploadPNG(file);
  if (result.error) { alert(result.error); return; }
  undoReset();
  loadState(result.state);
  clampMarkers();
  resetViewport();
  const loaded = getState();
  document.getElementById('team-name').value = loaded.meta.title || '';
  drawFloor();
  render(); updateUndoButtons(); updateTrackerUI();
  e.target.value = '';
});
```

Then add the `clampMarkers` function near `initMarkers`:
```js
function clampMarkers() {
  const state = getState();
  const { roomW } = getRoomDimensions();
  for (const comp of state.components) {
    if (comp.subtype !== 'start' && comp.subtype !== 'finish') continue;
    const clampedX = Math.max(0, Math.min(roomW - comp.width, comp.x));
    const clampedY = Math.max(0, Math.min(WORLD_H - comp.height, comp.y));
    if (clampedX !== comp.x || clampedY !== comp.y) {
      updateComponent(comp.id, { x: clampedX, y: clampedY });
    }
  }
}
```

Note: `WORLD_H` is not exported from canvas.js — use `getRoomDimensions().roomH` instead:

```js
function clampMarkers() {
  const state = getState();
  const { roomW, roomH } = getRoomDimensions();
  for (const comp of state.components) {
    if (comp.subtype !== 'start' && comp.subtype !== 'finish') continue;
    const clampedX = Math.max(0, Math.min(roomW - comp.width, comp.x));
    const clampedY = Math.max(0, Math.min(roomH - comp.height, comp.y));
    if (clampedX !== comp.x || clampedY !== comp.y) {
      updateComponent(comp.id, { x: clampedX, y: clampedY });
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/main.js
git commit -m "feat: clamp markers and reset viewport on PNG load for backwards compat"
```

---

## Task 10: Push to New-Features and smoke test

- [ ] **Step 1: Push to New-Features branch**

```bash
git push origin New-Features
```

- [ ] **Step 2: Hard-refresh GitHub Pages and verify**

Open the site. Confirm version label shows `v2.6.0`.

- [ ] **Step 3: Smoke test checklist**

- [ ] Pinch to zoom works on the canvas; left panel and right panel do not zoom
- [ ] Two-finger scroll pans the canvas
- [ ] Reset view button appears top-right of canvas area; clicking it returns to full view
- [ ] Floor line is visible in default view
- [ ] Start and finish markers are visible in default view and remain draggable
- [ ] Download PNG while zoomed in — exported image shows full canvas
- [ ] Upload an old PNG — project loads correctly, markers are visible
- [ ] All existing component operations (drag, resize, connect, delete) work normally
