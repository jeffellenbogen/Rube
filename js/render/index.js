import { renderEnvironment } from './environment.js';
import { renderMachines } from './machines.js';
import { renderMaterials } from './materials.js';
import { renderUI } from './ui.js';
import { renderConnections, renderFallLines } from './connections.js';
import { getLayers } from '../canvas.js';
import { getState } from '../state.js';
import { syncOverlays } from '../comments.js';
import { updateTrackerUI } from '../tracker-ui.js';

export function render() {
  const state = getState();
  const layers = getLayers();
  renderEnvironment(state, layers.environment);
  layers.machines.innerHTML = '';
  renderMachines(state, layers.machines);
  renderMaterials(state, layers.machines); // materials share machines layer
  renderConnections(state, layers.connections);
  renderFallLines(state, layers.connections);
  renderUI(state, layers.ui);
  syncOverlays();
  updateTrackerUI();
}
