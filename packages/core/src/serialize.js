/**
 * Serializer/deserializer with Map, Set, Date, Function, and undefined support.
 * Standard JSON.stringify/parse loses these types.
 *
 * Used for: graph snapshots, SSR state transfer, persistence, devtools inspection.
 */

/**
 * Serialize any value to a JSON string, preserving Map/Set/Date/undefined.
 * Functions are serialized by name only (cannot be revived).
 *
 * @param {*} value
 * @returns {string}
 */
export function serialize(value) {
  return JSON.stringify(value, (_key, val) => {
    if (val instanceof Map) return { __type: 'Map', entries: [...val.entries()] }
    if (val instanceof Set) return { __type: 'Set', values: [...val.values()] }
    if (val instanceof Date) return { __type: 'Date', value: val.toISOString() }
    if (typeof val === 'function') return { __type: 'Function', name: val.name || 'anonymous' }
    if (val === undefined) return { __type: 'undefined' }
    return val
  })
}

/**
 * Deserialize a JSON string back to a live value.
 * Functions revive as null (cannot be reconstructed from name alone).
 *
 * @param {string} json
 * @returns {*}
 */
export function deserialize(json) {
  return JSON.parse(json, (_key, val) => {
    if (val?.__type === 'Map') return new Map(val.entries)
    if (val?.__type === 'Set') return new Set(val.values)
    if (val?.__type === 'Date') return new Date(val.value)
    if (val?.__type === 'Function') return null
    if (val?.__type === 'undefined') return undefined
    return val
  })
}
