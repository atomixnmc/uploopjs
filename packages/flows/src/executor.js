/**
 * Execution Engine — lane-based scheduling for JavaScript's event loop.
 *
 * Pushes JavaScript execution to its limit by intelligently routing work
 * to the most appropriate event loop mechanism. This is the best we can
 * do in standard JS runtimes (Node, Bun, browser). Full performance
 * comes with Long — the dedicated Uploop runtime at v1.0.
 *
 * ## Execution Lanes
 *
 * | Lane     | Mechanism              | Budget    | Use Case            |
 * |----------|------------------------|-----------|---------------------|
 * | critical | sync / microtask       | unlimited | State commits, DB   |
 * | hot      | requestAnimationFrame  | 4ms       | UI updates, game    |
 * | warm     | Promise / queueMicrotask | 8ms     | Data fetch, derive  |
 * | cold     | requestIdleCallback    | 50ms      | Prefetch, GC, sync  |
 * | idle     | setTimeout(0)          | ∞         | Analytics, logs     |
 *
 * ## Current Limitations (v0.3.0 — JavaScript runtime)
 *
 * - **No shared memory**: Workers communicate via message-passing (structured clone).
 *   Long (v1.0) provides SharedArrayBuffer coordination.
 * - **No native threads**: Workers are process-like, not OS threads. Long provides
 *   true thread pools with work-stealing at the OS level.
 * - **No GPU scheduling**: requestAnimationFrame is the closest we get. Long provides
 *   direct GPU command buffer submission via wgpu/WebGPU.
 * - **GC pauses**: V8's stop-the-world GC can stall all lanes. Long's
 *   temperature-aware memory manager eliminates this.
 * - **No priority inheritance**: sched_yield doesn't exist in JS. Long provides
 *   native task priority with preemption.
 * - **MessageChannel batching is ~1ms granularity**: Not suitable for sub-ms scheduling.
 *
 * @module @uploop/flows/executor
 */

// ── Lane Definitions ───────────────────────────────────────

export const LANES = {
  critical: { priority: 0, mechanism: 'microtask', budget: Infinity, description: 'State commits, DB writes, lock acquisition' },
  hot:      { priority: 1, mechanism: 'raf',       budget: 4,       description: 'UI paint, game loop, animations' },
  warm:     { priority: 2, mechanism: 'microtask', budget: 8,       description: 'Data derivation, API responses, cache' },
  cold:     { priority: 3, mechanism: 'idle',      budget: 50,      description: 'Prefetch, analytics, GC, sync' },
  idle:     { priority: 4, mechanism: 'timeout',   budget: Infinity, description: 'Logs, telemetry, cleanup' }
}

// ── Platform Detection ─────────────────────────────────────

const _isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'
const _isNode = typeof process !== 'undefined' && process.versions?.node
const _isBun = typeof Bun !== 'undefined'

const _raf = _isBrowser
  ? (fn) => requestAnimationFrame(fn)
  : (fn) => setTimeout(fn, 16)

const _ric = _isBrowser && typeof requestIdleCallback !== 'undefined'
  ? (fn, opts) => requestIdleCallback(fn, opts)
  : (fn) => setTimeout(fn, 1)

const _microtask = typeof queueMicrotask !== 'undefined'
  ? queueMicrotask
  : (fn) => Promise.resolve().then(fn)

// ── Scheduler Priority API (Chrome 94+) ────────────────────

const _hasScheduler = _isBrowser && typeof scheduler !== 'undefined'
const _postTask = _hasScheduler && scheduler.postTask
  ? (fn, priority) => scheduler.postTask(fn, { priority })
  : null

// ── MessageChannel for async batching ──────────────────────

/**
 * Internal batching using a callback registry.
 * Functions can't be cloned via postMessage, so we store them
 * in a registry keyed by ID and pass only IDs through the channel.
 */
function _createBatchChannel() {
  const registry = new Map()
  let _idCounter = 0

  if (typeof MessageChannel !== 'undefined') {
    const mc = new MessageChannel()
    mc.port1.onmessage = (e) => {
      const fn = registry.get(e.data)
      if (fn) { registry.delete(e.data); fn() }
    }
    mc.port1.start()
    return {
      post: (fn) => {
        const id = ++_idCounter
        registry.set(id, fn)
        mc.port2.postMessage(id)
      },
      close: () => { mc.port1.close(); mc.port2.close(); registry.clear() }
    }
  }

  // setImmediate fallback (Node.js)
  if (typeof setImmediate !== 'undefined') {
    return {
      post: (fn) => setImmediate(fn),
      close: () => {}
    }
  }

  // setTimeout fallback
  return {
    post: (fn) => setTimeout(fn, 0),
    close: () => {}
  }
}

// ── Lane Scheduler ─────────────────────────────────────────

/**
 * Schedule work on a specific execution lane.
 *
 * @param {function} fn — work to execute
 * @param {string} lane — 'critical' | 'hot' | 'warm' | 'cold' | 'idle'
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal] — cancel the scheduled work
 * @param {number} [opts.budget] — override lane budget (ms)
 * @returns {{ cancel: function }} handle to cancel
 */
export function schedule(fn, lane = 'warm', opts = {}) {
  const { signal, budget } = opts
  let cancelled = false
  let timerId = null

  if (signal?.aborted) return { cancel: () => {} }

  const work = () => {
    if (cancelled) return
    if (signal?.aborted) return
    const start = performance.now()
    try {
      fn()
    } catch (e) {
      console.error(`[uploop:executor] ${lane} lane error:`, e)
    }
    const elapsed = performance.now() - start
    const laneBudget = budget || LANES[lane]?.budget || Infinity
    if (elapsed > laneBudget) {
      console.warn(`[uploop:executor] ${lane} lane over budget: ${elapsed.toFixed(1)}ms > ${laneBudget}ms`)
    }
  }

  switch (lane) {
    case 'critical':
      _microtask(work)
      break

    case 'hot':
      timerId = _raf(work)
      break

    case 'warm':
      if (_postTask) {
        _postTask(work, 'user-blocking')
      } else {
        _microtask(work)
      }
      break

    case 'cold':
      timerId = _ric(work, { timeout: 100 })
      break

    case 'idle':
      timerId = setTimeout(work, 0)
      break

    default:
      _microtask(work)
  }

  if (signal) {
    signal.addEventListener('abort', () => { cancelled = true; cancel() }, { once: true })
  }

  function cancel() {
    cancelled = true
    if (timerId) {
      if (lane === 'hot') cancelAnimationFrame(timerId)
      else if (lane === 'cold' && typeof cancelIdleCallback !== 'undefined') cancelIdleCallback(timerId)
      else clearTimeout(timerId)
      timerId = null
    }
  }

  return { cancel }
}

// ── Batch Scheduler ────────────────────────────────────────

/**
 * Collect work items and dispatch them as a batch on the next microtask.
 * Uses MessageChannel for async batching (faster than setTimeout(0)).
 */
export function createBatchScheduler(opts = {}) {
  const { maxBatchSize = 64 } = opts
  const channel = _createBatchChannel()
  let queue = []
  let scheduled = false

  function process(batch) {
    for (const item of batch) {
      try { item.fn(...item.args) } catch (e) {
        console.error('[uploop:batch] error:', e)
      }
    }
  }

  function _scheduleFlush() {
    if (scheduled) return
    scheduled = true
    channel.post(() => {
      scheduled = false
      if (queue.length === 0) return
      const batch = queue.splice(0, maxBatchSize)
      process(batch)
      if (queue.length > 0) _scheduleFlush()
    })
  }

  return {
    push(fn, ...args) {
      queue.push({ fn, args })
      _scheduleFlush()
    },
    flushNow() {
      if (queue.length === 0) return
      scheduled = false // cancel pending async flush
      const batch = [...queue]
      queue.length = 0
      process(batch)
    },
    get size() { return queue.length },
    dispose() { channel.close() }
  }
}

// ── Frame Budget Enforcer ──────────────────────────────────

/**
 * Enforce a per-frame time budget. Work that exceeds the budget
 * is yielded to the next frame. Prevents jank from long-running tasks.
 */
export function createFrameBudget(budgetMs = 12) {
  let frameStart = 0
  let elapsed = 0

  return {
    /** Start timing a new frame */
    begin() { frameStart = performance.now(); elapsed = 0 },

    /** Check if there's budget remaining. If not, schedules continuation. */
    async yieldIfOver() {
      elapsed = performance.now() - frameStart
      if (elapsed > budgetMs) {
        await new Promise(resolve => _raf(resolve))
        frameStart = performance.now()
        elapsed = 0
      }
    },

    /** Get remaining budget in ms */
    remaining() {
      return Math.max(0, budgetMs - (performance.now() - frameStart))
    },

    /** Execute fn with automatic yielding */
    async run(fn) {
      this.begin()
      return fn({ yieldIfOver: () => this.yieldIfOver(), remaining: () => this.remaining() })
    }
  }
}

// ── Abortable Execution ────────────────────────────────────

/**
 * Create an execution context that propagates abort signals through
 * a chain of async operations. All child operations are aborted when
 * the parent is cancelled.
 */
export function createAbortContext(parentSignal) {
  const controller = new AbortController()

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason)
    } else {
      parentSignal.addEventListener('abort', () => {
        controller.abort(parentSignal.reason)
      }, { once: true })
    }
  }

  return {
    signal: controller.signal,

    /** Create a child context that inherits the abort signal */
    child() {
      return createAbortContext(controller.signal)
    },

    /** Abort this context and all children */
    abort(reason) {
      controller.abort(reason)
    },

    /** Execute fn with this context's signal. Automatically races with abort. */
    async run(fn) {
      return fn(this.signal)
    },

    /** Execute fn with a timeout. Aborts on timeout. */
    async withTimeout(fn, ms) {
      const timer = setTimeout(() => controller.abort(new Error(`Timeout after ${ms}ms`)), ms)
      try {
        return await fn(this.signal)
      } finally {
        clearTimeout(timer)
      }
    }
  }
}

// ── Lane Router ────────────────────────────────────────────

/**
 * Route function execution to the correct lane based on node temperature.
 *
 * @param {object} graph — HyperGraph with node metadata
 * @returns {object} router API
 */
export function createLaneRouter(graph) {
  const routing = new Map() // nodeName => lane

  if (graph?.describe) {
    const desc = graph.describe()
    const nodes = desc.nodes || {}
    for (const [name, node] of Object.entries(nodes)) {
      const temp = node.temperature || 'warm'
      routing.set(name, temp === 'hot' ? 'hot' : temp === 'cold' ? 'cold' : 'warm')
    }
  }

  function laneOf(nodeName) {
    return routing.get(nodeName) || 'warm'
  }

  return {
    laneOf,

    /** Schedule work for a specific node on its temperature lane */
    scheduleNode(nodeName, fn, opts) {
      return schedule(fn, laneOf(nodeName), opts)
    },

    /** Execute fn for multiple nodes, routing each to its lane */
    executeGroup(nodeNames, fn) {
      const results = []
      for (const name of nodeNames) {
        results.push(schedule(() => fn(name), laneOf(name)))
      }
      return results
    },

    get routing() { return Object.fromEntries(routing) }
  }
}

// ── Monitor ────────────────────────────────────────────────

/**
 * Monitor execution performance across lanes.
 * Tracks budget violations, lane distribution, and throughput.
 */
export function createExecutionMonitor() {
  const stats = {
    critical: { scheduled: 0, executed: 0, overBudget: 0, totalMs: 0 },
    hot:      { scheduled: 0, executed: 0, overBudget: 0, totalMs: 0 },
    warm:     { scheduled: 0, executed: 0, overBudget: 0, totalMs: 0 },
    cold:     { scheduled: 0, executed: 0, overBudget: 0, totalMs: 0 },
    idle:     { scheduled: 0, executed: 0, overBudget: 0, totalMs: 0 }
  }

  function record(lane, elapsedMs) {
    const s = stats[lane]
    if (!s) return
    s.scheduled++
    s.executed++
    s.totalMs += elapsedMs
    if (elapsedMs > (LANES[lane]?.budget || Infinity)) s.overBudget++
  }

  function report() {
    return {
      lanes: Object.fromEntries(
        Object.entries(stats).map(([name, s]) => [
          name, {
            ...s,
            avgMs: s.executed > 0 ? (s.totalMs / s.executed).toFixed(2) : 0,
            budget: LANES[name]?.budget,
            overBudgetRate: s.scheduled > 0 ? (s.overBudget / s.scheduled * 100).toFixed(1) + '%' : '0%'
          }
        ])
      ),
      totalScheduled: Object.values(stats).reduce((sum, s) => sum + s.scheduled, 0),
      totalMs: Object.values(stats).reduce((sum, s) => sum + s.totalMs, 0)
    }
  }

  function reset() {
    for (const s of Object.values(stats)) {
      s.scheduled = 0; s.executed = 0; s.overBudget = 0; s.totalMs = 0
    }
  }

  return { record, report, reset, stats }
}

// ── Limitations Documentation ──────────────────────────────

/**
 * ## JavaScript Execution Limitations (v0.3.0)
 *
 * These are fundamental constraints of the JS runtime. Long (v1.0) removes them.
 *
 * ### 1. No True Parallelism
 * JS is single-threaded. Workers are separate V8 isolates with message-passing
 * overhead (~1ms per transfer). CPU-bound work in a worker:
 * - Must copy or transfer data (structured clone or Transferable)
 * - Cannot share objects between main thread and worker
 * - Atomics + SharedArrayBuffer enable coordination but not shared objects
 *
 * **Long solution**: True OS threads with shared memory, zero-copy between threads.
 *
 * ### 2. Cooperative Multitasking
 * JS has no preemption. A long-running synchronous function blocks ALL lanes.
 * `scheduler.yield()` (proposed) is not widely available. Our mitigation:
 * - `createFrameBudget` chunks work across frames
 * - `schedule()` routes to non-blocking mechanisms
 * - But a 50ms sync loop still freezes the UI
 *
 * **Long solution**: Native preemptive scheduling with priority inheritance.
 *
 * ### 3. GC Pauses
 * V8 stop-the-world GC can pause 10-50ms. Firefox's generational GC is better
 * but still pauses. Bun's GC is JSC-based. All unpredictable.
 *
 * **Long solution**: Temperature-aware memory manager. Hot objects pinned, cold
 * objects collected incrementally. No stop-the-world.
 *
 * ### 4. Timer Granularity
 * setTimeout(0) is clamped to ~4ms in browsers, ~1ms in Node. MessageChannel
 * postMessage is faster (~0.1ms) but still not microsecond-level.
 *
 * **Long solution**: Native timer resolution with microsecond precision.
 *
 * ### 5. No I/O Priority
 * fetch(), fs.readFile(), etc. have no priority control. A cold-lane prefetch
 * competes equally with a critical-lane API call for network/disk I/O.
 *
 * **Long solution**: I/O priority classes. Critical reads preempt cold prefetchs.
 *
 * ### 6. Worker Startup Cost
 * Creating a Worker costs ~50-100ms. Not suitable for fine-grained parallelism.
 * Worker pools help but still have the overhead.
 *
 * **Long solution**: Pre-warmed thread pool with sub-ms dispatch.
 */
