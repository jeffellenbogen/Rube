import { test, assertEqual, assert } from './run.js';
import { getComponentsInRect } from '../multi-select.js';

test('empty components returns empty array', () => {
  const result = getComponentsInRect([], { x: 0, y: 0, width: 100, height: 100 });
  assertEqual(result.length, 0);
});

test('component fully inside rect is included', () => {
  const components = [{ id: 'a', type: 'simple_machine', subtype: 'lever', x: 10, y: 10, width: 20, height: 10 }];
  const result = getComponentsInRect(components, { x: 5, y: 5, width: 50, height: 30 });
  assertEqual(result.length, 1);
  assertEqual(result[0], 'a');
});

test('component partially overlapping rect is included', () => {
  const components = [{ id: 'a', type: 'material', subtype: 'ball', x: 45, y: 10, width: 20, height: 20 }];
  const result = getComponentsInRect(components, { x: 0, y: 0, width: 50, height: 50 });
  assertEqual(result.length, 1);
});

test('component fully outside rect is excluded', () => {
  const components = [{ id: 'a', type: 'simple_machine', subtype: 'lever', x: 200, y: 200, width: 20, height: 10 }];
  const result = getComponentsInRect(components, { x: 0, y: 0, width: 50, height: 50 });
  assertEqual(result.length, 0);
});

test('touching edge only is excluded', () => {
  // Component starts exactly where rect ends — strict < means no overlap
  const components = [{ id: 'a', type: 'material', subtype: 'domino', x: 50, y: 0, width: 10, height: 20 }];
  const result = getComponentsInRect(components, { x: 0, y: 0, width: 50, height: 50 });
  assertEqual(result.length, 0);
});

test('environment items are excluded regardless of position', () => {
  const components = [
    { id: 'env1', type: 'environment', subtype: 'desk', x: 10, y: 10, width: 50, height: 30 },
    { id: 'mach1', type: 'simple_machine', subtype: 'lever', x: 10, y: 10, width: 20, height: 10 },
  ];
  const result = getComponentsInRect(components, { x: 0, y: 0, width: 100, height: 100 });
  assertEqual(result.length, 1);
  assertEqual(result[0], 'mach1');
});

test('marker components are excluded', () => {
  const components = [
    { id: 'm1', type: 'marker', subtype: 'start', x: 10, y: 10, width: 20, height: 20 },
    { id: 'ball1', type: 'material', subtype: 'ball', x: 10, y: 10, width: 18, height: 18 },
  ];
  const result = getComponentsInRect(components, { x: 0, y: 0, width: 100, height: 100 });
  assertEqual(result.length, 1);
  assertEqual(result[0], 'ball1');
});

test('multiple overlapping components all returned', () => {
  const components = [
    { id: 'a', type: 'simple_machine', subtype: 'lever', x: 10, y: 10, width: 20, height: 10 },
    { id: 'b', type: 'material', subtype: 'ball', x: 30, y: 10, width: 18, height: 18 },
    { id: 'c', type: 'material', subtype: 'domino', x: 100, y: 100, width: 12, height: 24 },
  ];
  const result = getComponentsInRect(components, { x: 0, y: 0, width: 60, height: 40 });
  assertEqual(result.length, 2);
  assert(result.includes('a'));
  assert(result.includes('b'));
});
