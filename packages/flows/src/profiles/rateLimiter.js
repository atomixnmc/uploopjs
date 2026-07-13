/**
 * Rate Limiter — token bucket, sliding window, and fixed window algorithms.
 *
 * Controls throughput for API gateways, login protection, cost control.
 * Supports per-key rate limiting with configurable burst allowance.
 *
 * @module @uploop/flows/profiles/rateLimiter
 */

export function createRateLimiter(config = {}) {
  const {
    algorithm = 'token-bucket',
    rate = 100,         // tokens per windowMs
    windowMs = 1000,    // refill window
    burst = 20,         // max burst above rate
    perKey = true,
    keyPrefix = 'rl'
  } = config

  // Shared store for per-key state
  const stores = new Map()

  function _getStore(key) {
    if (!stores.has(key)) {
      stores.set(key, {
        tokens: rate + burst,
        lastRefill: Date.now(),
        windowLog: [] // for sliding-window
      })
    }
    return stores.get(key)
  }

  // ── Token Bucket ──
  function _tokenBucket(key) {
    const s = _getStore(key)
    const now = Date.now()
    const elapsed = now - s.lastRefill

    // refill tokens
    const refill = Math.floor(elapsed / windowMs * rate)
    s.tokens = Math.min(s.tokens + refill, rate + burst)
    if (refill > 0) s.lastRefill = now

    if (s.tokens >= 1) {
      s.tokens--
      return true
    }
    return false
  }

  // ── Sliding Window ──
  function _slidingWindow(key) {
    const s = _getStore(key)
    const now = Date.now()
    const threshold = now - windowMs

    // remove expired entries
    while (s.windowLog.length > 0 && s.windowLog[0] < threshold) {
      s.windowLog.shift()
    }

    if (s.windowLog.length < rate) {
      s.windowLog.push(now)
      return true
    }
    return false
  }

  // ── Fixed Window ──
  function _fixedWindow(key) {
    const s = _getStore(key)
    const now = Date.now()
    const windowKey = Math.floor(now / windowMs)

    if (s._currentWindow !== windowKey) {
      s._currentWindow = windowKey
      s._windowCount = 0
    }

    s._windowCount = (s._windowCount || 0) + 1
    return s._windowCount <= rate
  }

  const algos = { 'token-bucket': _tokenBucket, 'sliding-window': _slidingWindow, 'fixed-window': _fixedWindow }
  const check = algos[algorithm] || _tokenBucket

  /**
   * Try to acquire a token. Returns { allowed, remaining, resetInMs }.
   */
  function tryAcquire(key = '_default') {
    const k = perKey ? `${keyPrefix}:${key}` : '_default'
    const allowed = check(k)
    const s = _getStore(k)
    return {
      allowed,
      remaining: algorithm === 'token-bucket' ? s.tokens : (
        algorithm === 'sliding-window'
          ? Math.max(0, rate - s.windowLog.length)
          : Math.max(0, rate - (s._windowCount || 0))
      ),
      resetInMs: algorithm === 'token-bucket'
        ? Math.max(0, windowMs - (Date.now() - s.lastRefill))
        : (s.windowLog.length > 0 ? Math.max(0, windowMs - (Date.now() - s.windowLog[0])) : windowMs)
    }
  }

  /** Check if allowed (boolean shortcut). */
  function isAllowed(key) {
    return tryAcquire(key).allowed
  }

  /** Wrap a function: calls are rate-limited, rejects with RateLimitError. */
  function wrap(fn) {
    return async function (...args) {
      const key = args[0]?.userId || args[0]?.ip || '_default'
      const { allowed, remaining, resetInMs } = tryAcquire(key)
      if (!allowed) {
        const err = new Error('Rate limit exceeded')
        err.name = 'RateLimitError'
        err.remaining = remaining
        err.resetInMs = resetInMs
        throw err
      }
      return fn(...args)
    }
  }

  /** Reset all state for a key. */
  function reset(key) {
    stores.delete(perKey ? `${keyPrefix}:${key}` : '_default')
  }

  /** Get current stats for a key. */
  function stats(key = '_default') {
    const s = _getStore(perKey ? `${keyPrefix}:${key}` : '_default')
    return { ...tryAcquire(key), ...s, size: stores.size }
  }

  /** Clean expired stores (call periodically for per-key mode). */
  function gc(maxAge = 300000) {
    const now = Date.now()
    for (const [k, s] of stores) {
      if (now - s.lastRefill > maxAge) stores.delete(k)
    }
  }

  const instance = { tryAcquire, isAllowed, wrap, reset, stats, gc,
    describe() {
      return { kind: 'uploop.flow.profile', profile: 'rateLimiter', algorithm, rate, windowMs, burst, perKey, activeKeys: stores.size }
    }
  }

  if (perKey) {
    setInterval(gc, 60000).unref?.()
  }

  return instance
}
