import { countSteps } from './connections.js';

const MACHINE_SUBTYPES = ['lever','pulley','inclinedPlane','wheelAxle','wedge','screw'];
const EXCLUDED_TYPES = ['marker'];
const MACHINES_REQUIRED = 3;
const STEPS_REQUIRED = 5;

export function getRequirements(state) {
  const components = state.components || [];
  const placed = components.filter(c => c.type === 'simple_machine');
  const machineTypes = [...new Set(placed.map(c => c.subtype))];
  const steps = countSteps(state);
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
    .sort((a, b) => a.name.localeCompare(b.name));
}
