/**
 * Flow Builder — applies a flow profile to a HyperGraph.
 *
 * createFlow(graph, profile) wraps a graph with tuned execution parameters
 * from a flow profile. It does NOT replace the graph — it augments it.
 *
 * @module @uploop/flows/builder
 */
import { flows } from './registry.js'

/**
 * Apply a flow profile to a HyperGraph instance.
 *
 * @param {Object} graph — from createGraph()
 * @param {Object|string} profile — flow profile object or name from registry
 * @returns {Object} tuned graph proxy (same API + flow metadata)
 */
export function createFlow(graph, profile) {
  const flow = typeof profile === 'string' ? flows[profile] : profile
  if (!flow) throw new Error(`Unknown flow: ${profile}`)

  const tuning = flow.tuning || {}
  const lanes = flow.lanes || {}

  // Apply debounce to update handlers if the graph supports it
  if (tuning.debounce && typeof graph._setDebounce === 'function') {
    graph._setDebounce(tuning.debounce)
  }

  // Apply cache hints
  if (tuning.cache) {
    // Graph nodes can have cache metadata set via registerNode
    const desc = typeof graph.describe === 'function' ? graph.describe() : { nodes: {} }
    for (const [name, node] of Object.entries(desc.nodes || {})) {
      if (node.type === 'data') {
        graph.registerNode?.(name, {
          ...node,
          cache: tuning.cache
        })
      }
    }
  }

  // Return an augmented graph proxy
  const tuned = {
    // Passthrough all graph methods
    get: (...args) => graph.get(...args),
    getNode: (...args) => graph.getNode(...args),
    set: (...args) => graph.set(...args),
    setMany: (...args) => graph.setMany(...args),
    send: (...args) => graph.send(...args),
    subscribe: (...args) => graph.subscribe(...args),
    onDataChange: (...args) => graph.onDataChange(...args),
    frame: graph.frame,
    batch: graph.batch,
    use: (...args) => graph.use(...args),
    registerNode: (...args) => graph.registerNode(...args),
    registerEdge: (...args) => graph.registerEdge(...args),
    describe: () => {
      const desc = typeof graph.describe === 'function' ? graph.describe() : {}
      return { ...desc, flow: flow.name, tuning, lanes, category: flow.category }
    },
    dispose: () => graph.dispose(),
    events: graph.events,
    nodes: graph.nodes,
    edges: graph.edges,

    // Flow-specific metadata
    _flow: flow,
    flowName: flow.name,
    flowCategory: flow.category,
    getTuning: () => ({ ...tuning }),
    getLanes: () => ({ ...lanes }),

    // Lane routing helper
    laneOf(nodeName) {
      for (const [pattern, lane] of Object.entries(lanes)) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
        if (regex.test(nodeName)) return lane
      }
      return 'warm' // default lane
    }
  }

  return tuned
}

/**
 * Create a flow with per-subgraph executor routing.
 * Advanced: different subgraphs get different flows.
 *
 * @param {Object} graph
 * @param {Object} config — { subgraphs: { 'region': flowName, ... }, default: flowName }
 * @returns {Object}
 */
export function createMixedFlow(graph, config = {}) {
  const subgraphs = config.subgraphs || {}
  const defaultFlow = config.default || 'form'

  // For now, apply the default flow globally
  // Subgraph routing will be implemented when graph supports regions
  return createFlow(graph, defaultFlow)
}
