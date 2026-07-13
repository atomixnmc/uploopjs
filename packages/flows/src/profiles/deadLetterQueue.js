/**
 * Dead Letter Queue — poison message isolation with TTL, replay, and alerting.
 *
 * Failed messages (exhausted retries, unprocessable) are moved to a DLQ
 * ring buffer instead of being lost. Supports per-source isolation, TTL-based
 * expiry, threshold-based alerting, and replay back to origin.
 *
 * @module @uploop/flows/profiles/deadLetterQueue
 */

export function createDeadLetterQueue(config = {}) {
  const {
    maxSize = 5000,
    ttl = 604800000,       // 7 days
    perSource = true,
    alertThreshold = 100,   // emit alert when this many messages accumulated
    autoExpire = true
  } = config

  const sources = new Map()  // sourceKey => { messages[], alerts, totalEnqueued, totalReplayed }
  let alertHandler = null    // ({ source, count, messages }) => void

  function _getSource(key) {
    const k = perSource ? (key || '_default') : '_default'
    if (!sources.has(k)) {
      sources.set(k, {
        messages: [],
        alerts: 0,
        totalEnqueued: 0,
        totalReplayed: 0,
        totalExpired: 0
      })
    }
    return sources.get(k)
  }

  function _expireExpired(source) {
    if (!autoExpire) return
    const now = Date.now()
    let removed = 0
    source.messages = source.messages.filter(m => {
      if (now - m.ts > ttl) { removed++; source.totalExpired++; return false }
      return true
    })
    return removed
  }

  /**
   * Move a message to the DLQ.
   * @param {string} sourceKey — origin identifier
   * @param {*} message — the failed message
   * @param {Error} [error] — the error that caused failure
   * @param {object} [meta] — additional metadata
   */
  function enqueue(sourceKey, message, error, meta = {}) {
    const s = _getSource(sourceKey)
    s.totalEnqueued++

    if (s.messages.length >= maxSize) {
      // drop oldest
      s.messages.shift()
    }

    s.messages.push({
      message,
      error: error ? { name: error.name, message: error.message, stack: error.stack } : null,
      meta,
      ts: Date.now(),
      id: s.totalEnqueued
    })

    _expireExpired(s)

    // alert threshold
    if (alertHandler && s.messages.length >= alertThreshold) {
      alertHandler({
        source: sourceKey,
        count: s.messages.length,
        messages: [...s.messages]
      })
      s.alerts++
    }

    return s.messages.length
  }

  /** Get all messages for a source. */
  function peek(sourceKey) {
    const s = sources.get(perSource ? sourceKey : '_default')
    if (!s) return []
    _expireExpired(s)
    return [...s.messages]
  }

  /** Get all sources. */
  function listSources() {
    return [...sources.keys()]
  }

  /**
   * Replay messages from DLQ back to a handler.
   * Messages are removed from DLQ on successful replay.
   * Failed replays stay in DLQ.
   *
   * @param {string} sourceKey
   * @param {function} handler — async (message, envelope) => void
   * @param {object} [opts] — { batchSize, filter }
   */
  async function replay(sourceKey, handler, opts = {}) {
    const s = sources.get(perSource ? sourceKey : '_default')
    if (!s) return { replayed: 0, failed: 0 }

    _expireExpired(s)
    const { batchSize = 10, filter } = opts
    const toReplay = filter ? s.messages.filter(filter) : [...s.messages]
    let replayed = 0, failed = 0

    for (let i = 0; i < Math.min(toReplay.length, batchSize); i++) {
      const msg = toReplay[i]
      const idx = s.messages.indexOf(msg)
      try {
        await handler(msg.message, msg)
        if (idx >= 0) s.messages.splice(idx, 1)
        s.totalReplayed++
        replayed++
      } catch (e) {
        failed++
      }
    }

    return { replayed, failed }
  }

  /** Purge messages for a source. */
  function purge(sourceKey, filter) {
    const s = sources.get(perSource ? sourceKey : '_default')
    if (!s) return 0
    if (filter) {
      const before = s.messages.length
      s.messages = s.messages.filter(m => !filter(m))
      return before - s.messages.length
    }
    const count = s.messages.length
    s.messages.length = 0
    return count
  }

  /** Set alert handler. */
  function onAlert(handler) {
    alertHandler = handler
  }

  /** Get stats for all sources. */
  function stats() {
    const result = {}
    for (const [key, s] of sources) {
      result[key] = {
        queued: s.messages.length,
        totalEnqueued: s.totalEnqueued,
        totalReplayed: s.totalReplayed,
        totalExpired: s.totalExpired,
        alerts: s.alerts
      }
    }
    return result
  }

  return {
    enqueue, peek, replay, purge, listSources,
    onAlert, stats,
    get totalSize() {
      return [...sources.values()].reduce((s, src) => s + src.messages.length, 0)
    },
    describe() {
      return {
        kind: 'uploop.flow.profile',
        profile: 'deadLetterQueue',
        config: { maxSize, ttl, perSource, alertThreshold },
        sources: stats()
      }
    }
  }
}
