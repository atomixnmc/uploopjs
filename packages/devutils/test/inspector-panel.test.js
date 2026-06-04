import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="panel"></div></body></html>', {
  url: 'http://localhost'
})
globalThis.document = dom.window.document
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.customElements = { define: () => {}, get: () => null }

import { html, component } from '@uploop/html'
import { InspectorPanel } from '@uploop/devutils'

describe('InspectorPanel scroll', () => {
  it('pre element has overflow:auto and flex:1', async () => {
    const root = document.getElementById('panel')
    const panel = InspectorPanel.create()
    panel.mount(root)
    panel.loop.send('selectTab', 'graph')
    panel.loop.send('setGraphMode', 'json')
    await new Promise(r => setTimeout(r, 20))

    const pre = root.querySelector('pre')
    expect(pre).not.toBeNull()
    const s = pre.getAttribute('style') || ''
    expect(s).toContain('overflow:auto')
    expect(s).toContain('flex:1')
  })

  it('content wrapper is flex column with overflow:hidden', async () => {
    const root = document.getElementById('panel')
    root.innerHTML = ''
    const panel = InspectorPanel.create()
    panel.mount(root)
    await new Promise(r => setTimeout(r, 20))

    const pre = root.querySelector('pre')
    expect(pre).not.toBeNull()
    const parent = pre.parentElement
    const ps = parent.getAttribute('style') || ''
    expect(ps).toContain('display:flex')
    expect(ps).toContain('overflow:hidden')
  })
})

describe('InspectorPanel realtime', () => {
  it('state tab updates when component state changes', async () => {
    const root = document.getElementById('panel')
    root.innerHTML = ''

    const Counter = component('Counter', {
      state: { count: 0 },
      update: { inc: (s) => ({ count: s.count + 1 }) },
      view: (s) => html`<div>${s.count}</div>`,
    })
    const counterInst = Counter.create()
    counterInst.mount(document.createElement('div'))

    const panel = InspectorPanel.create()
    panel.mount(root)
    panel.loop.send('setActiveComp', counterInst)
    panel.loop.send('selectTab', 'state')
    await new Promise(r => setTimeout(r, 20))

    const pre = root.querySelector('pre')
    const initial = pre.textContent

    counterInst.loop.send('inc')
    panel.loop.send('tick')  // manual refresh for jsdom
    await new Promise(r => setTimeout(r, 150))

    const after = root.querySelector('pre').textContent
    expect(after).toContain('count: 1')
    expect(after).not.toBe(initial)
  })
})
