import { createLoop } from '@uploop/core'

/**
 * Create an Uploop router as a HyperGraph store.
 *
 * Routes are data nodes — navigation is just an update handler.
 * This means route changes flow through the same frame scheduler
 * as any other state change.
 *
 * @param {Object} routes - Route definitions { path: component }
 * @param {Object} [options]
 * @param {string} [options.base=''] - Base path
 * @param {boolean} [options.useHash=false] - Use hash-based routing
 * @returns {Object} Router
 */
export function createRouter(routes = {}, options = {}) {
  const { base = '', useHash = false } = options

  // Normalize routes: path → component map
  const routeMap = {}
  for (const [path, def] of Object.entries(routes)) {
    const normalized = normalizePath(path)
    routeMap[normalized] = typeof def === 'function' ? { view: def } : def
  }

  // Default routes
  const notFound = routeMap['*'] || { view: () => '<h2>404 Not Found</h2>' }
  const index = routeMap[''] || routeMap['/'] || { view: () => '<h2>Welcome</h2>' }

  const currentPath = getCurrentPath(base, useHash)

  const store = createLoop({
    name: 'router',
    state: {
      path: currentPath,
      params: {},
      query: parseQueryString(),
      hash: (typeof window !== 'undefined') ? (window.location.hash || '') : ''
    },
    update: {
      /** Navigate to a path */
      navigate: (s, path) => {
        const cleanPath = path.replace(/^\/+/, '')
        if (typeof window !== 'undefined') {
          const fullPath = useHash ? `#${cleanPath}` : `/${base}${cleanPath}`
          window.history.pushState({}, '', fullPath)
        }
        return {
          path: cleanPath,
          params: extractParams(cleanPath, routeMap),
          query: (typeof window !== 'undefined') ? parseQueryString() : {},
          hash: (typeof window !== 'undefined') ? (window.location.hash || '') : ''
        }
      },
      /** Update search params */
      setQuery: (s, query) => {
        if (typeof window !== 'undefined') {
          const qs = new URLSearchParams(query).toString()
          const newUrl = useHash
            ? `#${s.path}${qs ? '?' + qs : ''}`
            : `${base}${s.path}${qs ? '?' + qs : ''}`
          window.history.replaceState({}, '', newUrl)
        }
        return { ...s, query }
      }
    }
  })

  // Listen to popstate (browser back/forward)
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      store.send('navigate', getCurrentPath(base, useHash))
    })
  }

  /**
   * Get the matched route component for current path
   */
  function match() {
    const state = store.get()
    const route = resolveRoute(state.path, routeMap)
    return route || notFound
  }

  /**
   * Render current view as string
   */
  function render() {
    const route = match()
    if (typeof route.view === 'function') {
      return route.view(store.get())
    }
    return route.view || ''
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
   * Get current query params
   */
  function query() {
    return store.get().query
  }

  return {
    ...store,
    match,
    render,
    link,
    navigate: (path) => store.send('navigate', path),
    params,
    query,
    getCurrentPath: () => store.get().path,
    getRoutes: () => ({ ...routeMap })
  }
}

// ─── Helpers ────────────────────────────────────────────────

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
      result[decodeURIComponent(k)] = decodeURIComponent(v || '')
    }
    return result
  } catch (e) {
    return {}
  }
}

function resolveRoute(path, routeMap) {
  // Exact match
  if (routeMap[path]) return routeMap[path]

  // Parametric match: /products/:id
  for (const [pattern, route] of Object.entries(routeMap)) {
    const params = matchPath(pattern, path)
    if (params !== null) {
      return { ...route, params }
    }
  }

  return null
}

function extractParams(path, routeMap) {
  for (const pattern of Object.keys(routeMap)) {
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
