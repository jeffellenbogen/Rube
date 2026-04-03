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
