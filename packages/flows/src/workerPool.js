/**
 * Worker Pool — CPU-bound task offloading with work-stealing.
 *
 * Manages a pool of Web Workers (browser) or worker_threads (Node.js).
 * Tasks are distributed across workers with load balancing.
 * Supports Transferable objects for zero-copy data transfer.
 *
 * ## Limitations (v0.3.0 — JavaScript runtime)
 *
 * - Worker startup: ~50-100ms per worker. Pool pre-warms but first task
 *   still pays the startup cost if pool was just created.
 * - Message passing: structured clone for objects, transfer for ArrayBuffers.
 *   No shared memory (except SharedArrayBuffer + Atomics).
 * - No CPU affinity: Cannot pin workers to specific cores in JS.
 * - Error propagation: worker crashes lose in-flight tasks. Pool detects
 *   dead workers and replaces them, but the task needs retry.
 *
 * **Long (v1.0)**: OS thread pool with shared memory, zero-copy, core pinning,
 * sub-ms dispatch. Worker pool becomes a thin wrapper over native threads.
 *
 * @module @uploop/flows/workerPool
 */

const _hasWorkers = typeof Worker !== 'undefined'

/**
 * Create a worker pool for CPU-bound task execution.
 *
 * @param {object} config
 * @param {number} [config.size] — pool size (default: navigator.hardwareConcurrency - 1 or 4)
 * @param {string|URL} [config.workerUrl] — URL to worker script (browser only)
 * @param {function} [config.workerFactory] — factory for Node.js worker_threads
 * @param {number} [config.taskTimeout] — max task execution time (ms). 0 = no limit.
 * @param {boolean} [config.transferResult] — auto-transfer ArrayBuffers in results
 */
export function createWorkerPool(config = {}) {
  const {
    size = (typeof navigator !== 'undefined' ? Math.max(1, (navigator.hardwareConcurrency || 4) - 1) : 4),
    workerUrl,
    workerFactory,
    taskTimeout = 0,
    transferResult = true
  } = config

  const workers = []
  const taskQueue = []   // { id, data, transfer, resolve, reject }
  const busy = new Set() // worker indices currently executing
  let _idCounter = 0
  let _disposed = false
  let _initializing = true

  // Stats
  let totalDispatched = 0
  let totalCompleted = 0
  let totalFailed = 0
  let totalTimedOut = 0

  // ── Worker Management ──────────────────────────────────

  function _createWorker(index) {
    if (_disposed) return null

    let worker
    if (_isNodeWorker()) {
      if (!workerFactory) {
        console.warn('[uploop:workerPool] Node.js worker pool requires workerFactory config')
        return null
      }
      worker = workerFactory()
    } else if (_hasWorkers && workerUrl) {
      worker = new Worker(workerUrl)
    } else {
      console.warn('[uploop:workerPool] Worker pool requires workerUrl (browser) or workerFactory (Node)')
      return null
    }

    worker.onmessage = (e) => {
      const { id, result, error } = e.data
      const task = _findTask(id)
      busy.delete(index)
      if (!task) return

      if (error) {
        totalFailed++
        task.reject(new Error(error))
      } else {
        totalCompleted++
        task.resolve(result)
      }

      _drain()
    }

    worker.onerror = (err) => {
      console.error(`[uploop:workerPool] Worker ${index} error:`, err)
      busy.delete(index)
      // replace dead worker
      workers[index] = _createWorker(index)
      _drain()
    }

    return worker
  }

  function _isNodeWorker() {
    return typeof globalThis.process !== 'undefined' && !workerUrl
  }

  function _findTask(id) {
    // tasks are consumed in order, so find by scanning
    // in practice, workers respond in order, so check the first
    for (const task of taskQueue) {
      if (task.id === id) return task
    }
    return null
  }

  function _getAvailableWorker() {
    for (let i = 0; i < workers.length; i++) {
      if (workers[i] && !busy.has(i)) return i
    }
    return -1
  }

  function _drain() {
    while (taskQueue.length > 0) {
      const idx = _getAvailableWorker()
      if (idx < 0) return
      const task = taskQueue.shift()
      busy.add(idx)
      totalDispatched++

      try {
        workers[idx].postMessage(
          { id: task.id, data: task.data },
          task.transfer || []
        )
      } catch (e) {
        totalFailed++
        busy.delete(idx)
        task.reject(e)
        _drain()
        return
      }

      if (taskTimeout > 0) {
        task.timer = setTimeout(() => {
          const stillQueued = _findTask(task.id)
          if (stillQueued) {
            totalTimedOut++
            busy.delete(idx)
            task.reject(new Error(`Worker task timed out after ${taskTimeout}ms`))
            _drain()
          }
        }, taskTimeout)
      }
    }
  }

  // ── Public API ─────────────────────────────────────────

  /**
   * Initialize the pool. Creates workers. Called automatically on first task.
   * Call explicitly if you want to pre-warm.
   */
  async function init() {
    if (!_initializing) return
    for (let i = 0; i < size; i++) {
      workers[i] = _createWorker(i)
    }
    _initializing = false
  }

  /**
   * Execute a task on a worker.
   *
   * @param {*} data — data to send to worker (structured clone or Transferable)
   * @param {Array} [transfer] — Transferable objects for zero-copy transfer
   * @returns {Promise<*>} worker's result
   */
  async function execute(data, transfer) {
    if (_disposed) throw new Error('Worker pool is disposed')
    if (_initializing) await init()

    const id = ++_idCounter

    return new Promise((resolve, reject) => {
      taskQueue.push({ id, data, transfer: transfer || [], resolve, reject, timer: null })

      // drain tries to dispatch immediately
      _drain()
    })
  }

  /**
   * Execute multiple tasks in parallel across the pool.
   *
   * @param {Array} tasks — array of data items
   * @returns {Promise<Array>} results in same order as input
   */
  async function map(tasks) {
    const promises = tasks.map((data, i) => execute(data))
    return Promise.all(promises)
  }

  /**
   * Execute a task inline (no worker) if the pool is full.
   * Falls back to main thread execution.
   */
  async function executeWithFallback(data, fallbackFn, transfer) {
    try {
      return await execute(data, transfer)
    } catch (e) {
      // if pool is full or worker failed, run inline
      if (fallbackFn) return fallbackFn(data)
      throw e
    }
  }

  /** Get pool statistics. */
  function stats() {
    return {
      size: workers.length,
      busy: busy.size,
      available: workers.length - busy.size,
      queued: taskQueue.length,
      dispatched: totalDispatched,
      completed: totalCompleted,
      failed: totalFailed,
      timedOut: totalTimedOut,
      utilization: workers.length > 0 ? (busy.size / workers.length * 100).toFixed(1) + '%' : 'N/A'
    }
  }

  /** Terminate all workers and clear the pool. */
  function dispose() {
    _disposed = true
    for (const worker of workers) {
      if (worker && typeof worker.terminate === 'function') worker.terminate()
    }
    workers.length = 0
    for (const task of taskQueue) {
      if (task.timer) clearTimeout(task.timer)
      task.reject(new Error('Worker pool disposed'))
    }
    taskQueue.length = 0
    busy.clear()
  }

  // Auto-init on first use
  const pool = {
    init, execute, map, executeWithFallback, stats, dispose,
    get size() { return workers.length },
    get available() { return workers.length - busy.size },
    get busy() { return busy.size },
    describe() {
      return {
        kind: 'uploop.flow.executor',
        type: 'workerPool',
        ...stats()
      }
    }
  }

  return pool
}
