/**
 * Refs — stable typed references scoped to a component instance.
 *
 * Each ref identifies a typed resource (DOM element, component, JS object).
 * Created by the bridge from the component's `refs` config. Resolved after
 * view rendering. Only accessible inside the component's lifecycle hooks.
 *
 * Template binding: `data-ref="${refs.canvas}"`  →  `data-ref="canvas"`
 *   (toString() returns the ref name, so html`` interpolation is transparent)
 *
 * @module @uploop/core/ref
 */

/**
 * @param {string} name — unique name within the component
 * @param {string} [type="object"] — tag name or type identifier
 * @returns {{ name: string, type: string, current: null, toString(): string }}
 */
export function createRef(name, type) {
  return {
    name,
    type: type || "object",
    current: null,
    toString() { return this.name; },
  };
}

/**
 * Reset all refs to null (e.g., before unmount).
 * @param {Object<string, Object>} refs — { key: ref }
 */
export function clearRefs(refs) {
  for (var key in refs) {
    if (refs[key] && refs[key].current != null) refs[key].current = null;
  }
}

/**
 * Inspect ref states for debugging.
 * @param {Object<string, Object>} refs
 * @returns {Object} { key: { type, bound } }
 */
export function inspectRefs(refs) {
  var out = {};
  for (var key in refs) {
    var r = refs[key];
    out[key] = { type: r.type, bound: r.current !== null };
  }
  return out;
}
