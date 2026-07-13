/**
 * Circuit Breaker — fail-fast state machine with half-open recovery.
 *
 * Protects external calls from cascading failures. Three states:
 *   CLOSED → normal operation, count failures
 *   OPEN   → all calls fail immediately with CircuitOpenError
 *   HALF_OPEN → probe with limited calls to test recovery
 *
 * @module @uploop/flows/profiles/circuitBreaker
 */

export class CircuitOpenError extends Error {
  constructor(name, failures) {
    super(`Circuit "${name}" is OPEN after ${failures} failures`)
    this.name = 'CircuitOpenError'
    this.circuitName = name
    this.failures = failures
  }
}

export function createCircuitBreaker(config = {}) {
  const {
    name = 'default',
    failureThreshold = 5,
    resetTimeout = 30000,
    halfOpenMaxCalls = 1,
    slidingWindowMs = 60000,
    fallback
  } = config

  let state = 'CLOSED' // CLOSED | OPEN | HALF_OPEN
  let failures = 0
  let openedAt = 0
  let halfOpenCalls = 0
  let successCount = 0
  let failureCount = 0
  const failureTimestamps = [] // sliding window

  function _recordFailure() {
    const now = Date.now()
    failureTimestamps.push(now)
    failureCount++

    // trim old entries outside window
    while (failureTimestamps.length > 0 && now - failureTimestamps[0] > slidingWindowMs) {
      failureTimestamps.shift()
    }
  }

  function _withinWindow() {
    const now = Date.now()
    while (failureTimestamps.length > 0 && now - failureTimestamps[0] > slidingWindowMs) {
      failureTimestamps.shift()
    }
    return failureTimestamps.length
  }

  function _transition(newState) {
    const prev = state
    state = newState
    if (newState === 'OPEN') {
      openedAt = Date.now()
      failures++
    }
    if (newState === 'CLOSED') {
      failures = 0
      failureTimestamps.length = 0
    }
    if (newState === 'HALF_OPEN') {
      halfOpenCalls = 0
    }
    return { from: prev, to: newState, ts: Date.now() }
  }

  function _checkState() {
    if (state === 'CLOSED') return true

    if (state === 'OPEN') {
      if (Date.now() - openedAt >= resetTimeout) {
        _transition('HALF_OPEN')
        // Allow the first HALF_OPEN call that triggered the transition
        return halfOpenCalls < halfOpenMaxCalls
          ? (halfOpenCalls++, true)
          : false
      }
      return false
    }

    if (state === 'HALF_OPEN') {
      if (halfOpenCalls >= halfOpenMaxCalls) return false
      halfOpenCalls++
      return true
    }

    return true
  }

  /**
   * Wrap an async function with circuit breaker protection.
   * Returns a function with identical signature.
   */
  function wrap(fn) {
    return async function (...args) {
      if (!_checkState()) {
        if (fallback) return fallback(...args)
        throw new CircuitOpenError(name, _withinWindow())
      }

      try {
        const result = await fn(...args)
        successCount++
        if (state === 'HALF_OPEN') {
          _transition('CLOSED')
        }
        return result
      } catch (e) {
        _recordFailure()
        if (state === 'CLOSED' && _withinWindow() >= failureThreshold) {
          _transition('OPEN')
        }
        if (state === 'HALF_OPEN') {
          _transition('OPEN')
        }
        throw e
      }
    }
  }

  /**
   * Execute with circuit breaker inline (no wrapping).
   */
  async function execute(fn, ...args) {
    return await wrap(fn)(...args)
  }

  /** Force circuit closed (admin override). */
  function reset() {
    _transition('CLOSED')
    return state
  }

  /** Force circuit open (admin override). */
  function forceOpen() {
    _transition('OPEN')
    return state
  }

  return {
    get name() { return name },
    get state() { return state },
    get failures() { return _withinWindow() },
    get successCount() { return successCount },
    get failureCount() { return failureCount },
    get openedAt() { return openedAt },
    get timeSinceOpen() { return state === 'OPEN' ? Date.now() - openedAt : 0 },
    wrap,
    execute,
    reset,
    forceOpen,
    _transition,
    describe() {
      return {
        kind: 'uploop.flow.profile',
        profile: 'circuitBreaker',
        name, state,
        failures: _withinWindow(),
        successCount, failureCount,
        config: { failureThreshold, resetTimeout, halfOpenMaxCalls, slidingWindowMs }
      }
    }
  }
}
