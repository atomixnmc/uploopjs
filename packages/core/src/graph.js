import { createSignal } from './signal.js'
import { createFrame } from './frame.js'
import { batch } from './batch.js'
import { createScope } from './scope.js'
import { use } from './plugin.js'

/**
 * Create an Uploop HyperGraph — the core primitive.
 *
 * A graph is a collection of typed nodes connected by edges.
 * Each node declares what it reads, writes, and how it should
 * be scheduled. The Runner compiles this into fast dependency
 * indexes and handles event dispatch, state patching, view
 * invalidation, and frame scheduling.
 *
 * ─── Node Types ──────────────────────────────────────────
 * data     - state/signal value
 * update   - pure transformation (reads data, writes data)
 * view     - render output (reads data)
 * effect   - side-effect handler
 * event    - external trigger
 * resource - fetch/cache/db
 *
 * ─── Architecture vs createLoop() ────────────────────────
 * createGraph() is the architecture-first version:
 *   • Nodes declare reads/writes explicitly
 *   • Edges define the data flow topology
 *   • Runner compiles dependency indexes at startup
 *   • When data changes, only affected views are notified
 *   • Per-node metadata (lifetime, frame, debounce, cache)
 *
 * createLoop() is the simplified version for quick use.
 * Internally it creates a flatten graph with implicit edges.
 *
 * @param {Object} config
 * @param {string} config.name - Graph name
 * @param {Object<string, Object>} config.nodes - Node definitions
 * @param {Array<[string, string]>} [config.edges] - Edge pairs
 * @param {Object<string, Function>} [config.on] - Event → update handlers
 * @param {number} [config.maxEventDepth=100]
 * @param {number} [config.maxEventsPerTransaction=0]
 * @returns {Object} Graph API
 */
export function createGraph(config = {}) {
  const { name = 'graph', nodes = {}, edges = [], on: eventHandlers = {} } = config
  const maxEventDepth = config.maxEventDepth ?? 100
  const maxEventsPerTransaction = config.maxEventsPerTransaction ?? 0

  // ─── Extract node definitions ──────────────────────────
  const nodeDefs = new Map()   // name → { type, readKeys, writeKeys, default, ...meta }
  const dataNodes = new Map()  // name → signal
  const updateFns = new Map()  // name → handler function
  const effectFns = new Map()  // name → handler function
  const viewFns = new Map()    // name → handler function
  const eventToUpdate = new Map() // event → update node name

  for (const [nodeName, def] of Object.entries(nodes)) {
    const type = def.type || 'data'
    const meta = { ...def, type }
    nodeDefs.set(nodeName, meta)

    if (type === 'data') {
      dataNodes.set(nodeName, createSignal(def.default !== undefined ? def.default : null))
    } else if (type === 'update' && def.run) {
      updateFns.set(nodeName, def.run)
    } else if (type === 'view' && def.run) {
      viewFns.set(nodeName, def.run)
    } else if (type === 'effect' && def.run) {
      effectFns.set(nodeName, def.run)
    }
  }

  // ─── Compile dependency indexes ────────────────────────
  // dataToUpdates:  dataName → [updateNodeNames]
  // dataToViews:    dataName → [viewNodeNames]
  // updateToData:   updateName → [writtenDataNames]
  // eventToUpdate:  eventName → updateName

  const dataToUpdates = new Map()
  const dataToViews = new Map()
  const updateToData = new Map()

  for (const [name, meta] of nodeDefs) {
    const reads = meta.reads || []
    const writes = meta.writes || []

    if (meta.type === 'update') {
      updateToData.set(name, writes)
      for (const d of writes) {
        if (!dataToUpdates.has(d)) dataToUpdates.set(d, [])
        dataToUpdates.get(d).push(name)
      }
    }

    if (meta.type === 'view') {
      for (const d of reads) {
        if (!dataToViews.has(d)) dataToViews.set(d, [])
        dataToViews.get(d).push(name)
      }
    }
  }

  // Register event handlers: key = event name, value = update node name
  for (const [ev, updateName] of Object.entries(eventHandlers)) {
    eventToUpdate.set(ev, updateName)
  }
  // Also from edges: [eventName, updateName]
  for (const [from, to] of edges) {
    const fromDef = nodeDefs.get(from)
    if (fromDef?.type === 'event' || !nodeDefs.has(from)) {
      eventToUpdate.set(from, to)
    }
  }

  // ─── State ─────────────────────────────────────────────
  const frame = createFrame(config.frame || 'micro')
  const scope = createScope()
  const subscribers = new Set()
  const _txCounts = new Map()

  // Event processing state
  let _evDepth = 0, _evId = null, _evSource = 'user', _evTransaction = null
  let _evCounter = 0, _evRejected = 0

  // ─── Core API ──────────────────────────────────────────

  /** Get all data as a plain object */
  function get() {
    const result = {}
    for (const [name, sig] of dataNodes) {
      result[name] = sig.get()
    }
    return result
  }

  /** Get a single data node's value */
  function getNode(name) {
    const sig = dataNodes.get(name)
    return sig ? sig.get() : undefined
  }

  /** Set a data node directly (use send() for event-driven updates) */
  function set(name, value) {
    const sig = dataNodes.get(name)
    if (!sig) return
    sig.set(value)
    notifyAffected(name)
  }

  /** Set multiple data nodes at once */
  function setMany(pairs) {
    batch(() => {
      const affected = new Set()
      for (const [name, value] of pairs) {
        const sig = dataNodes.get(name)
        if (sig) { sig.set(value); affected.add(name) }
      }
      return affected
    }, {
      notify: () => {
        const allAffected = /** @type {Set<string>} */(batch._lastAffected) || new Set()
        for (const d of allAffected) notifyAffected(d)
      }
    })
  }

  /**
   * Send an event through the graph pipeline.
   *  1. Find the update node mapped to this event
   *  2. Guard against cycles
   *  3. Execute the update (reads data, writes data)
   *  4. Find affected views and notify them
   */
  function send(event, ...args) {
    // Create event envelope
    const depth = _evDepth + 1
    const transaction = _evTransaction || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const envelope = {
      id: `ev_${++_evCounter}`, type: event, payload: args,
      source: _evSource, cause: _evId, depth, timestamp: Date.now(), transaction
    }

    // Guard: maxEventDepth
    if (depth > maxEventDepth) {
      _evRejected++
      console.error(`[Uploop] Event "${event}" rejected at depth ${depth} (max: ${maxEventDepth}). Possible cycle. chain: ${_evId} → ${envelope.id}`)
      if (config.onEventRejected) config.onEventRejected(envelope)
      return
    }

    // Guard: maxEventsPerTransaction
    if (maxEventsPerTransaction > 0) {
      let txMap = _txCounts.get(transaction)
      if (!txMap) { txMap = new Map(); _txCounts.set(transaction, txMap) }
      const count = (txMap.get(event) || 0) + 1
      txMap.set(event, count)
      if (count > maxEventsPerTransaction) {
        _evRejected++
        console.error(`[Uploop] Event "${event}" fired ${count}x in txn ${transaction.slice(0, 10)} (limit: ${maxEventsPerTransaction})`)
        if (config.onEventRejected) config.onEventRejected(envelope)
        return
      }
    }

    // Find the update node for this event
    const updateName = eventToUpdate.get(event)
    if (!updateName) {
      if (config.onUnknownEvent) config.onUnknownEvent(event, ...args)
      return
    }

    const updateFn = updateFns.get(updateName)
    const meta = nodeDefs.get(updateName)
    if (!updateFn || !meta) return
    const writes = meta.writes || []

    // Save context for chained events
    const prevDepth = _evDepth, prevId = _evId, prevSrc = _evSource, prevTxn = _evTransaction
    _evDepth = depth; _evId = envelope.id; _evSource = envelope.source; _evTransaction = transaction

    try {
      batch(() => {
        // Read current data for this update's dependencies
        const reads = meta.reads || []
        const inputs = {}
        for (const r of reads) {
          const sig = dataNodes.get(r)
          if (sig) inputs[r] = sig.get()
        }
        // Also pass all data for convenience
        const allData = get()

        // Run the update handler
        let result
        if (meta.pure) {
          // Pure: (inputs, ...args) → partial data object
          result = updateFn(inputs, ...args)
        } else {
          // Standard: (allData, ...args) → partial data object
          result = updateFn(allData, ...args)
        }

        // Write results to data nodes
        if (result && typeof result === 'object') {
          for (const key of writes) {
            if (key in result) {
              const sig = dataNodes.get(key)
              if (sig) sig.set(result[key])
            }
          }
          // Also write any key that appears in result and is a data node
          for (const [k, v] of Object.entries(result)) {
            const sig = dataNodes.get(k)
            if (sig) sig.set(v)
          }
        }
      }, {
        notify: () => {
          // After batch, notify views affected by written data nodes
          for (const d of writes) {
            notifyAffected(d)
          }
          // Run effects
          for (const [name, fn] of effectFns) {
            try { fn({ get, send }) } catch (e) { console.error(`Effect "${name}" error:`, e) }
          }
        }
      })
    } finally {
      _evDepth = prevDepth; _evId = prevId; _evSource = prevSrc; _evTransaction = prevTxn
    }
  }

  /** Notify views and subscribers affected by a data node change */
  function notifyAffected(dataName) {
    const viewNames = dataToViews.get(dataName) || []

    frame.schedule(() => {
      const allData = get()

      // Notify view node subscribers
      for (const vn of viewNames) {
        try {
          const fn = viewFns.get(vn)
          if (fn) fn(allData)
        } catch (e) { console.error(`View "${vn}" error:`, e) }
      }

      // Notify general subscribers
      for (const fn of subscribers) {
        try { fn(allData) } catch (e) { console.error('Subscriber error:', e) }
      }
    })
  }

  // ─── Public API ────────────────────────────────────────

  function subscribe(fn) {
    subscribers.add(fn)
    return () => subscribers.delete(fn)
  }

  function describe() {
    const result = {
      kind: 'uploop.graph',
      name,
      nodes: {},
      edges: [...edges]
    }
    for (const [name, meta] of nodeDefs) {
      result.nodes[name] = { ...meta }
      delete result.nodes[name].run  // don't expose functions
    }
    // Add event → update edges to manifest
    for (const [ev, updateName] of eventToUpdate) {
      if (!result.edges.find(([a, b]) => a === ev && b === updateName)) {
        result.edges.push([ev, updateName])
      }
    }
    return result
  }

  function registerNode(name, def) {
    nodeDefs.set(name, { ...def })
    if (def.type === 'data' && !dataNodes.has(name)) {
      dataNodes.set(name, createSignal(def.default !== undefined ? def.default : null))
    }
    if (def.type === 'update' && def.run) updateFns.set(name, def.run)
    if (def.type === 'view' && def.run) viewFns.set(name, def.run)
    if (def.type === 'effect' && def.run) effectFns.set(name, def.run)
  }

  function registerEdge(from, to) {
    edges.push([from, to])
    const toDef = nodeDefs.get(to)
    if (toDef?.type === 'update') {
      eventToUpdate.set(from, to)
    }
  }

  function dispose() {
    subscribers.clear()
    for (const sig of dataNodes.values()) sig.dispose()
    frame.dispose()
    scope.dispose()
    _txCounts.clear()
  }

  return {
    get, getNode, set, setMany, send, subscribe,
    frame, batch,
    use: (plugin) => use({ get, send, subscribe, frame, describe }, plugin),
    registerNode, registerEdge, describe, dispose,
    events: {
      get total() { return _evCounter },
      get rejected() { return _evRejected },
      get depth() { return _evDepth }
    },
    // Graph introspection
    nodes: {
      get names() { return [...nodeDefs.keys()] },
      get types() { return Object.fromEntries([...nodeDefs.entries()].map(([n, m]) => [n, m.type])) },
      get: (name) => nodeDefs.get(name),
      data: (name) => {
        const sig = dataNodes.get(name)
        return sig ? sig.get() : undefined
      }
    },
    edges: {
      get list() { return [...edges] },
      get: (from) => edges.filter(e => e[0] === from).map(e => e[1])
    },
    _dataNodes: dataNodes,
    _notifyAffected: notifyAffected
  }
}
