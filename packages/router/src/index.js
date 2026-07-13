import { createLoop } from '@uploop/core'

/**
 * Create an Uploop router as a HyperGraph store.
 *
 * Routes are data nodes — navigation is just an update handler.
 * This means route changes flow through the same frame scheduler
 * as any other state change.
 *
 * ─── Features ──────────────────────────────────────────
 * • Exact + parametric route matching (/users/:id)
 * • Route guards (consistent (state, path) signature)
 * • Nested layouts (parent routes wrap children)
 * • Lazy loading (dynamic import)
 * • Query params
 * • Browser history (popstate)
 *
 * ─── Route Definition ──────────────────────────────────
 * {
 *   view: (state) => template,      // render function
 *   guard: (state, path) => bool,   // navigation guard
 *   layout: (state, content) => tpl, // wraps child content
 *   lazy: () => import('./Page.js'), // dynamic import
 * }
 *
 * @param {Object} routes - { path: viewFn | RouteDef }
 * @param {Object} [options]
 * @param {string} [options.base=''] - Base path prefix
 * @param {boolean} [options.useHash=false] - Hash-based routing
 * @param {Function} [options.onNavigate] - Global guard (state, path, resolved) => bool
 * @param {Function} [options.onError] - Called on lazy load failure
 * @returns {Object} Router with loop API + match/render/link/navigate/params
 */
export function createRouter(routes = {}, options = {}) {
  const { base = '', useHash = false, onNavigate, onError } = options

  // ─── Normalize route definitions ──────────────────────
  const routeMap = new Map()
  const layoutRoutes = []

  for (const [rawPath, def] of Object.entries(routes)) {
    const path = normalizePath(rawPath)
    const routeDef = normalizeRoute(def)
    routeMap.set(path, routeDef)
    if (routeDef.layout) {
      layoutRoutes.push({ path, def: routeDef })
    }
  }
  // Sort by path depth descending — deeper layouts wrap inner ones
  layoutRoutes.sort((a, b) => b.path.split('/').filter(Boolean).length - a.path.split('/').filter(Boolean).length)

  const notFound = routeMap.get('*') || { view: () => '<h2>404 Not Found</h2>' }

  const currentPath = getCurrentPath(base, useHash)

  // ─── Lazy loading state ───────────────────────────────
  const _lazyCache = new Map()
  const _loadingPaths = new Set()

  const store = createLoop({
    name: 'router',
    state: {
      path: currentPath,
      params: extractParams(currentPath, routeMap),
      query: parseQueryString(),
      loading: false,
      error: null
    },
    update: {
      navigate: (s, path) => {
        const cleanPath = path.startsWith('/') ? path.slice(1) : path
        const resolved = resolveRoute(cleanPath, routeMap)

        // Global guard — (state, cleanPath, resolved) → boolean
        if (onNavigate && onNavigate(s, cleanPath, resolved) === false) return s

        // Per-route guard — (state, path) → boolean
        if (resolved?.guard && resolved.guard(s, cleanPath) === false) return s

        if (typeof window !== 'undefined') {
          const url = useHash
            ? `#/${cleanPath}`
            : base ? `/${base}/${cleanPath}`.replace(/\/+/g, '/') : `/${cleanPath}`
          window.history.pushState({}, '', url)
        }

        return {
          path: cleanPath,
          params: resolved?.params || extractParams(cleanPath, routeMap),
          query: parseQueryString(),
          loading: false,
          error: null
        }
      },

      _setLoading: (s, loading) => ({ ...s, loading }),
      _setError: (s, error) => ({ ...s, error })
    }
  })

  // Listen to browser back/forward
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      store.send('navigate', getCurrentPath(base, useHash))
    })
    // Also listen for hashchange when using hash mode
    if (useHash) {
      window.addEventListener('hashchange', () => {
        const path = getCurrentPath(base, useHash)
        if (path !== store.get().path) {
          store.send('navigate', path)
        }
      })
    }
  }

  /** Resolve the matched route, handling lazy loading */
  function match() {
    const state = store.get()
    const route = resolveRoute(state.path, routeMap) || notFound

    // Lazy loading
    if (route.lazy && !_lazyCache.has(state.path)) {
      if (!_loadingPaths.has(state.path)) {
        _loadingPaths.add(state.path)
        store.send('_setLoading', true)

        Promise.resolve(route.lazy())
          .then(mod => {
            _lazyCache.set(state.path, normalizeRoute(mod.default || mod))
            _loadingPaths.delete(state.path)
            store.send('_setLoading', false)
            store.set(s => ({ ...s }))
          })
          .catch(err => {
            _loadingPaths.delete(state.path)
            store.send('_setLoading', false)
            store.send('_setError', err.message || 'Failed to load route')
            if (onError) onError(err)
          })
      }
      return { view: () => '<div>Loading...</div>', loading: true }
    }

    if (_lazyCache.has(state.path)) return _lazyCache.get(state.path)
    return route
  }

  /** Get matching layout chain from outermost to innermost */
  function getLayouts() {
    const state = store.get()
    const layouts = []
    for (const { path, def } of layoutRoutes) {
      if (state.path === path || state.path.startsWith(path + '/')) {
        layouts.push({ path, layout: def.layout })
      }
    }
    return layouts
  }

  /** Render current view with layouts applied */
  function render() {
    const state = store.get()
    if (state.loading) return '<div>Loading...</div>'
    if (state.error) return `<div style="color:red">Error: ${state.error}</div>`

    const route = match()
    let content = typeof route.view === 'function' ? route.view(state) : String(route.view || '')

    // Apply layouts from outermost to innermost
    const layouts = getLayouts()
    for (let i = 0; i < layouts.length; i++) {
      content = layouts[i].layout(state, content)
    }
    return content
  }

  /** Create an anchor click handler that prevents default + navigates */
  function link(path) {
    return (e) => {
      if (e) e.preventDefault()
      store.send('navigate', path)
    }
  }

  /** Current route params */
  function params() { return store.get().params }

  /** Check if navigation is allowed by guards */
  function canNavigate(path) {
    const s = store.get()
    const resolved = resolveRoute(path, routeMap)
    if (resolved?.guard && resolved.guard(s, path) === false) return false
    return true
  }

  /** Register a route at runtime */
  function addRoute(rawPath, def) {
    const path = normalizePath(rawPath)
    routeMap.set(path, normalizeRoute(def))
  }

  return {
    ...store,
    match, render, link,
    navigate: (path) => store.send('navigate', path),
    params, canNavigate, addRoute, getLayouts,
    getCurrentPath: () => store.get().path,
    getRoutes: () => Object.fromEntries(routeMap),
    get loading() { return store.get().loading },
    get error() { return store.get().error }
  }
}

// ─── Helpers ────────────────────────────────────────────────

function normalizeRoute(def) {
  if (typeof def === 'function') return { view: def }
  if (def && typeof def === 'object' && !Array.isArray(def)) return { ...def }
  return { view: () => String(def) }
}

function normalizePath(path) {
  return path.replace(/\/+$/, '').replace(/^\/+/, '') || ''
}

function getCurrentPath(base, useHash) {
  if (typeof window === 'undefined') return ''
  try {
    if (useHash) return normalizePath(window.location.hash.replace(/^#\/?/, '').split('?')[0])
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

function resolveRoute(path, routeMap) {
  if (routeMap.has(path)) return { ...routeMap.get(path) }
  for (const [pattern, route] of routeMap) {
    if (pattern === '*') continue
    const params = matchPath(pattern, path)
    if (params) return { ...route, params }
  }
  return routeMap.get('*') || null
}

function extractParams(path, routeMap) {
  for (const [pattern] of routeMap) {
    if (pattern === '*') continue
    const params = matchPath(pattern, path)
    if (params) return params
  }
  return {}
}

function matchPath(pattern, path) {
  const pp = pattern.split('/').filter(Boolean)
  const up = path.split('/').filter(Boolean)
  if (pp.length !== up.length) return null
  const params = {}
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) {
      params[pp[i].slice(1)] = decodeURIComponent(up[i])
    } else if (pp[i] !== up[i]) {
      return null
    }
  }
  return params
}
