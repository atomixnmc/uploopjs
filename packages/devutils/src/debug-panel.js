/**
 * HyperGraph Debug Panel — reusable inspector UI component.
 *
 * Provides a collapsible debug panel with multiple views
 * (Graph, Tree, JSON, State, Components, Signals) powered
 * by the inspector and formatter functions.
 *
 * Usage:
 *   import { debugPanel } from '@uploop/devutils'
 *   // In a view: ${debugPanel({ tabs, activeComp, debugTab, autoRefresh, send })}
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
    case 'state':
      return JSON.stringify(activeComp.loop?.get?.() ?? {}, null, 2)
    case 'signals': {
      const graph = activeComp.describe?.()
      if (!graph) return '  (no graph)'
      const dataNodes = Object.entries(graph.nodes || {})
        .filter(([, n]) => n.type === 'data')
      const viewNodes = Object.entries(graph.nodes || {})
        .filter(([, n]) => n.type === 'view')
      const lines = [
        `  Data signals: ${dataNodes.length}`,
        ...dataNodes.map(([n]) => `  • ${n}`),
        '',
        `  View signals: ${viewNodes.length}`,
        ...viewNodes.map(([n]) => `  • ${n}`),
      ]
      return lines.join('\n')
    }
    case 'components': {
      if (!allTabs || allTabs.length === 0) return '  (no components registered)'
      const parts = []
      for (const t of allTabs) {
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
    default:
      return ''
  }
}
