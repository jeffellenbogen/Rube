import { getState } from '../state.js';
export function render() {
  const state = getState();
  // sub-renderers called here as they're implemented
  console.log('render()', state.components.length, 'components');
}
