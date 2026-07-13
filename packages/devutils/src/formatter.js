/**
 * Human-readable formatters for inspector snapshots.
 *
 * @module @uploop/devutils/formatter
 */

/**
 * Format a snapshot as a box-drawing ASCII diagram.
 * Suitable for console.log or terminal output.
 *
 * @param {Object} snap — inspector snapshot
 * @returns {string}
 */
export function format(snap) {
  if (!snap) return '(no data)'
  const lines = []

  // Header
  const kind = snap.kind || 'unknown'
  const name = snap.name || 'unnamed'
  lines.push(headerLine(name, kind, snap.graph))
  lines.push('')

  // Graph nodes
  if (snap.graph && snap.graph.nodes) {
    const nodes = Object.entries(snap.graph.nodes)
    const edges = snap.graph.edges || []
    lines.push(formatNodes(nodes))
    if (edges.length > 0) {
      lines.push(formatEdges(edges))
    }
  }

  // State
  if (snap.state) {
    lines.push('')
    lines.push(formatState(snap.state))
  }

  // Events
  if (snap.events) {
    lines.push('')
    lines.push(`  Events: ${snap.events.total || 0} total, ${snap.events.rejected || 0} rejected`)
  }

  // Children
  if (snap.children && snap.children.length > 0) {
    lines.push('')
    lines.push(`  Children (${snap.children.length}):`)
    for (const child of snap.children) {
      lines.push(`    └─ ${child.name || 'unnamed'} [${child.kind || '?'}]`)
    }
  }

  return lines.join('\n')
}

/**
 * Format as a tree structure with indentation.
 *
 * @param {Object} snap
 * @returns {string}
 */
export function formatTree(snap, depth = 0) {
  if (!snap) return ''
  const prefix = '  '.repeat(depth)
  const lines = []

  const kind = snap.kind || '?'
  const name = snap.name || 'unnamed'
  const nodeCount = snap.graph ? Object.keys(snap.graph.nodes || {}).length : 0
  const edgeCount = snap.graph ? (snap.graph.edges || []).length : 0
  const stateKeys = snap.state ? Object.keys(snap.state).length : 0

  lines.push(`${prefix}${name} [${kind}]  nodes:${nodeCount}  edges:${edgeCount}  state:${stateKeys}`)

  // State values (one level deep)
  if (snap.state) {
    for (const [key, val] of Object.entries(snap.state)) {
      const display = typeof val === 'object' ? `{${Object.keys(val).join(',')}}` : String(val)
      if (display.length > 40) {
        lines.push(`${prefix}  ${key}: ${display.slice(0, 40)}...`)
      } else {
        lines.push(`${prefix}  ${key}: ${display}`)
      }
    }
  }

  // Children recursed
  for (const child of (snap.children || [])) {
    lines.push(formatTree(child, depth + 1))
  }

  return lines.filter(Boolean).join('\n')
}

/**
 * Format snapshot as pretty-printed JSON.
 *
 * @param {Object} snap
 * @returns {string}
 */
export function formatJSON(snap) {
  return JSON.stringify(snap, null, 2)
}

// ─── Internal formatters ──────────────────────────────────

function headerLine(name, kind, graph) {
  const nodeCount = graph ? Object.keys(graph.nodes || {}).length : 0
  const edgeCount = graph ? (graph.edges || []).length : 0
  const title = `HyperGraph: ${name}`
  const info = `[${kind}]  ${nodeCount} nodes · ${edgeCount} edges`
  return `${title}\n${info}`
}

function formatNodes(nodes) {
  const lines = []
  const nodeMap = {}
  for (const [name, def] of nodes) {
    nodeMap[name] = def
  }

  lines.push(formatBox(nodes.length, 'Nodes'))

  for (const [name, def] of nodes) {
    let meta = ''
    if (def.reads && def.reads.length > 0) meta += ` reads:[${def.reads.join(',')}]`
    if (def.writes && def.writes.length > 0) meta += ` writes:[${def.writes.join(',')}]`
    if (def.lifetime) meta += ` lifetime:${def.lifetime}`
    if (def.debounce) meta += ` debounce:${def.debounce}ms`
    if (def.interruptible) meta += ` interruptible`
    if (def.error) meta += ` error`
    if (def.suspend) meta += ` suspend`
    lines.push(`  [${(def.type || '?').padEnd(6)}] ${name}${meta}`)
  }

  return lines.join('\n')
}

function formatEdges(edges) {
  const lines = ['  ── Edges ──']
  for (const [from, to] of edges) {
    lines.push(`  ${from} → ${to}`)
  }
  return lines.join('\n')
}

function formatBox(count, label) {
  const width = 36
  const s = `${label} (${count})`
  const pad = Math.max(0, width - s.length - 2)
  const left = Math.floor(pad / 2)
  const right = pad - left
  return `  ┌${'─'.repeat(left)} ${s} ${'─'.repeat(right)}┐`
}

function formatState(state, indent = 2) {
  if (!state || Object.keys(state).length === 0) return '  (empty state)'
  const prefix = ' '.repeat(indent)
  const lines = [`${prefix}── State ──`]
  const keys = Object.keys(state).slice(0, 20)
  for (const key of keys) {
    const val = state[key]
    if (val === null || val === undefined) {
      lines.push(`${prefix}${key}: ${val}`)
    } else if (typeof val === 'object') {
      const innerKeys = Object.keys(val)
      if (innerKeys.length === 0) {
        lines.push(`${prefix}${key}: {}`)
      } else if (innerKeys.length <= 2) {
        const display = innerKeys.map(k => `${k}: ${truncate(val[k])}`).join(', ')
        lines.push(`${prefix}${key}: { ${display} }`)
      } else {
        // Expand 3+ keys onto separate lines
        lines.push(`${prefix}${key}: {`)
        for (const ik of innerKeys) {
          const iv = val[ik]
          if (iv && typeof iv === 'object' && !Array.isArray(iv) && Object.keys(iv).length > 0) {
            const subKeys = Object.keys(iv)
            if (subKeys.length <= 2) {
              const subDisplay = subKeys.map(sk => `${sk}: ${truncate(iv[sk])}`).join(', ')
              lines.push(`${prefix}  ${ik}: { ${subDisplay} }`)
            } else {
              lines.push(`${prefix}  ${ik}: {`)
              for (const sk of subKeys) {
                lines.push(`${prefix}    ${sk}: ${truncate(iv[sk])}`)
              }
              lines.push(`${prefix}  }`)
            }
          } else {
            lines.push(`${prefix}  ${ik}: ${truncate(iv)}`)
          }
        }
        lines.push(`${prefix}}`)
      }
    } else {
      lines.push(`${prefix}${key}: ${truncate(val)}`)
    }
  }
  if (Object.keys(state).length > 20) {
    lines.push(`${prefix}... and ${Object.keys(state).length - 20} more keys`)
  }
  return lines.join('\n')
}

function truncate(val) {
  const s = String(val)
  return s.length > 50 ? s.slice(0, 47) + '...' : s
}
