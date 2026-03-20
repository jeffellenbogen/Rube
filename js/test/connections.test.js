import { test, assertEqual } from './run.js';
import { countSteps } from '../connections.js';

const mkConn = (fromId, toId) => ({ id: Math.random().toString(36).slice(2), fromId, fromPoint: 'output', toId, toPoint: 'input' });

test('empty components returns 0', () => {
  assertEqual(countSteps({ components: [], connections: [] }), 0);
});

test('no connections = 0 steps', () => {
  assertEqual(countSteps({ components: [{ id: 'start', subtype: 'start' }, { id: 'finish', subtype: 'finish' }], connections: [] }), 0);
});

test('linear chain START→A→B→FINISH = 3 steps', () => {
  const s = {
    components: [{ id: 's', subtype: 'start' }, { id: 'a', subtype: 'ball' }, { id: 'b', subtype: 'ball' }, { id: 'f', subtype: 'finish' }],
    connections: [mkConn('s', 'a'), mkConn('a', 'b'), mkConn('b', 'f')]
  };
  assertEqual(countSteps(s), 3);
});

test('forked chain takes longest path to FINISH', () => {
  // s→a→c→finish (2 hops) vs s→b→finish (1 hop) — longest = 2
  const s = {
    components: [
      { id: 's', subtype: 'start' }, { id: 'a', subtype: 'ball' },
      { id: 'b', subtype: 'ball' }, { id: 'c', subtype: 'ball' }, { id: 'f', subtype: 'finish' }
    ],
    connections: [mkConn('s', 'a'), mkConn('a', 'c'), mkConn('c', 'f'), mkConn('s', 'b'), mkConn('b', 'f')]
  };
  assertEqual(countSteps(s), 3); // s→a→c→f = 3 edges
});

test('cycle does not infinite loop', () => {
  const s = {
    components: [{ id: 's', subtype: 'start' }, { id: 'a', subtype: 'ball' }, { id: 'f', subtype: 'finish' }],
    connections: [mkConn('s', 'a'), mkConn('a', 's'), mkConn('a', 'f')]
  };
  assertEqual(countSteps(s), 2); // s→a→f
});

test('disconnected sub-chain does not count', () => {
  const s = {
    components: [{ id: 's', subtype: 'start' }, { id: 'x', subtype: 'ball' }, { id: 'y', subtype: 'ball' }, { id: 'f', subtype: 'finish' }],
    connections: [mkConn('x', 'y')] // x-y disconnected from start
  };
  assertEqual(countSteps(s), 0);
});

test('diamond graph (shared interior node) counts longest path', () => {
  // s→a→c→f AND s→b→c→f — longest is 3 edges, C reachable via both branches
  const s = {
    components: [
      { id: 's', subtype: 'start' }, { id: 'a', subtype: 'ball' },
      { id: 'b', subtype: 'ball' }, { id: 'c', subtype: 'ball' }, { id: 'f', subtype: 'finish' }
    ],
    connections: [mkConn('s', 'a'), mkConn('s', 'b'), mkConn('a', 'c'), mkConn('b', 'c'), mkConn('c', 'f')]
  };
  assertEqual(countSteps(s), 3); // s→a→c→f or s→b→c→f = 3 edges
});
