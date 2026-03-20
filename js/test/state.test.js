import { test, assert, assertEqual } from './run.js';
import {
  getState, resetState,
  addComponent, removeComponent, updateComponent,
  addConnection, removeConnection,
  addEnvItem, removeEnvItem, updateEnvItem,
  expandCanvas
} from '../state.js';

test('initial state has version 2 and empty arrays', () => {
  resetState();
  const s = getState();
  assertEqual(s.version, 2);
  assertEqual(s.components.length, 0);
  assertEqual(s.connections.length, 0);
  assertEqual(s.environment.length, 0);
});

test('addComponent adds to state and returns id', () => {
  resetState();
  const id = addComponent({ type: 'simple_machine', subtype: 'lever', x: 10, y: 20, width: 30, height: 10, subParts: { fulcrumOffset: 0.5 }, comment: '', commentVisible: false });
  assertEqual(getState().components.length, 1);
  assertEqual(getState().components[0].id, id);
});

test('removeComponent removes by id', () => {
  resetState();
  const id = addComponent({ type: 'material', subtype: 'ball', x: 0, y: 0, width: 5, height: 5, subParts: {}, comment: '', commentVisible: false });
  removeComponent(id);
  assertEqual(getState().components.length, 0);
});

test('updateComponent patches fields', () => {
  resetState();
  const id = addComponent({ type: 'material', subtype: 'ball', x: 0, y: 0, width: 5, height: 5, subParts: {}, comment: '', commentVisible: false });
  updateComponent(id, { x: 99 });
  assertEqual(getState().components[0].x, 99);
});

test('addConnection and removeConnection', () => {
  resetState();
  const id = addConnection({ fromId: 'a', fromPoint: 'output', toId: 'b', toPoint: 'input' });
  assertEqual(getState().connections.length, 1);
  removeConnection(id);
  assertEqual(getState().connections.length, 0);
});

test('expandCanvas clamps to 0.5 max', () => {
  resetState();
  expandCanvas('left'); // 0.25
  expandCanvas('left'); // 0.5
  expandCanvas('left'); // should stay at 0.5
  assertEqual(getState().meta.canvasExpansion.left, 0.5);
});
