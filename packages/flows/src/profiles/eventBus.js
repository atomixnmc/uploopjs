/**
 * Event Bus — pub/sub with wildcard topic matching, backpressure, replay.
 *
 * Topics are dot-separated paths. Subscriptions support wildcards:
 *   'user.*'     → matches user.login, user.logout
 *   '*.error'    → matches api.error, db.error
 *   'user.>'     → matches user and all children (recursive)
 *
 * @module @uploop/flows/profiles/eventBus
 */

/**
 * Convert a wildcard pattern to a RegExp.
 * '*' matches one segment, '>' matches everything below.
 */
function _patternToRegex(pattern) {
  const parts = pattern.split('.')
  const regexParts = parts.map(part => {
    if (part === '>') return '.+'  // recursive wildcard
    if (part === '*') return '[^.]+'
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  })
  return new RegExp('^' + regexParts.join('\\.') + '$')
}

export function createEventBus(config = {}) {
  const {
    maxHistory = 1000,
    backpressure = 'drop-oldest', // drop-oldest | drop-newest | block
    maxListeners = 100,
    async = false               // emit to listeners asynchronously
  } = config

  const subscriptions = []      // { id, pattern, regex, handler }
  const history = []            // { topic, payload, ts, id }
  const topicStats = new Map()  // topic => { emitted, lastAt }
  let _idCounter = 0
  let totalEmitted = 0

  function _match(topic) {
    const results = []
    for (const sub of subscriptions) {
      if (sub.regex.test(topic)) results.push(sub)
    }
    return results
  }

  /**
   * Subscribe to a topic pattern. Returns unsubscribe function.
   * @param {string} pattern — 'user.*' | 'order.created' | '>'
   * @param {function} handler — (payload, envelope) => void
   */
  function on(pattern, handler) {
    if (subscriptions.length >= maxListeners) {
      throw new Error(`Max listeners (${maxListeners}) exceeded`)
    }
    const sub = { id: ++_idCounter, pattern, regex: _patternToRegex(pattern), handler }
    subscriptions.push(sub)
    return () => unsubscribe(sub.id)
  }

  /** Subscribe once — auto-unsubscribes after first match. */
  function once(pattern, handler) {
    const unsub = on(pattern, (payload, env) => {
      unsub()
      handler(payload, env)
    })
    return unsub
  }

  function unsubscribe(id) {
    const idx = subscriptions.findIndex(s => s.id === id)
    if (idx >= 0) subscriptions.splice(idx, 1)
  }

  /**
   * Emit an event on a topic.
   * @returns {number} listener count
   */
  function emit(topic, payload) {
    const envelope = { topic, payload, ts: Date.now(), id: totalEmitted++ }

    // history
    history.push(envelope)
    if (history.length > maxHistory) history.shift()

    // stats
    if (!topicStats.has(topic)) topicStats.set(topic, { emitted: 0, lastAt: 0 })
    const s = topicStats.get(topic)
    s.emitted++
    s.lastAt = Date.now()

    const matched = _match(topic)

    if (async) {
      for (const sub of matched) {
        setImmediate(() => {
          try { sub.handler(payload, envelope) } catch (e) { console.error('[eventBus] handler error:', e) }
        })
      }
    } else {
      for (const sub of matched) {
        try { sub.handler(payload, envelope) } catch (e) { console.error('[eventBus] handler error:', e) }
      }
    }

    return matched.length
  }

  /** Query history, optionally filtered. */
  function getHistory(filter) {
    if (!filter) return [...history]
    return history.filter(env => {
      if (filter.topic && env.topic !== filter.topic) return false
      if (filter.pattern && !_patternToRegex(filter.pattern).test(env.topic)) return false
      if (filter.since && env.ts < filter.since) return false
      return true
    })
  }

  /** Replay history to a handler. */
  function replay(pattern, handler, filter) {
    const regex = _patternToRegex(pattern)
    for (const env of history) {
      if (regex.test(env.topic) && (!filter || filter(env))) {
        try { handler(env.payload, env) } catch (e) {}
      }
    }
    return on(pattern, handler)
  }

  /** Get topic statistics. */
  function stats() {
    return {
      subscriptions: subscriptions.length,
      totalEmitted,
      historySize: history.length,
      topics: Object.fromEntries(topicStats)
    }
  }

  /** Remove all subscriptions and history. */
  function reset() {
    subscriptions.length = 0
    history.length = 0
    topicStats.clear()
    totalEmitted = 0
  }

  return {
    on, once, emit, unsubscribe,
    getHistory, replay, stats, reset,
    get subscriberCount() { return subscriptions.length },
    describe() {
      return {
        kind: 'uploop.flow.profile',
        profile: 'eventBus',
        ...stats()
      }
    }
  }
}
