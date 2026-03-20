import { countSteps } from './connections.js';

const MACHINE_SUBTYPES = ['lever','pulley','inclinedPlane','wheelAxle','wedge','screw'];
const EXCLUDED_TYPES = ['marker'];

export function getRequirements(state) {
  const placed = state.components.filter(c => c.type === 'simple_machine');
  const machineTypes = [...new Set(placed.map(c => c.subtype))];
  const steps = countSteps(state);
  return {
    machineTypes,
    machinesMet: machineTypes.length >= 3,
    steps,
    stepsMet: steps >= 5,
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
