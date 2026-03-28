import { getAttachPx } from './render/attachPoints.js';
import { addConnection, removeConnection as removeConn } from './state.js';

export function countSteps(state) {
  if (!state?.components || !state.connections) return 0;

  const startComp = state.components.find(c => c.subtype === 'start');
  if (!startComp) return 0;
  const finishComp = state.components.find(c => c.subtype === 'finish');
  if (!finishComp) return 0;

  const startId = startComp.id;
  const finishId = finishComp.id;

  // Build undirected adjacency map over all component IDs
  const adj = {};
  for (const comp of state.components) adj[comp.id] = [];
  for (const conn of state.connections) {
    adj[conn.fromId]?.push(conn.toId);
    adj[conn.toId]?.push(conn.fromId);
  }

  // Build snap-pair set for merging different-subtype components into one step
  const snapPairs = new Set();
  for (const conn of state.connections) {
    if (conn.snap) snapPairs.add([conn.fromId, conn.toId].sort().join('|'));
  }
  const isSnap = (a, b) => snapPairs.has([a, b].sort().join('|'));

  const compById = Object.fromEntries(state.components.map(c => [c.id, c]));

  // ── Step 1: Build step-groups ────────────────────────────────────────────
  // Group non-START, non-FINISH nodes where:
  //   • same subtype AND directly connected  →  same group
  //   • snap-connected (any subtype)         →  same group
  const groupOf = {};   // nodeId → group index
  const groups = [];    // array of Sets of node IDs

  const eligible = state.components
    .map(c => c.id)
    .filter(id => id !== startId && id !== finishId);
  const eligibleSet = new Set(eligible);

  for (const nodeId of eligible) {
    if (groupOf[nodeId] !== undefined) continue;
    const group = new Set();
    const queue = [nodeId];
    while (queue.length) {
      const cur = queue.shift();
      if (group.has(cur)) continue;
      group.add(cur);
      const curSubtype = compById[cur]?.subtype;
      for (const nb of adj[cur] || []) {
        if (group.has(nb) || groupOf[nb] !== undefined) continue;
        if (!eligibleSet.has(nb)) continue;
        if (compById[nb]?.subtype === curSubtype || isSnap(cur, nb)) {
          queue.push(nb);
        }
      }
    }
    const gi = groups.length;
    groups.push(group);
    for (const m of group) groupOf[m] = gi;
  }

  const G = groups.length;
  if (G === 0) return 0;

  // ── Step 2: Build group-level adjacency ──────────────────────────────────
  // Also identify which groups are adjacent to START and to FINISH.
  const gAdj = Array.from({ length: G }, () => new Set());
  const startGroups = new Set();
  const finishGroups = new Set();

  for (const conn of state.connections) {
    const fg = groupOf[conn.fromId];
    const tg = groupOf[conn.toId];

    if (fg !== undefined && tg !== undefined && fg !== tg) {
      gAdj[fg].add(tg);
      gAdj[tg].add(fg);
    }
    if (conn.fromId === startId && tg !== undefined) startGroups.add(tg);
    if (conn.toId === startId && fg !== undefined) startGroups.add(fg);
    if (conn.fromId === finishId && tg !== undefined) finishGroups.add(tg);
    if (conn.toId === finishId && fg !== undefined) finishGroups.add(fg);
  }

  if (startGroups.size === 0) return 0;

  // ── Step 3: Longest path in group graph ──────────────────────────────────
  // DFS with visited-set for cycle safety.
  // useFinish=true: stop and count at finishGroups; return -1 if not reached.
  // useFinish=false: count dead-ends as valid terminals.
  function dfs(gi, visited, useFinish) {
    if (useFinish && finishGroups.has(gi)) return 1;
    let best = -1;
    for (const next of gAdj[gi]) {
      if (visited.has(next)) continue;
      visited.add(next);
      const sub = dfs(next, visited, useFinish);
      visited.delete(next);
      if (sub !== -1) best = Math.max(best, 1 + sub);
    }
    if (best === -1 && !useFinish) return 1;
    return best;
  }

  // When FINISH is connected: try to count path to FINISH.
  // If FINISH group isn't reachable from the start chain (incomplete design),
  // fall back to dead-end counting so we always show something useful.
  const useFinish = finishGroups.size > 0;
  let maxSteps = 0;
  for (const sg of startGroups) {
    const result = dfs(sg, new Set([sg]), useFinish);
    if (result !== -1) maxSteps = Math.max(maxSteps, result);
  }
  if (useFinish && maxSteps === 0) {
    // FINISH is wired but unreachable — fall back to dead-end count
    for (const sg of startGroups) {
      const result = dfs(sg, new Set([sg]), false);
      if (result !== -1) maxSteps = Math.max(maxSteps, result);
    }
  }
  return maxSteps;
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
