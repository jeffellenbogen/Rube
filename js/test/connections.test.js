import { test, assertEqual } from './run.js';
import { countSteps } from '../connections.js';

const mkConn = (fromId, toId) => ({
  id: Math.random().toString(36).slice(2),
  fromId, fromPoint: 'output', toId, toPoint: 'input'
});
const mkSnap = (fromId, toId) => ({
  id: Math.random().toString(36).slice(2),
  fromId, fromPoint: 'output', toId, toPoint: 'input', snap: true
});

// ── Baseline ────────────────────────────────────────────────────────────────

test('empty components returns 0', () => {
  assertEqual(countSteps({ components: [], connections: [] }), 0);
});

test('no connections = 0 steps', () => {
  assertEqual(countSteps({
    components: [{ id: 's', subtype: 'start' }, { id: 'f', subtype: 'finish' }],
    connections: []
  }), 0);
});

test('START directly connected to FINISH = 0 steps', () => {
  assertEqual(countSteps({
    components: [{ id: 's', subtype: 'start' }, { id: 'f', subtype: 'finish' }],
    connections: [mkConn('s', 'f')]
  }), 0);
});

test('disconnected component not counted', () => {
  assertEqual(countSteps({
    components: [
      { id: 's', subtype: 'start' }, { id: 'f', subtype: 'finish' },
      { id: 'x', subtype: 'domino' }, { id: 'y', subtype: 'domino' }
    ],
    connections: [mkConn('x', 'y')]
  }), 0);
});

test('component reachable from START but no path to FINISH = 0 steps', () => {
  assertEqual(countSteps({
    components: [
      { id: 's', subtype: 'start' }, { id: 'f', subtype: 'finish' },
      { id: 'a', subtype: 'lever' }
    ],
    connections: [mkConn('s', 'a')]
  }), 0);
});

// ── Single-component paths ───────────────────────────────────────────────────

test('single component between START and FINISH = 1 step', () => {
  assertEqual(countSteps({
    components: [
      { id: 's', subtype: 'start' }, { id: 'f', subtype: 'finish' },
      { id: 'a', subtype: 'lever' }
    ],
    connections: [mkConn('s', 'a'), mkConn('a', 'f')]
  }), 1);
});

// ── Same-subtype collapsing ──────────────────────────────────────────────────

test('two same-subtype components in sequence = 1 step', () => {
  assertEqual(countSteps({
    components: [
      { id: 's', subtype: 'start' }, { id: 'f', subtype: 'finish' },
      { id: 'a', subtype: 'domino' }, { id: 'b', subtype: 'domino' }
    ],
    connections: [mkConn('s', 'a'), mkConn('a', 'b'), mkConn('b', 'f')]
  }), 1);
});

test('six-domino chain = 1 step', () => {
  const components = [
    { id: 's', subtype: 'start' }, { id: 'f', subtype: 'finish' },
    { id: 'd1', subtype: 'domino' }, { id: 'd2', subtype: 'domino' },
    { id: 'd3', subtype: 'domino' }, { id: 'd4', subtype: 'domino' },
    { id: 'd5', subtype: 'domino' }, { id: 'd6', subtype: 'domino' }
  ];
  const connections = [
    mkConn('s', 'd1'),
    mkConn('d1', 'd2'), mkConn('d2', 'd3'), mkConn('d3', 'd4'),
    mkConn('d4', 'd5'), mkConn('d5', 'd6'),
    mkConn('d6', 'f')
  ];
  assertEqual(countSteps({ components, connections }), 1);
});

// ── Multi-step paths (different subtypes) ────────────────────────────────────

test('two different subtypes in sequence = 2 steps', () => {
  assertEqual(countSteps({
    components: [
      { id: 's', subtype: 'start' }, { id: 'f', subtype: 'finish' },
      { id: 'lev', subtype: 'lever' }, { id: 'pul', subtype: 'pulley' }
    ],
    connections: [mkConn('s', 'lev'), mkConn('lev', 'pul'), mkConn('pul', 'f')]
  }), 2);
});

test('lever → pulley → domino chain = 3 steps', () => {
  const components = [
    { id: 's', subtype: 'start' }, { id: 'f', subtype: 'finish' },
    { id: 'lev', subtype: 'lever' }, { id: 'pul', subtype: 'pulley' },
    { id: 'd1', subtype: 'domino' }, { id: 'd2', subtype: 'domino' }, { id: 'd3', subtype: 'domino' }
  ];
  const connections = [
    mkConn('s', 'lev'), mkConn('lev', 'pul'),
    mkConn('pul', 'd1'), mkConn('d1', 'd2'), mkConn('d2', 'd3'),
    mkConn('d3', 'f')
  ];
  assertEqual(countSteps({ components, connections }), 3);
});

// ── Snap collapsing ──────────────────────────────────────────────────────────

test('snap-connected different-subtype pair = 1 step', () => {
  assertEqual(countSteps({
    components: [
      { id: 's', subtype: 'start' }, { id: 'f', subtype: 'finish' },
      { id: 'car', subtype: 'toyCar' }, { id: 'lev', subtype: 'lever' }
    ],
    connections: [mkConn('s', 'car'), mkSnap('car', 'lev'), mkConn('lev', 'f')]
  }), 1);
});

test('car (snap on lever) → pulley → domino chain = 3 steps', () => {
  const components = [
    { id: 's', subtype: 'start' }, { id: 'f', subtype: 'finish' },
    { id: 'car', subtype: 'toyCar' }, { id: 'lev', subtype: 'lever' },
    { id: 'pul', subtype: 'pulley' },
    { id: 'd1', subtype: 'domino' }, { id: 'd2', subtype: 'domino' }
  ];
  const connections = [
    mkConn('s', 'car'), mkSnap('car', 'lev'),
    mkConn('lev', 'pul'),
    mkConn('pul', 'd1'), mkConn('d1', 'd2'),
    mkConn('d2', 'f')
  ];
  assertEqual(countSteps({ components, connections }), 3);
});

// ── Branching: longest path wins ─────────────────────────────────────────────

test('forked paths: longest branch wins, parallel branch not double-counted', () => {
  const components = [
    { id: 's', subtype: 'start' }, { id: 'f', subtype: 'finish' },
    { id: 'lev', subtype: 'lever' },
    { id: 'd1', subtype: 'domino' }, { id: 'd2', subtype: 'domino' }, { id: 'd3', subtype: 'domino' },
    { id: 'b', subtype: 'ball' }
  ];
  const connections = [
    mkConn('s', 'lev'), mkConn('lev', 'd1'), mkConn('d1', 'd2'), mkConn('d2', 'd3'), mkConn('d3', 'f'),
    mkConn('s', 'b'), mkConn('b', 'f')
  ];
  assertEqual(countSteps({ components, connections }), 2);
});

test('two parallel same-length branches = count of one branch (not sum)', () => {
  assertEqual(countSteps({
    components: [
      { id: 's', subtype: 'start' }, { id: 'f', subtype: 'finish' },
      { id: 'a', subtype: 'lever' }, { id: 'b', subtype: 'pulley' }
    ],
    connections: [
      mkConn('s', 'a'), mkConn('a', 'f'),
      mkConn('s', 'b'), mkConn('b', 'f')
    ]
  }), 1);
});

// ── Safety ───────────────────────────────────────────────────────────────────

test('cycle does not infinite loop', () => {
  assertEqual(countSteps({
    components: [
      { id: 's', subtype: 'start' }, { id: 'a', subtype: 'lever' }, { id: 'f', subtype: 'finish' }
    ],
    connections: [mkConn('s', 'a'), mkConn('a', 's'), mkConn('a', 'f')]
  }), 1);
});
