/**
 * Idempotency Guard — key-based deduplication with response replay.
 *
 * Ensures at-most-once semantics for critical operations (payments,
 * order submission, account creation). Caches responses by idempotency key.
 * Duplicate requests receive the cached response instead of re-executing.
 *
 * @module @uploop/flows/profiles/idempotencyGuard
 */

export function createIdempotencyGuard(config = {}) {
  const {
    ttl = 86400000,          // 24h default — how long keys are remembered
    maxEntries = 100000,     // max cached responses
    keyFn = null,            // (payload) => string
    headerKey = 'idempotency-key'  // fallback header name
  } = config

  const cache = new Map()    // key => { response, at, error }

  let hits = 0
  let misses = 0
  let replays = 0

  function _evictOld() {
    const now = Date.now()
    for (const [key, entry] of cache) {
      if (now - entry.at > ttl) cache.delete(key)
    }
  }

  function _evictLRU() {
    if (cache.size <= maxEntries) return
    // find oldest
    let oldest = null
    for (const [key, entry] of cache) {
      if (!oldest || entry.at < oldest.at) oldest = { key, at: entry.at }
    }
    if (oldest) cache.delete(oldest.key)
  }

  /**
   * Execute an operation with idempotency protection.
   *
   * @param {string|object} keyOrPayload — idempotency key, or payload with key
   * @param {function} fn — async function to execute. Only called on first request.
   * @returns {{ result, replayed }} — result and whether it was a replay
   */
  async function execute(keyOrPayload, fn) {
    // support execute(fn) without explicit key (uses header/auto)
    if (typeof keyOrPayload === 'function') {
      fn = keyOrPayload
      keyOrPayload = undefined
    }

    let key
    if (typeof keyOrPayload === 'string') {
      key = keyOrPayload
    } else if (keyFn) {
      key = keyFn(keyOrPayload)
    } else if (keyOrPayload?.[headerKey]) {
      key = keyOrPayload[headerKey]
    } else {
      // auto-generate from payload hash
      key = _hash(JSON.stringify(keyOrPayload || ''))
    }

    // periodic cleanup
    if (misses % 1000 === 0) _evictOld()

    // check cache
    const cached = cache.get(key)
    if (cached) {
      hits++
      replays++
      if (cached.error) throw cached.error
      return { result: cached.response, replayed: true }
    }

    misses++
    _evictLRU()

    try {
      const result = await fn()
      cache.set(key, { response: result, at: Date.now() })
      return { result, replayed: false }
    } catch (err) {
      // cache errors too (prevents retry-without-idempotency issues)
      cache.set(key, { error: err, at: Date.now() })
      throw err
    }
  }

  /** Wrap a function with idempotency. Pass key as first argument. */
  function wrap(fn) {
    return async function (key, ...args) {
      const { result } = await execute(key, () => fn(...args))
      return result
    }
  }

  /** Check if a key has already been processed. */
  function wasProcessed(key) {
    return cache.has(key)
  }

  /** Get cached response for a key. */
  function getCached(key) {
    const entry = cache.get(key)
    if (!entry) return undefined
    if (entry.error) throw entry.error
    return entry.response
  }

  /** Manually set a cache entry (e.g., for pre-warming). */
  function set(key, response) {
    cache.set(key, { response, at: Date.now() })
    _evictLRU()
  }

  /** Clear all cached keys. */
  function reset() {
    cache.clear()
    hits = 0; misses = 0; replays = 0
  }

  return {
    execute, wrap, wasProcessed, getCached, set, reset,
    get stats() {
      return {
        cacheSize: cache.size,
        hits, misses, replays,
        hitRate: (hits + misses) > 0 ? hits / (hits + misses) : 0
      }
    },
    describe() {
      return {
        kind: 'uploop.flow.profile',
        profile: 'idempotencyGuard',
        config: { ttl, maxEntries },
        ...this.stats
      }
    }
  }
}

function _hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return 'ik_' + Math.abs(h).toString(36)
}
