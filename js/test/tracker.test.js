import { test, assertEqual, assert } from './run.js';
import { getRequirements, getBOM } from '../tracker.js';

const MACHINES = ['lever','pulley','inclinedPlane','wheelAxle','wedge','screw'];

test('0 machines placed = 0 checked', () => {
  const r = getRequirements({ components: [], connections: [] });
  assertEqual(r.machineTypes.length, 0);
  assertEqual(r.machinesMet, false);
});

test('3 distinct machine types = met', () => {
  const comps = [
    { type: 'simple_machine', subtype: 'lever' },
    { type: 'simple_machine', subtype: 'pulley' },
    { type: 'simple_machine', subtype: 'wedge' },
  ];
  const r = getRequirements({ components: comps, connections: [] });
  assertEqual(r.machineTypes.length, 3);
  assertEqual(r.machinesMet, true);
});

test('duplicate machine types count once', () => {
  const comps = [
    { type: 'simple_machine', subtype: 'lever' },
    { type: 'simple_machine', subtype: 'lever' },
  ];
  const r = getRequirements({ components: comps, connections: [] });
  assertEqual(r.machineTypes.length, 1);
});

test('BOM counts by subtype/name, excludes environment', () => {
  const comps = [
    { type: 'material', subtype: 'ball' },
    { type: 'material', subtype: 'ball' },
    { type: 'material', subtype: 'domino' },
    { type: 'simple_machine', subtype: 'lever' },
    { type: 'marker', subtype: 'start' },
  ];
  const bom = getBOM({ components: comps });
  assert(bom.find(b => b.name === 'ball' && b.count === 2));
  assert(bom.find(b => b.name === 'domino' && b.count === 1));
  assert(bom.find(b => b.name === 'lever' && b.count === 1));
  assert(!bom.find(b => b.name === 'start')); // markers excluded
});

test('custom items appear by name in BOM', () => {
  const comps = [{ type: 'material', subtype: 'custom', name: 'Catapult' }];
  const bom = getBOM({ components: comps });
  assert(bom.find(b => b.name === 'Catapult'));
});

test('5+ steps via connections = stepsMet true', () => {
  const comps = [
    { id: 's', type: 'marker', subtype: 'start' },
    { id: 'a', type: 'material', subtype: 'ball' },
    { id: 'b', type: 'material', subtype: 'ball' },
    { id: 'c', type: 'material', subtype: 'ball' },
    { id: 'd', type: 'material', subtype: 'ball' },
    { id: 'e', type: 'material', subtype: 'ball' },
    { id: 'f', type: 'marker', subtype: 'finish' },
  ];
  const connections = [
    { fromId: 's', toId: 'a' }, { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' }, { fromId: 'c', toId: 'd' },
    { fromId: 'd', toId: 'e' }, { fromId: 'e', toId: 'f' },
  ];
  const r = getRequirements({ components: comps, connections });
  assertEqual(r.steps, 6);
  assertEqual(r.stepsMet, true);
});

test('custom item without name falls back to "Custom"', () => {
  const bom = getBOM({ components: [{ type: 'material', subtype: 'custom' }] });
  assert(bom.find(b => b.name === 'Custom'));
});
