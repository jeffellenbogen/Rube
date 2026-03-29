import { getRequirements, getBOM } from './tracker.js';
import { getState } from './state.js';

const MACHINE_LABELS = { lever:'Lever', pulley:'Pulley', inclinedPlane:'Inclined Plane', wheelAxle:'Wheel & Axle', wedge:'Wedge', screw:'Screw' };
const ITEM_LABELS = {
  ...MACHINE_LABELS,
  domino:'Domino', ball:'Ball', toyCar:'Toy Car', string:'String',
  cup:'Cup', bucket:'Bucket', tube:'Tube', box:'Crate',
  cardboard:'Cardboard', yardstick:'Yardstick', protractor:'Protractor',
  matchboxTrack:'Car Track', book:'Book', custom:'Custom',
};

export function updateTrackerUI() {
  const state = getState();
  const req = getRequirements(state);
  const bom = getBOM(state);
  const mode = state.mode || 'auto';

  const ul = document.getElementById('machine-checklist');
  if (ul) {
    ul.innerHTML = '';
    for (const [sub, label] of Object.entries(MACHINE_LABELS)) {
      const li = document.createElement('li');
      li.textContent = label;
      if (req.machineTypes.includes(sub)) li.classList.add('done');
      ul.appendChild(li);
    }
  }

  const cardAuto = document.getElementById('mode-card-auto');
  const cardFlags = document.getElementById('mode-card-flags');
  if (cardAuto) cardAuto.classList.toggle('active', mode === 'auto');
  if (cardFlags) cardFlags.classList.toggle('active', mode === 'flags');

  const widget = document.getElementById('flag-drag-widget');
  if (widget) {
    widget.hidden = mode !== 'flags';
    const flagCount = state.components.filter(c => c.type === 'marker' && c.subtype === 'flag').length;
    const numEl = widget.querySelector('#flag-widget-number');
    if (numEl) numEl.textContent = String(flagCount + 1);
    widget.dataset.catalog = JSON.stringify({ subtype: 'flag', type: 'marker', defaultW: 8, defaultH: 24 });
  }

  const counter = document.getElementById('step-counter');
  if (counter) {
    const label = mode === 'flags' ? 'of 5+ flags' : 'of 5+ steps';
    counter.innerHTML = `${req.steps}<small>${label}</small>`;
    counter.className = req.stepsMet ? 'done' : '';
  }

  const bomUl = document.getElementById('bom-list');
  if (bomUl) {
    bomUl.innerHTML = '';
    for (const { name, count } of bom) {
      const li = document.createElement('li');
      const label = ITEM_LABELS[name] || name;
      li.innerHTML = `<span>${label}</span><span>${count}</span>`;
      bomUl.appendChild(li);
    }
  }
}
