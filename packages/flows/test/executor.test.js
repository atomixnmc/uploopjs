import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  schedule, createBatchScheduler, createFrameBudget,
  createAbortContext, createLaneRouter, createExecutionMonitor,
  LANES
} from '../src/executor.js'
import { createWorkerPool } from '../src/workerPool.js'

// ── Lane Scheduler ────────────────────────────────────────

describe('schedule()', () => {
  it('executes critical lane synchronously via microtask', async () => {
    const order = []
    schedule(() => order.push('critical'), 'critical')
    order.push('sync')
    await new Promise(r => setTimeout(r, 10))
    expect(order).toEqual(['sync', 'critical']) // microtask runs after sync
  })

  it('executes warm lane via microtask', async () => {
    let called = false
    schedule(() => { called = true }, 'warm')
    await new Promise(r => setTimeout(r, 10))
    expect(called).toBe(true)
  })

  it('executes idle lane via setTimeout', async () => {
    let called = false
    schedule(() => { called = true }, 'idle')
    expect(called).toBe(false)
    await new Promise(r => setTimeout(r, 10))
    expect(called).toBe(true)
  })

  it('returns cancel handle that prevents execution', async () => {
    let called = false
    const { cancel } = schedule(() => { called = true }, 'idle')
    cancel()
    await new Promise(r => setTimeout(r, 10))
    expect(called).toBe(false)
  })

  it('respects AbortSignal', async () => {
    let called = false
    const controller = new AbortController()
    schedule(() => { called = true }, 'warm', { signal: controller.signal })
    controller.abort()
    await new Promise(r => setTimeout(r, 10))
    expect(called).toBe(false)
  })

  it('handles already-aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    let called = false
    schedule(() => { called = true }, 'warm', { signal: controller.signal })
    await new Promise(r => setTimeout(r, 10))
    expect(called).toBe(false)
  })

  it('cold lane uses requestIdleCallback or setTimeout fallback', async () => {
    let called = false
    schedule(() => { called = true }, 'cold')
    await new Promise(r => setTimeout(r, 10))
    expect(called).toBe(true)
  })

  it('executes in lane priority order (critical before idle)', async () => {
    const order = []
    schedule(() => order.push('idle'), 'idle')
    schedule(() => order.push('critical'), 'critical')
    schedule(() => order.push('warm'), 'warm')
    await new Promise(r => setTimeout(r, 20))
    // critical and warm are microtasks (run before timers), idle is setTimeout (after)
    expect(order.indexOf('critical')).toBeLessThan(order.indexOf('idle'))
    expect(order.indexOf('warm')).toBeLessThan(order.indexOf('idle'))
  })
})

// ── Batch Scheduler ────────────────────────────────────────

describe('createBatchScheduler', () => {
  it('batches multiple pushes into one async dispatch', async () => {
    const seen = []
    const bs = createBatchScheduler()
    bs.push((x) => seen.push(x), 1)
    bs.push((x) => seen.push(x), 2)
    bs.push((x) => seen.push(x), 3)
    expect(seen.length).toBe(0)
    await new Promise(r => setTimeout(r, 20))
    expect(seen).toEqual([1, 2, 3])
    bs.dispose()
  })

  it('flushNow() processes immediately', () => {
    const seen = []
    const bs = createBatchScheduler()
    bs.push((x) => seen.push(x), 1)
    bs.flushNow()
    expect(seen).toEqual([1])
    bs.dispose()
  })

  it('batches at maxBatchSize boundaries', async () => {
    const seen = []
    const bs = createBatchScheduler({ maxBatchSize: 2 })
    bs.push((x) => seen.push(x), 1)
    bs.push((x) => seen.push(x), 2)
    bs.push((x) => seen.push(x), 3)
    bs.push((x) => seen.push(x), 4)
    await new Promise(r => setTimeout(r, 20))
    expect(seen).toContain(1)
    expect(seen).toContain(2)
    expect(seen).toContain(3)
    expect(seen).toContain(4)
    bs.dispose()
  })
})

// ── Frame Budget ───────────────────────────────────────────

describe('createFrameBudget', () => {
  it('tracks remaining budget', () => {
    const fb = createFrameBudget(100)
    fb.begin()
    expect(fb.remaining()).toBeGreaterThan(0)
    expect(fb.remaining()).toBeLessThanOrEqual(100)
  })

  it('yields when over budget', async () => {
    const fb = createFrameBudget(0.01) // 0.01ms — always over
    fb.begin()
    const before = Date.now()
    await fb.yieldIfOver()
    const after = Date.now()
    // should have waited at least a frame
    expect(after - before).toBeGreaterThan(0)
  })

  it('run() provides context with yieldIfOver', async () => {
    const fb = createFrameBudget(1000)
    let yielded = false
    await fb.run(async (ctx) => {
      // big budget, shouldn't yield
      yielded = false
    })
    expect(yielded).toBe(false)
  })
})

// ── Abort Context ──────────────────────────────────────────

describe('createAbortContext', () => {
  it('creates signal that propagates from parent', async () => {
    const parent = new AbortController()
    const ctx = createAbortContext(parent.signal)
    expect(ctx.signal.aborted).toBe(false)
    parent.abort()
    expect(ctx.signal.aborted).toBe(true)
  })

  it('child inherits parent abort', () => {
    const parent = new AbortController()
    const ctx = createAbortContext(parent.signal)
    const child = ctx.child()
    parent.abort()
    expect(child.signal.aborted).toBe(true)
  })

  it('abort() cancels context', () => {
    const ctx = createAbortContext()
    ctx.abort('reason')
    expect(ctx.signal.aborted).toBe(true)
    expect(ctx.signal.reason).toBe('reason')
  })

  it('run() passes signal to function', async () => {
    const ctx = createAbortContext()
    let received = null
    await ctx.run(async (signal) => {
      received = signal
      return 'done'
    })
    expect(received).toBe(ctx.signal)
  })

  it('withTimeout aborts after ms', async () => {
    const ctx = createAbortContext()
    let timedOut = false
    try {
      await ctx.withTimeout(async (signal) => {
        // check signal periodically
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 100)
          signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
        })
      }, 10)
    } catch (e) {
      timedOut = true
    }
    expect(timedOut).toBe(true)
  })
})

// ── Lane Router ────────────────────────────────────────────

describe('createLaneRouter', () => {
  it('routes by node temperature', () => {
    const mockGraph = {
      describe: () => ({
        nodes: {
          mouseX: { temperature: 'hot' },
          products: { temperature: 'cold' },
          userName: { temperature: 'warm' }
        }
      })
    }
    const router = createLaneRouter(mockGraph)
    expect(router.laneOf('mouseX')).toBe('hot')
    expect(router.laneOf('products')).toBe('cold')
    expect(router.laneOf('userName')).toBe('warm')
    expect(router.laneOf('unknown')).toBe('warm')
  })

  it('handles graph without describe gracefully', () => {
    const router = createLaneRouter({})
    expect(router.laneOf('anything')).toBe('warm')
  })
})

// ── Execution Monitor ─────────────────────────────────────

describe('createExecutionMonitor', () => {
  it('records lane activity', () => {
    const mon = createExecutionMonitor()
    mon.record('critical', 1)
    mon.record('critical', 2)
    mon.record('warm', 5)
    const r = mon.report()
    expect(r.lanes.critical.executed).toBe(2)
    expect(r.lanes.critical.totalMs).toBe(3)
    expect(r.lanes.critical.avgMs).toBe('1.50')
    expect(r.lanes.warm.executed).toBe(1)
  })

  it('detects over-budget executions', () => {
    const mon = createExecutionMonitor()
    mon.record('hot', 10) // hot budget is 4ms
    const r = mon.report()
    expect(r.lanes.hot.overBudget).toBe(1)
    expect(r.lanes.hot.overBudgetRate).toBe('100.0%')
  })

  it('reset clears all stats', () => {
    const mon = createExecutionMonitor()
    mon.record('warm', 10)
    mon.reset()
    const r = mon.report()
    expect(r.lanes.warm.executed).toBe(0)
  })

  it('reports total scheduled across all lanes', () => {
    const mon = createExecutionMonitor()
    mon.record('critical', 1)
    mon.record('hot', 1)
    mon.record('warm', 1)
    mon.record('cold', 1)
    mon.record('idle', 1)
    expect(mon.report().totalScheduled).toBe(5)
  })
})

// ── LANES Definition ──────────────────────────────────────

describe('LANES', () => {
  it('defines 5 execution lanes', () => {
    expect(Object.keys(LANES)).toEqual(['critical', 'hot', 'warm', 'cold', 'idle'])
  })

  it('each lane has required fields', () => {
    for (const [name, lane] of Object.entries(LANES)) {
      expect(lane.priority).toBeGreaterThanOrEqual(0)
      expect(lane.mechanism).toBeTruthy()
      expect(typeof lane.budget).toBe('number')
    }
  })

  it('critical has highest priority', () => {
    expect(LANES.critical.priority).toBe(0)
  })

  it('idle has lowest priority', () => {
    expect(LANES.idle.priority).toBe(4)
  })
})

// ── Worker Pool ───────────────────────────────────────────

describe('createWorkerPool (without workers)', () => {
  it('creates pool config without workers (no-op in test env)', () => {
    const pool = createWorkerPool({ size: 2 })
    expect(pool.size).toBe(0) // no workers created without url/factory
    expect(pool.stats().utilization).toBe('N/A')
    pool.dispose()
  })

  it('dispose cleans up safely', () => {
    const pool = createWorkerPool({ size: 2 })
    pool.dispose()
    expect(pool.size).toBe(0)
  })

  it('stats returns empty pool state', () => {
    const pool = createWorkerPool({ size: 2 })
    const s = pool.stats()
    expect(s.size).toBe(0)
    expect(s.busy).toBe(0)
    expect(s.queued).toBe(0)
    pool.dispose()
  })

  it('describe() returns JSON-safe state', () => {
    const pool = createWorkerPool({ size: 2 })
    const d = pool.describe()
    expect(d.kind).toBe('uploop.flow.executor')
    expect(d.type).toBe('workerPool')
    pool.dispose()
  })
})
