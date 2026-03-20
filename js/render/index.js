import { renderEnvironment } from './environment.js';
import { renderMachines } from './machines.js';
import { renderMaterials } from './materials.js';
import { getLayers } from '../canvas.js';
import { getState } from '../state.js';

export function render() {
  const state = getState();
  const layers = getLayers();
  renderEnvironment(state, layers.environment);
  layers.machines.innerHTML = '';
  renderMachines(state, layers.machines);
  renderMaterials(state, layers.machines); // materials share machines layer
}
