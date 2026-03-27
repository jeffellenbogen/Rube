// Canvas state
let svgEl;
let scale = 3; // px per cm — set dynamically in initCanvas
let roomW = 800, roomH = 300; // cm
let onViewChange = null;
export function setOnViewChange(fn) { onViewChange = fn; }

const LAYERS = {};

export function initCanvas(svg) {
  svgEl = svg;
  LAYERS.environment = svg.querySelector('#layer-environment');
  LAYERS.materials = svg.querySelector('#layer-materials');
  LAYERS.machines = svg.querySelector('#layer-machines');
  LAYERS.connections = svg.querySelector('#layer-connections');
  LAYERS.ui = svg.querySelector('#layer-ui');

  scale = computeScale();
  updateSvgSize();

  // Fire onViewChange on scroll so comment overlays reposition
  svg.parentElement.addEventListener('scroll', () => {
    if (typeof onViewChange === 'function') onViewChange();
  });
}

function computeScale() {
  const wrapper = svgEl.parentElement;
  const availW = wrapper.clientWidth || 800;
  return availW / roomW;
}

function updateSvgSize() {
  const wrapper = svgEl.parentElement;
  const availH = wrapper.clientHeight || 600;
  const w = Math.round(cmToPx(roomW));
  svgEl.setAttribute('width', w);
  svgEl.setAttribute('height', availH);
  svgEl.setAttribute('viewBox', `0 0 ${w} ${availH}`);
}

export function getFloorPx() {
  const availH = svgEl ? svgEl.parentElement.clientHeight : 600;
  return availH - 50;
}

export function getLayers() { return LAYERS; }
export function getSvg() { return svgEl; }
export function getRoomDimensions() { return { roomW, roomH }; }

export function cmToPx(cm) { return cm * scale; }
export function pxToCm(px) { return px / scale; }

export function screenToCanvas(screenX, screenY) {
  const rect = svgEl.getBoundingClientRect();
  return {
    x: pxToCm(screenX - rect.left),
    y: pxToCm(screenY - rect.top)
  };
}

export function canvasToScreen(cmX, cmY) {
  const rect = svgEl.getBoundingClientRect();
  return {
    x: cmToPx(cmX) + rect.left,
    y: cmToPx(cmY) + rect.top
  };
}

export function setRoomWidth(expansionLeft, expansionRight) {
  roomW = 800 * (1 + expansionLeft + expansionRight);
  updateSvgSize();
}
