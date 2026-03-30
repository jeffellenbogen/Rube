/**
 * Pure utilities for multi-select with no browser dependencies (testable in Node.js).
 */

/**
 * Returns the IDs of all components and environment items whose axis-aligned
 * bounding box overlaps the given rectangle. Ignores rotation.
 * Touching edges (strict less-than) do not count as overlap.
 *
 * @param {Array} components - state.components array (machines, materials, markers)
 * @param {Array} environment - state.environment array (desks, chairs, etc.)
 * @param {{ x: number, y: number, width: number, height: number }} rect - in cm
 * @returns {string[]}
 */
export function getComponentsInRect(components, environment, rect) {
  const overlaps = item =>
    item.x < rect.x + rect.width &&
    item.x + item.width  > rect.x  &&
    item.y < rect.y + rect.height &&
    item.y + item.height > rect.y;
  return [...components, ...environment].filter(overlaps).map(c => c.id);
}
