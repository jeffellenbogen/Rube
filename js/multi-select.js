/**
 * Pure utilities for multi-select with no browser dependencies (testable in Node.js).
 */

const CORD_POINTS = new Set(['cordLeft', 'cordRight', 'end1', 'end2']);

/**
 * Returns the IDs of all components, environment items, and symbolic connections
 * that fall inside the given rectangle. Connections are included only when both
 * their endpoint components are inside the rect (snap and cord connections excluded).
 * Touching edges (strict less-than) do not count as overlap.
 *
 * @param {Array} components  - state.components array
 * @param {Array} environment - state.environment array
 * @param {Array} connections - state.connections array
 * @param {{ x: number, y: number, width: number, height: number }} rect - in cm
 * @returns {string[]}
 */
export function getItemsInRect(components, environment, connections, rect) {
  const overlaps = item =>
    item.x < rect.x + rect.width &&
    item.x + item.width  > rect.x  &&
    item.y < rect.y + rect.height &&
    item.y + item.height > rect.y;

  const itemIds = [...components, ...environment].filter(overlaps).map(c => c.id);
  const idSet = new Set(itemIds);

  // Symbolic connections: include when both endpoints are inside the rect
  const connIds = (connections || [])
    .filter(c => !c.snap && !CORD_POINTS.has(c.fromPoint) && !CORD_POINTS.has(c.toPoint))
    .filter(c => idSet.has(c.fromId) && idSet.has(c.toId))
    .map(c => c.id);

  return [...itemIds, ...connIds];
}
