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
