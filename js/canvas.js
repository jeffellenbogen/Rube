export function initCanvas(svg) {}
export function getLayers() { return { environment: null, machines: null, connections: null, ui: null }; }
export function getSvg() { return null; }
export function getRoomDimensions() { return { roomW: 800, roomH: 300 }; }
export function cmToPx(cm) { return cm * 4; }
export function pxToCm(px) { return px / 4; }
export function screenToCanvas(x, y) { return { x: x / 4, y: y / 4 }; }
export function canvasToScreen(x, y) { return { x: x * 4, y: y * 4 }; }
export function setRoomWidth(l, r) {}
