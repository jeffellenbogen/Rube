import { renderEnvironment } from './environment.js';
import { getLayers } from '../canvas.js';
import { getState } from '../state.js';

export function render() {
  const state = getState();
  const layers = getLayers();
  renderEnvironment(state, layers.environment);
  // more renderers added in subsequent tasks
}
