import { initCanvas, getLayers, cmToPx, getRoomDimensions, screenToCanvas, setOnViewChange, setRoomWidth } from './canvas.js';
import { getState, addComponent, addEnvItem, removeComponent, removeEnvItem, removeConnection, updateComponent, expandCanvas, loadState, setTitle } from './state.js';
import { render } from './render/index.js';
import { drawMachineIcon } from './render/machines.js';
import { drawMaterialIcon } from './render/materials.js';
import { drawEnvIcon } from './render/environment.js';
import { undo, redo, canUndo, canRedo, push as undoPush, reset as undoReset } from './undo.js';
import { toggleComment, repositionOverlays } from './comments.js';
import { updateTrackerUI } from './tracker-ui.js';
import { initDrag, getSelected, setSelected } from './drag.js';
import { deleteConnection } from './connections.js';
import { downloadPNG, uploadPNG } from './export.js';

const CATALOG = {
  machines: [
    { subtype: 'lever', label: 'Lever', type: 'simple_machine', defaultW: 60, defaultH: 16 },
    { subtype: 'pulley', label: 'Pulley', type: 'simple_machine', defaultW: 15, defaultH: 20 },
    { subtype: 'inclinedPlane', label: 'Inclined Plane', type: 'simple_machine', defaultW: 80, defaultH: 40 },
    { subtype: 'wheelAxle', label: 'Wheel & Axle', type: 'simple_machine', defaultW: 20, defaultH: 20 },
    { subtype: 'wedge', label: 'Wedge', type: 'simple_machine', defaultW: 20, defaultH: 15 },
    { subtype: 'screw', label: 'Screw', type: 'simple_machine', defaultW: 5, defaultH: 15 },
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
    { subtype: 'bookshelf', label: 'Bookshelf', type: 'environment', defaultW: 40, defaultH: 120 },
    { subtype: 'couch', label: 'Couch', type: 'environment', defaultW: 140, defaultH: 55 },
  ]
};

function makeComponentIcon(item) {
  const NS = 'http://www.w3.org/2000/svg';
  const SIZE = 36, PAD = 3, INNER = SIZE - PAD * 2;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', SIZE);
  svg.setAttribute('height', SIZE);
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute('overflow', 'hidden');
  svg.style.flexShrink = '0';

  const scale = Math.min(INNER / item.defaultW, INNER / item.defaultH);
  let iw = Math.max(item.defaultW * scale, 8);
  let ih = Math.max(item.defaultH * scale, 8);
  // Lever is very flat by default; give it more height so the bar and fulcrum are legible
  if (item.subtype === 'lever') { ih = INNER * 0.65; iw = INNER; }
  const ox = PAD + (INNER - iw) / 2;
  const oy = PAD + (INNER - ih) / 2;

  const g = document.createElementNS(NS, 'g');
  svg.appendChild(g);

  if (item.type === 'simple_machine')  drawMachineIcon(item.subtype, g, ox, oy, iw, ih);
  else if (item.type === 'material')   drawMaterialIcon(item.subtype, g, ox, oy, iw, ih);
  else if (item.type === 'environment') drawEnvIcon(item.subtype, g, ox, oy, iw, ih);
  return svg;
}

function buildLibrary() {
  for (const [section, items] of Object.entries(CATALOG)) {
    const container = document.querySelector(`#lib-${section} .lib-items`);
    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'lib-item';
      div.draggable = true;
      div.dataset.catalog = JSON.stringify(item);
      div.appendChild(makeComponentIcon(item));
      const label = document.createElement('span');
      label.textContent = item.label;
      div.appendChild(label);
      div.addEventListener('dragstart', e => {
        e.dataTransfer.setData('catalog', JSON.stringify(item));
        e.dataTransfer.effectAllowed = 'copy';
      });
      container.appendChild(div);
    }
  }
}

function promptCustomName(compId) {
  const state = getState();
  const comp = state.components.find(c => c.id === compId);
  if (!comp) return;

  const wrapper = document.getElementById('canvas-wrapper');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'custom-name-input';
  input.placeholder = 'Name this item...';
  input.maxLength = 30;
  input.value = comp.name || '';

  const rect = wrapper.getBoundingClientRect();
  import('./canvas.js').then(({ canvasToScreen }) => {
    const pos = canvasToScreen(comp.x + comp.width / 2, comp.y + comp.height / 2);
    input.style.left = `${pos.x - rect.left - 60}px`;
    input.style.top = `${pos.y - rect.top - 12}px`;
  });

  wrapper.appendChild(input);
  input.focus();

  const finish = () => {
    const name = input.value.trim() || '?';
    updateComponent(compId, { name });
    input.remove();
    render();
  };

  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finish(); } });
  input.addEventListener('blur', finish);
}

function defaultSubParts(subtype) {
  const defaults = {
    lever: { fulcrumOffset: 0.5, tiltSide: 'none' },
    pulley: { leftCordLength: 20, rightCordLength: 20, leftCordAngle: 0, rightCordAngle: 0 },
    inclinedPlane: { angle: 30 },
    wheelAxle: {},
    screw: {},
    matchboxTrack: { angle: 0 },
  };
  return defaults[subtype] || {};
}

const svgEl = document.getElementById('canvas');
initCanvas(svgEl);
setOnViewChange(repositionOverlays());
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
  // Action buttons take priority (including delete-conn on connections)
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    const { action, targetId, connId } = actionEl.dataset;
    if (action === 'delete-conn') {
      undoPush();
      deleteConnection(connId);
      render(); updateUndoButtons(); updateTrackerUI();
      return;
    }
    // fall through to handle other actions below
    if (action === 'delete') {
      undoPush();
      const state = getState();
      if (state.environment.find(en => en.id === targetId)) removeEnvItem(targetId);
      else removeComponent(targetId);
      setSelected(null);
      render(); updateUndoButtons(); updateTrackerUI();
      return;
    }
    if (action === 'comment') { toggleComment(targetId); render(); return; }
    if (action === 'rotate') {
      undoPush();
      const comp = getState().components.find(c => c.id === targetId);
      if (comp) { updateComponent(targetId, { rotation: ((comp.rotation || 0) + 90) % 360 }); render(); }
      return;
    }
    if (action === 'flip') {
      undoPush();
      const comp = getState().components.find(c => c.id === targetId);
      if (comp) { updateComponent(targetId, { flipped: !comp.flipped }); render(); }
      return;
    }

    if (action === 'tilt') {
      undoPush();
      const comp = getState().components.find(c => c.id === targetId);
      if (comp) {
        const current = (comp.subParts && comp.subParts.tiltSide) || 'none';
        const next = current === 'none' ? 'left' : current === 'left' ? 'right' : 'none';
        updateComponent(targetId, { subParts: { ...comp.subParts, tiltSide: next } });
        render();
      }
      return;
    }
    return;
  }
  const connEl = e.target.closest('[data-conn-id]');
  if (connEl) {
    selectedConnId = connEl.dataset.connId;
    return;
  }
});

svgEl.addEventListener('dblclick', e => {
  const comp = e.target.closest('[data-id]');
  if (!comp) return;
  const id = comp.dataset.id;
  const s = getState();
  const item = s.components.find(c => c.id === id && c.subtype === 'custom');
  if (item) promptCustomName(id);
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
    const newId = addComponent({ type: item.type, subtype: item.subtype, name: '', ...pos, subParts: defaultSubParts(item.subtype), comment: '', commentVisible: false, rotation: 0, flipped: false });
    if (item.subtype === 'custom') promptCustomName(newId);
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

// Task 19: Canvas Expansion
let expandBtnLeft = null, expandBtnRight = null;

function getOrCreateExpandBtn(side) {
  const wrapper = document.getElementById('canvas-wrapper');
  let btn = side === 'left' ? expandBtnLeft : expandBtnRight;
  if (!btn) {
    btn = document.createElement('button');
    btn.className = `expand-btn expand-${side}`;
    btn.textContent = side === 'left' ? '← Expand' : 'Expand →';
    btn.addEventListener('click', () => {
      expandCanvas(side);
      const s = getState();
      setRoomWidth(s.meta.canvasExpansion.left, s.meta.canvasExpansion.right);
      drawFloor();
      render();
      hideExpandButtons();
    });
    wrapper.appendChild(btn);
    if (side === 'left') expandBtnLeft = btn;
    else expandBtnRight = btn;
  }
  return btn;
}

function showExpandButton(side) {
  const btn = getOrCreateExpandBtn(side);
  btn.style.display = 'block';
}

function hideExpandButtons() {
  if (expandBtnLeft) expandBtnLeft.style.display = 'none';
  if (expandBtnRight) expandBtnRight.style.display = 'none';
}

document.getElementById('canvas-wrapper').addEventListener('mousemove', e => {
  if (!window.__dragActive) return;
  checkExpansionAffordance(e.clientX);
});

function checkExpansionAffordance(screenX) {
  const wrapper = document.getElementById('canvas-wrapper');
  const rect = wrapper.getBoundingClientRect();
  const state = getState();
  if (screenX - rect.left < 40 && state.meta.canvasExpansion.left < 0.5) {
    showExpandButton('left');
  } else if (rect.right - screenX < 40 && state.meta.canvasExpansion.right < 0.5) {
    showExpandButton('right');
  } else {
    hideExpandButtons();
  }
}

// Task 22: Download, Upload, Team Name
document.getElementById('btn-download').addEventListener('click', () => {
  downloadPNG(document.getElementById('canvas'));
});

document.querySelector('#btn-upload input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const result = await uploadPNG(file);
  if (result.error) { alert(result.error); return; }
  undoReset();
  loadState(result.state);
  const loaded = getState();
  document.getElementById('team-name').value = loaded.meta.title || '';
  setRoomWidth(loaded.meta.canvasExpansion.left, loaded.meta.canvasExpansion.right);
  drawFloor();
  render(); updateUndoButtons(); updateTrackerUI();
  e.target.value = '';
});

document.getElementById('team-name').addEventListener('input', e => setTitle(e.target.value));
