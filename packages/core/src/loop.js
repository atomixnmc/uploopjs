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
    maxEventsPerTransaction = 0
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

  // HyperGraph manifest
  const graph = {
    kind: 'uploop.loop',
    name: config.name || 'unnamed',
    nodes: { state: { type: 'data', access: 'readwrite' } },
    edges: []
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
    const handler = updateHandlers[event]

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
    if (!handler) {
      if (config.onUnknownEvent) config.onUnknownEvent(event, ...args)
      return
    }

    // ── Execute Handler (with context save/restore) ────────
    const prevDepth = _evDepth
    const prevId = _evId
    const prevSource = _evSource
    const prevTransaction = _evTransaction

    _evDepth = depth
    _evId = envelope.id
    _evSource = envelope.source
    _evTransaction = transaction

    try {
      batch(() => {
        const currentState = stateSignal.get()
        let result

        if (typeof handler === 'function') {
          result = handler(currentState, ...args)
        }

        if (result !== undefined && result !== currentState) {
          const nextState = { ...currentState, ...result }
          stateSignal.set(nextState)
        }
      }, {
        notify: () => {
          notify()
          runEffects()
        }
      })
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

  function describe() {
    const result = JSON.parse(JSON.stringify(graph))
    // Add event metadata (total/rejected counts for diagnostics)
    result.events = {
      total: _evCounter,
      rejected: _evRejected
    }
    return result
  }

  function dispose() {
    subscribers.clear()
    effects.disposeAll()
    frame.dispose()
    scope.dispose()
    stateSignal.dispose()
    _txCounts.clear()
  }

  // Register initial nodes
  for (const name of Object.keys(updateHandlers)) {
    graph.nodes[name] = { type: 'update', reads: ['state'], writes: ['state'] }
  }
  for (const name of Object.keys(effectHandlers)) {
    graph.nodes[name] = { type: 'effect' }
  }

  return {
    get, set, send, subscribe, on, effect,
    frame, batch,
    use: (plugin) => use({ get, set, send, subscribe, frame, describe }, plugin),
    registerNode, registerEdge, describe, dispose,
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
