/**
 * Create a reactive signal primitive.
 * Signals are the atomic unit of reactive state in Uploop.
 *
 * @template T
 * @param {T} initialValue
 * @returns {import('./types.js').Signal}
 */
export function createSignal(initialValue) {
  let value = initialValue
  const subscribers = new Set()

  function get() {
    return value
  }

  function set(newValue) {
    const next = typeof newValue === 'function' ? newValue(value) : newValue
    if (next !== value) {
      value = next
      subscribers.forEach(fn => {
        try { fn(value) } catch (e) { console.error('Signal subscriber error:', e) }
      })
    }
  }

  function subscribe(fn) {
    subscribers.add(fn)
    return () => subscribers.delete(fn)
  }

  function dispose() {
    subscribers.clear()
    value = undefined
  }

  return { get, set, subscribe, dispose }
}
