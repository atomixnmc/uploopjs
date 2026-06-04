import { createSignal } from './signal.js'
import { createFrame } from './frame.js'
import { createEffectSystem } from './effect.js'
import { batch } from './batch.js'
import { createScope } from './scope.js'
import { use } from './plugin.js'

/**
 * Create an Uploop update loop.
 *
 * Event Processing Pipeline:
 *
 *   send('eventName', ...payload)
 *       │
 *       ▼
 *   ┌──────────────────────────────────────┐
 *   │  Create Event Envelope               │
 *   │  ├─ id:        'ev_42'              │
 *   │  ├─ type:      'eventName'          │
 *   │  ├─ payload:   [...]                │
 *   │  ├─ source:    'user'               │
 *   │  ├─ cause:     'ev_41' | null       │
 *   │  ├─ depth:     parentDepth + 1      │
 *   │  ├─ timestamp: 1234567              │
 *   │  └─ transaction: 'tx_abc'           │
 *   └──────────────────────────────────────┘
 *       │
 *       ▼
 *   ┌──────────────────────────────────────┐
 *   │  Guard: maxEventDepth               │
 *   │  depth > maxEventDepth → REJECT     │
 *   └──────────────────────────────────────┘
 *       │
 *       ▼
 *   ┌──────────────────────────────────────┐
 *   │  Guard: maxEventsPerTransaction     │
 *   │  same event > limit → REJECT        │
 *   └──────────────────────────────────────┘
 *       │
 *       ▼
 *   ┌──────────────────────────────────────┐
 *   │  Execute Update Handler              │
 *   │  (state, ...payload) → partialState  │
 *   │  If handler calls send() → recurse    │
 *   │  with depth+1, cause=current id       │
 *   └──────────────────────────────────────┘
 *       │
 *       ▼
 *   batch complete → notify subscribers (async, via frame scheduler)
 *
 * @param {import('./types.js').LoopConfig} config
 * @returns {import('./types.js').Loop}
 */
export function createLoop(config = {}) {
  const {
    state: initialState = {},
    update: updateHandlers = {},
    effect: effectHandlers = {},
    maxEventDepth = 100,
    maxEventsPerTransaction = 0,
    error: errorConfig = {},
    suspend: suspendConfig = {}
  } = config

  // Core state
  const stateSignal = createSignal({ ...initialState })
  const frame = createFrame(config.frame || 'micro')
  const scope = createScope()
  const effects = createEffectSystem(
    { ...effectHandlers },
    () => stateSignal.get(),
    (event, ...args) => send(event, ...args)
  )
  const subscribers = new Set()

  // ─── Event Processing State ──────────────────────────────
  // These track the current event chain across nested send() calls.
  let _evDepth = 0
  let _evId = null
  let _evSource = 'user'
  let _evTransaction = null
  let _evCounter = 0
  let _evRejected = 0

  // Transaction-scoped event counters: Map<transaction, Map<eventType, count>>
  const _txCounts = new Map()

  // ─── Async Metadata State ────────────────────────────────

  /** @type {Map<string, { run: Function, debounce: number, interruptible: boolean }>} */
  const _handlerMeta = new Map()

  /** @type {Map<string, number>} event → timer ID for debounced handlers */
  const _debounceTimers = new Map()

  /** @type {Map<string, AbortController>} event → controller for interruptible handlers */
  const _abortControllers = new Map()

  /** @type {Map<string, { message: string, retriesLeft: number, fallback?: any }>} */
  const _errors = new Map()

  /** @type {Set<string>} events with in-flight async handlers */
  const _pending = new Set()

  // Parse handler metadata from config
  for (const [name, handler] of Object.entries(updateHandlers)) {
    if (typeof handler === 'object' && handler !== null && !Array.isArray(handler)) {
      _handlerMeta.set(name, {
        run: handler.run,
        debounce: handler.debounce || 0,
        interruptible: handler.interruptible || false
      })
    }
  }

  // HyperGraph manifest
  const graph = {
    kind: 'uploop.loop',
    name: config.name || 'unnamed',
    nodes: { state: { type: 'data', access: 'readwrite' } },
    edges: []
  }

  // ─── Internal Helpers ────────────────────────────────────

  /**
   * Execute a handler's run function with error/suspend tracking.
   * Called after debounce timer fires (or immediately for non-debounced).
   */
  function _executeHandler(event, state, args, envelope) {
    const meta = _handlerMeta.get(event)
    let signal = undefined

    // ── Interruptible: abort previous, create new controller ──
    if (meta && meta.interruptible) {
      const prevCtrl = _abortControllers.get(event)
      if (prevCtrl) prevCtrl.abort()
      const ctrl = new AbortController()
      _abortControllers.set(event, ctrl)
      signal = ctrl.signal
    }

    const runFn = meta ? meta.run : updateHandlers[event]

    // ── Execute handler ─────────────────────────────────────
    let result
    const execArgs = meta && meta.interruptible
      ? [state, ...args, { signal }]
      : [state, ...args]

    // Track pending for async handlers
    const maybeMarkPending = (promiseOrVal) => {
      if (promiseOrVal instanceof Promise) {
        _pending.add(event)
        return promiseOrVal
          .then(v => { _pending.delete(event); return v })
          .catch(e => { _pending.delete(event); throw e })
      }
      return promiseOrVal
    }

    try {
      result = maybeMarkPending(runFn(...execArgs))
    } catch (err) {
      _handleError(event, err)
      return
    }

    // Handle async result
    if (result instanceof Promise) {
      result.then(
        (resolved) => {
          if (resolved !== undefined && resolved !== state) {
            const nextState = { ...stateSignal.get(), ...resolved }
            stateSignal.set(nextState)
            notify()
            runEffects()
          }
        },
        (err) => {
          _handleError(event, err)
        }
      )
    } else if (result !== undefined && result !== state) {
      const nextState = { ...state, ...result }
      stateSignal.set(nextState)
    }
  }

  function _handleError(event, err) {
    const ec = errorConfig[event]
    if (!ec) {
      console.error(`[Uploop] Handler "${event}" error:`, err)
      return
    }

    const prev = _errors.get(event)
    const retriesLeft = prev ? prev.retriesLeft - 1 : (ec.retry || 0)
    const entry = {
      message: err.message || String(err),
      retriesLeft,
      fallback: ec.fallback
    }
    _errors.set(event, entry)

    // Apply fallback state
    if (ec.fallback !== undefined) {
      const nextState = { ...stateSignal.get(), ...ec.fallback }
      stateSignal.set(nextState)
      notify()
    }

    // Schedule retry with exponential backoff
    if (retriesLeft > 0) {
      const maxRetries = ec.retry || 0
      const delay = Math.pow(2, maxRetries - retriesLeft) * 1000
      setTimeout(() => send(event, ...[]), delay)
    } else {
      console.error(`[Uploop] Handler "${event}" failed, no retries left:`, err)
    }
  }

  // ─── Public API ──────────────────────────────────────────

  function get() {
    return stateSignal.get()
  }

  function set(patch) {
    const next = typeof patch === 'function'
      ? patch(stateSignal.get())
      : { ...stateSignal.get(), ...patch }
    stateSignal.set(next)
    notify()
  }

  /**
   * Send an event through the Uploop processing pipeline.
   *
   * Every send() creates an EventEnvelope, runs guards, and
   * (if accepted) executes the registered handler.
   * Handlers that call send() recursively are tracked via
   * depth and transaction counters.
   */
  function send(event, ...args) {
    const rawHandler = updateHandlers[event]
    const meta = _handlerMeta.get(event)

    // ── Create Event Envelope ──────────────────────────────
    const depth = _evDepth + 1
    const transaction = _evTransaction || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const envelope = {
      id: `ev_${++_evCounter}`,
      type: event,
      payload: args,
      source: _evSource,
      cause: _evId,
      depth,
      timestamp: Date.now(),
      transaction
    }

    // ── Guard 1: maxEventDepth ─────────────────────────────
    if (depth > maxEventDepth) {
      _evRejected++
      const msg = `[Uploop] Event "${event}" rejected at depth ${depth} (max: ${maxEventDepth}). Possible infinite loop.`
      console.error(msg, `chain: ${_evId} → ${envelope.id}`)
      if (config.onEventRejected) config.onEventRejected(envelope)
      return
    }

    // ── Guard 2: maxEventsPerTransaction ───────────────────
    if (maxEventsPerTransaction > 0) {
      let txMap = _txCounts.get(transaction)
      if (!txMap) {
        txMap = new Map()
        _txCounts.set(transaction, txMap)
      }
      const count = (txMap.get(event) || 0) + 1
      txMap.set(event, count)
      if (count > maxEventsPerTransaction) {
        _evRejected++
        const msg = `[Uploop] Event "${event}" fired ${count}x in transaction ${transaction.slice(0, 10)} (limit: ${maxEventsPerTransaction}). Possible cycle.`
        console.error(msg)
        if (config.onEventRejected) config.onEventRejected(envelope)
        return
      }
    }

    // ── No registered handler? ─────────────────────────────
    if (!rawHandler) {
      if (config.onUnknownEvent) config.onUnknownEvent(event, ...args)
      return
    }

    // ── Debounce: delay handler execution ──────────────────
    if (meta && meta.debounce > 0) {
      const prevTimer = _debounceTimers.get(event)
      if (prevTimer) clearTimeout(prevTimer)
      const timerId = setTimeout(() => {
        _debounceTimers.delete(event)
        _executeWithContext(event, args, envelope)
      }, meta.debounce)
      _debounceTimers.set(event, timerId)
      return
    }

    // ── Execute immediately (non-debounced) ────────────────
    _executeWithContext(event, args, envelope)
  }

  /**
   * Execute a handler within the event context save/restore wrapper.
   * Used by both immediate and debounced paths.
   */
  function _executeWithContext(event, args, envelope) {
    const prevDepth = _evDepth
    const prevId = _evId
    const prevSource = _evSource
    const prevTransaction = _evTransaction

    _evDepth = envelope.depth
    _evId = envelope.id
    _evSource = envelope.source
    _evTransaction = envelope.transaction

    try {
      const meta = _handlerMeta.get(event)
      const handler = updateHandlers[event]

      // If handler is an object (with metadata), delegate to _executeHandler
      if (meta) {
        const stateBefore = stateSignal.get()
        batch(() => {
          _executeHandler(event, stateBefore, envelope.payload, envelope)
        }, {
          notify: () => {
            // For sync handlers, state would already be set in _executeHandler.
            // For async handlers, state is set in the .then() callback outside batch.
            // Only notify if state actually changed.
            const stateAfter = stateSignal.get()
            if (stateAfter !== stateBefore) {
              notify()
              runEffects()
            }
          }
        })
      } else {
        // Plain function handler — original behavior
        let _stateDidChange = false
        batch(() => {
          const currentState = stateSignal.get()
          let result

          if (typeof handler === 'function') {
            result = handler(currentState, ...envelope.payload)
          }

          if (result !== undefined && result !== currentState) {
            const nextState = { ...currentState, ...result }
            stateSignal.set(nextState)
            _stateDidChange = true
          }
        }, {
          notify: () => {
            if (_stateDidChange) {
              notify()
              runEffects()
            }
          }
        })
      }
    } finally {
      _evDepth = prevDepth
      _evId = prevId
      _evSource = prevSource
      _evTransaction = prevTransaction
    }
  }

  function subscribe(fn) {
    subscribers.add(fn)
    return () => subscribers.delete(fn)
  }

  function notify() {
    const currentState = stateSignal.get()
    frame.schedule(() => {
      for (const fn of subscribers) {
        try { fn(currentState) } catch (e) { console.error('Subscriber error:', e) }
      }
    })
  }

  function runEffects() {
    for (const name of Object.keys(effectHandlers)) {
      try { effects.run(name) } catch (e) { console.error(`Effect "${name}" error:`, e) }
    }
  }

  function on(event, handler) {
    updateHandlers[event] = handler
    if (typeof handler === 'object' && handler !== null && !Array.isArray(handler)) {
      _handlerMeta.set(event, {
        run: handler.run,
        debounce: handler.debounce || 0,
        interruptible: handler.interruptible || false
      })
    }
    graph.nodes[event] = { type: 'update', reads: ['state'], writes: ['state'] }
  }

  function effect(name, handler) {
    effectHandlers[name] = handler
    effects.register(name, handler)
    graph.nodes[name] = { type: 'effect' }
  }

  function registerNode(name, nodeDef) {
    graph.nodes[name] = nodeDef
  }

  function registerEdge(from, to) {
    graph.edges.push([from, to])
  }

  /**
   * Returns true if an async handler for this event is currently running.
   * @param {string} event
   * @returns {boolean}
   */
  function isPending(event) {
    return _pending.has(event)
  }

  /**
   * Returns current error state for an event, or null.
   * @param {string} event
   * @returns {{ message: string, retriesLeft: number } | null}
   */
  function getError(event) {
    const err = _errors.get(event)
    if (!err) return null
    return { message: err.message, retriesLeft: err.retriesLeft }
  }

  /**
   * Clears error state for an event.
   * @param {string} event
   */
  function clearError(event) {
    _errors.delete(event)
  }

  /**
   * Returns metadata for an event handler.
   * @param {string} event
   * @returns {{ debounce: number, interruptible: boolean } | null}
   */
  function getMeta(event) {
    const meta = _handlerMeta.get(event)
    if (!meta) return null
    return { debounce: meta.debounce, interruptible: meta.interruptible }
  }

  function describe() {
    const result = JSON.parse(JSON.stringify(graph))
    // Add event metadata (total/rejected counts for diagnostics)
    result.events = {
      total: _evCounter,
      rejected: _evRejected
    }
    // Add node-level metadata for update handlers
    for (const [name, meta] of _handlerMeta) {
      if (result.nodes[name]) {
        if (meta.debounce > 0) result.nodes[name].debounce = meta.debounce
        if (meta.interruptible) result.nodes[name].interruptible = true
      }
    }
    // Add error config metadata
    for (const name of Object.keys(errorConfig)) {
      if (result.nodes[name]) {
        const ec = errorConfig[name]
        result.nodes[name].error = {
          hasFallback: ec.fallback !== undefined,
          retries: ec.retry || 0
        }
      }
    }
    // Add suspend config metadata
    for (const name of Object.keys(suspendConfig)) {
      if (result.nodes[name]) {
        result.nodes[name].suspend = true
      }
    }
    return result
  }

  function dispose() {
    // Clear all debounce timers
    for (const [event, timerId] of _debounceTimers) {
      clearTimeout(timerId)
    }
    _debounceTimers.clear()

    // Abort all pending interruptible handlers
    for (const [event, ctrl] of _abortControllers) {
      ctrl.abort()
    }
    _abortControllers.clear()

    // Clear remaining state
    _errors.clear()
    _pending.clear()
    _handlerMeta.clear()

    subscribers.clear()
    effects.disposeAll()
    frame.dispose()
    scope.dispose()
    stateSignal.dispose()
    _txCounts.clear()
  }

  // Register initial nodes
  for (const name of Object.keys(updateHandlers)) {
    const meta = _handlerMeta.get(name)
    const nodeDef = { type: 'update', reads: ['state'], writes: ['state'] }
    if (meta) {
      if (meta.debounce > 0) nodeDef.debounce = meta.debounce
      if (meta.interruptible) nodeDef.interruptible = true
    }
    if (errorConfig[name]) nodeDef.error = true
    if (suspendConfig[name]) nodeDef.suspend = true
    graph.nodes[name] = nodeDef
  }
  for (const name of Object.keys(effectHandlers)) {
    graph.nodes[name] = { type: 'effect' }
  }

  return {
    get, set, send, subscribe, on, effect,
    frame, batch,
    use: (plugin) => use({ get, set, send, subscribe, frame, describe }, plugin),
    registerNode, registerEdge, describe, dispose,
    isPending, getError, clearError, getMeta,
    events: {
      get total() { return _evCounter },
      get rejected() { return _evRejected },
      get depth() { return _evDepth }
    },
    nodes: {
      get names() { return Object.keys(graph.nodes) },
      get: (name) => graph.nodes[name]
    },
    edges: {
      get list() { return [...graph.edges] }
    },
    _signal: stateSignal,
    _notify: notify
  }
}
