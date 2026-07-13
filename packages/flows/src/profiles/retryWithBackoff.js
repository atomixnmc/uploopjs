/**
 * Retry with Backoff — exponential, linear, or fixed backoff with jitter.
 *
 * Handles transient failures (network flakiness, eventual consistency,
 * rate limits) by retrying with configurable delay strategies.
 *
 * @module @uploop/flows/profiles/retryWithBackoff
 */

export class MaxRetriesExceededError extends Error {
  constructor(attempts, lastError) {
    super(`Retry exhausted after ${attempts} attempts: ${lastError?.message || 'unknown'}`)
    this.name = 'MaxRetriesExceededError'
    this.attempts = attempts
    this.lastError = lastError
  }
}

export function createRetryWithBackoff(config = {}) {
  const {
    max = 3,
    backoff = 'exponential', // exponential | linear | fixed
    initialMs = 100,
    maxMs = 30000,           // max delay cap
    jitter = true,           // add randomness to avoid thundering herd
    maxElapsedMs = 0,        // 0 = no limit
    retryable = null         // (err) => boolean — custom predicate
  } = config

  const stats = {
    attempts: 0,
    successes: 0,
    failures: 0,
    totalRetries: 0
  }

  /**
   * Calculate delay for attempt N (1-based).
   */
  function _delay(attempt) {
    let ms
    switch (backoff) {
      case 'exponential':
        ms = initialMs * Math.pow(2, attempt - 1)
        break
      case 'linear':
        ms = initialMs * attempt
        break
      case 'fixed':
      default:
        ms = initialMs
    }
    ms = Math.min(ms, maxMs)

    if (jitter) {
      // full jitter: random between 0 and ms
      ms = Math.random() * ms
    }

    return Math.floor(ms)
  }

  /**
   * Check if an error is retryable.
   * Default: retry on transient errors (429, 5xx, network errors).
   */
  function _isRetryable(err) {
    if (retryable) return retryable(err)
    if (err?.status === 429) return true
    if (err?.status && err.status >= 500 && err.status < 600) return true
    if (err?.code === 'ECONNRESET' || err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT') return true
    if (err?.name === 'AbortError') return false
    if (err?.name === 'RateLimitError') return true
    if (err?.name === 'CircuitOpenError') return false
    // unknown errors: retry once
    return true
  }

  /**
   * Execute fn with retries. fn receives (attempt, totalAttempts).
   * Returns { result, attempts, totalTimeMs } on success.
   * Throws MaxRetriesExceededError if all attempts fail.
   */
  async function execute(fn) {
    const startedAt = Date.now()
    let lastError

    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        const result = await fn(attempt, max)
        stats.successes++
        stats.attempts++
        return {
          result,
          attempts: attempt,
          totalTimeMs: Date.now() - startedAt
        }
      } catch (err) {
        lastError = err
        stats.attempts++

        if (attempt >= max) break

        if (!_isRetryable(err)) {
          stats.failures++
          throw err
        }

        if (maxElapsedMs > 0 && (Date.now() - startedAt) >= maxElapsedMs) {
          stats.failures++
          throw new MaxRetriesExceededError(attempt, err)
        }

        const delay = _delay(attempt)
        stats.totalRetries++
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    stats.failures++
    throw new MaxRetriesExceededError(max, lastError)
  }

  /**
   * Wrap an async function with retry.
   */
  function wrap(fn) {
    return async function (...args) {
      const { result } = await execute(() => fn(...args))
      return result
    }
  }

  /**
   * Execute fn with retry, calling onRetry callback between attempts.
   */
  async function executeWithHook(fn, onRetry) {
    return execute(fn, async (attempt, err, delay) => {
      if (onRetry) await onRetry(attempt, err, delay)
    })
  }

  return {
    execute,
    wrap,
    executeWithHook,
    get stats() { return { ...stats } },
    _delay,
    _isRetryable,
    describe() {
      return {
        kind: 'uploop.flow.profile',
        profile: 'retryWithBackoff',
        config: { max, backoff, initialMs, maxMs, jitter, maxElapsedMs },
        ...stats
      }
    }
  }
}
