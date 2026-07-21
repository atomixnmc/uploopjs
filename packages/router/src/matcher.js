/**
 * Pattern matching engine — exact, parametric, wildcard, regex.
 *
 *   import { createMatcher, matchPattern, rankPatterns } from '@uploop/router'
 *
 *   const m = createMatcher()
 *   m.add('users/:id', handler1)
 *   m.add('users/:id/posts/*', handler2)
 *   const { handler, params, pattern } = m.match('users/42/posts/recent')
 */

/**
 * Normalize a path pattern.
 * Strips leading/trailing slashes, collapses runs.
 *
 * @param {string} path
 * @returns {string}
 */
export function normalizePath(path) {
  return (path || '').replace(/\/+/g, '/').replace(/^\/+/, '').replace(/\/+$/, '') || ''
}

/**
 * Parse a pattern string into segments for matching.
 *
 * @param {string} pattern — e.g. 'users/:id/posts/*'
 * @returns {Object[]} segments — [{ type, name?, regex? }]
 */
export function parsePattern(pattern) {
  const raw = normalizePath(pattern)
  if (!raw) return []

  return raw.split('/').map(seg => {
    // Globstar: ** (multi-segment)
    if (seg === '**') return { type: 'globstar' }
    // Single-segment wildcard
    if (seg === '*') return { type: 'wildcard', name: '*' }

    // Prefix wildcard: payment:* or file-*
    if (seg.endsWith('*') && seg.length > 1) {
      return { type: 'prefix-wildcard', prefix: seg.slice(0, -1) }
    }

    // Param with regex constraint: :id(\d+)
    const regexParam = seg.match(/^:(\w+)\((.+)\)$/)
    if (regexParam) {
      return { type: 'param', name: regexParam[1], regex: new RegExp('^' + regexParam[2] + '$') }
    }

    // Optional param: :id?
    const optParam = seg.match(/^:(\w+)\?$/)
    if (optParam) {
      return { type: 'optional', name: optParam[1] }
    }

    // Standard param: :id
    if (seg.startsWith(':')) {
      return { type: 'param', name: seg.slice(1) }
    }

    // Static segment
    return { type: 'static', value: seg }
  })
}

/**
 * Try to match a concrete path against a parsed pattern.
 *
 * @param {Object[]} patternSegs — from parsePattern()
 * @param {string} path — concrete path to match
 * @returns {Object|null} { params } if match, null otherwise
 */
export function matchSegments(patternSegs, path) {
  const pp = path.split('/').filter(Boolean)
  const ps = patternSegs
  const params = {}

  let pi = 0, si = 0

  while (pi < ps.length && si < pp.length) {
    const seg = ps[pi]

    switch (seg.type) {
      case 'static':
        if (seg.value !== decodeURIComponent(pp[si])) return null
        pi++; si++
        break

      case 'param':
        if (seg.regex && !seg.regex.test(decodeURIComponent(pp[si]))) return null
        params[seg.name] = decodeURIComponent(pp[si])
        pi++; si++
        break

      case 'optional':
        // Try to match as a value; if the remaining segments don't match
        // as static, treat this as the param value
        params[seg.name] = decodeURIComponent(pp[si])
        pi++; si++
        break

      case 'wildcard':
        // * matches exactly one segment
        params['*'] = decodeURIComponent(pp[si])
        pi++; si++
        break

      case 'prefix-wildcard':
        // prefix* matches any segment starting with prefix
        if (!decodeURIComponent(pp[si]).startsWith(seg.prefix)) return null
        params['*'] = params['*'] || decodeURIComponent(pp[si])
        pi++; si++
        break

      case 'globstar':
        // ** matches zero or more segments
        const remaining = ps.slice(pi + 1)
        if (remaining.length === 0) {
          // ** at end — consume rest (or zero if exhausted)
          if (si < pp.length) {
            params['**'] = pp.slice(si).map(decodeURIComponent).join('/')
            si = pp.length
          } else {
            params['**'] = ''
          }
          pi++
          break
        }
        // Find the next static segment in remaining path
        let bestMatch = -1
        for (let j = si; j <= pp.length - remaining.length; j++) {
          const match = tryStaticPrefix(remaining, pp.slice(j))
          if (match) {
            bestMatch = j
            break
          }
        }
        if (bestMatch < 0) return null
        params['**'] = pp.slice(si, bestMatch).map(decodeURIComponent).join('/')
        si = bestMatch
        pi++
        // Continue matching remaining segments
        while (pi < ps.length && si < pp.length) {
          const s2 = ps[pi]
          if (s2.type === 'static') {
            if (s2.value !== decodeURIComponent(pp[si])) return null
            pi++; si++
          } else if (s2.type === 'param') {
            if (s2.regex && !s2.regex.test(decodeURIComponent(pp[si]))) return null
            params[s2.name] = decodeURIComponent(pp[si])
            pi++; si++
          } else if (s2.type === 'wildcard') {
            params['*'] = decodeURIComponent(pp[si])
            pi++; si++
          } else {
            pi++
          }
        }
        break
    }
  }

  // Handle remaining optional and globstar segments (consume zero path segments)
  while (pi < ps.length && (ps[pi].type === 'optional' || ps[pi].type === 'globstar')) {
    if (ps[pi].type === 'globstar') {
      params['**'] = (params['**'] || '') // preserve if already set, else ''
    }
    pi++
  }

  if (pi === ps.length && si === pp.length) return { params }
  return null
}

function tryStaticPrefix(segs, pathParts) {
  if (segs.length > pathParts.length) return false
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].type === 'static' && segs[i].value !== decodeURIComponent(pathParts[i])) {
      return false
    }
  }
  return true
}

/**
 * Create a pattern matcher that stores handler → pattern mappings
 * and matches paths to the best handler.
 *
 * @returns {Object} matcher
 */
export function createMatcher() {
  const routes = []

  return {
    /**
     * Add a route pattern with handler.
     *
     * @param {string} pattern — e.g. 'users/:id'
     * @param {*} handler — route definition, view, or handler
     */
    add(pattern, handler) {
      const segs = parsePattern(pattern)
      routes.push({ pattern, segs, handler, raw: pattern })
    },

    /**
     * Remove a route by its exact pattern string.
     * @param {string} pattern
     */
    remove(pattern) {
      const idx = routes.findIndex(r => r.raw === pattern)
      if (idx >= 0) routes.splice(idx, 1)
    },

    /**
     * Match a path against all registered routes.
     * Returns the best (most specific) match.
     *
     * Priority:
     *   1. Exact static match
     *   2. Most static segments
     *   3. Fewer wildcards/params
     *
     * @param {string} path
     * @returns {{ handler: *, params: Object, pattern: string }|null}
     */
    match(path) {
      const clean = normalizePath(path)
      let best = null
      let bestScore = -1

      for (const route of routes) {
        // Exact match (no params, no wildcards) — highest priority
        if (!route.segs.some(s => s.type !== 'static')) {
          const flat = route.segs.map(s => s.value).join('/')
          if (flat === clean) {
            return { handler: route.handler, params: {}, pattern: route.raw }
          }
        }

        const result = matchSegments(route.segs, clean)
        if (result) {
          const score = scoreMatch(route.segs)
          if (score > bestScore) {
            bestScore = score
            best = { handler: route.handler, params: result.params, pattern: route.raw }
          }
        }
      }

      return best
    },

    /**
     * List all registered routes.
     */
    list() {
      return routes.map(r => ({ pattern: r.raw, handler: typeof r.handler === 'function' ? '[Function]' : r.handler }))
    },

    /**
     * Number of registered routes.
     */
    get size() { return routes.length }
  }
}

/**
 * Score a pattern by specificity.
 * Higher = more specific (static > param > wildcard).
 *
 * @param {Object[]} segs
 * @returns {number}
 */
function scoreMatch(segs) {
  let score = segs.length * 100
  for (const seg of segs) {
    if (seg.type === 'static') score += 10
    else if (seg.type === 'param') score += 5
    else if (seg.type === 'regex') score += 7
    else if (seg.type === 'optional') score += 3
    else if (seg.type === 'wildcard' || seg.type === 'globstar') score += 0
  }
  return score
}

/**
 * Check if a path matches a pattern (no wildcard/globstar).
 * For use in incremental matching (SSR path scanning).
 *
 * @param {string} pattern
 * @param {string} path
 * @returns {Object|null} params or null
 */
export function matchPath(pattern, path) {
  const pp = parsePattern(pattern)
  if (pp.some(s => s.type === 'globstar')) {
    // Use full matchSegments for globstar
    return matchSegments(pp, path)
  }

  const pp1 = normalizePath(pattern).split('/').filter(Boolean)
  const up1 = normalizePath(path).split('/').filter(Boolean)
  if (pp1.length !== up1.length) return null

  const params = {}
  for (let i = 0; i < pp1.length; i++) {
    if (pp1[i].startsWith(':')) {
      const name = pp1[i].match(/^:(\w+)/)
      if (name) params[name[1]] = decodeURIComponent(up1[i])
    } else if (pp1[i] !== '*' && pp1[i] !== '**' && pp1[i] !== decodeURIComponent(up1[i])) {
      return null
    }
  }
  return params
}

/**
 * Rank multiple patterns by specificity (for sorting).
 * @param {string[]} patterns
 * @returns {string[]} sorted patterns (most specific first)
 */
export function rankPatterns(patterns) {
  return [...patterns].sort((a, b) => scoreMatch(parsePattern(b)) - scoreMatch(parsePattern(a)))
}
