import { renderEnvironment } from './environment.js';
import { renderMachines } from './machines.js';
import { renderMaterials } from './materials.js';
import { renderUI } from './ui.js';
import { renderConnections } from './connections.js';
import { getLayers } from '../canvas.js';
import { getState } from '../state.js';
import { syncOverlays } from '../comments.js';
import { updateTrackerUI } from '../tracker-ui.js';

export function render() {
  const state = getState();
  const layers = getLayers();
  renderEnvironment(state, layers.environment);
  renderMaterials(state, layers.materials);
  layers.machines.innerHTML = '';
  renderMachines(state, layers.machines);
  renderConnections(state, layers.connections);
  renderUI(state, layers.ui);
  syncOverlays();
  updateTrackerUI();
}
