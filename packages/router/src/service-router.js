/**
 * Service Router — RPC / microservice-style dispatch.
 *
 * Services expose named methods that can be called locally or remotely.
 * Integrates with @uploop/store for data-backed services and
 * @uploop/schema for request/response validation.
 *
 *   import { createServiceRouter } from '@uploop/router'
 *
 *   const services = createServiceRouter({
 *     'products': {
 *       find: (params, ctx) => ctx.store?.find('products', params),
 *       get: (id, ctx) => ctx.store?.get('products', id),
 *       create: {
 *         guard: adminOnly,
 *         handler: (data, ctx) => ctx.store?.create('products', data)
 *       }
 *     }
 *   })
 *
 *   const products = await services.call('products.find', { category: 'books' })
 */

import { createPipeline } from './middleware.js'
import { createContext } from './context.js'

/**
 * @typedef {Object} ServiceDef
 * @property {Object<string, Function|ServiceMethod>} methods — method name → handler or config
 * @property {Function} [guard] — service-level guard
 * @property {Object} [schema] — @uploop/schema entity
 * @property {Object} [store] — @uploop/store instance
 */

/**
 * @typedef {Object} ServiceMethod
 * @property {Function} handler — (args..., ctx) => result
 * @property {Function} [guard] — (args..., ctx) => boolean
 * @property {Object} [schema] — request/response schema
 * @property {boolean} [realtime] — emit events on call
 */

/**
 * Create a service router.
 *
 * @param {Object} services — { name: ServiceDef }
 * @param {Object} [options]
 * @param {string} [options.name='serviceRouter']
 * @param {Function[]} [options.middleware] — pipeline
 * @returns {Object} service router
 */
export function createServiceRouter(services = {}, options = {}) {
  const { name = 'serviceRouter', middleware = [] } = options

  const _services = new Map()    // name → { methods, guard, schema, store }
  const _listeners = new Map()   // 'serviceName.event' → Set<fn>
  const pipeline = createPipeline(middleware)

  // Normalize and register services
  for (const [svcName, def] of Object.entries(services)) {
    _services.set(svcName, normalizeService(def))
  }

  /**
   * Call a service method.
   *
   * @param {string} path — 'serviceName.method' or 'serviceName/method'
   * @param {...*} args — method arguments
   * @returns {Promise<*>} result
   *
   *   await services.call('products.find', { category: 'books' })
   *   await services.call('users.create', { name: 'Alice' })
   */
  async function call(path, ...args) {
    // Support both 'svc.method' and 'svc/method' notation
    const dot = path.indexOf('.')
    const slash = path.indexOf('/')
    const sep = dot >= 0 ? dot : slash
    if (sep < 0) throw new Error(`[${name}] Invalid service path: "${path}". Use "service.method".`)

    const svcName = path.slice(0, sep)
    const methodName = path.slice(sep + 1)

    const svc = _services.get(svcName)
    if (!svc) throw new Error(`[${name}] Service "${svcName}" not found. Available: ${[..._services.keys()].join(', ')}`)

    const method = svc.methods[methodName]
    if (!method) {
      throw new Error(
        `[${name}] Method "${methodName}" not found on service "${svcName}". ` +
        `Available: ${Object.keys(svc.methods).join(', ')}`
      )
    }

    const ctx = createContext({
      path: `${svcName}.${methodName}`,
      params: { service: svcName, method: methodName },
      meta: { service: svcName, method: methodName }
    })

    // Run pipeline
    let pipelineCtx = ctx
    try {
      pipelineCtx = await pipeline.run(ctx)
    } catch (e) {
      emitServiceEvent(svcName, '$error', { method: methodName, args, error: e }, ctx)
      throw e
    }

    // Service-level guard
    if (svc.guard) {
      const allowed = await svc.guard(args, pipelineCtx)
      if (!allowed) {
        emitServiceEvent(svcName, '$blocked', { method: methodName, args }, pipelineCtx)
        throw new Error(`[${name}] Guard blocked "${svcName}.${methodName}"`)
      }
    }

    // Method-level guard
    const methodDef = svc._methodDefs?.[methodName]
    if (methodDef?.guard) {
      const allowed = await methodDef.guard(...args, pipelineCtx)
      if (!allowed) {
        emitServiceEvent(svcName, '$blocked', { method: methodName, args }, pipelineCtx)
        throw new Error(`[${name}] Method guard blocked "${svcName}.${methodName}"`)
      }
    }

    // Execute
    try {
      const result = await method(...args, pipelineCtx)

      // Emit realtime event if configured
      if (methodDef?.realtime) {
        emitServiceEvent(svcName, methodName, { args, result }, pipelineCtx)
      }

      return result
    } catch (e) {
      emitServiceEvent(svcName, '$error', { method: methodName, args, error: e }, pipelineCtx)
      throw e
    }
  }

  /**
   * Shorthand: execute a method with a single argument (data/params).
   * Routes 'service.create' to services.call('service.create', data).
   */
  async function exec(path, data, baseCtx) {
    return call(path, data, baseCtx)
  }

  /**
   * Register a service at runtime.
   */
  function addService(name, def) {
    _services.set(name, normalizeService(def))
  }

  /**
   * Remove a service.
   */
  function removeService(name) {
    _services.delete(name)
    // Clean up listeners
    for (const [key] of _listeners) {
      if (key.startsWith(name + '.')) _listeners.delete(key)
    }
  }

  /**
   * Subscribe to realtime service events.
   *
   * @param {string} event — 'serviceName.methodName' or 'serviceName.*'
   * @param {Function} fn — (payload, ctx) => void
   * @returns {Function} unsubscribe
   */
  function on(event, fn) {
    if (!_listeners.has(event)) _listeners.set(event, new Set())
    _listeners.get(event).add(fn)
    return () => _listeners.get(event)?.delete(fn)
  }

  /** @private */
  function emitServiceEvent(svcName, method, payload, ctx) {
    const keys = [`${svcName}.${method}`, `${svcName}.*`, '*']
    for (const key of keys) {
      const fns = _listeners.get(key)
      if (fns) {
        for (const fn of fns) {
          try { fn(payload, ctx) } catch (e) {
            console.warn(`[${name}] listener error for "${key}":`, e)
          }
        }
      }
    }
  }

  /** List registered services and their methods */
  function list() {
    const result = {}
    for (const [svcName, svc] of _services) {
      result[svcName] = Object.keys(svc.methods)
    }
    return result
  }

  return {
    name,
    call, exec,
    addService, removeService,
    on, list,
    get services() { return new Map(_services) },
    get pipeline() { return pipeline }
  }
}

/**
 * Normalize a service definition into { methods, guard, schema, store, _methodDefs }.
 */
function normalizeService(def) {
  // def can be a plain object with methods, or a function (handler for default method)
  if (typeof def === 'function') {
    return { methods: { default: def }, _methodDefs: {} }
  }

  const methods = {}
  const methodDefs = {}

  for (const [name, methodDef] of Object.entries(def.methods || def)) {
    if (typeof methodDef === 'function') {
      methods[name] = methodDef
      methodDefs[name] = { handler: methodDef }
    } else if (methodDef && typeof methodDef === 'object' && typeof methodDef.handler === 'function') {
      methods[name] = methodDef.handler
      methodDefs[name] = { ...methodDef }
    }
  }

  return {
    methods,
    _methodDefs: methodDefs,
    guard: def.guard || null,
    schema: def.schema || null,
    store: def.store || null
  }
}
