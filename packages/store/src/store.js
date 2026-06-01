import { createSignal, createLoop } from '@uploop/core'

/**
 * Create an external store.
 * A store is a standalone update loop that can be shared across components.
 *
 * @param {Object} config
 * @param {Object} [config.state] - Initial state
 * @param {Object<string, Function>} [config.update] - Update handlers
 * @param {Object<string, Function>} [config.effect] - Effect handlers
 * @returns {Object} Store
 */
export function store(config = {}) {
  const { state: initialState = {}, update: updateHandlers = {}, effect: effectHandlers = {} } = config

  const loop = createLoop({
    name: config.name || 'store',
    state: initialState,
    update: updateHandlers,
    effect: effectHandlers
  })

  /**
   * Select a slice of state
   * @param {string|Function} selector - Key path or selector function
   * @returns {any}
   */
  function select(selector) {
    const state = loop.get()
    if (typeof selector === 'function') {
      return selector(state)
    }
    if (typeof selector === 'string') {
      return selector.split('.').reduce((o, k) => o?.[k], state)
    }
    return state
  }

  /**
   * Create a derived signal from state
   * @param {Function} fn - Derivation function
   * @returns {Object} Signal-like { get, subscribe }
   */
  function derived(fn) {
    const signal = createSignal(fn(loop.get()))
    const unsub = loop.subscribe((state) => {
      signal.set(fn(state))
    })
    return {
      get: signal.get,
      subscribe: (cb) => {
        const unsub2 = signal.subscribe(cb)
        return () => { unsub2(); unsub() }
      }
    }
  }

  return {
    get: loop.get,
    set: loop.set,
    send: loop.send,
    subscribe: loop.subscribe,
    select,
    derived,
    on: loop.on,
    effect: loop.effect,
    describe: loop.describe,
    dispose: loop.dispose
  }
}
