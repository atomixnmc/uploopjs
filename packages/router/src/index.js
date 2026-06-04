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
 * • Route guards (before/after navigation)
 * • Nested layouts (parent routes wrap children)
 * • Lazy loading (dynamic import)
 * • Query params + hash
 * • Browser history (popstate)
 *
 * @param {Object} routes - Route definitions { path: component|RouteDef }
 * @param {Object} [options]
 * @param {string} [options.base=''] - Base path
 * @param {boolean} [options.useHash=false] - Use hash-based routing
 * @param {Function} [options.onNavigate] - Called (from, to) before navigation
 * @param {Function} [options.onError] - Called (error) on lazy load failure
 * @returns {Object} Router
 */
export function createRouter(routes = {}, options = {}) {
  const { base = '', useHash = false, onNavigate, onError } = options

  // ─── Normalize route definitions ──────────────────────
  // RouteDef: { view, guard, layout, lazy, children }
  const routeMap = {}
  const layoutRoutes = [] // parent routes with children (for nesting)

  for (const [path, def] of Object.entries(routes)) {
    const normalized = normalizePath(path)
    const routeDef = normalizeRoute(def)

    routeMap[normalized] = routeDef
    if (routeDef.layout || routeDef.children) {
      layoutRoutes.push({ path: normalized, def: routeDef })
    }
  }
  // Sort by path depth so deeper routes match first
  layoutRoutes.sort((a, b) => b.path.split('/').length - a.path.split('/').length)

  // Default routes
  const notFound = routeMap['*'] || { view: () => '<h2>404 Not Found</h2>' }
  const index = routeMap[''] || routeMap['/'] || { view: () => '<h2>Welcome</h2>' }

  const currentPath = getCurrentPath(base, useHash)

  // ─── Lazy loading state ───────────────────────────────
  const _lazyCache = new Map() // path → resolved component
  const _loadingPath = new Set() // paths currently loading

  const store = createLoop({
    name: 'router',
    state: {
      path: currentPath,
      params: {},
      query: parseQueryString(),
      hash: (typeof window !== 'undefined') ? (window.location.hash || '') : '',
      loading: false,
      error: null
    },
    update: {
      /** Navigate to a path */
      navigate: (s, path) => {
        const cleanPath = path.replace(/^\/+/, '')
        const resolved = resolveRoute(cleanPath, routeMap)

        // ── Route guard ─────────────────────────────────
        if (onNavigate) {
          const allowed = onNavigate(s.path, cleanPath, resolved)
          if (allowed === false) return s
        }

        // ── Per-route guard ─────────────────────────────
        if (resolved?.guard) {
          const allowed = resolved.guard(s, cleanPath)
          if (allowed === false) return s
        }

        if (typeof window !== 'undefined') {
          const fullPath = useHash ? `#${cleanPath}` : `/${base}${cleanPath}`
          window.history.pushState({}, '', fullPath)
        }
        return {
          path: cleanPath,
          params: extractParams(cleanPath, routeMap),
          query: (typeof window !== 'undefined') ? parseQueryString() : {},
          hash: (typeof window !== 'undefined') ? (window.location.hash || '') : '',
          loading: false,
          error: null
        }
      },

      /** Set loading state (used by lazy loader) */
      _setLoading: (s, loading) => ({ ...s, loading }),

      /** Set error state */
      _setError: (s, error) => ({ ...s, error })
    }
  })

  // Listen to popstate (browser back/forward)
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      store.send('navigate', getCurrentPath(base, useHash))
    })
  }

  /**
   * Get the matched route component for current path.
   * Handles lazy loading — returns a promise if loading.
   */
  function match() {
    const state = store.get()
    const route = resolveRoute(state.path, routeMap)

    if (!route) return notFound

    // ── Lazy loading ────────────────────────────────────
    if (route.lazy && !_lazyCache.has(state.path)) {
      if (!_loadingPath.has(state.path)) {
        _loadingPath.add(state.path)
        store.send('_setLoading', true)

        Promise.resolve(route.lazy())
          .then(mod => {
            const comp = mod.default || mod
            _lazyCache.set(state.path, normalizeRoute(comp))
            _loadingPath.delete(state.path)
            store.send('_setLoading', false)
            // Re-render with loaded component
            store.set(s => ({ ...s }))
          })
          .catch(err => {
            _loadingPath.delete(state.path)
            store.send('_setLoading', false)
            store.send('_setError', err.message || 'Failed to load route')
            if (onError) onError(err)
          })
      }
      return { view: () => '<div>Loading...</div>', loading: true }
    }

    if (_lazyCache.has(state.path)) {
      return _lazyCache.get(state.path)
    }

    return route
  }

  /**
   * Get the layout chain for current path.
   * Returns an array of layout route defs from outermost to innermost.
   */
  function getLayouts() {
    const state = store.get()
    const layouts = []

    for (const { path, def } of layoutRoutes) {
      if (state.path.startsWith(path) || state.path === path) {
        if (def.layout) {
          layouts.push({ path, layout: def.layout })
        }
      }
    }
    return layouts
  }

  /**
   * Render current view as string with layouts applied.
   */
  function render() {
    const state = store.get()

    if (state.loading) return '<div>Loading...</div>'
    if (state.error) return `<div style="color:red">Error: ${state.error}</div>`

    const route = match()
    let content = ''

    if (typeof route.view === 'function') {
      content = route.view(state)
    } else {
      content = route.view || ''
    }

    // ── Apply layouts ───────────────────────────────────
    const layouts = getLayouts()
    for (let i = layouts.length - 1; i >= 0; i--) {
      const { layout } = layouts[i]
      if (typeof layout === 'function') {
        content = layout(state, content)
      }
    }

    return content
  }

  /**
   * Create an anchor click handler
   */
  function link(path) {
    return (e) => {
      if (e) e.preventDefault()
      store.send('navigate', path)
    }
  }

  /**
   * Get current route params
   */
  function params() {
    return store.get().params
  }

  /**
   * Check if a guard allows navigation to a path.
   * Returns false if guard blocks, true otherwise.
   */
  function canNavigate(path) {
    const current = store.get().path
    const resolved = resolveRoute(path, routeMap)
    if (resolved?.guard) {
      return resolved.guard(store.get(), path) !== false
    }
    return true
  }

  /**
   * Register a route at runtime.
   */
  function addRoute(path, def) {
    const normalized = normalizePath(path)
    routeMap[normalized] = normalizeRoute(def)
  }

  return {
    ...store,
    match,
    render,
    link,
    navigate: (path) => store.send('navigate', path),
    params,
    canNavigate,
    addRoute,
    getLayouts,
    getCurrentPath: () => store.get().path,
    getRoutes: () => ({ ...routeMap }),
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
    if (useHash) {
      return window.location.hash.replace(/^#/, '').split('?')[0] || ''
    }
    let path = window.location.pathname
    if (base && path.startsWith(base)) {
      path = path.slice(base.length)
    }
    return normalizePath(path)
  } catch (e) {
    return ''
  }
}

function parseQueryString() {
  if (typeof window === 'undefined') return {}
  try {
    const qs = window.location.search.replace(/^\?/, '')
    if (!qs) return {}
    const result = {}
    for (const part of qs.split('&')) {
      const [k, v] = part.split('=')
      if (k) result[decodeURIComponent(k)] = decodeURIComponent(v || '')
    }
    return result
  } catch (e) {
    return {}
  }
}

function resolveRoute(path, routeMap) {
  // Exact match
  if (routeMap[path]) return routeMap[path]

  // Parametric match: /users/:id
  for (const [pattern, route] of Object.entries(routeMap)) {
    if (pattern === '*') continue
    const params = matchPath(pattern, path)
    if (params !== null) {
      return { ...route, params }
    }
  }

  // Wildcard
  if (routeMap['*']) return routeMap['*']

  return null
}

function extractParams(path, routeMap) {
  for (const pattern of Object.keys(routeMap)) {
    if (pattern === '*') continue
    const params = matchPath(pattern, path)
    if (params !== null) return params
  }
  return {}
}

function matchPath(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)

  if (patternParts.length !== pathParts.length) return null

  const params = {}
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i])
    } else if (patternParts[i] !== pathParts[i]) {
      return null
    }
  }
  return params
}
