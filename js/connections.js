import { getAttachPx } from './render/attachPoints.js';
import { addConnection, removeConnection as removeConn } from './state.js';

export function countSteps(state) {
  if (!state?.components || !state.connections) return 0;

  const startComp = state.components.find(c => c.subtype === 'start');
  if (!startComp) return 0;
  const finishId = state.components.find(c => c.subtype === 'finish')?.id;

  // Build undirected adjacency so reachability works regardless of connection direction
  const adj = {};
  for (const comp of state.components) adj[comp.id] = [];
  for (const conn of state.connections) {
    adj[conn.fromId]?.push(conn.toId);
    adj[conn.toId]?.push(conn.fromId);
  }

  // BFS from Start — collect every reachable node except Start and Finish themselves
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

  // Group same-subtype components that are directly connected into one step.
  // A row of dominoes all linked = 1 step; a lever = its own step; etc.
  const compById = Object.fromEntries(state.components.map(c => [c.id, c]));
  const stepSeen = new Set();
  let steps = 0;

  for (const nodeId of reachable) {
    if (stepSeen.has(nodeId)) continue;
    const subtype = compById[nodeId]?.subtype;
    // BFS within the same-subtype connected cluster
    const gq = [nodeId];
    stepSeen.add(nodeId);
    while (gq.length) {
      const cur = gq.shift();
      for (const nb of adj[cur] || []) {
        if (!stepSeen.has(nb) && reachable.has(nb) && compById[nb]?.subtype === subtype) {
          stepSeen.add(nb);
          gq.push(nb);
        }
      }
    }
    steps++;
  }

  return steps;
}

export function findNearestAttachment(state, px, py, excludeId, snapDist = 15) {
  for (const comp of state.components) {
    if (comp.id === excludeId) continue;
    const pts = getAttachPx(comp);
    for (const [name, pos] of Object.entries(pts)) {
      if (Math.hypot(pos.x - px, pos.y - py) < snapDist) return { compId: comp.id, pointName: name };
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
