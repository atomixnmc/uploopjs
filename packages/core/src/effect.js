/**
 * Create an effect system.
 * Effects are side-effect handlers that run in response to state changes.
 *
 * @param {Object<string, Function>} effects - Map of effect name to handler
 * @param {Function} getState - Function to get current state
 * @param {Function} send - Function to send events
 * @returns {Object} Effect system
 */
export function createEffectSystem(effects = {}, getState, send) {
  const cleanupFns = new Map()

  function run(name, ...args) {
    const handler = effects[name]
    if (!handler) {
      console.warn(`Effect "${name}" not found`)
      return
    }

    const ctx = {
      get: getState,
      send,
      onDispose: (fn) => {
        if (!cleanupFns.has(name)) cleanupFns.set(name, [])
        cleanupFns.get(name).push(fn)
      }
    }

    return handler(ctx, ...args)
  }

  function register(name, handler) {
    effects[name] = handler
  }

  function dispose(name) {
    const fns = cleanupFns.get(name)
    if (fns) {
      fns.forEach(fn => { try { fn() } catch (e) { console.error('Cleanup error:', e) } })
      cleanupFns.delete(name)
    }
    delete effects[name]
  }

  function disposeAll() {
    for (const name of cleanupFns.keys()) {
      dispose(name)
    }
  }

  return { run, register, dispose, disposeAll }
}
