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
  const heuristic = config.heuristic || false

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

  // ─── Execution Plan ────────────────────────────────────
  /**
   * Given an array of changed data keys, return what needs to happen:
   * which views to notify, which updates may cascade, which effects to run.
   * This is the single source of truth for "what is affected by X".
   */
  function plan(changedKeys) {
    const views = new Set()
    const updates = new Set()
    const effects = new Set()

    for (const key of changedKeys) {
      for (const v of (dataToViews.get(key) || [])) views.add(v)
      for (const u of (dataToUpdates.get(key) || [])) updates.add(u)
      for (const [name, meta] of nodeDefs) {
        if (meta.type === 'effect' && (meta.reads || []).includes(key)) {
          effects.add(name)
        }
      }
    }

    // Auto-select frame lane based on data node temperature metadata.
    // Only applies when data nodes explicitly declare a temperature field.
    //   'hot'    → 'visual' (high-priority, render-critical)
    //   'cold'   → 'idle'   (low-priority, background)
    //   'frozen' → 'idle'   (low-priority, background)
    // Falls back to 'micro' (default) when no temperature is declared.
    let frame = 'micro'
    for (const key of changedKeys) {
      const meta = nodeDefs.get(key)
      if (!meta) continue
      if (meta.temperature === 'hot') frame = 'visual'
      else if (meta.temperature === 'cold' || meta.temperature === 'frozen') frame = 'idle'
    }

    return {
      views: [...views],
      updates: [...updates],
      effects: [...effects],
      frame,
      changed: changedKeys
    }
  }

  /**
   * Infer a data node's temperature based on metadata and heuristics.
   * When config.heuristic is true, auto-detects hot/cold/warm.
   * Explicit node metadata always takes precedence.
   */
  function inferTemperature(dataName, meta) {
    if (meta?.temperature) return meta.temperature
    if (!heuristic) return 'warm'
    // Heuristic: track set() frequency per data node
    const entry = _dataWriteCounts.get(dataName)
    if (entry && entry.count >= 5) {
      const elapsed = Math.max((Date.now() - entry.firstSeen) / 1000, 0.001)
      if (entry.count / elapsed > 10) return 'hot'
    }
    if (meta?.cache) return 'cold'
    return 'warm'
  }

  /**
   * Show the merge benefit: how many view notifications were saved
   * by deduplication in this batch.
   */
  function getMergeStats(changedKeys) {
    const p = plan(changedKeys)
    let withoutMerge = 0
    for (const key of changedKeys) {
      const views = dataToViews.get(key) || []
      withoutMerge += views.length
    }
    return {
      changedKeys,
      viewsNotified: p.views.length,
      withoutMerge,
      saved: withoutMerge - p.views.length,
      savingsPercent: withoutMerge > 0
        ? Math.round((1 - p.views.length / withoutMerge) * 100)
        : 0
    }
  }

  // ─── Graph Queries ──────────────────────────────────────

  /** List all view/update/effect names that READ this data */
  function whatReads(dataName) {
    return [
      ...(dataToViews.get(dataName) || []),
      ...(dataToUpdates.get(dataName) || [])
    ]
  }

  /** List all update names that WRITE this data */
  function whatWrites(dataName) {
    return [...nodeDefs.entries()]
      .filter(([_, meta]) => (meta.writes || []).includes(dataName))
      .map(([name]) => name)
  }

  /**
   * Everything transitively downstream of a data node:
   * views + effects that depend on data that depends on this,
   * following the update chain.
   */
  function transitiveDeps(dataName) {
    const visited = new Set()
    const queue = [dataName]
    while (queue.length) {
      const current = queue.shift()
      if (visited.has(current)) continue
      visited.add(current)
      // Find all updates that write current, then all data they write,
      // then views depending on those
      const writers = whatWrites(current)
      for (const w of writers) {
        const writes = (nodeDefs.get(w)?.writes || [])
        for (const d of writes) {
          if (!visited.has(d)) queue.push(d)
          for (const v of (dataToViews.get(d) || [])) visited.add(v)
        }
      }
    }
    visited.delete(dataName) // remove self
    return [...visited]
  }

  /** Return a valid execution order of all update nodes (Kahn's algorithm) */
  function topologicalSort() {
    const updateNames = [...nodeDefs.entries()]
      .filter(([_, m]) => m.type === 'update')
      .map(([n]) => n)

    if (updateNames.length === 0) return []

    const inDegree = new Map()
    const adj = new Map()
    for (const name of updateNames) {
      inDegree.set(name, 0)
      adj.set(name, [])
    }

    for (const [name, meta] of nodeDefs) {
      if (meta.type !== 'update') continue
      const reads = meta.reads || []
      for (const d of reads) {
        for (const [otherName, otherMeta] of nodeDefs) {
          if (otherMeta.type === 'update' && otherName !== name) {
            if ((otherMeta.writes || []).includes(d)) {
              if (!adj.get(otherName).includes(name)) {
                adj.get(otherName).push(name)
                inDegree.set(name, (inDegree.get(name) || 0) + 1)
              }
            }
          }
        }
      }
    }

    const queue = []
    const result = []
    for (const [name, deg] of inDegree) {
      if (deg === 0) queue.push(name)
    }

    while (queue.length) {
      const node = queue.shift()
      result.push(node)
      for (const neighbor of (adj.get(node) || [])) {
        const newDeg = (inDegree.get(neighbor) || 1) - 1
        inDegree.set(neighbor, newDeg)
        if (newDeg === 0) queue.push(neighbor)
      }
    }

    return result
  }

  /** Find the longest dependency chain (critical path) through the graph */
  function criticalPath() {
    let longest = { path: [], length: 0 }
    for (const [viewName] of viewFns) {
      const path = []
      const visited = new Set()
      function walk(nodeName) {
        if (visited.has(nodeName)) return
        visited.add(nodeName)
        path.push(nodeName)
        const meta = nodeDefs.get(nodeName)
        const reads = meta?.reads || []
        for (const dataName of reads) {
          const writers = whatWrites(dataName)
          for (const w of writers) {
            if (!visited.has(w)) walk(w)
          }
        }
      }
      walk(viewName)
      if (path.length > longest.length) {
        longest = { path: [...path].reverse(), length: path.length }
      }
    }
    return longest
  }

  /** Find data nodes that are written but never read by any view or effect */
  function findOrphans() {
    const orphans = []
    for (const [name, meta] of nodeDefs) {
      if (meta.type !== 'data') continue
      const viewReaders = dataToViews.get(name) || []
      // Also check effects
      const effectReaders = []
      for (const [en, em] of nodeDefs) {
        if (em.type === 'effect' && (em.reads || []).includes(name)) {
          effectReaders.push(en)
        }
      }
      const allReaders = [...viewReaders, ...effectReaders]
      if (allReaders.length === 0) {
        orphans.push({ name, writtenBy: whatWrites(name) })
      }
    }
    return orphans
  }

  // ─── Serialization ──────────────────────────────────────

  /** Serialize the graph definition and current data to JSON */
  function serialize() {
    return JSON.stringify({
      name,
      nodes: Object.fromEntries([...nodeDefs.entries()].map(([k, v]) => [k, { ...v, run: undefined }])),
      edges: [...edges],
      data: get()
    })
  }

  // ─── State ─────────────────────────────────────────────
  const frame = createFrame(config.frame || 'micro')
  const scope = createScope()
  const subscribers = new Set()
  const _txCounts = new Map()

  // Event processing state
  let _evDepth = 0, _evId = null, _evSource = 'user', _evTransaction = null
  let _evCounter = 0, _evRejected = 0

  // Data node subscriptions: dataName → Set<Function>
  const _dataSubscribers = new Map()
  // Event frequency tracking: eventName → { count, firstSeen, lastSeen }
  const _eventCounts = new Map()
  // Data write frequency tracking: dataName → { count, firstSeen, lastSeen }
  const _dataWriteCounts = new Map()

  // Event causal chain ring buffer (when trackCausality enabled)
  const _eventChain = []

  // View batching: accumulate views across multiple notifyAffected calls
  // so each view is notified only once per frame tick
  let _pendingViews = new Set()
  let _batchScheduled = false

  // Last plan result, exposed for consumers to check frame recommendation
  let _lastPlan = null

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
    const oldVal = sig.get()
    sig.set(value)
    // Track data write frequency for heuristic inference
    if (!_dataWriteCounts.has(name)) {
      _dataWriteCounts.set(name, { count: 0, firstSeen: Date.now(), lastSeen: Date.now() })
    }
    const dwc = _dataWriteCounts.get(name)
    dwc.count++
    dwc.lastSeen = Date.now()
    notifyAffected(name)
    // Notify data node subscribers
    const subs = _dataSubscribers.get(name)
    if (subs) {
      for (const fn of subs) {
        try { fn(value, oldVal) } catch (e) { /* swallow */ }
      }
    }
  }

  /** Set multiple data nodes at once */
  function setMany(pairs) {
    // Capture old values before mutation
    const oldVals = new Map()
    for (const [name] of pairs) {
      const sig = dataNodes.get(name)
      if (sig) oldVals.set(name, sig.get())
    }
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
        for (const d of allAffected) {
          notifyAffected(d)
          // Notify data node subscribers
          const subs = _dataSubscribers.get(d)
          if (subs) {
            const sig = dataNodes.get(d)
            const newVal = sig ? sig.get() : undefined
            const oldVal = oldVals.get(d)
            for (const fn of subs) {
              try { fn(newVal, oldVal) } catch (e) { /* swallow */ }
            }
          }
        }
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

    // Track event frequency
    if (!_eventCounts.has(event)) {
      _eventCounts.set(event, { count: 0, firstSeen: Date.now(), lastSeen: Date.now() })
    }
    const evFreq = _eventCounts.get(event)
    evFreq.count++
    evFreq.lastSeen = Date.now()

    // Record event in causal chain ring buffer (when trackCausality enabled)
    if (config.trackCausality) {
      _eventChain.push({
        id: envelope.id,
        type: event,
        cause: _evId,
        depth,
        timestamp: envelope.timestamp,
        transaction
      })
      if (_eventChain.length > 100) _eventChain.shift()
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

    // Capture old values of written data nodes for subscriber notification
    const oldVals = new Map()
    for (const d of writes) {
      const sig = dataNodes.get(d)
      if (sig) oldVals.set(d, sig.get())
    }

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
            if (sig) { sig.set(v); batch._extraWrites = batch._extraWrites || new Set(); batch._extraWrites.add(k) }
          }
        }
      }, {
        notify: () => {
          // After batch, notify views affected by written data nodes
          const extraWrites = batch._extraWrites || new Set()
          const allWrites = new Set([...writes, ...extraWrites])
          for (const d of allWrites) {
            // Track data write frequency for heuristic inference
            if (!_dataWriteCounts.has(d)) {
              _dataWriteCounts.set(d, { count: 0, firstSeen: Date.now(), lastSeen: Date.now() })
            }
            const dwc = _dataWriteCounts.get(d)
            dwc.count++
            dwc.lastSeen = Date.now()
            notifyAffected(d)
            // Notify data node subscribers
            const subs = _dataSubscribers.get(d)
            if (subs) {
              const sig = dataNodes.get(d)
              const newVal = sig ? sig.get() : undefined
              const oldVal = oldVals.has(d) ? oldVals.get(d) : undefined
              for (const fn of subs) {
                try { fn(newVal, oldVal) } catch (e) { /* swallow */ }
              }
            }
          }
          if (batch._extraWrites) batch._extraWrites = undefined
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
    const p = plan([dataName])
    _lastPlan = p

    // Accumulate affected views; only schedule one flush per frame tick.
    // This prevents a view from being called twice when two of its
    // dependencies change in the same batch.
    for (const vn of p.views) _pendingViews.add(vn)

    if (!_batchScheduled) {
      _batchScheduled = true
      frame.schedule(() => {
        const allData = get()

        // Notify each affected view exactly once
        for (const vn of _pendingViews) {
          try {
            const fn = viewFns.get(vn)
            if (fn) fn(allData)
          } catch (e) { console.error(`View "${vn}" error:`, e) }
        }

        // Notify general subscribers once per batch
        for (const fn of subscribers) {
          try { fn(allData) } catch (e) { console.error('Subscriber error:', e) }
        }

        _pendingViews.clear()
        _batchScheduled = false
      })
    }
  }

  // ─── Public API ────────────────────────────────────────

  function subscribe(fn) {
    subscribers.add(fn)
    return () => subscribers.delete(fn)
  }

  /** Subscribe to changes on a specific data node. Returns unsubscribe fn. */
  function onDataChange(dataName, fn) {
    if (!_dataSubscribers.has(dataName)) _dataSubscribers.set(dataName, new Set())
    _dataSubscribers.get(dataName).add(fn)
    return () => _dataSubscribers.get(dataName)?.delete(fn)
  }

  function describe() {
    const result = {
      kind: 'uploop.graph',
      name,
      heuristic,
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

  /** Get the firing rate of an event (per-second, per-minute, total) */
  function getEventRate(eventName) {
    const entry = _eventCounts.get(eventName)
    if (!entry) return { perSecond: 0, perMinute: 0, total: 0 }
    const elapsed = (Date.now() - entry.firstSeen) / 1000
    return {
      perSecond: elapsed > 0 ? (entry.count / elapsed).toFixed(1) : 0,
      perMinute: elapsed > 0 ? (entry.count / elapsed * 60).toFixed(0) : 0,
      total: entry.count
    }
  }

  /** Get events firing faster than threshold/sec, sorted hottest-first */
  function getHotEvents(threshold = 1) {
    const hot = []
    for (const [name] of _eventCounts) {
      const rate = getEventRate(name)
      if (parseFloat(rate.perSecond) >= threshold) hot.push({ name, ...rate })
    }
    return hot.sort((a, b) => parseFloat(b.perSecond) - parseFloat(a.perSecond))
  }

  /**
   * Compare this graph structurally with another graph instance.
   * Returns { added, removed, changed, hasChanges }
   */
  function diff(otherGraph) {
    const added = []
    const removed = []
    const changed = []

    const myNodes = describe().nodes
    const otherNodes = otherGraph.describe().nodes

    for (const [name] of Object.entries(otherNodes)) {
      if (!myNodes[name]) added.push(name)
    }
    for (const [name, meta] of Object.entries(myNodes)) {
      if (!otherNodes[name]) {
        removed.push(name)
      } else {
        const otherMeta = otherNodes[name]
        if (JSON.stringify(meta) !== JSON.stringify(otherMeta)) {
          changed.push(name)
        }
      }
    }

    return { added, removed, changed, hasChanges: added.length + removed.length + changed.length > 0 }
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

  /** Return a snapshot of the event causal chain ring buffer */
  function getEventChain() {
    return [..._eventChain]
  }

  return {
    get, getNode, set, setMany, send, subscribe,
    onDataChange,
    frame, batch,
    use: (plugin) => use({ get, send, subscribe, frame, describe }, plugin),
    registerNode, registerEdge, describe, dispose,
    plan, whatReads, whatWrites, transitiveDeps, topologicalSort, serialize,
    criticalPath, findOrphans, inferTemperature, mergeStats: getMergeStats, diff,
    events: {
      get total() { return _evCounter },
      get rejected() { return _evRejected },
      get depth() { return _evDepth },
      rate: getEventRate,
      hot: getHotEvents
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
    _notifyAffected: notifyAffected,
    eventChain: getEventChain,
    get lastPlan() { return _lastPlan }
  }
}

/** Static factory: reconstruct a graph from its serialized JSON */
function fromJSON(json) {
  const data = JSON.parse(json)
  const g = createGraph({ name: data.name, nodes: data.nodes, edges: data.edges })
  // Restore serialized data values
  if (data.data) {
    for (const [key, value] of Object.entries(data.data)) {
      g.set(key, value)
    }
  }
  return g
}

createGraph.fromJSON = fromJSON
