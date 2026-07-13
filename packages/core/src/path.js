/**
 * Safe dot-path accessor for nested objects.
 *
 * @param {Object} obj — the object to traverse
 * @param {string|Function} path — dot-separated path ('a.b.c') or selector function
 * @returns {*} the value at path, or undefined
 */
export function getPath(obj, path) {
  if (typeof path === 'function') return path(obj)
  if (typeof path !== 'string' || !path) return obj
  return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj)
}

/**
 * Safe dot-path setter for nested objects.
 * Creates intermediate objects as needed.
 *
 * @param {Object} obj — the object to mutate
 * @param {string} path — dot-separated path ('a.b.c')
 * @param {*} value — value to set
 * @returns {Object} the mutated object (same reference)
 */
export function setPath(obj, path, value) {
  const keys = path.split('.')
  const last = keys.pop()
  const target = keys.reduce((o, k) => {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {}
    return o[k]
  }, obj)
  target[last] = value
  return obj
}
