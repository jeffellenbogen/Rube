import { test, assertEqual, assert } from './run.js';
import { getItemsInRect } from '../multi-select.js';

test('empty inputs returns empty array', () => {
  const result = getItemsInRect([], [], [], { x: 0, y: 0, width: 100, height: 100 });
  assertEqual(result.length, 0);
});

test('simple_machine fully inside rect is included', () => {
  const components = [{ id: 'a', type: 'simple_machine', subtype: 'lever', x: 10, y: 10, width: 20, height: 10 }];
  const result = getItemsInRect(components, [], [], { x: 5, y: 5, width: 50, height: 30 });
  assertEqual(result.length, 1);
  assertEqual(result[0], 'a');
});

test('material partially overlapping rect is included', () => {
  const components = [{ id: 'a', type: 'material', subtype: 'ball', x: 45, y: 10, width: 20, height: 20 }];
  const result = getItemsInRect(components, [], [], { x: 0, y: 0, width: 50, height: 50 });
  assertEqual(result.length, 1);
});

test('component fully outside rect is excluded', () => {
  const components = [{ id: 'a', type: 'simple_machine', subtype: 'lever', x: 200, y: 200, width: 20, height: 10 }];
  const result = getItemsInRect(components, [], [], { x: 0, y: 0, width: 50, height: 50 });
  assertEqual(result.length, 0);
});

test('touching edge only is excluded', () => {
  const components = [{ id: 'a', type: 'material', subtype: 'domino', x: 50, y: 0, width: 10, height: 20 }];
  const result = getItemsInRect(components, [], [], { x: 0, y: 0, width: 50, height: 50 });
  assertEqual(result.length, 0);
});

test('environment item inside rect is included', () => {
  const environment = [{ id: 'env1', type: 'environment', subtype: 'desk', x: 10, y: 10, width: 50, height: 30 }];
  const result = getItemsInRect([], environment, [], { x: 0, y: 0, width: 100, height: 100 });
  assertEqual(result.length, 1);
  assertEqual(result[0], 'env1');
});

test('marker component inside rect is included', () => {
  const components = [
    { id: 'm1',    type: 'marker',   subtype: 'start', x: 10, y: 10, width: 20, height: 20 },
    { id: 'ball1', type: 'material', subtype: 'ball',  x: 10, y: 10, width: 18, height: 18 },
  ];
  const result = getItemsInRect(components, [], [], { x: 0, y: 0, width: 100, height: 100 });
  assertEqual(result.length, 2);
  assert(result.includes('m1'));
  assert(result.includes('ball1'));
});

test('multiple overlapping components all returned', () => {
  const components = [
    { id: 'a', type: 'simple_machine', subtype: 'lever',  x: 10,  y: 10,  width: 20, height: 10 },
    { id: 'b', type: 'material',       subtype: 'ball',   x: 30,  y: 10,  width: 18, height: 18 },
    { id: 'c', type: 'material',       subtype: 'domino', x: 100, y: 100, width: 12, height: 24 },
  ];
  const result = getItemsInRect(components, [], [], { x: 0, y: 0, width: 60, height: 40 });
  assertEqual(result.length, 2);
  assert(result.includes('a'));
  assert(result.includes('b'));
});

test('symbolic connection included when both endpoints are in rect', () => {
  const components = [
    { id: 'a', type: 'marker',   subtype: 'start', x: 5,  y: 5,  width: 10, height: 10 },
    { id: 'b', type: 'material', subtype: 'ball',  x: 30, y: 30, width: 18, height: 18 },
  ];
  const connections = [
    { id: 'conn1', fromId: 'a', fromPoint: 'output', toId: 'b', toPoint: 'input' },
  ];
  const result = getItemsInRect(components, [], connections, { x: 0, y: 0, width: 100, height: 100 });
  assertEqual(result.length, 3);
  assert(result.includes('conn1'));
});

test('symbolic connection excluded when only one endpoint is in rect', () => {
  const components = [
    { id: 'a', type: 'marker',   subtype: 'start', x: 5,   y: 5,  width: 10, height: 10 },
    { id: 'b', type: 'material', subtype: 'ball',  x: 200, y: 30, width: 18, height: 18 },
  ];
  const connections = [
    { id: 'conn1', fromId: 'a', fromPoint: 'output', toId: 'b', toPoint: 'input' },
  ];
  const result = getItemsInRect(components, [], connections, { x: 0, y: 0, width: 100, height: 100 });
  assert(!result.includes('conn1'));
});

test('snap connection is never included in rubber-band result', () => {
  const components = [
    { id: 'a', type: 'simple_machine', subtype: 'lever', x: 5,  y: 5,  width: 60, height: 16 },
    { id: 'b', type: 'material',       subtype: 'ball',  x: 10, y: 10, width: 18, height: 18 },
  ];
  const connections = [
    { id: 'conn1', fromId: 'b', fromPoint: 'output', toId: 'a', toPoint: 'input', snap: true },
  ];
  const result = getItemsInRect(components, [], connections, { x: 0, y: 0, width: 100, height: 100 });
  assert(!result.includes('conn1'));
});

test('cord connection is never included in rubber-band result', () => {
  const components = [
    { id: 'a', type: 'simple_machine', subtype: 'pulley', x: 5,  y: 5,  width: 15, height: 20 },
    { id: 'b', type: 'material',       subtype: 'bucket', x: 10, y: 50, width: 20, height: 24 },
  ];
  const connections = [
    { id: 'conn1', fromId: 'a', fromPoint: 'cordLeft', toId: 'b', toPoint: 'input' },
  ];
  const result = getItemsInRect(components, [], connections, { x: 0, y: 0, width: 100, height: 100 });
  assert(!result.includes('conn1'));
});
