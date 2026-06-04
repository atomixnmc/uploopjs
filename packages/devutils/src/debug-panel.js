/**
 * HyperGraph Debug Panel — reusable inspector UI component.
 *
 * @module @uploop/devutils/debug-panel
 */

import { inspect } from './inspector.js'
import { format, formatTree } from './formatter.js'

/** @type {Array<{id: string, label: string}>} */
export const DEBUG_TABS = [
  { id: 'graph', label: 'Graph' },
  { id: 'tree', label: 'Tree' },
  { id: 'json', label: 'JSON' },
  { id: 'state', label: 'State' },
  { id: 'signals', label: 'Signals' },
  { id: 'components', label: 'Components' },
]

/**
 * Render debug content for the active tab.
 *
 * @param {string} debugTab — active tab id
 * @param {Object} activeComp — active component descriptor
 * @param {Array} allTabs — all registered tab definitions (for Components view)
 * @returns {string}
 */
export function renderDebugContent(debugTab, activeComp, allTabs = []) {
  if (!activeComp) return '  (no active component)'

  switch (debugTab) {
    case 'graph': {
      const data = inspect(activeComp)
      return format(data)
    }
    case 'tree': {
      const data = inspect(activeComp)
      return formatTree(data)
    }
    case 'json': {
      const data = inspect(activeComp)
      return JSON.stringify(data, null, 2)
    }
    case 'state': {
      const state = activeComp.loop?.get?.() ?? {}
      return formatStateSafe(state)
    }
    case 'signals': {
      return formatSignals(activeComp)
    }
    case 'components': {
      return formatComponents(allTabs)
    }
    default:
      return ''
  }
}

// ─── Signals ─────────────────────────────────────────────

function formatSignals(comp) {
  const graph = comp.describe?.()
  if (!graph) return '  (no graph)'

  const nodes = graph.nodes || {}
  const edges = graph.edges || []
  const lines = []

  // Data nodes with metadata
  const dataNodes = Object.entries(nodes).filter(([, n]) => n.type === 'data')
  if (dataNodes.length > 0) {
    lines.push(formatBox(dataNodes.length, 'Data'))
    for (const [name, def] of dataNodes) {
      const meta = []
      if (def.lifetime) meta.push(`lifetime:${def.lifetime}`)
      // Show which views read this data
      const readers = edges.filter(([, t]) => {
        const target = nodes[t]
        return target?.type === 'view' && target.reads?.includes(name)
      }).map(([, t]) => t)
      if (readers.length > 0) meta.push(`→ ${readers.join(', ')}`)
      lines.push(`  • ${name}${meta.length > 0 ? '  ' + meta.join('  ') : ''}`)
    }
    lines.push('')
  }

  // Update nodes (event handlers)
  const updateNodes = Object.entries(nodes).filter(([, n]) => n.type === 'update')
  if (updateNodes.length > 0) {
    lines.push(formatBox(updateNodes.length, 'Events'))
    for (const [name, def] of updateNodes) {
      const meta = []
      if (def.reads?.length > 0) meta.push(`reads:[${def.reads.join(',')}]`)
      if (def.writes?.length > 0) meta.push(`writes:[${def.writes.join(',')}]`)
      if (def.debounce) meta.push(`debounce:${def.debounce}ms`)
      if (def.interruptible) meta.push(`interruptible`)
      if (def.error) meta.push(`error:retry`)
      if (def.suspend) meta.push(`suspend`)
      lines.push(`  ⚡ ${name}${meta.length > 0 ? '  ' + meta.join('  ') : ''}`)
    }
    lines.push('')
  }

  // Effect nodes
  const effectNodes = Object.entries(nodes).filter(([, n]) => n.type === 'effect')
  if (effectNodes.length > 0) {
    lines.push(formatBox(effectNodes.length, 'Effects'))
    for (const [name] of effectNodes) {
      lines.push(`  ⚙ ${name}`)
    }
    lines.push('')
  }

  // View nodes
  const viewNodes = Object.entries(nodes).filter(([, n]) => n.type === 'view')
  if (viewNodes.length > 0) {
    lines.push(formatBox(viewNodes.length, 'Views'))
    for (const [name, def] of viewNodes) {
      if (def.reads?.length > 0) {
        lines.push(`  👁 ${name}  reads:[${def.reads.join(',')}]`)
      } else {
        lines.push(`  👁 ${name}`)
      }
    }
    lines.push('')
  }

  // Event counters
  if (graph.events) {
    lines.push(`  Events dispatched: ${graph.events.total || 0}`)
    if (graph.events.rejected > 0) {
      lines.push(`  Events rejected:  ${graph.events.rejected} (guards)`)
    }
  }

  return lines.join('\n') || '  (empty graph)'
}

// ─── State (with large-data omission) ────────────────────

function formatStateSafe(state, indent = 0) {
  if (!state || Object.keys(state).length === 0) return '  (empty state)'
  const prefix = '  '.repeat(indent)
  const lines = []

  for (const [key, val] of Object.entries(state)) {
    const display = formatValueSafe(val, indent + 1)
    lines.push(`${prefix}${key}: ${display}`)
  }
  return lines.join('\n')
}

function formatValueSafe(val, indent) {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (typeof val === 'function') return '[Function]'

  if (typeof val === 'string') {
    // Long strings: truncate
    if (val.length > 200) return `"${val.slice(0, 197)}..." (${val.length} chars)`
    return `"${val}"`
  }

  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val)
  }

  // Complex objects: inspect carefully
  if (typeof val === 'object') {
    if (val instanceof HTMLCanvasElement || val instanceof ImageData ||
        val instanceof ImageBitmap || val instanceof CanvasRenderingContext2D) {
      return '[Canvas — complex, omitted]'
    }

    if (val instanceof ArrayBuffer || ArrayBuffer.isView(val)) {
      return `[Binary — ${val.byteLength || val.length} bytes, omitted]`
    }

    if (val instanceof File || val instanceof Blob) {
      return `[Blob — ${val.size} bytes, omitted]`
    }

    if (val.nodeType !== undefined) {
      return `[DOM Node — <${val.tagName?.toLowerCase() || '?'}>, omitted]`
    }

    if (Array.isArray(val)) {
      if (val.length === 0) return '[]'
      if (val.length > 20) return `[${val.length} items — ${typeof val[0]}]`
      const prefix = '  '.repeat(indent)
      const items = val.slice(0, 10).map(v => formatValueSafe(v, indent + 1))
      const tail = val.length > 10 ? `\n${prefix}  ... (${val.length - 10} more)` : ''
      return `[\n${prefix}  ${items.join(`,\n${prefix}  `)}${tail}\n${prefix}]`
    }

    const keys = Object.keys(val)
    if (keys.length === 0) return '{}'

    // Detect large objects by serialized size
    try {
      const json = JSON.stringify(val)
      if (json.length > 1000) {
        return `{${keys.length} keys, ~${json.length} bytes — complex, omitted}`
      }
    } catch (e) {
      return `{${keys.length} keys — unserializable, omitted}`
    }

    if (keys.length > 10) {
      return `{${keys.length} keys}` + '\n' + JSON.stringify(val, null, 2).split('\n').slice(0, 15).join('\n') + '\n  ...'
    }

    return JSON.stringify(val, null, 2)
  }

  return String(val)
}

// ─── Components ──────────────────────────────────────────

function formatComponents(tabList) {
  if (!tabList || tabList.length === 0) return '  (no components registered)'
  const parts = []
  for (const t of tabList) {
    const comp = t.comp
    const graph = comp?.describe?.()
    const nodeCount = graph ? Object.keys(graph.nodes || {}).length : 0
    const edgeCount = graph ? (graph.edges || []).length : 0
    const state = comp?.loop?.get?.()
    const stateKeys = state ? Object.keys(state).length : 0
    const mounted = comp?.loop ? '✓' : '✗'
    const active = graph?.name || t.id
    parts.push(`  ${mounted} ${t.label.padEnd(14)} nodes:${String(nodeCount).padStart(2)}  edges:${String(edgeCount).padStart(2)}  state:${String(stateKeys).padStart(2)}  name:${active}`)
  }
  return parts.join('\n')
}

// ─── Helpers ─────────────────────────────────────────────

function formatBox(count, label) {
  const width = 36
  const s = `${label} (${count})`
  const pad = Math.max(0, width - s.length - 2)
  const left = Math.floor(pad / 2)
  const right = pad - left
  return `  ┌${'─'.repeat(left)} ${s} ${'─'.repeat(right)}┐`
}
