import { initCanvas, getLayers, cmToPx, getRoomDimensions, setOnZoom } from './canvas.js';
import { getState } from './state.js';
import { render } from './render/index.js';
import { undo, redo, canUndo, canRedo } from './undo.js';

const svgEl = document.getElementById('canvas');
initCanvas(svgEl);
setOnZoom(drawFloor);

// Draw floor (always present, not in state)
function drawFloor() {
  const { roomW, roomH } = getRoomDimensions();
  const layers = getLayers();
  let floor = layers.environment.querySelector('.floor-line');
  if (!floor) {
    floor = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    floor.classList.add('floor-line');
    floor.setAttribute('stroke', '#4a7a9a');
    floor.setAttribute('stroke-width', '4');
    layers.environment.prepend(floor);
  }
  floor.setAttribute('x1', 0);
  floor.setAttribute('y1', cmToPx(roomH));
  floor.setAttribute('x2', cmToPx(roomW));
  floor.setAttribute('y2', cmToPx(roomH));
}

drawFloor();
render();

const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');

function updateUndoButtons() {
  btnUndo.disabled = !canUndo();
  btnRedo.disabled = !canRedo();
}

updateUndoButtons(); // set initial disabled state
btnUndo.addEventListener('click', () => { undo(); render(); updateUndoButtons(); });
btnRedo.addEventListener('click', () => { redo(); render(); updateUndoButtons(); });

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) { redo(); } else { undo(); }
    render(); updateUndoButtons();
  }
});
