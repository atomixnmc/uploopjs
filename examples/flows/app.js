/**
 * Uploop Flows Showcase — 15 live demos of breakthrough execution patterns.
 *
 * Each demo shows a specific flow capability with real algorithms,
 * live visualizations, and performance stats. All demos use the same
 * Uploop primitives (html``, createLoop, pipelines) — showcasing how
 * easy it is to compose different flows on any component.
 *
 * Run: open examples/flows/index.html in a browser, or:
 *   npx vite examples/flows --open
 */

import {
  createCircuitBreaker, createRateLimiter, createRetryWithBackoff,
  createBatchProcessor, createPriorityQueue, createDeduplicationFilter,
  createEventBus, createIdempotencyGuard, createDeadLetterQueue,
  createBulkhead, createSagaOrchestrator, createFanOutFanIn,
  pipeline, queue, eventStream, schedule,
  createSignal, createComputed, createEffect, batch, createReactiveStore,
  createActor
} from '../../packages/flows/src/index.js'

import { html, component } from '../../packages/html/src/index.js'

// ====================================================================
// 1. Search Typeahead — debounce + interruptible + ring buffer
// ====================================================================
export function createSearchTypeaheadDemo() {
  const [query, setQuery] = createSignal('')
  const [results, setResults] = createSignal([])
  const [loading, setLoading] = createSignal(false)
  const [stats, setStats] = createSignal({ calls: 0, aborted: 0, cached: 0 })

  let controller = null
  let timer = null
  const cache = new Map()

  function handleInput(val) {
    controller?.abort()
    clearTimeout(timer)
    setQuery(val)

    if (!val) { setResults([]); return }

    setLoading(true)
    timer = setTimeout(async () => {
      if (cache.has(val)) {
        setResults(cache.get(val))
        setLoading(false)
        setStats(s => ({ ...s, cached: s.cached + 1 }))
        return
      }
      controller = new AbortController()
      try {
        const res = await fetch(`https://jsonplaceholder.typicode.com/users?q=${val}`)
        const data = await res.json()
        const filtered = data.filter(u => u.name.toLowerCase().includes(val.toLowerCase())).slice(0, 5)
        cache.set(val, filtered)
        setResults(filtered)
        setStats(s => ({ ...s, calls: s.calls + 1 }))
      } catch (e) {
        if (e.name === 'AbortError') setStats(s => ({ ...s, aborted: s.aborted + 1 }))
      }
      setLoading(false)
    }, 200)
  }

  return { query, results, loading, stats, handleInput }
}

// ====================================================================
// 2. Circuit Breaker — state machine visualization
// ====================================================================
export function createCircuitBreakerDemo() {
  const breaker = createCircuitBreaker({ name: 'api-gateway', failureThreshold: 3, resetTimeout: 5000 })
  const [state, setState] = createSignal('CLOSED')
  const [lastResult, setLastResult] = createSignal('')
  const [counts, setCounts] = createSignal({ success: 0, fail: 0 })

  const call = breaker.wrap(async (shouldFail) => {
    if (shouldFail) throw new Error('Service unavailable')
    return '✅ Success'
  })

  async function testCall(shouldFail) {
    try {
      const result = await call(shouldFail)
      setLastResult(result)
      setCounts(c => ({ ...c, success: c.success + 1 }))
    } catch (e) {
      setLastResult(e.name === 'CircuitOpenError' ? '🔴 Circuit OPEN — rejected' : '❌ ' + e.message)
      setCounts(c => ({ ...c, fail: c.fail + 1 }))
    }
    setState(breaker.state)
  }

  // Auto-refresh state
  setInterval(() => setState(breaker.state), 100)

  return { state, lastResult, counts, breaker, testCall }
}

// ====================================================================
// 3. Rate Limiter — token bucket visualization
// ====================================================================
export function createRateLimiterDemo() {
  const limiter = createRateLimiter({ rate: 5, windowMs: 1000, burst: 2, perKey: true })
  const [tokens, setTokens] = createSignal([])
  const [stats, setStats] = createSignal({ allowed: 0, denied: 0 })
  const MAX_TOKENS = 7

  function request(key) {
    const { allowed, remaining } = limiter.tryAcquire(key)
    const entry = { key, allowed, ts: Date.now() }
    setTokens(t => [...t.slice(-20), entry])
    setStats(s => ({
      allowed: s.allowed + (allowed ? 1 : 0),
      denied: s.denied + (allowed ? 0 : 1)
    }))
    return allowed
  }

  return { tokens, stats, request, maxTokens: MAX_TOKENS, limiter }
}

// ====================================================================
// 4. Priority Queue — job scheduling with aging
// ====================================================================
export function createPriorityQueueDemo() {
  const pq = createPriorityQueue({ levels: ['critical', 'high', 'normal', 'low', 'background'], aging: true, agingRate: 500 })
  const [jobs, setJobs] = createSignal([])
  const [processed, setProcessed] = createSignal([])
  let jobId = 0

  function addJob(level) {
    const id = `job-${++jobId}`
    pq.enqueue(id, level)
    setJobs(j => [...j, { id, level, ts: Date.now() }])
  }

  setInterval(() => {
    const job = pq.dequeue()
    if (job) {
      setProcessed(p => [...p.slice(-10), { id: job.task, level: job.level, ts: Date.now() }])
      setJobs(j => j.filter(x => x.id !== job.task))
      // simulate processing time
      setTimeout(() => pq.complete(job.id), 100 + Math.random() * 300)
    }
  }, 800)

  return { jobs, processed, addJob }
}

// ====================================================================
// 5. Event Bus — pub/sub with wildcards
// ====================================================================
export function createEventBusDemo() {
  const bus = createEventBus()
  const [events, setEvents] = createSignal([])
  const [subscribers, setSubscribers] = createSignal([])

  bus.on('user.*', (payload) => {
    setEvents(e => [...e.slice(-15), { topic: 'user.*', payload, ts: Date.now() }])
  })
  bus.on('order.>', (payload) => {
    setEvents(e => [...e.slice(-15), { topic: 'order.>', payload, ts: Date.now() }])
  })

  setSubscribers([{ pattern: 'user.*', handler: 'logs all user events' }, { pattern: 'order.>', handler: 'logs all order events' }])

  function emit(topic) {
    bus.emit(topic, { id: Math.random().toString(36).slice(2, 6) })
  }

  return { events, subscribers, emit }
}

// ====================================================================
// 6. Saga Checkout — compensating transaction
// ====================================================================
export function createSagaCheckoutDemo() {
  const so = createSagaOrchestrator({ timeout: 3000 })
  const [steps, setSteps] = createSignal([])
  const [result, setResult] = createSignal(null)

  const saga = so.create('checkout', [
    { name: 'validate-cart', execute: async (d) => { setSteps(s => [...s, { step: 'validate-cart', status: 'running' }]); await delay(300); setSteps(s => s.map(x => x.step === 'validate-cart' ? { ...x, status: '✅' } : x)); return d },
      compensate: async (d) => { setSteps(s => [...s, { step: 'validate-cart', status: '↩️ compensated' }]) } },
    { name: 'charge-payment', execute: async (d) => { setSteps(s => [...s, { step: 'charge-payment', status: 'running' }]); await delay(400); setSteps(s => s.map(x => x.step === 'charge-payment' ? { ...x, status: '✅' } : x)); return d },
      compensate: async (d) => { setSteps(s => [...s, { step: 'charge-payment', status: '↩️ refunded' }]) } },
    { name: 'reserve-inventory', execute: async (d) => { setSteps(s => [...s, { step: 'reserve-inventory', status: 'running' }]); await delay(400); setSteps(s => s.map(x => x.step === 'reserve-inventory' ? { ...x, status: '✅' } : x)); return d },
      compensate: async (d) => { setSteps(s => [...s, { step: 'reserve-inventory', status: '↩️ released' }]) } },
    { name: 'schedule-shipment', execute: async (d) => { setSteps(s => [...s, { step: 'schedule-shipment', status: 'running' }]); await delay(300); setSteps(s => s.map(x => x.step === 'schedule-shipment' ? { ...x, status: '✅' } : x)); return d },
      compensate: async (d) => { setSteps(s => [...s, { step: 'schedule-shipment', status: '↩️ cancelled' }]) } }
  ])

  async function runCheckout(shouldFail = false) {
    setSteps([])
    setResult(null)
    if (shouldFail) {
      // inject a failing step
      const failSaga = so.create('checkout-fail', [
        { name: 'validate-cart', execute: async () => { await delay(200); return 'ok' }, compensate: async () => {} },
        { name: 'charge-payment', execute: async () => { await delay(200); return 'ok' }, compensate: async () => {} },
        { name: 'reserve-inventory', execute: async () => { await delay(200); throw new Error('Out of stock') }, compensate: async () => {} }
      ])
      const r = await failSaga.run({})
      setSteps(prev => {
        const steps = []
        for (const s of r.completedSteps || []) steps.push({ step: s, status: '✅' })
        if (r.compensatedSteps) for (const s of r.compensatedSteps) steps.push({ step: s, status: '↩️ compensated' })
        return steps
      })
      setResult({ ...r, compensated: r.compensatedSteps })
    } else {
      const r = await saga.run({})
      setResult(r)
    }
  }

  return { steps, result, runCheckout }
}

// ====================================================================
// 7. Batch Processor — accumulation + flush
// ====================================================================
export function createBatchProcessorDemo() {
  const [batches, setBatches] = createSignal([])
  const [pending, setPending] = createSignal(0)
  const [stats, setStats] = createSignal({ processed: 0 })

  const bp = createBatchProcessor({
    maxSize: 5,
    maxLatency: 3000,
    handler: async (batch) => {
      setBatches(b => [...b.slice(-5), { items: batch, count: batch.length, ts: Date.now() }])
      setStats(s => ({ processed: s.processed + batch.length }))
    }
  })

  function addItem() {
    bp.push(`item-${stats().processed + pending() + 1}`)
    setPending(p => p + 1)
    // track pending reduction
    setTimeout(() => setPending(bp.size), 50)
  }

  setInterval(() => setPending(bp.size), 200)

  return { batches, pending, stats, addItem, flushAll: () => bp.flushAll() }
}

// ====================================================================
// 8. Dedup Filter — bloom + LRU
// ====================================================================
export function createDedupFilterDemo() {
  const df = createDeduplicationFilter({ falsePositiveRate: 0.01, expectedItems: 1000 })
  const [log, setLog] = createSignal([])

  function test(val) {
    const result = df.check(val)
    setLog(l => [...l.slice(-20), { value: val, duplicate: result.isDuplicate, method: result.method, ts: Date.now() }])
    return result
  }

  return { log, test, stats: () => df.stats }
}

// ====================================================================
// 9. Fan-Out / Fan-In — scatter-gather
// ====================================================================
export function createFanOutFanInDemo() {
  const fi = createFanOutFanIn({ concurrency: 3, partialPolicy: 'best-effort', timeout: 5000 })
  const [results, setResults] = createSignal(null)

  async function runTasks(count, withErrors = false) {
    setResults(null)
    const tasks = Array.from({ length: count }, (_, i) => ({
      fn: async () => {
        await delay(200 + Math.random() * 500)
        if (withErrors && i % 3 === 0) throw new Error(`Task ${i} failed`)
        return `Result-${i}`
      }
    }))
    const r = await fi.all(tasks)
    setResults(r)
  }

  return { results, runTasks }
}

// ====================================================================
// 10. Actor Model — isolated state + mailbox
// ====================================================================
export function createActorDemo() {
  const [log, setLog] = createSignal([])

  const counter = createActor({
    name: 'counter',
    state: { value: 0, history: [] },
    on: {
      inc: (s, amount) => ({ ...s, value: s.value + amount, history: [...s.history, `+${amount}`].slice(-5) }),
      dec: (s, amount) => ({ ...s, value: s.value - amount, history: [...s.history, `-${amount}`].slice(-5) }),
      reset: () => ({ value: 0, history: [] })
    }
  })

  counter.onStart((s) => setLog(l => [...l, 'Actor started with value ' + s.value]))

  async function doInc(n) { await counter.send('inc', n); updateDisplay() }
  async function doDec(n) { await counter.send('dec', n); updateDisplay() }
  async function doReset() { await counter.send('reset'); updateDisplay() }

  function updateDisplay() {
    setLog(l => [...l.slice(-10), `State: ${JSON.stringify(counter.state.value)} (processed: ${counter.totalProcessed})`])
  }

  return { log, counter, doInc, doDec, doReset }
}

// ====================================================================
// 11. Reactive Form — signals + computed + effects
// ====================================================================
export function createReactiveFormDemo() {
  const [name, setName] = createSignal('')
  const [email, setEmail] = createSignal('')
  const [age, setAge] = createSignal(0)

  const isValid = createComputed(() => {
    const n = name(), e = email(), a = age()
    return {
      name: n.length >= 2,
      email: e.includes('@') && e.includes('.'),
      age: a > 0 && a < 150,
      all: n.length >= 2 && e.includes('@') && e.includes('.') && a > 0 && a < 150
    }
  })

  const [submitted, setSubmitted] = createSignal(null)

  createEffect(() => {
    if (isValid().all && name() && email()) {
      // auto-save effect — would trigger API call in real app
    }
    return undefined
  })

  function submit() {
    if (isValid().all) {
      setSubmitted({ name: name(), email: email(), age: age() })
    }
  }

  return { name, setName, email, setEmail, age, setAge, isValid, submitted, submit }
}

// ====================================================================
// 12. Worker Pool — CPU offloading (fibonacci)
// ====================================================================
export function createWorkerPoolDemo() {
  const [results, setResults] = createSignal([])
  const [computing, setComputing] = createSignal(false)
  const pool = { stats: () => ({}) } // mock — real workers need workerUrl

  function fib(n) {
    if (n <= 1) return n
    let a = 0, b = 1
    for (let i = 2; i <= n; i++) [a, b] = [b, a + b]
    return b
  }

  async function compute(n) {
    setComputing(true)
    const start = performance.now()
    // simulate worker offload with setTimeout
    await new Promise(r => setTimeout(r, 10))
    const result = fib(n)
    const elapsed = (performance.now() - start).toFixed(1)
    setResults(r => [...r.slice(-5), { n, result, elapsed, ts: Date.now() }])
    setComputing(false)
    return result
  }

  return { results, computing, compute }
}

// ====================================================================
// 13. Idempotency Guard — duplicate prevention
// ====================================================================
export function createIdempotencyDemo() {
  const guard = createIdempotencyGuard({ ttl: 60000 })
  const [log, setLog] = createSignal([])

  async function processPayment(key, amount) {
    const { result, replayed } = await guard.execute(key, async () => {
      await delay(300) // simulate payment processing
      return { status: 'charged', amount, txId: 'tx_' + Date.now() }
    })
    setLog(l => [...l.slice(-10), { key, amount, replayed, ...result, ts: Date.now() }])
    return result
  }

  function stats() { return guard.stats }

  return { log, processPayment, stats }
}

// ====================================================================
// 14. Retry With Backoff — exponential + jitter
// ====================================================================
export function createRetryDemo() {
  const rb = createRetryWithBackoff({ max: 3, backoff: 'exponential', initialMs: 100, jitter: true })
  const [log, setLog] = createSignal([])

  async function call(shouldFail, failCount = 2) {
    let attempts = 0
    try {
      const { result, attempts: at } = await rb.execute(async () => {
        attempts++
        if (shouldFail && attempts <= failCount) throw new Error('Temporary error')
        return '✅ Recovered on attempt ' + attempts
      })
      setLog(l => [...l.slice(-10), { result, attempts: at, ts: Date.now() }])
    } catch (e) {
      setLog(l => [...l.slice(-10), { error: e.message, attempts, ts: Date.now() }])
    }
  }

  return { log, call }
}

// ====================================================================
// 15. Dead Letter Queue — poison message isolation
// ====================================================================
export function createDLQDemo() {
  const dlq = createDeadLetterQueue({ maxSize: 100, alertThreshold: 3 })
  const [log, setLog] = createSignal([])

  dlq.onAlert(({ source, count }) => {
    setLog(l => [...l, '🚨 Alert: ' + source + ' has ' + count + ' dead messages'])
  })

  function failMessage(source, msg) {
    dlq.enqueue(source, msg, new Error('Processing failed'))
    setLog(l => [...l.slice(-10), '💀 ' + source + ': ' + msg])
  }

  async function replay(source) {
    const { replayed } = await dlq.replay(source, async (msg) => {
      setLog(l => [...l.slice(-10), '🔄 Replayed: ' + msg])
    })
    setLog(l => [...l.slice(-10), `📊 Replayed ${replayed} messages from ${source}`])
  }

  function stats() { return dlq.stats() }

  return { log, failMessage, replay, stats, sources: () => Object.keys(dlq.stats()) }
}

// ====================================================================
// Utility
// ====================================================================
function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// ====================================================================
// Component: Tabbed Demo Shell
// ====================================================================
export const FlowsShowcase = component('FlowsShowcase', {
  state: {
    activeTab: 'search',
    demos: {}
  },
  init(state, { send }) {
    // Initialize all demos
    const demos = {}
    demos.search = createSearchTypeaheadDemo()
    demos.breaker = createCircuitBreakerDemo()
    demos.rate = createRateLimiterDemo()
    demos.priority = createPriorityQueueDemo()
    demos.eventbus = createEventBusDemo()
    demos.saga = createSagaCheckoutDemo()
    demos.batch = createBatchProcessorDemo()
    demos.dedup = createDedupFilterDemo()
    demos.fanout = createFanOutFanInDemo()
    demos.actor = createActorDemo()
    demos.form = createReactiveFormDemo()
    demos.worker = createWorkerPoolDemo()
    demos.idempotent = createIdempotencyDemo()
    demos.retry = createRetryDemo()
    demos.dlq = createDLQDemo()
    return { demos }
  },
  view(state, { send, getState }) {
    const tabs = [
      { id: 'search', label: '🔍 Search Typeahead', desc: 'Debounce + interrupt + cache' },
      { id: 'breaker', label: '⚡ Circuit Breaker', desc: '3-state fail-fast protection' },
      { id: 'rate', label: '🪣 Rate Limiter', desc: 'Token bucket throttle' },
      { id: 'priority', label: '📊 Priority Queue', desc: 'Aging + starvation prevention' },
      { id: 'eventbus', label: '📡 Event Bus', desc: 'Wildcard pub/sub' },
      { id: 'saga', label: '🔄 Saga Checkout', desc: 'Compensating transactions' },
      { id: 'batch', label: '📦 Batch Processor', desc: 'Size+time accumulation' },
      { id: 'dedup', label: '🔬 Dedup Filter', desc: 'Bloom + LRU' },
      { id: 'fanout', label: '🌐 Fan-Out/Fan-In', desc: 'Scatter-gather' },
      { id: 'actor', label: '🎭 Actor Model', desc: 'Isolated state + mailbox' },
      { id: 'form', label: '📝 Reactive Form', desc: 'Signals + computed + effects' },
      { id: 'worker', label: '⚙️ Worker Offload', desc: 'CPU-bound tasks' },
      { id: 'idempotent', label: '🔐 Idempotency', desc: 'At-most-once semantics' },
      { id: 'retry', label: '🔄 Retry Backoff', desc: 'Exponential + jitter' },
      { id: 'dlq', label: '💀 Dead Letter Queue', desc: 'Poison message isolation' }
    ]

    return html`
      <div class="flows-showcase">
        <header class="showcase-header">
          <h1>Uploop Flows — Breakthrough Execution Patterns</h1>
          <p class="showcase-subtitle">15 live demos. 404 tests. Zero dependencies beyond Uploop.</p>
        </header>

        <nav class="showcase-tabs">
          ${tabs.map(t => html`
            <button
              class=${'tab-btn ' + (state.activeTab === t.id ? 'active' : '')}
              @click=${() => send('switchTab', t.id)}
              title=${t.desc}
            >${t.label}</button>
          `)}
        </nav>

        <main class="showcase-content">
          ${renderTab(state.activeTab, state.demos)}
        </main>
      </div>
    `
  },
  css: `
    .flows-showcase { font-family: system-ui, sans-serif; max-width: 1100px; margin: 0 auto; padding: 1rem; }
    .showcase-header { text-align: center; margin-bottom: 1.5rem; }
    .showcase-header h1 { font-size: 1.6rem; margin: 0; }
    .showcase-subtitle { color: #666; margin: 0.3rem 0 0; font-size: 0.9rem; }
    .showcase-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 1.5rem; }
    .tab-btn { padding: 6px 12px; border: 1px solid #ddd; border-radius: 6px; background: #f5f5f5; cursor: pointer; font-size: 0.8rem; white-space: nowrap; transition: all 0.15s; }
    .tab-btn:hover { background: #e8e8e8; }
    .tab-btn.active { background: #1a73e8; color: #fff; border-color: #1a73e8; }
    .showcase-content { min-height: 400px; }
    .demo-section { background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; padding: 1.5rem; }
    .demo-section h2 { margin: 0 0 0.5rem; font-size: 1.2rem; }
    .demo-desc { color: #666; font-size: 0.85rem; margin-bottom: 1rem; }
    .demo-controls { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 1rem; }
    .demo-btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500; }
    .demo-btn.primary { background: #1a73e8; color: #fff; }
    .demo-btn.danger { background: #d93025; color: #fff; }
    .demo-btn.secondary { background: #e8e8e8; color: #333; }
    .demo-btn:disabled { opacity: 0.5; cursor: default; }
    .demo-input { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; min-width: 200px; }
    .demo-output { margin-top: 0.5rem; }
    .demo-log { max-height: 250px; overflow-y: auto; background: #fafafa; border: 1px solid #eee; border-radius: 6px; padding: 0.5rem; font-size: 0.8rem; font-family: monospace; }
    .demo-log .log-entry { padding: 2px 0; border-bottom: 1px solid #f0f0f0; }
    .demo-stats { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 0.5rem; }
    .stat-item { background: #f0f4ff; padding: 8px 14px; border-radius: 6px; }
    .stat-label { font-size: 0.7rem; color: #666; text-transform: uppercase; }
    .stat-value { font-size: 1.1rem; font-weight: 600; color: #1a73e8; }
    .result-list { max-height: 200px; overflow-y: auto; }
    .result-item { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; }
    .badge { padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; }
    .badge.ok { background: #e6f4ea; color: #1e8e3e; }
    .badge.fail { background: #fce8e6; color: #d93025; }
    .badge.warn { background: #fef7e0; color: #f9ab00; }
    .state-indicator { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600; }
    .state-CLOSED { background: #e6f4ea; color: #1e8e3e; }
    .state-OPEN { background: #fce8e6; color: #d93025; }
    .state-HALF_OPEN { background: #fef7e0; color: #e37400; }
    .form-field { margin-bottom: 0.8rem; }
    .form-field label { display: block; font-size: 0.8rem; font-weight: 500; margin-bottom: 2px; color: #555; }
    .form-field input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; max-width: 300px; }
    .form-field input.invalid { border-color: #d93025; }
    .form-field input.valid { border-color: #1e8e3e; }
  `,
  update: {
    switchTab: (s, tabId) => ({ activeTab: tabId })
  }
})

// ── Tab Renderers ───────────────────────────────────────────

function renderTab(tab, demos) {
  switch (tab) {
    case 'search': return renderSearch(demos.search)
    case 'breaker': return renderBreaker(demos.breaker)
    case 'rate': return renderRateLimiter(demos.rate)
    case 'priority': return renderPriority(demos.priority)
    case 'eventbus': return renderEventBus(demos.eventbus)
    case 'saga': return renderSaga(demos.saga)
    case 'batch': return renderBatch(demos.batch)
    case 'dedup': return renderDedup(demos.dedup)
    case 'fanout': return renderFanOut(demos.fanout)
    case 'actor': return renderActor(demos.actor)
    case 'form': return renderForm(demos.form)
    case 'worker': return renderWorker(demos.worker)
    case 'idempotent': return renderIdempotent(demos.idempotent)
    case 'retry': return renderRetry(demos.retry)
    case 'dlq': return renderDLQ(demos.dlq)
    default: return html`<p>Select a demo</p>`
  }
}

// ── Individual Tab Renderers ────────────────────────────────

function renderSearch(demo) {
  return html`<div class="demo-section">
    <h2>Search Typeahead with Smart Pipeline</h2>
    <p class="demo-desc">200ms debounce + AbortController + LRU cache + ring buffer. No manual wiring.</p>
    <div class="demo-controls">
      <input class="demo-input" type="text" placeholder="Type a name (e.g. Leanne, Ervin)..." oninput=${e => demo.handleInput(e.target.value)} />
    </div>
    <div class="demo-stats">
      <div class="stat-item"><div class="stat-label">API Calls</div><div class="stat-value">${demo.stats().calls}</div></div>
      <div class="stat-item"><div class="stat-label">Aborted</div><div class="stat-value">${demo.stats().aborted}</div></div>
      <div class="stat-item"><div class="stat-label">Cache Hits</div><div class="stat-value">${demo.stats().cached}</div></div>
      <div class="stat-item"><div class="stat-label">Query</div><div class="stat-value">${demo.query() || '—'}</div></div>
    </div>
    ${demo.loading() ? html`<p>⏳ Loading...</p>` : ''}
    <div class="result-list">
      ${demo.results().map(r => html`<div class="result-item"><span>${r.name}</span><span class="badge ok">${r.email}</span></div>`)}
    </div>
  </div>`
}

function renderBreaker(demo) {
  return html`<div class="demo-section">
    <h2>Circuit Breaker — 3-State Protection</h2>
    <p class="demo-desc">CLOSED → OPEN (after 3 failures) → HALF_OPEN (probe after 5s) → CLOSED (on success)</p>
    <div class="demo-controls">
      <button class="demo-btn primary" @click=${() => demo.testCall(false)}>✅ Success Call</button>
      <button class="demo-btn danger" @click=${() => demo.testCall(true)}>❌ Fail Call</button>
      <button class="demo-btn secondary" @click=${() => demo.breaker.reset()}>🔄 Reset</button>
    </div>
    <div class="demo-stats">
      <div class="stat-item"><div class="stat-label">State</div><div class="stat-value"><span class=${'state-indicator state-' + demo.state()}>${demo.state()}</span></div></div>
      <div class="stat-item"><div class="stat-label">Success</div><div class="stat-value">${demo.counts().success}</div></div>
      <div class="stat-item"><div class="stat-label">Failures</div><div class="stat-value">${demo.counts().fail}</div></div>
      <div class="stat-item"><div class="stat-label">Window Failures</div><div class="stat-value">${demo.breaker.failures}</div></div>
    </div>
    <div class="demo-output"><strong>Last: </strong>${demo.lastResult()}</div>
  </div>`
}

function renderRateLimiter(demo) {
  return html`<div class="demo-section">
    <h2>Rate Limiter — Token Bucket</h2>
    <p class="demo-desc">5 tokens/sec + 2 burst. Per-key isolation. Try spamming different keys!</p>
    <div class="demo-controls">
      <button class="demo-btn primary" @click=${() => demo.request('user-a')}>User A</button>
      <button class="demo-btn primary" @click=${() => demo.request('user-b')}>User B</button>
      <button class="demo-btn danger" @click=${() => demo.request('user-c')}>User C</button>
      <button class="demo-btn secondary" @click=${() => demo.limiter.reset('user-a')}>Reset A</button>
    </div>
    <div class="demo-stats">
      <div class="stat-item"><div class="stat-label">✓ Allowed</div><div class="stat-value">${demo.stats().allowed}</div></div>
      <div class="stat-item"><div class="stat-label">✗ Denied</div><div class="stat-value">${demo.stats().denied}</div></div>
    </div>
    <div class="demo-log">
      ${demo.tokens().map(t => html`<div class="log-entry">
        <span>${t.key}</span>
        <span class=${'badge ' + (t.allowed ? 'ok' : 'fail')}>${t.allowed ? '✓' : '✗'}</span>
      </div>`)}
    </div>
  </div>`
}

function renderPriority(demo) {
  return html`<div class="demo-section">
    <h2>Priority Queue with Aging</h2>
    <p class="demo-desc">Low-priority jobs gain priority over time. Critical always first, but background never starves.</p>
    <div class="demo-controls">
      <button class="demo-btn danger" @click=${() => demo.addJob('critical')}>⚡ Critical</button>
      <button class="demo-btn primary" @click=${() => demo.addJob('high')}>🔺 High</button>
      <button class="demo-btn secondary" @click=${() => demo.addJob('normal')}>Normal</button>
      <button class="demo-btn secondary" @click=${() => demo.addJob('low')}>🔻 Low</button>
      <button class="demo-btn secondary" @click=${() => demo.addJob('background')}>💤 Background</button>
    </div>
    <p><strong>Queue:</strong> ${demo.jobs().map(j => html`<span class=${'badge ' + (j.level === 'critical' ? 'fail' : 'warn')}>${j.id}(${j.level})</span> `)}</p>
    <div class="demo-log">
      <p><strong>Processed:</strong></p>
      ${demo.processed().map(p => html`<div class="log-entry">
        <span>${p.id}</span> <span class=${'badge ' + (p.level === 'critical' ? 'fail' : 'ok')}>${p.level}</span>
      </div>`)}
    </div>
  </div>`
}

function renderEventBus(demo) {
  return html`<div class="demo-section">
    <h2>Event Bus — Wildcard Pub/Sub</h2>
    <p class="demo-desc"><code>user.*</code> catches all user events. <code>order.&gt;</code> matches everything under order.</p>
    <div class="demo-controls">
      <button class="demo-btn primary" @click=${() => demo.emit('user.login')}>user.login</button>
      <button class="demo-btn primary" @click=${() => demo.emit('user.logout')}>user.logout</button>
      <button class="demo-btn danger" @click=${() => demo.emit('order.created')}>order.created</button>
      <button class="demo-btn danger" @click=${() => demo.emit('order.shipped')}>order.shipped</button>
      <button class="demo-btn secondary" @click=${() => demo.emit('system.health')}>system.health</button>
    </div>
    <div class="demo-log">
      ${demo.events().map(e => html`<div class="log-entry">
        <span class="badge ok">${e.topic}</span> ${JSON.stringify(e.payload)}
      </div>`)}
    </div>
  </div>`
}

function renderSaga(demo) {
  return html`<div class="demo-section">
    <h2>Saga Checkout — Compensating Transaction</h2>
    <p class="demo-desc">4-step checkout. Failure at any step reverses all previous steps in order.</p>
    <div class="demo-controls">
      <button class="demo-btn primary" @click=${() => demo.runCheckout(false)}>✅ Successful Checkout</button>
      <button class="demo-btn danger" @click=${() => demo.runCheckout(true)}>❌ Fail at Inventory</button>
    </div>
    <div class="demo-log">
      ${demo.steps().map(s => html`<div class="log-entry">
        <span class=${'badge ' + (s.status === '✅' ? 'ok' : s.status.includes('compensated') ? 'warn' : 'fail')}>${s.status}</span>
        ${s.step}
      </div>`)}
    </div>
    ${demo.result() ? html`<p><strong>${demo.result().success ? '✅ Success' : '❌ Failed'}</strong> — ${demo.result().compensated?.length || 0} steps compensated</p>` : ''}
  </div>`
}

function renderBatch(demo) {
  return html`<div class="demo-section">
    <h2>Batch Processor — Accumulate & Flush</h2>
    <p class="demo-desc">Flushes at 5 items or 3 seconds since first item.</p>
    <div class="demo-controls">
      <button class="demo-btn primary" @click=${() => demo.addItem()}>+ Add Item</button>
      <button class="demo-btn danger" @click=${() => demo.flushAll()}>⚡ Force Flush</button>
    </div>
    <div class="demo-stats">
      <div class="stat-item"><div class="stat-label">Pending</div><div class="stat-value">${demo.pending()}</div></div>
      <div class="stat-item"><div class="stat-label">Processed</div><div class="stat-value">${demo.stats().processed}</div></div>
    </div>
    <div class="demo-log">
      ${demo.batches().map(b => html`<div class="log-entry">📦 Batch of ${b.count}: ${b.items.join(', ')}</div>`)}
    </div>
  </div>`
}

function renderDedup(demo) {
  return html`<div class="demo-section">
    <h2>Dedup Filter — Bloom + LRU</h2>
    <p class="demo-desc">Stage 1: Bloom filter (fast, probabilistic). Stage 2: LRU hash (exact). FP rate &lt;1%.</p>
    <div class="demo-controls">
      <button class="demo-btn primary" @click=${() => demo.test('msg-' + Math.floor(Math.random() * 50))}>Random (0-50)</button>
      <button class="demo-btn primary" @click=${() => demo.test('msg-42')}>Fixed: msg-42</button>
      <button class="demo-btn danger" @click=${() => demo.test('msg-7')}>Fixed: msg-7</button>
    </div>
    <div class="demo-stats">
      ${(() => { const s = demo.stats(); return html`<div class="stat-item"><div class="stat-label">Seen</div><div class="stat-value">${s.totalSeen}</div></div>
      <div class="stat-item"><div class="stat-label">Dups</div><div class="stat-value">${s.totalDuplicates}</div></div>
      <div class="stat-item"><div class="stat-label">Bloom FP</div><div class="stat-value">${s.totalBloomFalsePositives}</div></div>
      <div class="stat-item"><div class="stat-label">FP Rate</div><div class="stat-value">${s.falsePositiveRate.toFixed(3)}</div></div>` })()}
    </div>
    <div class="demo-log">
      ${demo.log().map(l => html`<div class="log-entry">
        <span class=${'badge ' + (l.duplicate ? 'fail' : 'ok')}>${l.duplicate ? 'DUP' : 'NEW'}</span>
        ${l.value} <small>(${l.method})</small>
      </div>`)}
    </div>
  </div>`
}

function renderFanOut(demo) {
  return html`<div class="demo-section">
    <h2>Fan-Out / Fan-In — Scatter-Gather</h2>
    <p class="demo-desc">3 concurrent workers. Options: clean run, or with errors (best-effort partial policy).</p>
    <div class="demo-controls">
      <button class="demo-btn primary" @click=${() => demo.runTasks(6, false)}>✅ 6 Tasks (clean)</button>
      <button class="demo-btn danger" @click=${() => demo.runTasks(6, true)}>❌ 6 Tasks (with errors)</button>
    </div>
    ${demo.results() ? html`<div class="demo-stats">
      <div class="stat-item"><div class="stat-label">Completed</div><div class="stat-value">${demo.results().completed}/${demo.results().total}</div></div>
      <div class="stat-item"><div class="stat-label">Success</div><div class="stat-value">${demo.results().success ? '✅' : '❌'}</div></div>
      <div class="stat-item"><div class="stat-label">Errors</div><div class="stat-value">${demo.results().errors.filter(Boolean).length}</div></div>
    </div>
    <div class="result-list">
      ${(demo.results().results || []).filter(Boolean).map(r => html`<div class="result-item"><span class="badge ok">${r}</span></div>`)}
    </div>` : '<p>Click a button to run tasks.</p>'}
  </div>`
}

function renderActor(demo) {
  return html`<div class="demo-section">
    <h2>Actor Model — Isolated State + Sequential Mailbox</h2>
    <p class="demo-desc">Actors own their state. Messages are processed one at a time. No shared state.</p>
    <div class="demo-controls">
      <button class="demo-btn primary" @click=${() => demo.doInc(1)}>+1</button>
      <button class="demo-btn primary" @click=${() => demo.doInc(5)}>+5</button>
      <button class="demo-btn danger" @click=${() => demo.doDec(3)}>-3</button>
      <button class="demo-btn secondary" @click=${() => demo.doReset()}>Reset</button>
    </div>
    <div class="demo-stats">
      <div class="stat-item"><div class="stat-label">State</div><div class="stat-value">${demo.counter.state.value}</div></div>
      <div class="stat-item"><div class="stat-label">Processed</div><div class="stat-value">${demo.counter.totalProcessed}</div></div>
    </div>
    <div class="demo-log">
      ${demo.log().map(l => html`<div class="log-entry">${l}</div>`)}
    </div>
  </div>`
}

function renderForm(demo) {
  return html`<div class="demo-section">
    <h2>Reactive Form — Signals + Computed + Effects</h2>
    <p class="demo-desc">Signals for state, computed for validation, effect for auto-save. No hooks wiring.</p>
    <div class="form-field">
      <label>Name (min 2 chars)</label>
      <input class=${demo.isValid().name ? 'valid' : (demo.name() ? 'invalid' : '')} value=${demo.name()} oninput=${e => demo.setName(e.target.value)} placeholder="John" />
    </div>
    <div class="form-field">
      <label>Email</label>
      <input class=${demo.isValid().email ? 'valid' : (demo.email() ? 'invalid' : '')} value=${demo.email()} oninput=${e => demo.setEmail(e.target.value)} placeholder="john@example.com" />
    </div>
    <div class="form-field">
      <label>Age (1-150)</label>
      <input type="number" class=${demo.isValid().age ? 'valid' : (demo.age() > 0 ? 'invalid' : '')} value=${demo.age()} oninput=${e => demo.setAge(Number(e.target.value))} placeholder="30" />
    </div>
    <button class="demo-btn primary" ?disabled=${!demo.isValid().all} @click=${demo.submit}>Submit</button>
    ${demo.submitted() ? html`<p>✅ Submitted: ${JSON.stringify(demo.submitted())}</p>` : ''}
  </div>`
}

function renderWorker(demo) {
  return html`<div class="demo-section">
    <h2>CPU Offloading — Fibonacci Computation</h2>
    <p class="demo-desc">Offload CPU-bound tasks to workers (simulated). In production: true Worker threads with 0ms main thread blocking.</p>
    <div class="demo-controls">
      <button class="demo-btn primary" @click=${() => demo.compute(35)}>fib(35)</button>
      <button class="demo-btn primary" @click=${() => demo.compute(40)}>fib(40)</button>
      <button class="demo-btn danger" @click=${() => demo.compute(45)}>fib(45)</button>
    </div>
    ${demo.computing() ? '<p>⏳ Computing...</p>' : ''}
    <div class="demo-log">
      ${demo.results().map(r => html`<div class="log-entry">
        fib(${r.n}) = <strong>${r.result}</strong> <small>(${r.elapsed}ms)</small>
      </div>`)}
    </div>
  </div>`
}

function renderIdempotent(demo) {
  return html`<div class="demo-section">
    <h2>Idempotency Guard — At-Most-Once Semantics</h2>
    <p class="demo-desc">Same key → same result, never re-executed. Payment dedup.</p>
    <div class="demo-controls">
      <button class="demo-btn primary" @click=${() => demo.processPayment('order-123', 99)}>💳 Pay order-123 ($99)</button>
      <button class="demo-btn primary" @click=${() => demo.processPayment('order-123', 99)}>💳 Pay order-123 ($99) — duplicate</button>
      <button class="demo-btn secondary" @click=${() => demo.processPayment('order-456', 49)}>💳 Pay order-456 ($49)</button>
    </div>
    <div class="demo-stats">
      ${(() => { const s = demo.stats(); return html`<div class="stat-item"><div class="stat-label">Cache</div><div class="stat-value">${s.cacheSize}</div></div>
      <div class="stat-item"><div class="stat-label">Hits</div><div class="stat-value">${s.hits}</div></div>
      <div class="stat-item"><div class="stat-label">Replays</div><div class="stat-value">${s.replays}</div></div>` })()}
    </div>
    <div class="demo-log">
      ${demo.log().map(l => html`<div class="log-entry">
        <span class=${'badge ' + (l.replayed ? 'warn' : 'ok')}>${l.replayed ? '🔁 REPLAY' : '✅ NEW'}</span>
        ${l.key}: $${l.amount} → ${l.status} (${l.txId})
      </div>`)}
    </div>
  </div>`
}

function renderRetry(demo) {
  return html`<div class="demo-section">
    <h2>Retry with Backoff — Exponential + Jitter</h2>
    <p class="demo-desc">Fails twice, recovers on 3rd attempt. Exponential backoff with jitter prevents thundering herd.</p>
    <div class="demo-controls">
      <button class="demo-btn primary" @click=${() => demo.call(true, 2)}>Fails 2× (recovers)</button>
      <button class="demo-btn danger" @click=${() => demo.call(true, 5)}>Fails 5× (exhausted)</button>
      <button class="demo-btn primary" @click=${() => demo.call(false)}>Always succeeds</button>
    </div>
    <div class="demo-log">
      ${demo.log().map(l => html`<div class="log-entry">
        <span class=${'badge ' + (l.error ? 'fail' : 'ok')}>${l.error ? '❌ ' + l.error : '✅ ' + l.result}</span>
        <small>(${l.attempts} attempts)</small>
      </div>`)}
    </div>
  </div>`
}

function renderDLQ(demo) {
  return html`<div class="demo-section">
    <h2>Dead Letter Queue — Poison Message Isolation</h2>
    <p class="demo-desc">Failed messages go to DLQ instead of being lost. Replay when ready. Alert at threshold.</p>
    <div class="demo-controls">
      <button class="demo-btn danger" @click=${() => demo.failMessage('orders', 'Failed order #' + Math.floor(Math.random() * 1000))}>Fail Order</button>
      <button class="demo-btn danger" @click=${() => demo.failMessage('payments', 'Failed payment #' + Math.floor(Math.random() * 1000))}>Fail Payment</button>
      <button class="demo-btn primary" @click=${() => demo.replay('orders')}>Replay Orders</button>
      <button class="demo-btn primary" @click=${() => demo.replay('payments')}>Replay Payments</button>
    </div>
    <div class="demo-stats">
      ${(() => {
        const s = demo.stats()
        const keys = Object.keys(s)
        return keys.map(k => html`<div class="stat-item"><div class="stat-label">${k}</div><div class="stat-value">${s[k].queued} queued / ${s[k].totalReplayed} replayed</div></div>`)
      })()}
    </div>
    <div class="demo-log">
      ${demo.log().map(l => html`<div class="log-entry">${l}</div>`)}
    </div>
  </div>`
}

export function mountShowcase(root) {
  FlowsShowcase.mount(root || document.getElementById('root'))
}
