import { initCanvas, getLayers, cmToPx, getRoomDimensions, setOnZoom, screenToCanvas } from './canvas.js';
import { getState, addComponent, addEnvItem, removeComponent, removeEnvItem, removeConnection } from './state.js';
import { render } from './render/index.js';
import { undo, redo, canUndo, canRedo, push as undoPush } from './undo.js';
import { toggleComment } from './comments.js';
import { updateTrackerUI } from './tracker-ui.js';
import { initDrag, getSelected, setSelected } from './drag.js';
import { deleteConnection } from './connections.js';

const CATALOG = {
  machines: [
    { subtype: 'lever', label: 'Lever', type: 'simple_machine', defaultW: 30, defaultH: 8 },
    { subtype: 'pulley', label: 'Pulley', type: 'simple_machine', defaultW: 15, defaultH: 20 },
    { subtype: 'inclinedPlane', label: 'Ramp', type: 'simple_machine', defaultW: 40, defaultH: 20 },
    { subtype: 'wheelAxle', label: 'Wheel & Axle', type: 'simple_machine', defaultW: 20, defaultH: 20 },
    { subtype: 'wedge', label: 'Wedge', type: 'simple_machine', defaultW: 20, defaultH: 15 },
    { subtype: 'screw', label: 'Screw', type: 'simple_machine', defaultW: 8, defaultH: 25 },
  ],
  materials: [
    { subtype: 'domino', label: 'Domino', type: 'material', defaultW: 4, defaultH: 8 },
    { subtype: 'ball', label: 'Ball', type: 'material', defaultW: 6, defaultH: 6 },
    { subtype: 'toyCar', label: 'Toy Car', type: 'material', defaultW: 12, defaultH: 7 },
    { subtype: 'string', label: 'String', type: 'material', defaultW: 20, defaultH: 1 },
    { subtype: 'cup', label: 'Cup', type: 'material', defaultW: 7, defaultH: 9 },
    { subtype: 'bucket', label: 'Bucket', type: 'material', defaultW: 10, defaultH: 12 },
    { subtype: 'tube', label: 'Tube', type: 'material', defaultW: 20, defaultH: 5 },
    { subtype: 'box', label: 'Box', type: 'material', defaultW: 12, defaultH: 12 },
    { subtype: 'cardboard', label: 'Cardboard', type: 'material', defaultW: 20, defaultH: 2 },
    { subtype: 'tape', label: 'Tape', type: 'material', defaultW: 5, defaultH: 5 },
    { subtype: 'magnet', label: 'Magnet', type: 'material', defaultW: 6, defaultH: 8 },
    { subtype: 'track', label: 'Track', type: 'material', defaultW: 20, defaultH: 4 },
    { subtype: 'yardstick', label: 'Yardstick', type: 'material', defaultW: 36, defaultH: 2 },
    { subtype: 'protractor', label: 'Protractor', type: 'material', defaultW: 10, defaultH: 5 },
    { subtype: 'matchboxTrack', label: 'Car Track', type: 'material', defaultW: 20, defaultH: 4 },
    { subtype: 'custom', label: '? Custom', type: 'material', defaultW: 12, defaultH: 12 },
  ],
  environment: [
    { subtype: 'desk', label: 'Desk', type: 'environment', defaultW: 80, defaultH: 75 },
    { subtype: 'chair', label: 'Chair', type: 'environment', defaultW: 45, defaultH: 80 },
    { subtype: 'stairs', label: 'Stairs', type: 'environment', defaultW: 80, defaultH: 60 },
    { subtype: 'shelf', label: 'Shelf', type: 'environment', defaultW: 40, defaultH: 3 },
    { subtype: 'bookshelf', label: 'Bookshelf', type: 'environment', defaultW: 40, defaultH: 120 },
    { subtype: 'couch', label: 'Couch', type: 'environment', defaultW: 90, defaultH: 70 },
  ]
};

function placeholderEmoji(subtype) {
  const map = { lever:'⚖️', pulley:'🎡', inclinedPlane:'📐', wheelAxle:'⚙️', wedge:'🔺', screw:'🔩',
    domino:'🁣', ball:'⚽', toyCar:'🚗', string:'🧵', cup:'🥤', bucket:'🪣', tube:'🫙', box:'📦',
    cardboard:'🗂️', tape:'📼', magnet:'🧲', track:'🛤️', yardstick:'📏', protractor:'📐',
    matchboxTrack:'🛣️', custom:'❓',
    desk:'🪑', chair:'🪑', stairs:'🪜', shelf:'🗄️', bookshelf:'📚', couch:'🛋️' };
  return map[subtype] || '?';
}

function buildLibrary() {
  for (const [section, items] of Object.entries(CATALOG)) {
    const container = document.querySelector(`#lib-${section} .lib-items`);
    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'lib-item';
      div.draggable = true;
      div.dataset.catalog = JSON.stringify(item);
      div.innerHTML = `<span style="font-size:24px">${placeholderEmoji(item.subtype)}</span><span>${item.label}</span>`;
      div.addEventListener('dragstart', e => {
        e.dataTransfer.setData('catalog', JSON.stringify(item));
        e.dataTransfer.effectAllowed = 'copy';
      });
      container.appendChild(div);
    }
  }
}

function promptCustomName() { /* implemented in Task 21 */ }

function defaultSubParts(subtype) {
  const defaults = {
    lever: { fulcrumOffset: 0.5 },
    pulley: { leftCordLength: 20, rightCordLength: 20 },
    inclinedPlane: { angle: 30 },
    wheelAxle: { spinDirection: 'cw' },
    screw: { spinDirection: 'cw', angle: 90 },
    matchboxTrack: { angle: 0 },
  };
  return defaults[subtype] || {};
}

const svgEl = document.getElementById('canvas');
initCanvas(svgEl);
setOnZoom(drawFloor);
initDrag(svgEl);

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
initMarkers();
render();

let selectedConnId = null;

svgEl.addEventListener('click', e => {
  const connEl = e.target.closest('[data-conn-id]');
  if (connEl) {
    selectedConnId = connEl.dataset.connId;
    return;
  }
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const { action, targetId } = actionEl.dataset;
  if (action === 'delete') {
    undoPush();
    const state = getState();
    if (state.environment.find(en => en.id === targetId)) removeEnvItem(targetId);
    else removeComponent(targetId);
    setSelected(null);
    render(); updateUndoButtons(); updateTrackerUI();
  }
  if (action === 'comment') {
    toggleComment(targetId);
    render();
  }
});

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
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedConnId) {
      undoPush();
      deleteConnection(selectedConnId);
      selectedConnId = null;
      render(); updateUndoButtons(); updateTrackerUI();
      return;
    }
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
});

const canvasWrapper = document.getElementById('canvas-wrapper');
canvasWrapper.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
canvasWrapper.addEventListener('drop', e => {
  e.preventDefault();
  const data = e.dataTransfer.getData('catalog');
  if (!data) return;
  const item = JSON.parse(data);
  const { x, y } = screenToCanvas(e.clientX, e.clientY);
  const pos = { x: x - item.defaultW/2, y: y - item.defaultH/2, width: item.defaultW, height: item.defaultH };

  undoPush();
  if (item.type === 'environment') {
    addEnvItem({ subtype: item.subtype, ...pos, ...(item.subtype === 'stairs' ? { stepCount: 4 } : {}) });
  } else {
    addComponent({ type: item.type, subtype: item.subtype, name: '', ...pos, subParts: defaultSubParts(item.subtype), comment: '', commentVisible: false });
    if (item.subtype === 'custom') promptCustomName();
  }
  render(); updateUndoButtons();
});

document.querySelectorAll('.collapse-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const items = btn.closest('.lib-section').querySelector('.lib-items');
    items.style.display = items.style.display === 'none' ? '' : 'none';
    btn.textContent = items.style.display === 'none' ? '▸' : '▾';
  });
});

buildLibrary();

function initMarkers() {
  const state = getState();
  if (!state.components.find(c => c.subtype === 'start')) {
    addComponent({ type: 'marker', subtype: 'start', name: '', x: 5, y: 240, width: 18, height: 14, subParts: {}, comment: '', commentVisible: false });
  }
  if (!state.components.find(c => c.subtype === 'finish')) {
    addComponent({ type: 'marker', subtype: 'finish', name: '', x: 777, y: 240, width: 18, height: 14, subParts: {}, comment: '', commentVisible: false });
  }
}
