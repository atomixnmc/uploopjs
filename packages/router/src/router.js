/**
 * Unified Router — composes pages, events, services, and streams.
 *
 * This is the main entry point for @uploop/router v0.10.x.
 * It provides backward compatibility with v0.9's createRouter while
 * exposing the full multi-mode dispatch architecture.
 *
 *   import { createRouter } from '@uploop/router'
 *
 *   const router = createRouter({
 *     pages: { '/': HomeView, '/users/:id': UserView },
 *     events: { 'order:created': orderHandler },
 *     services: { products: { find, create } },
 *     streams: { 'live:notifications': { source: feed } },
 *     middleware: [authMiddleware, logMiddleware]
 *   })
 *
 *   // Page navigation (v0.9 compatible)
 *   router.navigate('/users/42')
 *   router.render()
 *
 *   // Event dispatch
 *   router.events.dispatch('order:created', { id: 1 })
 *
 *   // Service call
 *   await router.services.call('products.find', { category: 'books' })
 *
 *   // Stream open
 *   const feed = router.streams.open('live:notifications')
 */

import { createPageRouter } from './page-router.js'
import { createEventRouter } from './event-router.js'
import { createServiceRouter } from './service-router.js'
import { createStreamRouter } from './stream-router.js'
import { createPipeline } from './middleware.js'
import { createContext } from './context.js'
import { normalizePath } from './matcher.js'

/**
 * Create a unified router.
 *
 * @param {Object} config
 * @param {Object} [config.pages] — page route definitions
 * @param {Object} [config.events] — event route definitions
 * @param {Object} [config.services] — service route definitions
 * @param {Object} [config.streams] — stream route definitions
 * @param {Function[]} [config.middleware] — shared middleware pipeline
 * @param {Object} [config.options] — options passed to all sub-routers
 * @returns {Object} unified router
 */
export function createRouter(config = {}, legacyOptions) {
  // Support v0.9 API: createRouter(routes, options) — two positional args
  if (legacyOptions !== undefined) {
    return createPageRouter(config, legacyOptions)
  }

  // Support v0.9 API: createRouter({ '/': HomeView }) — single routes object
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    const hasModeKeys = ['pages', 'events', 'services', 'streams', 'middleware', 'options']
      .some(k => k in config)
    if (!hasModeKeys) {
      return createPageRouter(config)
    }
  }

  const {
    pages = {},
    events = {},
    services = {},
    streams = {},
    middleware = [],
    options = {}
  } = config

  const sharedPipeline = createPipeline(middleware)

  // Create sub-routers
  const pageRouter = createPageRouter(pages, {
    ...options,
    middleware: [...middleware, ...(options.middleware || [])]
  })

  const eventRouter = createEventRouter(events, {
    ...options,
    middleware: [...middleware, ...(options.middleware || [])]
  })

  const serviceRouter = createServiceRouter(services, {
    ...options,
    middleware: [...middleware, ...(options.middleware || [])]
  })

  const streamRouter = createStreamRouter(streams, {
    ...options,
    middleware: [...middleware, ...(options.middleware || [])]
  })

  // Sub-routers map for mounting
  const _mounted = new Map()   // prefix → unified router

  /**
   * Mount a sub-router at a path prefix.
   *
   *   const adminRouter = createRouter({ pages: { dashboard: ... } })
   *   mainRouter.mount('/admin', adminRouter)
   */
  function mount(prefix, subRouter) {
    const clean = normalizePath(prefix)
    _mounted.set(clean, subRouter)
    // Register all page routes from the sub-router with the prefix
    const subRoutes = subRouter.listRoutes ? subRouter.listRoutes() : subRouter.listRoutes?.() || []
    if (Array.isArray(subRoutes)) {
      for (const route of subRoutes) {
        const fullPath = clean ? `${clean}/${route.pattern}` : route.pattern
        if (route.handler !== '[Function]') {
          pageRouter.addRoute(fullPath, { view: route.handler })
        }
      }
    }
  }

  /**
   * Unmount a sub-router.
   */
  function unmount(prefix) {
    _mounted.delete(normalizePath(prefix))
  }

  /**
   * Create a request context with the router attached.
   */
  function createRequestContext(init = {}) {
    return createContext({
      ...init,
      router: {
        pages: pageRouter,
        events: eventRouter,
        services: serviceRouter,
        streams: streamRouter
      }
    })
  }

  // ── Unified API ───────────────────────────────────────

  const router = {
    // Sub-routers (direct access)
    pages: pageRouter,
    events: eventRouter,
    services: serviceRouter,
    streams: streamRouter,

    // Mount/unmount
    mount, unmount,

    // Context factory
    createRequestContext,

    // Shared pipeline
    pipeline: sharedPipeline,

    // ── Page delegation (v0.9 compatibility) ──────────
    navigate: (path) => pageRouter.navigate(path),
    render: () => pageRouter.render(),
    match: () => pageRouter.match(),
    link: (path) => pageRouter.link(path),
    params: () => pageRouter.params(),
    canNavigate: (path) => pageRouter.canNavigate(path),
    addRoute: (path, def) => pageRouter.addRoute(path, def),
    getCurrentPath: () => pageRouter.getCurrentPath(),
    getRoutes: () => pageRouter.getRoutes(),
    getLayouts: () => pageRouter.getLayouts(),
    get loading() { return pageRouter.loading },
    get error() { return pageRouter.error },
    get path() { return pageRouter.path },

    // Delegate loop API for store compatibility
    get: () => pageRouter.get(),
    set: (fn) => pageRouter.set(fn),
    send: (event, ...args) => pageRouter.send(event, ...args),
    subscribe: (fn) => pageRouter.subscribe(fn),
    on: (event, fn) => pageRouter.on?.(event, fn),
    dispose: () => pageRouter.dispose?.(),

    /**
     * Handle an incoming HTTP request (server-side).
     * Routes the request through pages → events → services → streams
     * based on the URL and method.
     *
     * @param {Object} req — Node.js IncomingMessage or similar
     * @param {Object} res — Node.js ServerResponse or similar
     * @returns {Promise<Object>} response ctx
     */
    async handle(req, res) {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const path = normalizePath(url.pathname)
      const method = (req.method || 'GET').toUpperCase()

      const ctx = createRequestContext({
        path,
        query: Object.fromEntries(url.searchParams),
        req, res,
        meta: { method, url: url.href }
      })

      // Run shared pipeline
      await sharedPipeline.run(ctx)

      // Check sub-routers first
      for (const [prefix, subRouter] of _mounted) {
        if (path === prefix || path.startsWith(prefix + '/')) {
          const subPath = path.slice(prefix.length)
          return subRouter.handle(req, res)
        }
      }

      // Try pages first (GET)
      if (method === 'GET') {
        const pageMatch = pageRouter.match()
        if (pageMatch && !pageMatch.loading) {
          const html = pageRouter.render()
          res.writeHead(ctx._status || 200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(html)
          return ctx
        }
      }

      // Try service routes
      // Convention: /api/serviceName/method → services.call('serviceName.method')
      if (path.startsWith('api/')) {
        const servicePath = path.slice(4).replace(/\//g, '.') // 'api/products/find' → 'products.find'
        try {
          let body = null
          if (['POST', 'PUT', 'PATCH'].includes(method)) {
            body = await readBody(req)
          }
          const result = await serviceRouter.call(servicePath, body, ctx)
          res.writeHead(ctx._status || 200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
          return ctx
        } catch (e) {
          res.writeHead(ctx._status || 404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
          return ctx
        }
      }

      // Try SSE streams
      if (path.startsWith('streams/')) {
        const streamName = path.slice(8)
        try {
          const sseStream = streamRouter.createSSEStream(streamName, ctx)
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          })
          const reader = sseStream.getReader()
          const pump = async () => {
            while (true) {
              const { done, value } = await reader.read()
              if (done) { res.end(); break }
              res.write(value)
            }
          }
          pump()
          return ctx
        } catch (e) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
          return ctx
        }
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<h2>404 Not Found</h2>')
      return ctx
    }
  }

  return router
}

/**
 * Read the body of an incoming HTTP request.
 * @param {Object} req
 * @returns {Promise<*>} parsed body
 */
async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : null)
      } catch {
        resolve(data)
      }
    })
    req.on('error', reject)
  })
}

// Re-export sub-routers for standalone usage
export { createPageRouter } from './page-router.js'
export { createEventRouter } from './event-router.js'
export { createServiceRouter } from './service-router.js'
export { createStreamRouter } from './stream-router.js'

// Re-export utilities
export { createContext } from './context.js'
export {
  createPipeline,
  composeMiddleware,
  loggerMiddleware,
  errorMiddleware,
  timeoutMiddleware
} from './middleware.js'
export {
  createMatcher,
  normalizePath,
  parsePattern,
  matchPath,
  rankPatterns
} from './matcher.js'
