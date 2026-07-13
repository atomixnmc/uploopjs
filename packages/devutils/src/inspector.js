/**
 * HyperGraph Inspector — extract structured information from
 * Uploop components, stores, loops, and graphs.
 *
 * @module @uploop/devutils/inspector
 */

/**
 * Inspect a single component, store, or graph.
 * Returns a structured snapshot of the current state.
 *
 * @param {Object} target — component descriptor, store, loop, or graph
 * @returns {InspectorSnapshot}
 *
 * @typedef {Object} InspectorSnapshot
 * @property {string} kind — 'component' | 'store' | 'loop' | 'graph'
 * @property {string} name
 * @property {Object} graph — nodes + edges from describe()
 * @property {Object} [state] — current state (if loop is accessible)
 * @property {Object} events — event counters
 * @property {Array} children — child component snapshots (recursive)
 */
export function inspect(target) {
  if (!target) return null

  const graph = typeof target.describe === 'function' ? target.describe() : null

  const snapshot = {
    kind: graph?.kind || guessKind(target),
    name: graph?.name || target.name || 'unnamed',
    graph: graph ? {
      nodes: { ...(graph.nodes || {}) },
      edges: [...(graph.edges || [])]
    } : null,
    state: null,
    events: graph?.events ? { ...graph.events } : null,
    children: []
  }

  // Extract live state if available
  if (target.loop && typeof target.loop.get === 'function') {
    try {
      const s = target.loop.get()
      snapshot.state = s ? deepCopy(s) : null
    } catch (e) { /* loop not active yet */ }
  } else if (typeof target.get === 'function') {
    try {
      const s = target.get()
      snapshot.state = s ? deepCopy(s) : null
    } catch (e) {}
  }

  // Recursively inspect children (components with compose)
  if (target.children && Array.isArray(target.children)) {
    for (const child of target.children) {
      const childSnap = inspect(child)
      if (childSnap) snapshot.children.push(childSnap)
    }
  }

  return snapshot
}

/**
 * Inspect multiple components at once.
 * Useful for getting an overview of all registered components.
 *
 * @param {Array<{label: string, comp: Object}>} items
 * @returns {InspectorSnapshot[]}
 */
export function inspectAll(items) {
  return items.map(item => ({
    label: item.label || item.id || 'unknown',
    ...inspect(item.comp || item)
  }))
}

// ─── Helpers ──────────────────────────────────────────────

function guessKind(target) {
  if (target.loop) return 'component'
  if (target.components) return 'app'
  if (typeof target.send === 'function' && typeof target.get === 'function') return target.name || 'loop'
  return 'unknown'
}

function deepCopy(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(deepCopy)
  const copy = {}
  for (const key of Object.keys(obj)) {
    copy[key] = deepCopy(obj[key])
  }
  return copy
}
