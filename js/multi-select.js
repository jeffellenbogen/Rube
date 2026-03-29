/**
 * Pure utilities for multi-select with no browser dependencies (testable in Node.js).
 */

/**
 * Returns the IDs of components (machines and materials only) whose
 * axis-aligned bounding box overlaps the given rectangle. Ignores rotation.
 * Touching edges (strict less-than) do not count as overlap.
 *
 * @param {Array} components - state.components array
 * @param {{ x: number, y: number, width: number, height: number }} rect - in cm
 * @returns {string[]}
 */
export function getComponentsInRect(components, rect) {
  return components
    .filter(c => c.type === 'simple_machine' || c.type === 'material')
    .filter(c =>
      c.x < rect.x + rect.width &&
      c.x + c.width > rect.x &&
      c.y < rect.y + rect.height &&
      c.y + c.height > rect.y
    )
    .map(c => c.id);
}
