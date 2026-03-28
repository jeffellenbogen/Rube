import { getAttachPx } from './render/attachPoints.js';
import { addConnection, removeConnection as removeConn } from './state.js';

export function countSteps(state) {
  if (!state?.components || !state.connections) return 0;

  const startComp = state.components.find(c => c.subtype === 'start');
  if (!startComp) return 0;
  const finishId = state.components.find(c => c.subtype === 'finish')?.id;

  // Build undirected adjacency (all connections) for reachability
  const adj = {};
  for (const comp of state.components) adj[comp.id] = [];
  for (const conn of state.connections) {
    adj[conn.fromId]?.push(conn.toId);
    adj[conn.toId]?.push(conn.fromId);
  }

  // Snap-connected pairs merge into the same step regardless of subtype
  // (e.g. a car sitting on an inclined plane = one action, not two)
  const snapPairs = new Set();
  for (const conn of state.connections) {
    if (conn.snap) {
      const key = [conn.fromId, conn.toId].sort().join('|');
      snapPairs.add(key);
    }
  }
  function isSnap(a, b) {
    return snapPairs.has([a, b].sort().join('|'));
  }

  // BFS from Start — collect every reachable node except Start and Finish
  const reachable = new Set();
  const visited = new Set([startComp.id]);
  const queue = [startComp.id];
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of adj[cur] || []) {
      if (visited.has(nb)) continue;
      visited.add(nb);
      queue.push(nb);
      if (nb !== finishId) reachable.add(nb);
    }
  }

  // Group into steps:
  //   • Snap-connected components (any subtype) → same step
  //     (a car on a ramp is one action, not two)
  //   • Same-subtype directly-connected components → same step
  //     (a row of dominoes is one action)
  //   • Everything else → separate step
  const compById = Object.fromEntries(state.components.map(c => [c.id, c]));
  const stepSeen = new Set();
  let steps = 0;

  for (const nodeId of reachable) {
    if (stepSeen.has(nodeId)) continue;
    const subtype = compById[nodeId]?.subtype;
    const gq = [nodeId];
    stepSeen.add(nodeId);
    while (gq.length) {
      const cur = gq.shift();
      const curSubtype = compById[cur]?.subtype;
      for (const nb of adj[cur] || []) {
        if (stepSeen.has(nb) || !reachable.has(nb)) continue;
        if (compById[nb]?.subtype === curSubtype || isSnap(cur, nb)) {
          stepSeen.add(nb);
          gq.push(nb);
        }
      }
    }
    steps++;
  }

  return steps;
}

const ENV_ATTACH_SUBTYPES = new Set(['couch', 'stairs', 'chair', 'desk']);

export function findNearestAttachment(state, px, py, excludeId, snapDist = 15) {
  for (const comp of state.components) {
    if (comp.id === excludeId) continue;
    const pts = getAttachPx(comp);
    for (const [name, pos] of Object.entries(pts)) {
      if (Math.hypot(pos.x - px, pos.y - py) < snapDist) return { compId: comp.id, pointName: name };
    }
  }
  for (const item of (state.environment || [])) {
    if (item.id === excludeId) continue;
    if (!ENV_ATTACH_SUBTYPES.has(item.subtype)) continue;
    const pts = getAttachPx(item);
    for (const [name, pos] of Object.entries(pts)) {
      if (Math.hypot(pos.x - px, pos.y - py) < snapDist) return { compId: item.id, pointName: name };
    }
  }
  return null;
}

export function createConnection(fromId, fromPoint, toId, toPoint, snap = false) {
  return addConnection({ fromId, fromPoint, toId, toPoint, ...(snap && { snap: true }) });
}

export function deleteConnection(id) {
  removeConn(id);
}
