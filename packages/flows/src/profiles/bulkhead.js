/**
 * Bulkhead — resource isolation via semaphore-based concurrency limiting.
 *
 * Partitions resources (connections, workers, memory) by tenant, domain,
 * or operation type. Prevents one noisy neighbor from exhausting shared
 * resources. Each partition gets an independent capacity limit.
 *
 * @module @uploop/flows/profiles/bulkhead
 */

export class BulkheadFullError extends Error {
  constructor(name) {
    super(`Bulkhead "${name}" is full`)
    this.name = 'BulkheadFullError'
    this.bulkhead = name
  }
}

export function createBulkhead(config = {}) {
  const {
    name = 'default',
    maxConcurrency = 10,
    maxQueue = 50,
    perPartition = true,    // separate counters per partition key
    rejectOnFull = true,    // reject immediately when full vs queue
    timeout = 0             // max wait time in queue (0 = no limit)
  } = config

  // Per-partition state
  const partitions = new Map()

  function _getPartition(key) {
    const k = perPartition ? key : '_default'
    if (!partitions.has(k)) {
      partitions.set(k, {
        running: 0,
        queue: [],       // { resolve, reject, timer }
        totalCompleted: 0,
        totalRejected: 0,
        totalQueued: 0
      })
    }
    return partitions.get(k)
  }

  /**
   * Execute a function within the bulkhead.
   * If full: queues (if space) or rejects (if rejectOnFull).
   * @param {string} [partitionKey] — partition identifier
   * @param {function} fn — async function to execute
   */
  async function execute(partitionKey, fn) {
    // support execute(fn) without key
    if (typeof partitionKey === 'function') {
      fn = partitionKey
      partitionKey = '_default'
    }

    const p = _getPartition(partitionKey)
    const id = ++p.totalQueued

    // try to acquire
    if (p.running < maxConcurrency) {
      return _run(p, fn, id)
    }

    // need to wait
    if (p.queue.length >= maxQueue) {
      if (rejectOnFull) {
        p.totalRejected++
        throw new BulkheadFullError(`${name}:${partitionKey}`)
      }
      // drop oldest queued
      const oldest = p.queue.shift()
      if (oldest?.reject) oldest.reject(new BulkheadFullError(`${name}:${partitionKey}`))
      p.totalRejected++
    }

    return new Promise((resolve, reject) => {
      const entry = { resolve, reject, fn, id }
      p.queue.push(entry)

      if (timeout > 0) {
        entry.timer = setTimeout(() => {
          const idx = p.queue.indexOf(entry)
          if (idx >= 0) {
            p.queue.splice(idx, 1)
            p.totalRejected++
            reject(new Error(`Bulkhead queue timeout after ${timeout}ms`))
          }
        }, timeout)
      }
    })
  }

  async function _run(p, fn, id) {
    p.running++
    try {
      const result = await fn()
      p.totalCompleted++
      return result
    } finally {
      p.running--
      _drain(p)
    }
  }

  function _drain(p) {
    while (p.running < maxConcurrency && p.queue.length > 0) {
      const entry = p.queue.shift()
      if (entry.timer) clearTimeout(entry.timer)
      p.running++
      entry.fn()
        .then(r => { p.totalCompleted++; entry.resolve(r) })
        .catch(e => { p.totalRejected++; entry.reject(e) })
        .finally(() => { p.running--; _drain(p) })
    }
  }

  /**
   * Wrap a function with bulkhead protection.
   * Returns a function that accepts (partitionKey, ...args) or just (...args).
   */
  function wrap(fn) {
    return async function (...args) {
      const key = typeof args[0] === 'string' ? args.shift() : '_default'
      return execute(key, () => fn(...args))
    }
  }

  /** Get stats for a partition. */
  function stats(partitionKey) {
    const parts = partitionKey
      ? { [partitionKey]: _getPartition(partitionKey) }
      : Object.fromEntries(partitions)

    const result = {}
    for (const [k, p] of Object.entries(parts)) {
      result[k] = {
        running: p.running,
        queued: p.queue.length,
        completed: p.totalCompleted,
        rejected: p.totalRejected,
        capacity: maxConcurrency - p.running
      }
    }
    return result
  }

  /** Reset a partition. Running tasks are not interrupted. */
  function reset(partitionKey) {
    if (partitionKey) {
      const p = partitions.get(partitionKey)
      if (p) {
        for (const entry of p.queue) {
          if (entry.timer) clearTimeout(entry.timer)
          entry.reject(new Error('Bulkhead reset'))
        }
        p.queue.length = 0
      }
    } else {
      for (const [k, p] of partitions) reset(k)
    }
  }

  return {
    execute, wrap, stats, reset,
    get name() { return name },
    describe() {
      return {
        kind: 'uploop.flow.profile',
        profile: 'bulkhead',
        name, maxConcurrency, maxQueue, perPartition,
        partitions: stats()
      }
    }
  }
}
