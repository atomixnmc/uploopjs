import { createSignal } from '@uploop/core'

/**
 * Create a derived value that auto-updates when its dependencies change.
 *
 * @param {Function} deriveFn - Derivation function
 * @param {Function} subscribe - Subscribe to dependency changes
 * @returns {Object} { get, subscribe, dispose }
 */
export function derived(deriveFn, subscribe) {
  const signal = createSignal(deriveFn())

  const unsubscribe = subscribe((...args) => {
    signal.set(deriveFn(...args))
  })

  return {
    get: signal.get,
    subscribe: signal.subscribe,
    dispose: () => {
      signal.dispose()
      unsubscribe()
    }
  }
}
