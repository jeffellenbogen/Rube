import { getAttachPx } from './render/attachPoints.js';
import { addConnection, removeConnection as removeConn } from './state.js';

export function countSteps(state) {
  if (!state || !state.components || !state.connections) return 0;
  const startComp = state.components.find(c => c.subtype === 'start');
  const finishComp = state.components.find(c => c.subtype === 'finish');
  if (!startComp || !finishComp) return 0;

  // Build adjacency list
  const adj = {};
  for (const conn of state.connections) {
    if (!adj[conn.fromId]) adj[conn.fromId] = [];
    adj[conn.fromId].push(conn.toId);
  }

  // Branch-local DFS: copies visited set per branch so different paths can share nodes.
  // O(n!) worst case for highly connected graphs, but fine for student projects (dozens of components).
  // Branch-local DFS: returns max edges from node to finish, or -1 if unreachable
  function dfs(nodeId, visited) {
    if (nodeId === finishComp.id) return 0;
    if (visited.has(nodeId)) return -1; // cycle in this branch
    const neighbors = adj[nodeId] || [];
    if (neighbors.length === 0) return -1;
    visited.add(nodeId);
    let best = -1;
    for (const next of neighbors) {
      const result = dfs(next, new Set(visited)); // new Set = branch-local
      if (result !== -1) best = Math.max(best, result + 1);
    }
    return best;
  }

  const result = dfs(startComp.id, new Set());
  return result === -1 ? 0 : result;
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
