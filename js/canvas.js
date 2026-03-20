// Canvas state
let svgEl, viewBox = { x: 0, y: 0 }; // in px
let scale = 4; // px per cm (default)
let roomW = 800, roomH = 300; // cm
let isPanning = false, panStart = null;
let onZoom = null;
export function setOnZoom(fn) { onZoom = fn; }

const LAYERS = {};

export function initCanvas(svg) {
  svgEl = svg;
  LAYERS.environment = svg.querySelector('#layer-environment');
  LAYERS.machines = svg.querySelector('#layer-machines');
  LAYERS.connections = svg.querySelector('#layer-connections');
  LAYERS.ui = svg.querySelector('#layer-ui');

  updateViewBox();
  bindPan();
  bindZoom();
}

export function getLayers() { return LAYERS; }
export function getSvg() { return svgEl; }
export function getRoomDimensions() { return { roomW, roomH }; }

export function cmToPx(cm) { return cm * scale; }
export function pxToCm(px) { return px / scale; }

export function screenToCanvas(screenX, screenY) {
  const rect = svgEl.getBoundingClientRect();
  return {
    x: pxToCm(screenX - rect.left + viewBox.x),
    y: pxToCm(screenY - rect.top + viewBox.y)
  };
}

export function canvasToScreen(cmX, cmY) {
  const rect = svgEl.getBoundingClientRect();
  return {
    x: cmToPx(cmX) - viewBox.x + rect.left,
    y: cmToPx(cmY) - viewBox.y + rect.top
  };
}

function updateViewBox() {
  const rect = svgEl.getBoundingClientRect();
  const vbW = rect.width || 800;
  const vbH = rect.height || 600;
  svgEl.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${vbW} ${vbH}`);
}

function bindPan() {
  svgEl.addEventListener('mousedown', e => {
    if (e.target !== svgEl) return;
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY, vbx: viewBox.x, vby: viewBox.y };
    svgEl.classList.add('panning');
  });

  window.addEventListener('mousemove', e => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    viewBox.x = panStart.vbx - dx;
    viewBox.y = panStart.vby - dy;
    updateViewBox();
  });

  window.addEventListener('mouseup', () => {
    isPanning = false;
    svgEl.classList.remove('panning');
  });
}

function bindZoom() {
  svgEl.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const oldScale = scale;
    scale = Math.max(1, Math.min(12, scale * factor));
    if (scale === oldScale) return;

    // Zoom toward cursor: keep canvas point under cursor stationary
    const rect = svgEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; // px from SVG top-left
    const mouseY = e.clientY - rect.top;

    // Canvas point under cursor before scale change
    const canvasPxX = mouseX + viewBox.x;
    const canvasPxY = mouseY + viewBox.y;

    // After scale change, same canvas point should be under cursor:
    // canvasPxX_new = mouseX + viewBox.x_new
    // canvasPxX_new = canvasCm * scale_new
    // canvasCm = canvasPxX_old / oldScale
    const canvasCmX = canvasPxX / oldScale;
    const canvasCmY = canvasPxY / oldScale;
    viewBox.x = canvasCmX * scale - mouseX;
    viewBox.y = canvasCmY * scale - mouseY;

    updateViewBox();
    if (typeof onZoom === 'function') onZoom();
  }, { passive: false });
}

export function setRoomWidth(expansionLeft, expansionRight) {
  // Called when canvas expands; re-renders floor/ceiling
  roomW = 800 * (1 + expansionLeft + expansionRight);
}
