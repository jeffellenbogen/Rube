import { getRequirements, getBOM } from './tracker.js';
import { getState } from './state.js';

const MACHINE_LABELS = { lever:'Lever', pulley:'Pulley', inclinedPlane:'Inclined Plane', wheelAxle:'Wheel & Axle', wedge:'Wedge', screw:'Screw' };

export function updateTrackerUI() {
  const state = getState();
  const req = getRequirements(state);
  const bom = getBOM(state);

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

  const counter = document.getElementById('step-counter');
  if (counter) {
    counter.innerHTML = `${req.steps}<small>of 5+ steps</small>`;
    counter.className = req.stepsMet ? 'done' : '';
  }

  const bomUl = document.getElementById('bom-list');
  if (bomUl) {
    bomUl.innerHTML = '';
    for (const { name, count } of bom) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${name}</span><span>${count}</span>`;
      bomUl.appendChild(li);
    }
  }
}
