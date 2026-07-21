/**
 * Request context — the unified ctx object passed through middleware,
 * route handlers, and views. Every handler receives the same ctx shape.
 *
 *   import { createContext } from '@uploop/router'
 *   const ctx = createContext({ path: '/users/42', req, res })
 */

/**
 * Create a request context.
 *
 * @param {Object} init
 * @param {string} [init.path] — current path
 * @param {Object} [init.params] — route params
 * @param {Object} [init.query] — query string params
 * @param {Object} [init.auth] — auth session state { user, session, token }
 * @param {Object} [init.store] — @uploop/store instance
 * @param {Object} [init.state] — request-local mutable state
 * @param {Object} [init.req] — raw HTTP request (server)
 * @param {Object} [init.res] — raw HTTP response (server)
 * @param {Object} [init.router] — parent router reference
 * @param {Object} [init.meta] — arbitrary metadata
 * @returns {Object} ctx
 */
export function createContext(init = {}) {
  const ctx = {
    // ── Route info ─────────────────────────────────────
    path: init.path || '',
    params: init.params || {},
    query: init.query || {},
    fullPath: init.fullPath || init.path || '',

    // ── Auth ───────────────────────────────────────────
    auth: init.auth || { user: null, session: null, token: null },

    // ── Store (injected by host) ───────────────────────
    store: init.store || null,

    // ── Request-local mutable state ────────────────────
    state: init.state || {},

    // ── Raw HTTP (server-side only) ────────────────────
    req: init.req || null,
    res: init.res || null,

    // ── Metadata ───────────────────────────────────────
    meta: init.meta || {},
    router: init.router || null,

    // ── Response helpers ───────────────────────────────
    /** Set a response status code */
    status(code) {
      ctx._status = code
      return ctx
    },

    /** Set a response header */
    header(key, value) {
      if (!ctx._headers) ctx._headers = {}
      ctx._headers[key] = value
      return ctx
    },

    /** Get a response header */
    getHeader(key) {
      return ctx._headers?.[key]
    },

    /** Get the current status code */
    getStatus() {
      return ctx._status || 200
    },

    // ── Internal ───────────────────────────────────────
    _status: 200,
    _headers: null,
    _body: null,
    _responseType: 'auto', // 'html' | 'json' | 'stream' | 'sse' | 'redirect'

    /**
     * Clone this context (shallow copy, for sub-routers).
     * Inherits store, auth, req, res, router but gets independent state.
     */
    clone(overrides = {}) {
      return createContext({
        path: overrides.path ?? ctx.path,
        params: overrides.params ?? { ...ctx.params },
        query: overrides.query ?? { ...ctx.query },
        fullPath: overrides.fullPath ?? ctx.fullPath,
        auth: overrides.auth ?? ctx.auth,
        store: overrides.store ?? ctx.store,
        state: overrides.state ?? {},
        req: overrides.req ?? ctx.req,
        res: overrides.res ?? ctx.res,
        meta: overrides.meta ?? { ...ctx.meta },
        router: overrides.router ?? ctx.router
      })
    },

    /**
     * Check if running on server (req/res present).
     */
    get isServer() {
      return !!(ctx.req && ctx.res)
    },

    /**
     * Check if running in browser.
     */
    get isClient() {
      return typeof window !== 'undefined' && !ctx.req
    }
  }

  return ctx
}
