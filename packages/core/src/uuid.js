/**
 * UUID generator with crypto.randomUUID + fallback.
 *
 * Used internally for event IDs, transaction markers,
 * binding stable IDs, SSR hydration markers, and
 * persisted store keys.
 *
 * @returns {string} RFC 4122 v4 UUID
 */
export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback: RFC 4122 v4 via Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

/**
 * Simple counter-based ID for hot paths where UUID overhead matters.
 * Shorter, faster, but not unique across sessions.
 *
 * @param {string} [prefix='id'] — prefix for the ID
 * @returns {string} e.g. 'ev_42'
 */
let _counter = 0
export function seq(prefix = 'id') {
  return `${prefix}_${++_counter}`
}
