/**
 * Page Router — URL-based navigation with views, layouts, guards, lazy loading.
 *
 * Built on the unified pattern matcher and middleware pipeline.
 * Maintains backward compatibility with v0.9 createRouter API.
 *
 *   import { createPageRouter } from '@uploop/router'
 *
 *   const pages = createPageRouter({
 *     '/': HomeView,
 *     '/users/:id': { view: UserView, guard: authGuard, layout: AppLayout },
 *     '/admin/*': { lazy: () => import('./Admin.js') }
 *   })
 *
 *   pages.navigate('/users/42')
 *   pages.render()  // → HTML string
 */

import { createLoop } from '@uploop/core'
import { createMatcher, normalizePath } from './matcher.js'
import { createPipeline } from './middleware.js'
import { createContext } from './context.js'

/**
 * @typedef {Object} PageRoute
 * @property {Function} [view] — render function (state) → html
 * @property {Function} [guard] — (state, path) → boolean
 * @property {Function} [layout] — (state, content) → html (wraps child)
 * @property {Function} [lazy] — () => import('./Page.js')
 * @property {string} [title] — document title
 * @property {Object} [meta] — arbitrary metadata
 */

/**
 * Create a page router.
 *
 * @param {Object} routes — { path: viewFn | PageRoute }
 * @param {Object} [options]
 * @param {string} [options.base=''] — base path prefix
 * @param {boolean} [options.useHash=false] — hash-based routing
 * @param {Function[]} [options.middleware] — middleware pipeline
 * @param {Function} [options.onNavigate] — global guard (ctx, resolved) => boolean
 * @param {Function} [options.onError] — called on lazy load failure
 * @param {string} [options.name='pageRouter'] — loop name
 * @returns {Object} page router
 */
export function createPageRouter(routes = {}, options = {}) {
  const { base = '', useHash = false, middleware = [], onNavigate, onError, name = 'pageRouter' } = options

  // ── Normalize routes into matcher ──────────────────────
  const matcher = createMatcher()
  const routeMeta = new Map()    // pattern → { guard, layout, lazy, title, meta }
  const layoutRoutes = []

  for (const [rawPath, def] of Object.entries(routes)) {
    const path = normalizePath(rawPath)
    const routeDef = normalizeRoute(def)
    matcher.add(path, routeDef.view)
    routeMeta.set(path, routeDef)

    if (routeDef.layout) {
      layoutRoutes.push({ path, layout: routeDef.layout })
    }
  }

  // Sort layouts by depth descending — deeper layouts wrap inner ones
  layoutRoutes.sort((a, b) =>
    b.path.split('/').filter(Boolean).length - a.path.split('/').filter(Boolean).length
  )

  const notFound = routeMeta.get('*')?.view || (() => '<h2>404 Not Found</h2>')

  // ── Lazy loading state ─────────────────────────────────
  const _lazyCache = new Map()
  const _loadingPaths = new Set()

  // ── Initial path ───────────────────────────────────────
  const currentPath = getCurrentPath(base, useHash)

  // ── Loop store ─────────────────────────────────────────
  const store = createLoop({
    name,
    state: {
      path: currentPath,
      params: {},
      query: parseQueryString(),
      loading: false,
      error: null,
      title: ''
    },
    update: {
      navigate: (s, path) => {
        const cleanPath = normalizePath(path)
        const match = matcher.match(cleanPath)
        const resolved = match?.handler ? match : null
        const meta = match?.pattern ? routeMeta.get(match.pattern) : null

        // Create context for guard checks
        const ctx = createContext({
          path: cleanPath,
          params: match?.params || {},
          query: parseQueryString(),
          meta: meta?.meta || {}
        })

        // Global guard — supports both v0.9 (state, path, resolved) and v0.10 (ctx, resolved)
        if (onNavigate) {
          // Detect signature: if first param is ctx (has .path, .params, etc.), use new API
          const ctxTest = createContext({ path: cleanPath, params: match?.params || {} })
          const useNewAPI = onNavigate.length <= 2
          const blocked = useNewAPI
            ? onNavigate(ctxTest, resolved) === false
            : onNavigate(s, cleanPath, resolved) === false
          if (blocked) return s
        }

        // Per-route guard
        if (meta?.guard && meta.guard(s, cleanPath) === false) return s

        // Update browser history
        if (typeof window !== 'undefined') {
          const url = useHash
            ? `#/${cleanPath}`
            : base ? `/${base}/${cleanPath}`.replace(/\/+/g, '/') : `/${cleanPath}`
          window.history.pushState({}, '', url)
        }

        return {
          path: cleanPath,
          params: match?.params || {},
          query: parseQueryString(),
          loading: false,
          error: null,
          title: meta?.title || ''
        }
      },

      _setLoading: (s, loading) => ({ ...s, loading }),
      _setError: (s, error) => ({ ...s, error }),
      _setTitle: (s, title) => ({ ...s, title })
    }
  })

  // ── Browser history events ─────────────────────────────
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      store.send('navigate', getCurrentPath(base, useHash))
    })
    if (useHash) {
      window.addEventListener('hashchange', () => {
        const path = getCurrentPath(base, useHash)
        if (path !== store.get().path) {
          store.send('navigate', path)
        }
      })
    }
  }

  // ── Middleware pipeline ─────────────────────────────────
  const pipeline = createPipeline(middleware)

  // ── Public API ─────────────────────────────────────────

  /**
   * Resolve and return the matched route for the current path.
   * Handles lazy loading — returns loading view while importing.
   */
  function match() {
    const state = store.get()
    const result = matcher.match(state.path)

    if (!result || !result.handler) {
      return { view: notFound, params: {}, loading: false }
    }

    const pattern = result.pattern
    const meta = routeMeta.get(pattern)

    // Lazy loading
    if (meta?.lazy && !_lazyCache.has(state.path)) {
      if (!_loadingPaths.has(state.path)) {
        _loadingPaths.add(state.path)
        store.send('_setLoading', true)

        Promise.resolve(meta.lazy())
          .then(mod => {
            const resolved = normalizeRoute(mod.default || mod)
            _lazyCache.set(state.path, resolved.view)
            _loadingPaths.delete(state.path)
            store.send('_setLoading', false)
            store.set(s => ({ ...s })) // trigger re-render
          })
          .catch(err => {
            _loadingPaths.delete(state.path)
            store.send('_setLoading', false)
            store.send('_setError', err.message || 'Failed to load route')
            if (onError) onError(err)
          })
      }
      return { view: () => '<div>Loading...</div>', loading: true, params: result.params }
    }

    const view = _lazyCache.get(state.path) || result.handler
    return {
      view,
      params: result.params,
      loading: false,
      meta: meta?.meta || {},
      title: meta?.title || ''
    }
  }

  /**
   * Get matching layout chain from outermost to innermost.
   */
  function getLayouts() {
    const state = store.get()
    const layouts = []
    for (const { path, layout } of layoutRoutes) {
      if (state.path === path || state.path.startsWith(path + '/')) {
        layouts.push({ path, layout })
      }
    }
    return layouts
  }

  /**
   * Render the current route to HTML, with layouts applied.
   */
  function render() {
    const state = store.get()
    if (state.loading) return '<div>Loading...</div>'
    if (state.error) return `<div style="color:red">Error: ${state.error}</div>`

    const route = match()
    let content = typeof route.view === 'function'
      ? route.view(state)
      : String(route.view || '')

    const layouts = getLayouts()
    for (let i = 0; i < layouts.length; i++) {
      content = layouts[i].layout(state, content)
    }

    // Update document title
    if (route.title && typeof document !== 'undefined') {
      document.title = route.title
    }

    return content
  }

  /**
   * Navigate to a path.
   */
  function navigate(path) {
    store.send('navigate', path)
  }

  /**
   * Create an anchor click handler that prevents default + navigates.
   */
  function link(path) {
    return (e) => {
      if (e) e.preventDefault()
      store.send('navigate', path)
    }
  }

  /** Get current route params */
  function params() { return store.get().params }

  /** Check if navigation to a path is allowed by guards */
  function canNavigate(path) {
    const s = store.get()
    const match = matcher.match(normalizePath(path))
    const meta = match?.pattern ? routeMeta.get(match.pattern) : null
    if (meta?.guard && meta.guard(s, path) === false) return false
    return true
  }

  /** Register a route at runtime */
  function addRoute(rawPath, def) {
    const path = normalizePath(rawPath)
    const routeDef = normalizeRoute(def)
    matcher.add(path, routeDef.view)
    routeMeta.set(path, routeDef)
    if (routeDef.layout) {
      layoutRoutes.push({ path, layout: routeDef.layout })
      layoutRoutes.sort((a, b) =>
        b.path.split('/').filter(Boolean).length - a.path.split('/').filter(Boolean).length
      )
    }
  }

  /**
   * Resolve a named route to a concrete path.
   * @param {string} name — route name (the raw pattern)
   * @param {Object} [params] — param values
   */
  function resolve(name, params = {}) {
    let path = normalizePath(name)
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`:${key}`, encodeURIComponent(value))
    }
    return path
  }

  /**
   * Create an <a> tag string for a route.
   */
  function href(name, params = {}, text = '') {
    const path = resolve(name, params)
    const displayText = text || path
    return `<a href="/${path}" data-up-link="${path}">${displayText}</a>`
  }

  // Lifecycle hook storage
  const _hooks = { before: [], after: [], enter: new Map(), leave: new Map() }

  return {
    ...store,
    match, render, link,
    navigate,
    params, canNavigate, addRoute, getLayouts, resolve, href,
    getCurrentPath: () => store.get().path,
    getRoutes: () => {
      const obj = {}
      for (const [pattern, meta] of routeMeta) {
        obj[pattern] = { view: meta.view, guard: meta.guard, layout: meta.layout, title: meta.title }
      }
      return obj
    },
    listRoutes: () => matcher.list(),
    get loading() { return store.get().loading },
    get error() { return store.get().error },
    get path() { return store.get().path },
    // Lifecycle hooks (Phase 2)
    beforeEach(fn) { _hooks.before.push(fn); return this },
    afterEach(fn) { _hooks.after.push(fn); return this },
    beforeEnter(pattern, fn) { if (!_hooks.enter.has(pattern)) _hooks.enter.set(pattern, []); _hooks.enter.get(pattern).push(fn); return this },
    afterLeave(pattern, fn) { if (!_hooks.leave.has(pattern)) _hooks.leave.set(pattern, []); _hooks.leave.get(pattern).push(fn); return this }
  }
}

// ── Internal helpers ──────────────────────────────────────────

function normalizeRoute(def) {
  if (typeof def === 'function') return { view: def }
  if (def && typeof def === 'object' && !Array.isArray(def)) return { ...def }
  return { view: () => String(def) }
}

function getCurrentPath(base, useHash) {
  if (typeof window === 'undefined') return ''
  try {
    if (useHash) {
      return normalizePath(window.location.hash.replace(/^#\/?/, '').split('?')[0])
    }
    let p = window.location.pathname
    if (base && p.startsWith('/' + base)) p = p.slice(base.length + 1)
    else if (base && p.startsWith(base)) p = p.slice(base.length)
    return normalizePath(p)
  } catch { return '' }
}

function parseQueryString() {
  if (typeof window === 'undefined') return {}
  try {
    const qs = window.location.search.replace(/^\?/, '')
    if (!qs) return {}
    const result = {}
    for (const part of qs.split('&')) {
      const eq = part.indexOf('=')
      if (eq >= 0) result[decodeURIComponent(part.slice(0, eq))] = decodeURIComponent(part.slice(eq + 1))
    }
    return result
  } catch { return {} }
}
