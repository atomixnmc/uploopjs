/**
 * Event Router — message-based event dispatch.
 *
 * Events are named messages (like Redux actions or CQRS commands).
 * Routes match on event name patterns: 'order:*', 'payment:received', etc.
 *
 * Integrates naturally with:
 *   - @uploop/state-machine (send events to machines)
 *   - @uploop/flows (execution profiles, circuit breakers, sagas)
 *   - @uploop/schema (payload validation)
 *
 *   import { createEventRouter } from '@uploop/router'
 *
 *   const events = createEventRouter({
 *     'order:created': {
 *       handler: (payload, ctx) => { ctx.store.send('addOrder', payload) }
 *     },
 *     'payment:*': {
 *       guard: (payload, ctx) => ctx.auth.user?.role === 'admin',
 *       handler: (payload, ctx) => { ... }
 *     }
 *   })
 *
 *   await events.dispatch('order:created', { id: 1 }, ctx)
 */

import { createMatcher, normalizePath } from './matcher.js'
import { createPipeline } from './middleware.js'
import { createContext } from './context.js'

/**
 * @typedef {Object} EventRoute
 * @property {Function} handler — (payload, ctx) => void | Promise<void>
 * @property {Function} [guard] — (payload, ctx) => boolean
 * @property {Object} [schema] — @uploop/schema for payload validation
 * @property {string} [flow] — @uploop/flows execution profile name
 * @property {Object} [retry] — { maxAttempts, backoff }
 * @property {Object} [circuitBreaker] — { threshold, resetTimeout }
 */

/**
 * Create an event router.
 *
 * @param {Object} routes — { eventPattern: handlerFn | EventRoute }
 * @param {Object} [options]
 * @param {string} [options.name='eventRouter']
 * @param {Function[]} [options.middleware] — pipeline
 * @returns {Object} event router
 */
export function createEventRouter(routes = {}, options = {}) {
  const { name = 'eventRouter', middleware = [] } = options

  const matcher = createMatcher()
  const routeMeta = new Map()

  for (const [rawPattern, def] of Object.entries(routes)) {
    const pattern = normalizePath(rawPattern)
    const routeDef = normalizeEventRoute(def)
    matcher.add(pattern, routeDef.handler)
    routeMeta.set(pattern, routeDef)
  }

  const pipeline = createPipeline(middleware)
  const _listeners = new Map()   // event → Set<fn>
  const _history = []           // recent events (for replay/debug)
  const _maxHistory = options.maxHistory || 100

  /**
   * Dispatch an event to all matching handlers.
   *
   * @param {string} event — event name (e.g. 'order:created')
   * @param {*} payload — event data
   * @param {Object} [baseCtx] — base context (injected by host)
   * @returns {Promise<Object[]>} results from all matched handlers
   */
  async function dispatch(event, payload, baseCtx = {}) {
    // Augment baseCtx directly so handler mutations are visible to caller
    const ctx = baseCtx
    ctx.path = ctx.path || event
    ctx.params = ctx.params || { event }
    ctx.event = event

    // Record in history
    _history.push({ event, payload, timestamp: Date.now(), ctx: { path: ctx.path } })
    if (_history.length > _maxHistory) _history.shift()

    const results = []

    // Step 1: Run through pipeline middleware
    let pipelineCtx = ctx
    try {
      pipelineCtx = await pipeline.run(ctx)
    } catch (e) {
      // Emit to error listeners
      emitLocal('$error', { event, payload, error: e }, ctx)
      throw e
    }

    // Step 2: Match and dispatch to route handlers
    const match = matcher.match(event)

    if (match && match.handler) {
      const meta = routeMeta.get(match.pattern)

      // Guard check
      if (meta?.guard) {
        try {
          const allowed = await meta.guard(payload, pipelineCtx)
          if (!allowed) {
            emitLocal('$blocked', { event, payload, reason: 'guard' }, pipelineCtx)
            return results
          }
        } catch (e) {
          emitLocal('$error', { event, payload, error: e }, pipelineCtx)
          throw e
        }
      }

      // Schema validation (if @uploop/schema available)
      if (meta?.schema && pipelineCtx.store?.schema) {
        // Deferred: integrate with @uploop/schema
      }

      try {
        const result = await match.handler(payload, pipelineCtx)
        results.push({ pattern: match.pattern, result })
      } catch (e) {
        emitLocal('$error', { event, payload, error: e, pattern: match.pattern }, pipelineCtx)
        throw e
      }
    }

    // Step 3: Emit to wildcard listeners
    emitLocal('*', { event, payload }, pipelineCtx)

    // Step 4: Emit to specific listeners
    emitLocal(event, payload, pipelineCtx)

    return results
  }

  /**
   * Broadcast to all handlers regardless of event name.
   * Useful for middleware-like cross-cutting events.
   */
  async function broadcast(payload, baseCtx = {}) {
    const ctx = baseCtx
    ctx.path = ctx.path || '$broadcast'
    const results = []
    for (const [pattern, meta] of routeMeta) {
      try {
        const result = await meta.handler(payload, ctx)
        results.push({ pattern, result })
      } catch (e) {
        emitLocal('$error', { event: '$broadcast', payload, error: e, pattern }, ctx)
      }
    }
    return results
  }

  /**
   * Subscribe to an event.
   *
   * @param {string} event — event name or '*' for all
   * @param {Function} fn — (payload, ctx) => void
   * @returns {Function} unsubscribe
   */
  function on(event, fn) {
    if (!_listeners.has(event)) _listeners.set(event, new Set())
    _listeners.get(event).add(fn)
    return () => _listeners.get(event)?.delete(fn)
  }

  /** @private */
  function emitLocal(event, payload, ctx) {
    const fns = _listeners.get(event)
    if (fns) {
      for (const fn of fns) {
        try { fn(payload, ctx) } catch (e) {
          console.warn(`[${name}] listener error for "${event}":`, e)
        }
      }
    }
  }

  /** Register a new event route at runtime */
  function addRoute(eventPattern, def) {
    const pattern = normalizePath(eventPattern)
    const routeDef = normalizeEventRoute(def)
    matcher.add(pattern, routeDef.handler)
    routeMeta.set(pattern, routeDef)
  }

  /** Remove an event route */
  function removeRoute(eventPattern) {
    const pattern = normalizePath(eventPattern)
    matcher.remove(pattern)
    routeMeta.delete(pattern)
  }

  /** Get recent event history */
  function history() {
    return [..._history]
  }

  /** Clear event history */
  function clearHistory() {
    _history.length = 0
  }

  return {
    name,
    dispatch,
    broadcast,
    on,
    addRoute,
    removeRoute,
    history,
    clearHistory,
    getRoutes: () => matcher.list(),
    get pipeline() { return pipeline }
  }
}

function normalizeEventRoute(def) {
  if (typeof def === 'function') return { handler: def }
  if (def && typeof def === 'object' && !Array.isArray(def)) return { ...def }
  return { handler: () => {} }
}
