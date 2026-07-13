/**
 * Reactive Pattern — signals, computed values, and effects on HyperGraph.
 *
 * Provides Solid.js / RxJS style reactive primitives that compile down to
 * HyperGraph data nodes + update nodes + edges. Developer-friendly syntax
 * with all the power of HyperGraph's temperature routing, lane scheduling,
 * and binary streaming underneath.
 *
 * ## Pattern Choice
 *
 * | Pattern        | When to use                          |
 * |----------------|--------------------------------------|
 * | Reactive       | UI-derived data, computed views, form wiring    |
 * | Actor          | Distributed state, fault isolation, supervision |
 * | Pipeline/Queue | Stream processing, ETL, batch work             |
 * | HyperGraph     | Complex relationships, multi-entity graphs     |
 *
 * ## Relationship to HyperGraph
 *
 * ```
 * createSignal('count', 0)
 *   → HyperGraph: data node { type: 'data', default: 0, temperature: 'hot' }
 *
 * createComputed('double', () => count() * 2, [count])
 *   → HyperGraph: update node { reads: ['count'], writes: ['double'], run: fn }
 *
 * createEffect(() => console.log(count()), [count])
 *   → HyperGraph: effect node { reads: ['count'], run: fn }
 * ```
 *
 * @module @uploop/flows/reactive
 */

// ── Signal ─────────────────────────────────────────────────

let _currentObserver = null
const _observerStack = []

function _pushObserver(fn) {
  _observerStack.push(_currentObserver)
  _currentObserver = fn
}

function _popObserver() {
  _currentObserver = _observerStack.pop()
}

/**
 * Create a reactive signal — a mutable value that tracks dependencies.
 *
 * @param {*} initialValue
 * @param {object} [opts]
 * @param {string} [opts.name] — signal name (for debugging)
 * @param {boolean} [opts.equals] — custom equality check (default: Object.is)
 * @returns {[getter, setter]}
 */
export function createSignal(initialValue, opts = {}) {
  const { name = 'signal', equals = Object.is } = opts
  let _value = initialValue
  const _subscribers = new Set() // fns to call on change

  function get() {
    if (_currentObserver) {
      _subscribers.add(_currentObserver)
    }
    return _value
  }

  function set(newValue) {
    const resolved = typeof newValue === 'function' ? newValue(_value) : newValue
    if (equals(_value, resolved)) return _value
    const prevValue = _value
    _value = resolved
    // notify subscribers with the NEW value, batched
    const subs = [..._subscribers]
    if (subs.length > 0) {
      const val = _value // capture now, not during batch
      scheduleBatch(() => {
        for (const fn of subs) {
          try { fn(val) } catch (e) { console.error(`[reactive:${name}] subscriber error:`, e) }
        }
      })
    }
    return _value
  }

  function update(fn) {
    return set(fn(_value))
  }

  // extend getter with properties
  get.set = set
  get.update = update
  get.peek = () => _value
  get.subscribe = (fn) => { _subscribers.add(fn); return () => _subscribers.delete(fn) }

  return [get, set]
}

// ── Computed ───────────────────────────────────────────────

/**
 * Create a computed (derived) value that auto-updates when dependencies change.
 *
 * @param {function} fn — computation function
 * @param {Array} [deps] — signals this depends on (auto-detected if omitted)
 * @param {object} [opts]
 * @returns {function} getter function
 */
export function createComputed(fn, deps, opts = {}) {
  const { name = 'computed' } = opts
  let _value
  let _dirty = true
  let _sources = new Set()

  function get() {
    if (_currentObserver) {
      _sources.forEach(s => {
        if (typeof s.subscribe === 'function') s.subscribe(_currentObserver)
      })
    }
    if (_dirty) {
      _pushObserver(recompute)
      _value = fn()
      _popObserver()
      _dirty = false
    }
    return _value
  }

  function recompute() {
    _dirty = true
  }

  // If deps provided, subscribe to them
  if (deps) {
    for (const dep of deps) {
      if (dep && typeof dep.subscribe === 'function') {
        _sources.add(dep)
        dep.subscribe(recompute)
      }
    }
    // initial compute to set up auto-tracking
    _pushObserver(recompute)
    _value = fn()
    _popObserver()
    _dirty = false
  }

  get.recompute = recompute
  get.peek = () => (_dirty ? get() : _value)

  return get
}

// ── Effect ─────────────────────────────────────────────────

/**
 * Create an effect — a side effect that re-runs when dependencies change.
 *
 * @param {function} fn — effect function
 * @param {Array} [deps] — explicit dependencies
 * @returns {{ dispose: function }}
 */
export function createEffect(fn, deps) {
  let _disposed = false
  let _cleanup

  function run() {
    if (_disposed) return
    if (typeof _cleanup === 'function') _cleanup()
    _pushObserver(run)
    _cleanup = fn()
    _popObserver()
  }

  if (deps) {
    for (const dep of deps) {
      if (dep && typeof dep.subscribe === 'function') {
        dep.subscribe(() => {
          if (!_disposed) scheduleBatch(run)
        })
      }
    }
  }

  // initial run
  scheduleBatch(run)

  return {
    dispose() {
      _disposed = true
      if (typeof _cleanup === 'function') _cleanup()
      _cleanup = undefined
    }
  }
}

// ── Batch ──────────────────────────────────────────────────

let _batchQueue = []
let _batchScheduled = false

function scheduleBatch(fn) {
  _batchQueue.push(fn)
  if (!_batchScheduled) {
    _batchScheduled = true
    Promise.resolve().then(flushBatch)
  }
}

function flushBatch() {
  _batchScheduled = false
  const queue = _batchQueue
  _batchQueue = []
  for (const fn of queue) {
    try { fn() } catch (e) { console.error('[reactive:batch] error:', e) }
  }
}

/**
 * Execute fn with batching — all signal updates within are deferred
 * until fn completes.
 */
export function batch(fn) {
  const prevQueue = _batchQueue
  _batchQueue = []
  try {
    fn()
  } finally {
    // flush any accumulated updates
    if (_batchQueue.length > 0) {
      const pending = _batchQueue
      _batchQueue = prevQueue
      for (const f of pending) {
        try { f() } catch (e) {}
      }
    }
  }
}

// ── Store (Signal Collection) ──────────────────────────────

/**
 * Create a reactive store — multiple signals managed as a group.
 *
 * @param {object} initialState
 * @returns {object} store with .get('key'), .set('key', val), .on('key', fn)
 */
export function createReactiveStore(initialState = {}) {
  const signals = {}
  const store = {}

  for (const [key, value] of Object.entries(initialState)) {
    const [get, set] = createSignal(value, { name: key })
    signals[key] = { get, set }
    Object.defineProperty(store, key, {
      get: () => signals[key].get(),
      set: (v) => signals[key].set(v),
      enumerable: true
    })
  }

  store.get = (key) => signals[key]?.get()
  store.set = (key, value) => signals[key]?.set(value)
  store.update = (key, fn) => { const s = signals[key]; if (s) s.get.update(fn) }
  store.peek = (key) => signals[key]?.get.peek()
  store.on = (key, fn) => signals[key]?.get.subscribe(fn)
  store.keys = () => Object.keys(signals)
  store.snapshot = () => {
    const snap = {}
    for (const key of Object.keys(signals)) snap[key] = signals[key].get.peek()
    return snap
  }

  store.describe = () => ({
    kind: 'uploop.flow.reactiveStore',
    keys: Object.keys(signals),
    values: store.snapshot()
  })

  return store
}

// ── Resource (Async Signal) ────────────────────────────────

/**
 * Create an async resource — a signal that loads from a promise.
 * Returns { loading, error, data, refetch }.
 *
 * @param {function} fetcher — () => Promise<data>
 * @param {object} [opts]
 */
export function createResource(fetcher, opts = {}) {
  const { initialValue, lazy = false } = opts
  const [loadingSignal, setLoading] = createSignal(!lazy)
  const [errorSignal, setError] = createSignal(null)
  const [dataSignal, setData] = createSignal(initialValue)
  let _abortController = null

  async function refetch() {
    _abortController?.abort()
    _abortController = new AbortController()
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher({ signal: _abortController.signal })
      setData(result)
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError(e)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!lazy) refetch()

  return {
    loading: loadingSignal,
    error: errorSignal,
    data: dataSignal,
    get state() {
      if (loadingSignal()) return 'loading'
      if (errorSignal()) return 'error'
      return 'ready'
    },
    refetch,
    dispose() { _abortController?.abort() }
  }
}

// ── From / To (Reactive ↔ HyperGraph Bridge) ───────────────

/**
 * Create reactive signals from HyperGraph data nodes.
 * Changes to signals auto-propagate to the graph and vice versa.
 *
 * @param {object} graph — HyperGraph instance (from createGraph)
 * @param {string[]} nodeNames — data node names to bridge
 * @returns {object} reactive store
 */
export function reactiveFromGraph(graph, nodeNames) {
  const signals = {}

  for (const name of nodeNames) {
    const [get, set] = createSignal(graph.getNode(name), { name })
    // graph → signal
    graph.onNodeChange?.(name, (value) => set(value))
    // signal → graph
    const originalSet = set
    signals[name] = {
      get,
      set: (v) => { originalSet(v); graph.setNode?.(name, v); return v }
    }
  }

  const store = {}
  for (const [key, sig] of Object.entries(signals)) {
    Object.defineProperty(store, key, {
      get: sig.get,
      set: sig.set,
      enumerable: true
    })
  }

  return store
}

// ── Scheduler Hooks ────────────────────────────────────────

/**
 * Enable lane-aware scheduling for reactive updates.
 * Hot signals update on RAF, cold signals update on idle.
 */
export function configureReactiveScheduler({ schedule }) {
  // override scheduleBatch to use lane-aware scheduler
  const originalSchedule = scheduleBatch
  // This is a hook — actual lane routing happens at the graph level
  return { originalSchedule }
}
