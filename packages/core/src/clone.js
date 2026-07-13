/**
 * Deep clone with Map, Set, Date, Array, and circular reference support.
 * Object.create preserves the prototype chain.
 *
 * @param {*} obj — value to clone
 * @param {WeakMap} [seen] — internal circular reference tracker
 * @returns {*} deep copy
 */
export function clone(obj, seen = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj
  if (seen.has(obj)) return seen.get(obj)

  if (obj instanceof Map) {
    const copy = new Map()
    seen.set(obj, copy)
    for (const [k, v] of obj) copy.set(clone(k, seen), clone(v, seen))
    return copy
  }
  if (obj instanceof Set) {
    const copy = new Set()
    seen.set(obj, copy)
    for (const v of obj) copy.add(clone(v, seen))
    return copy
  }
  if (obj instanceof Date) return new Date(obj)
  if (Array.isArray(obj)) {
    const copy = []
    seen.set(obj, copy)
    for (let i = 0; i < obj.length; i++) copy[i] = clone(obj[i], seen)
    return copy
  }

  const copy = Object.create(Object.getPrototypeOf(obj))
  seen.set(obj, copy)
  for (const key of Object.keys(obj)) {
    copy[key] = clone(obj[key], seen)
  }
  return copy
}
