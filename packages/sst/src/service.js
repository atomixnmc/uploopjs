/**
 * Service Layer — FeathersJS-inspired CRUD + real-time events.
 *
 * Wraps Uploop loops with find/get/create/update/remove methods
 * and real-time event emitters (created, updated, removed, patched).
 *
 *   import { createService, createServiceApp } from '@uploop/sst'
 *
 *   const service = createService(cartLoop, {
 *     methods: {
 *       find: () => cartLoop.get().items,
 *       create: (item) => { cartLoop.send('addItem', item); return item }
 *     }
 *   })
 *
 *   service.on('created', (item) => { ... })
 *   await service.create({ id: 1, name: 'Widget' })
 */

/**
 * Create a service wrapper around a Uploop loop.
 *
 * A service exposes standard CRUD methods and real-time events.
 * The loop's subscribers are wired to emit service events whenever
 * state changes (the loop notifies on any update; service events
 * are emitted after each state change the service produces).
 *
 * @param {Object} loop - A Uploop loop or graph instance
 * @param {Object} [config]
 * @param {Object} [config.methods] - Custom method implementations
 * @param {Function} [config.methods.find] - (params) → data
 * @param {Function} [config.methods.get] - (id, params) → data
 * @param {Function} [config.methods.create] - (data, params) → created
 * @param {Function} [config.methods.update] - (id, data, params) → updated
 * @param {Function} [config.methods.patch] - (id, data, params) → patched
 * @param {Function} [config.methods.remove] - (id, params) → removed
 * @returns {Object} Service instance
 */
export function createService(loop, config = {}) {
  const methods = config.methods || {}
  const listeners = {}

  const service = {
    loop,

    /**
     * Register an event listener.
     * @param {string} event - 'created' | 'updated' | 'patched' | 'removed'
     * @param {Function} fn - Callback receiving the data
     * @returns {Object} service (for chaining)
     */
    on(event, fn) {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(fn)
      return this
    },

    /**
     * Remove an event listener.
     * @param {string} event
     * @param {Function} fn
     * @returns {Object} service
     */
    off(event, fn) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(f => f !== fn)
      }
      return this
    },

    /**
     * Emit an event to all listeners.
     * @param {string} event
     * @param {*} data
     */
    emit(event, data) {
      const fns = listeners[event] || []
      for (const fn of fns) {
        try { fn(data) } catch (e) {
          console.warn(`[Uploop Service] Error in '${event}' listener:`, e)
        }
      }
    },

    /**
     * Find multiple items. Calls config.methods.find.
     * @param {Object} [params] - Query parameters
     * @returns {Promise<Array|*>}
     */
    async find(params) {
      if (typeof methods.find !== 'function') return loop.get?.() ?? null
      return methods.find(params)
    },

    /**
     * Get a single item by ID.
     * @param {string|number} id
     * @param {Object} [params]
     * @returns {Promise<*>}
     */
    async get(id, params) {
      if (typeof methods.get !== 'function') return null
      return methods.get(id, params)
    },

    /**
     * Create a new item. Calls methods.create and emits 'created'.
     * @param {*} data
     * @param {Object} [params]
     * @returns {Promise<*>}
     */
    async create(data, params) {
      if (typeof methods.create !== 'function') return data
      const result = methods.create(data, params)
      const value = result instanceof Promise ? await result : result

      // Emit after create completes
      service.emit('created', value)

      return value
    },

    /**
     * Update an existing item (full replace). Emits 'updated'.
     * @param {string|number} id
     * @param {*} data
     * @param {Object} [params]
     * @returns {Promise<*>}
     */
    async update(id, data, params) {
      if (typeof methods.update !== 'function') return data
      const result = methods.update(id, data, params)
      const value = result instanceof Promise ? await result : result

      service.emit('updated', value)

      return value
    },

    /**
     * Patch an item (partial update). Emits 'patched'.
     * @param {string|number} id
     * @param {Object} data
     * @param {Object} [params]
     * @returns {Promise<*>}
     */
    async patch(id, data, params) {
      if (typeof methods.patch !== 'function') {
        // Fallback to update if no patch method
        return service.update(id, data, params)
      }
      const result = methods.patch(id, data, params)
      const value = result instanceof Promise ? await result : result

      service.emit('patched', value)

      return value
    },

    /**
     * Remove an item by ID. Emits 'removed'.
     * @param {string|number} id
     * @param {Object} [params]
     * @returns {Promise<*>}
     */
    async remove(id, params) {
      if (typeof methods.remove !== 'function') return { id }
      const result = methods.remove(id, params)
      const value = result instanceof Promise ? await result : result

      service.emit('removed', value)

      return value
    }
  }

  return service
}

/**
 * Create a service application that manages multiple named services.
 *
 *   const app = createServiceApp()
 *   app.use('products', { loop: productLoop, methods: { ... } })
 *   app.use('users', { loop: userLoop, methods: { ... } })
 *   const products = app.service('products')
 *   await products.find()
 *
 * @returns {Object} Service app
 */
export function createServiceApp() {
  const _services = {}

  return {
    /** Map of name → service instances */
    get services() {
      return { ..._services }
    },

    /**
     * Register a service.
     * @param {string} name - Service name
     * @param {Object} config - { loop, methods }
     * @returns {Object} service app (for chaining)
     */
    use(name, config = {}) {
      const { loop, methods } = config
      _services[name] = createService(loop, { methods })
      return this
    },

    /**
     * Get a registered service by name.
     * @param {string} name
     * @returns {Object|undefined}
     */
    service(name) {
      return _services[name]
    },

    /**
     * Remove a service.
     * @param {string} name
     * @returns {Object} service app
     */
    remove(name) {
      delete _services[name]
      return this
    }
  }
}
