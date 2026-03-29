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

  const modeSwitch = document.getElementById('mode-switch');
  const modeFlagsLabel = document.getElementById('mode-flags-label');
  if (modeSwitch) {
    modeSwitch.classList.toggle('flags-active', mode === 'flags');
    modeSwitch.setAttribute('aria-checked', String(mode === 'flags'));
  }
  if (modeFlagsLabel) modeFlagsLabel.classList.toggle('active', mode === 'flags');

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
