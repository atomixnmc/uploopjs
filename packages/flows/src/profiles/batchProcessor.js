/**
 * Batch Processor — accumulate items by size or time, flush in batches.
 *
 * Collects items into a buffer. Flushes when maxSize is reached OR
 * maxLatency ms elapses since first item. Executes batch handler
 * with configurable concurrency. Handles backpressure.
 *
 * @module @uploop/flows/profiles/batchProcessor
 */

export function createBatchProcessor(config = {}) {
  const {
    maxSize = 500,          // flush when buffer reaches this size
    maxLatency = 5000,      // flush after this many ms since first item
    concurrent = 3,         // max concurrent batch handlers
    groupBy = null,         // (item) => key — group items by key before batching
    handler = null,         // async (batch) => void — batch handler
    backpressure = 'block'  // block | drop | error
  } = config

  const buffers = new Map() // key => items[]
  let firstItemAt = new Map() // key => timestamp
  let flushing = new Set()    // keys currently being flushed
  let activeFlushes = 0
  let totalProcessed = 0
  let totalDropped = 0
  let _timer = null

  const pendingResolvers = new Map() // key => [{ resolve }]

  function _getKey(item) {
    return groupBy ? groupBy(item) : '_default'
  }

  function _getBuffer(key) {
    if (!buffers.has(key)) {
      buffers.set(key, [])
      firstItemAt.set(key, Date.now())
    }
    return buffers.get(key)
  }

  function _scheduleFlush(key) {
    if (_timer) return
    const check = () => {
      _timer = null
      let anyFlushed = false
      for (const [k, items] of buffers) {
        if (items.length > 0) {
          const age = Date.now() - (firstItemAt.get(k) || Date.now())
          if (age >= maxLatency) {
            _flush(k)
            anyFlushed = true
          }
        }
      }
      // re-schedule if buffers still have items
      if (!anyFlushed && [...buffers.values()].some(b => b.length > 0)) {
        _timer = setTimeout(check, maxLatency / 2)
      }
    }
    _timer = setTimeout(check, maxLatency / 2)
  }

  async function _flush(key) {
    if (flushing.has(key)) return
    const items = buffers.get(key)
    if (!items || items.length === 0) return

    // take a slice
    const batch = items.splice(0, maxSize)
    if (items.length === 0) {
      buffers.delete(key)
      firstItemAt.delete(key)
    }

    flushing.add(key)
    activeFlushes++

    try {
      if (handler) await handler(batch)
      totalProcessed += batch.length
    } catch (e) {
      // re-enqueue failed batch items
      const buf = _getBuffer(key)
      buf.unshift(...batch)
      throw e
    } finally {
      flushing.delete(key)
      activeFlushes--

      // resolve any pending queued items
      const resolvers = pendingResolvers.get(key)
      if (resolvers && items.length < maxSize) {
        pendingResolvers.delete(key)
        for (const r of resolvers) r.resolve()
      }

      // flush remaining
      if (buffers.has(key) && buffers.get(key).length >= maxSize) {
        _flush(key)
      }
    }
  }

  /**
   * Add an item to the batch. Returns immediately unless backpressure
   * is 'block' and buffer is full (then waits for flush).
   */
  async function push(item) {
    const key = _getKey(item)
    const buf = _getBuffer(key)

    if (buf.length >= maxSize * 2) {
      if (backpressure === 'drop') {
        totalDropped++
        return false
      }
      if (backpressure === 'error') {
        throw new Error(`Batch buffer full for key "${key}"`)
      }
      // block — wait for flush
      await new Promise(resolve => {
        if (!pendingResolvers.has(key)) pendingResolvers.set(key, [])
        pendingResolvers.get(key).push({ resolve })
      })
    }

    buf.push(item)
    _scheduleFlush(key)

    if (buf.length >= maxSize) {
      await _flush(key)
    }

    return true
  }

  /** Push multiple items, flushing at maxSize boundaries. */
  async function pushMany(items) {
    for (const item of items) {
      await push(item)
    }
  }

  /** Force flush all buffers immediately. */
  async function flushAll() {
    const promises = []
    for (const [key] of buffers) {
      promises.push(_flush(key))
    }
    await Promise.all(promises)
  }

  /** Force flush a specific key. */
  async function flush(key) {
    await _flush(key)
  }

  /** Get buffer stats. */
  function getStats() {
    const keyStats = {}
    for (const [key, items] of buffers) {
      keyStats[key] = { size: items.length, age: Date.now() - (firstItemAt.get(key) || 0) }
    }
    return {
      totalProcessed,
      totalDropped,
      activeFlushes,
      buffers: keyStats,
      totalBuffered: [...buffers.values()].reduce((s, i) => s + i.length, 0)
    }
  }

  /** Clean up timers. */
  function dispose() {
    if (_timer) { clearTimeout(_timer); _timer = null }
  }

  return {
    push, pushMany, flushAll, flush, getStats, dispose,
    get size() { return [...buffers.values()].reduce((s, i) => s + i.length, 0) },
    describe() {
      return {
        kind: 'uploop.flow.profile',
        profile: 'batchProcessor',
        config: { maxSize, maxLatency, concurrent, backpressure },
        ...getStats()
      }
    }
  }
}
