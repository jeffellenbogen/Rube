export function countSteps(state) {
  const startComp = state.components.find(c => c.subtype === 'start');
  const finishComp = state.components.find(c => c.subtype === 'finish');
  if (!startComp || !finishComp) return 0;

  // Build adjacency list
  const adj = {};
  for (const conn of state.connections) {
    if (!adj[conn.fromId]) adj[conn.fromId] = [];
    adj[conn.fromId].push(conn.toId);
  }

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
export function createConnection(fromId, fromPoint, toId, toPoint) { return ''; }
export function deleteConnection(id) {}
export function findNearestAttachment(state, px, py, excludeId, snapDist = 15) { return null; }
