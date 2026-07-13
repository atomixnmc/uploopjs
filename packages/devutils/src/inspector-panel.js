/**
 * HyperGraph Inspector Panel - compact debug UI.
 * @module @uploop/devutils/inspector-panel
 */

import { html, component } from '@uploop/html'
import { inspect } from './inspector.js'
import { format, formatTree } from './formatter.js'
import { renderDebugContent } from './debug-panel.js'
import { startEventCapture, getEventHistory } from './event-capture.js'

let _prevComp = null
let _stopCapture = null
let _autoTimer = null
let _compSub = null
let _cachedData = null
let _cachedComp = null
let _panelSend = null

const TABS = [
  { id: 'graph', icon: '\u25EB', label: 'Graph' },
  { id: 'state', icon: '\u29C9', label: 'State' },
  { id: 'signals', icon: '\u26A1', label: 'Signals' },
  { id: 'components', icon: '\u229E', label: 'Comps' },
]
const GRAPH_MODES = ['graph', 'tree', 'json']
const MODE_ICONS = { graph: '\u25EB', tree: '\u2514', json: '{ }' }

const S = {
  pre: 'font-family:monospace;font-size:0.66rem;line-height:1.35;' +
       'color:#cdd6f4;white-space:pre;tab-size:2;margin:0;overflow:auto;flex:1;min-height:0;',
  subTab: 'padding:0.15rem 0.45rem;border:none;cursor:pointer;font-size:0.64rem;font-family:inherit;',
  tabBtn: 'flex:1;padding:0.2rem 0;border:none;cursor:pointer;font-size:0.68rem;' +
          'font-family:inherit;border-radius:3px 3px 0 0;',
  hdr: 'display:flex;align-items:center;padding:0.3rem 0.5rem;' +
       'border-bottom:1px solid #2a2a3a;gap:0.4rem;',
  listItem: 'cursor:pointer;padding:1px 3px;border-radius:2px;font-size:0.68rem;',
}

export function bindInspectorSend(send) {
  _panelSend = send
}

export const InspectorPanel = component('InspectorPanel', {
  state: {
    activeTab: 'graph', graphMode: 'graph',
    componentList: [], activeComp: null, autoRefresh: true,
    _blinkId: '', _blinkTime: 0, _t: 0,
  },

  update: {
    selectTab: (s, tab) => ({ ...s, activeTab: tab }),
    setGraphMode: (s, m) => ({ ...s, graphMode: m }),
    setComponents: (s, list) => ({ ...s, componentList: list }),
    setActiveComp: (s, comp) => { _cachedData = null; _cachedComp = null; return { ...s, activeComp: comp } },
    toggleAutoRefresh: (s) => ({ ...s, autoRefresh: !s.autoRefresh }),
    blink: (s, id) => ({ ...s, _blinkId: id, _blinkTime: Date.now() }),
    tick: (s) => ({ ...s, _t: Date.now() }),
  },

  effect: {
    onActiveCompChange(ctx) {
      const current = ctx.get().activeComp
      if (current === _prevComp) return
      if (_stopCapture) { _stopCapture(); _stopCapture = null }
      if (_compSub) { _compSub(); _compSub = null }
      if (current) {
        _stopCapture = startEventCapture(current)
        if (current.loop && current.loop.subscribe) {
          _compSub = current.loop.subscribe(() => {
            if (_panelSend) _panelSend('tick')
          })
        }
      }
      _prevComp = current
    },
  },

  mount(_el, ctx) {
    const sync = () => {
      const s = ctx.get()
      if (s.autoRefresh && !_autoTimer) _autoTimer = setInterval(() => ctx.send('tick'), 400)
      else if (!s.autoRefresh && _autoTimer) { clearInterval(_autoTimer); _autoTimer = null }
    }
    sync()
    InspectorPanel.loop.subscribe(() => sync())
  },

  view(state, { send }) {
    const tab = state.activeTab
    const comp = state.activeComp
    const auto = state.autoRefresh
    const gm = state.graphMode

    if (comp !== _cachedComp) { _cachedComp = comp; _cachedData = comp ? inspect(comp) : null }

    return html`
      <div style="${S.hdr}">
        <span style="font-size:0.72rem;font-weight:600;color:#cdd6f4;flex:1;">⚡ HyperGraph Inspector</span>
        <label style="font-size:0.6rem;color:#888;display:flex;align-items:center;gap:0.15rem;cursor:pointer;">
          <input type="checkbox" ?checked=${auto} @click=${() => send('toggleAutoRefresh')}
            style="cursor:pointer;margin:0;" /> auto
        </label>
        ${!auto ? html`
          <button @click=${() => send('tick')}
            style="font-size:0.6rem;padding:0.1rem 0.35rem;border:1px solid #444;
                   border-radius:2px;cursor:pointer;background:transparent;color:#888;">↻</button>
        ` : ''}
      </div>

      <div style="display:flex;gap:1px;padding:0.25rem 0.4rem 0 0.4rem;">
        ${TABS.map(t => html`
          <button @click=${() => send('selectTab', t.id)}
            style="${S.tabBtn}background:${tab === t.id ? '#646cff' : '#2a2a3a'};
                   color:${tab === t.id ? '#fff' : '#888'};
                   font-weight:${tab === t.id ? '600' : '400'};">
            ${t.icon} ${t.label}
          </button>
        `)}
      </div>

      <div style="display:flex;flex-direction:column;overflow:hidden;
                  padding:0.3rem 0.4rem 0.4rem 0.4rem;color:#cdd6f4;
                  max-height:calc(75vh - 68px);">
        ${tab === 'graph' ? html`
          <div style="display:flex;gap:0;margin-bottom:0.3rem;flex-shrink:0;">
            ${GRAPH_MODES.map(m => html`
              <button @click=${() => send('setGraphMode', m)}
                style="${S.subTab}background:${gm === m ? '#646cff' : '#2a2a3a'};
                       color:${gm === m ? '#fff' : '#666'};
                       font-weight:${gm === m ? '600' : '400'};
                       border-radius:${m === 'graph' ? '2px 0 0 2px' : m === 'json' ? '0 2px 2px 0' : '0'};">
                ${MODE_ICONS[m]} ${m === 'graph' ? 'Box' : m === 'tree' ? 'Tree' : 'JSON'}
              </button>
            `)}
          </div>
          <pre style="${S.pre}">${gm === 'graph' ? (_cachedData ? format(_cachedData) : '(no data)')
            : gm === 'tree' ? (_cachedData ? formatTree(_cachedData) : '(no data)')
            : (_cachedData ? JSON.stringify(_cachedData, null, 2) : '(no data)')}</pre>
        ` : ''}

        ${tab === 'state' ? html`
          <pre style="${S.pre}">${renderDebugContent('state', comp)}</pre>
        ` : ''}

        ${tab === 'signals' ? html`
          <pre style="${S.pre}">${comp ? renderDebugContent('signals', comp) : '(no component)'}
${(() => { const h = comp ? getEventHistory(comp) : []; return h.length > 0
  ? '-- Events (' + h.length + ') --\n' + h.slice(-20).map(e =>
    new Date(e.timestamp).toISOString().slice(11, 23) + '  ' + e.event.padEnd(14) + (e.args || '')).join('\n')
  : '\n(no events yet)'; })()}</pre>
        ` : ''}

        ${tab === 'components' ? html`
          <div style="overflow:auto;flex:1;min-height:0;">
            ${(state.componentList || []).map(item => html`
              <div @click=${() => {
                  send('blink', item.id)
                  const el = document.getElementById(item.id)
                  if (el) { el.style.outline = '2px solid #646cff'; el.style.outlineOffset = '1px'
                    setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = '' }, 800) }
                }}
                style="${S.listItem}color:${state._blinkId === item.id ? '#646cff' : '#cdd6f4'};"
                @mouseenter=${e => { e.target.style.background = '#2a2a3a' }}
                @mouseleave=${e => { e.target.style.background = 'transparent' }}>
                ${item.label}
              </div>
            `)}
          </div>
        ` : ''}
      </div>
    `
  },
})
