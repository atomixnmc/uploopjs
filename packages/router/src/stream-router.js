/**
 * Stream Router — SSE, WebSocket, and streaming response dispatch.
 *
 * Stream routes define push-based data flows: real-time updates,
 * binary streams, event sources. Integrates with @uploop/stream
 * for binary codec support.
 *
 *   import { createStreamRouter } from '@uploop/router'
 *
 *   const streams = createStreamRouter({
 *     'live:notifications': {
 *       source: (ctx) => notificationFeed(ctx.auth.user.id),
 *       transport: 'sse',
 *       guard: authenticated
 *     },
 *     'realtime:prices': {
 *       source: priceFeed,
 *       transport: 'websocket',
 *       codec: PriceTickCodec
 *     }
 *   })
 *
 *   const feed = streams.open('live:notifications', ctx)
 *   feed.on('data', (msg) => console.log(msg))
 */

import { createPipeline } from './middleware.js'
import { createContext } from './context.js'

/**
 * @typedef {Object} StreamRoute
 * @property {Function} source — (ctx) => AsyncIterator | ReadableStream | EventEmitter
 * @property {string} [transport='sse'] — 'sse' | 'websocket' | 'stream'
 * @property {Function} [guard] — (ctx) => boolean
 * @property {Object} [codec] — @uploop/stream codec
 * @property {string} [flow] — @uploop/flows profile
 */

/**
 * Create a stream router.
 *
 * @param {Object} routes — { streamName: sourceFn | StreamRoute }
 * @param {Object} [options]
 * @param {string} [options.name='streamRouter']
 * @param {Function[]} [options.middleware]
 * @returns {Object} stream router
 */
export function createStreamRouter(routes = {}, options = {}) {
  const { name = 'streamRouter', middleware = [] } = options

  const _streams = new Map()    // name → StreamRoute
  const _active = new Map()     // name → Set<StreamInstance>
  const pipeline = createPipeline(middleware)

  for (const [streamName, def] of Object.entries(routes)) {
    _streams.set(streamName, normalizeStreamRoute(def))
  }

  /**
   * Open a stream connection.
   *
   * @param {string} streamName
   * @param {Object} [baseCtx] — base context
   * @returns {StreamInstance}
   *
   *   const feed = streams.open('live:notifications', ctx)
   *   for await (const msg of feed) { ... }
   */
  function open(streamName, baseCtx = {}) {
    const route = _streams.get(streamName)
    if (!route) throw new Error(`[${name}] Stream "${streamName}" not found`)

    const ctx = createContext({
      path: streamName,
      params: { stream: streamName },
      ...baseCtx
    })

    // Guard
    if (route.guard) {
      const allowed = route.guard(ctx)
      if (!allowed) {
        throw new Error(`[${name}] Guard blocked stream "${streamName}"`)
      }
    }

    const instance = createStreamInstance(streamName, route, ctx)

    // Track active instances
    if (!_active.has(streamName)) _active.set(streamName, new Set())
    _active.get(streamName).add(instance)
    instance.onClose(() => {
      _active.get(streamName)?.delete(instance)
    })

    return instance
  }

  /**
   * Get a ReadableStream for server-sent events usage.
   *
   * @param {string} streamName
   * @param {Object} [baseCtx]
   * @returns {ReadableStream}
   */
  function createSSEStream(streamName, baseCtx = {}) {
    const instance = open(streamName, baseCtx)
    let closed = false

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const data of instance) {
            if (closed) break
            const message = `data: ${JSON.stringify(data)}\n\n`
            controller.enqueue(new TextEncoder().encode(message))
          }
        } catch (e) {
          if (!closed) controller.error(e)
        } finally {
          if (!closed) controller.close()
        }
      },
      cancel() {
        closed = true
        instance.close()
      }
    })

    return stream
  }

  /**
   * Broadcast data to all active instances of a stream.
   *
   * @param {string} streamName
   * @param {*} data
   */
  function broadcast(streamName, data) {
    const instances = _active.get(streamName)
    if (!instances) return 0
    let count = 0
    for (const inst of instances) {
      inst.push(data)
      count++
    }
    return count
  }

  /** Register a stream route at runtime */
  function addRoute(streamName, def) {
    _streams.set(streamName, normalizeStreamRoute(def))
  }

  /** Remove a stream route and close all active instances */
  function removeRoute(streamName) {
    const instances = _active.get(streamName)
    if (instances) {
      for (const inst of instances) inst.close()
      _active.delete(streamName)
    }
    _streams.delete(streamName)
  }

  /** List registered streams */
  function list() {
    const result = {}
    for (const [name, route] of _streams) {
      result[name] = {
        transport: route.transport,
        hasGuard: !!route.guard,
        hasCodec: !!route.codec,
        active: _active.get(name)?.size || 0
      }
    }
    return result
  }

  return {
    name,
    open, createSSEStream, broadcast,
    addRoute, removeRoute, list,
    get streams() { return new Map(_streams) },
    get pipeline() { return pipeline }
  }
}

// ── Stream Instance ──────────────────────────────────────────

/**
 * Create a stream instance from a route definition.
 *
 * @param {string} name
 * @param {StreamRoute} route
 * @param {Object} ctx
 * @returns {StreamInstance}
 */
function createStreamInstance(name, route, ctx) {
  const _listeners = { data: [], error: [], close: [] }
  const _buffer = []
  let _closed = false
  let _iterator = null
  let _started = false

  const instance = {
    name,

    /** Async iterator — for await (const data of instance) */
    async *[Symbol.asyncIterator]() {
      _start()
      while (true) {
        if (_closed && _buffer.length === 0) break
        if (_buffer.length > 0) {
          yield _buffer.shift()
        } else {
          await new Promise(resolve => {
            const check = () => {
              if (_buffer.length > 0 || _closed) resolve()
              else setTimeout(check, 10)
            }
            check()
          })
        }
      }
    },

    /** Push data into the stream (for broadcast) */
    push(data) {
      if (_closed) return
      _buffer.push(data)
      for (const fn of _listeners.data) {
        try { fn(data) } catch (e) {
          console.warn(`[streamRouter] "${name}" data listener error:`, e)
        }
      }
    },

    /** Register event listeners */
    on(event, fn) {
      if (_listeners[event]) _listeners[event].push(fn)
      return () => {
        const idx = _listeners[event]?.indexOf(fn)
        if (idx >= 0) _listeners[event].splice(idx, 1)
      }
    },

    onClose(fn) {
      return instance.on('close', fn)
    },

    /** Close the stream */
    close() {
      if (_closed) return
      _closed = true
      if (_iterator?.return) {
        try { _iterator.return() } catch {}
      }
      for (const fn of _listeners.close) {
        try { fn() } catch {}
      }
    },

    get closed() { return _closed },
    get transport() { return route.transport }
  }

  async function _start() {
    if (_started) return
    _started = true

    try {
      const source = route.source(ctx)

      // Handle different source types
      if (source[Symbol.asyncIterator]) {
        _iterator = source[Symbol.asyncIterator]()
        for await (const data of _iterator) {
          instance.push(data)
        }
      } else if (source.getReader && typeof source.getReader === 'function') {
        // ReadableStream
        const reader = source.getReader()
        _iterator = reader
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          instance.push(value)
        }
      } else if (source.on && typeof source.on === 'function') {
        // EventEmitter-like
        _iterator = source
        source.on('data', (data) => instance.push(data))
        source.on('error', (err) => {
          for (const fn of _listeners.error) {
            try { fn(err) } catch {}
          }
        })
        source.on('close', () => instance.close())
      }
    } catch (e) {
      for (const fn of _listeners.error) {
        try { fn(e) } catch {}
      }
    } finally {
      instance.close()
    }
  }

  // Auto-start when iterated
  return instance
}

function normalizeStreamRoute(def) {
  if (typeof def === 'function') return { source: def, transport: 'sse' }
  if (def && typeof def === 'object') {
    return {
      source: def.source || (() => ({
        [Symbol.asyncIterator]() { return { next: () => Promise.resolve({ done: true }) } }
      })),
      transport: def.transport || 'sse',
      guard: def.guard || null,
      codec: def.codec || null,
      flow: def.flow || null
    }
  }
  return { source: () => ({}), transport: 'sse' }
}
