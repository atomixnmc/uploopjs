/**
 * Client-side hydration for Uploop components.
 *
 * Reattaches event listeners and state to server-rendered HTML.
 * The server sends HTML with data-up-* markers; hydrate() finds them
 * and wires up the live component on top.
 *
 *   import { hydrate } from '@uploop/sst'
 *   hydrate(Counter, document.getElementById('app'), {}, { count: 0 })
 */

import { createLoop } from '@uploop/core'

/**
 * Hydrate a server-rendered component in the DOM.
 *
 * Creates a new loop instance with the server state, then mounts
 * the component onto an existing DOM element. Event bindings are
 * reattached via the component's execution hooks.
 *
 * @param {Function} Comp - Component descriptor
 * @param {HTMLElement} target - DOM element containing server-rendered HTML
 * @param {Object} [props={}] - Props to pass to the component
 * @param {Object} [serverState={}] - Server-rendered state (must match server)
 * @returns {Object} { loop, unmount } - The hydrated instance
 */
export function hydrate(Comp, target, props = {}, serverState = {}) {
  if (!Comp || !target) return { loop: null, unmount: () => {} }

  // Use the component's mount method with initial props merged from server state
  const mergedProps = { ...serverState, ...props }
  const unmount = Comp.mount(target, mergedProps)

  return {
    loop: Comp.loop,
    unmount
  }
}

/**
 * Create a server-state-aware loop for hydration.
 *
 * Useful when you want to hydrate multiple components from a single
 * server state payload embedded in a <script> tag.
 *
 * @param {Object} serverState - The __UPLOOP_STATE__ from the server
 * @returns {Object} Hydration helper
 */
export function createHydrationRoot(serverState = {}) {
  const components = new Map()

  return {
    /**
     * Register a component name → descriptor mapping.
     * @param {string} name
     * @param {Function} compDesc
     */
    register(name, compDesc) {
      components.set(name, compDesc)
    },

    /**
     * Hydrate a specific component by name.
     * @param {string} name
     * @param {HTMLElement} target
     * @returns {Object} { loop, unmount }
     */
    hydrate(name, target) {
      const Comp = components.get(name)
      if (!Comp) return { loop: null, unmount: () => {} }

      const state = serverState[name] || {}
      return hydrate(Comp, target, {}, state)
    },

    /**
     * Hydrate all registered components found in the DOM.
     * @param {HTMLElement} root - Root element to scan
     * @returns {Object[]} Array of hydrated instances
     */
    hydrateAll(root) {
      const results = []
      for (const [name, Comp] of components) {
        const selector = `[data-up-component="${name}"]`
        const elements = root.querySelectorAll(selector)
        for (const el of elements) {
          results.push(hydrate(Comp, el, {}, serverState[name] || {}))
        }
      }
      return results
    }
  }
}
