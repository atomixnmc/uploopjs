/**
 * @uploop/router — v0.10.0
 *
 * Unified multi-mode router: pages, events, services, streams.
 * Built on @uploop/core loops and the pattern matching engine.
 *
 *   import { createRouter } from '@uploop/router'
 *
 *   // Full unified router
 *   const router = createRouter({
 *     pages: { '/': HomeView, '/users/:id': UserView },
 *     events: { 'order:created': orderHandler },
 *     services: { products: { find, create } },
 *     streams: { 'live:notifications': { source: feed } },
 *     middleware: [authMiddleware]
 *   })
 *
 *   // Or use individual routers standalone
 *   import { createPageRouter, createEventRouter } from '@uploop/router'
 */
export {
  createRouter,
  createPageRouter,
  createEventRouter,
  createServiceRouter,
  createStreamRouter
} from './router.js'

export {
  createContext
} from './context.js'

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
