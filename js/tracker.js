import { countSteps } from './connections.js';

const MACHINE_SUBTYPES = ['lever','pulley','inclinedPlane','wheelAxle','wedge','screw'];
const EXCLUDED_TYPES = ['marker'];
const MACHINES_REQUIRED = 3;
const STEPS_REQUIRED = 5;

export const ITEM_LABELS = {
  lever:'Lever', pulley:'Pulley', inclinedPlane:'Inclined Plane',
  wheelAxle:'Wheel & Axle', wedge:'Wedge', screw:'Screw',
  domino:'Domino', ball:'Ball', toyCar:'Toy Car', dumpTruck:'Dump Truck',
  string:'String', cup:'Cup', bucket:'Bucket', funnel:'Funnel',
  tube:'Tube', box:'Crate', cardboard:'Cardboard', yardstick:'Yardstick',
  protractor:'Protractor', matchboxTrack:'Car Track', book:'Book',
  fan:'Fan', rubiksCube:"Rubik's Cube", spring:'Spring', custom:'Custom',
};

export function getRequirements(state) {
  const components = state.components || [];
  const placed = components.filter(c => c.type === 'simple_machine');
  const machineTypes = [...new Set(placed.map(c => c.subtype))];
  const mode = state.mode || 'auto';
  const steps = mode === 'flags'
    ? components.filter(c => c.type === 'marker' && c.subtype === 'flag').length
    : countSteps(state);
  return {
    machineTypes,
    machinesMet: machineTypes.length >= MACHINES_REQUIRED,
    steps,
    stepsMet: steps >= STEPS_REQUIRED,
    allMachines: MACHINE_SUBTYPES
  };
}

export function getBOM(state) {
  const counts = {};
  for (const c of state.components) {
    if (EXCLUDED_TYPES.includes(c.type)) continue;
    const name = c.subtype === 'custom' ? (c.name || 'Custom') : c.subtype;
    counts[name] = (counts[name] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      const la = ITEM_LABELS[a.name] || a.name;
      const lb = ITEM_LABELS[b.name] || b.name;
      return la.localeCompare(lb);
    });
}
