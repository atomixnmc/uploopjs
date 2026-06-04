/**
 * Test: inst.mount + input events + re-render (CityInput regression)
 */
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost'
})
globalThis.document = dom.window.document
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.customElements = { define: () => {}, get: () => null }
globalThis.DOMParser = dom.window.DOMParser

import { html, component } from '@uploop/html'

describe('CityInput regression', () => {
  it('input event triggers state change and re-renders suggestions', async () => {
    const root = document.getElementById('root')

    // Simulate CityInput: autocomplete with suggestions dropdown
    const Autocomplete = component('Autocomplete', {
      state: { query: '', suggestions: [], open: false },
      update: {
        input: (s, q) => {
          if (q.length >= 1) {
            return {
              query: q,
              suggestions: [`${q}1`, `${q}2`, `${q}3`],
              open: true
            }
          }
          return { query: q, suggestions: [], open: false }
        }
      },
      view: (state, { send }) => html`
        <div>
          <input id="ac-input" .value=${state.query}
            @input=${['input', e => e.target.value]} />
          ${state.open ? html`
            <ul id="ac-suggestions">
              ${state.suggestions.map(s => html`<li>${s}</li>`)}
            </ul>
          ` : ''}
        </div>
      `,
    })

    // Use inst.mount path (same as CityInput)
    const inst = Autocomplete.create()
    inst.mount(root)

    // Type in the input
    const input = root.querySelector('#ac-input')
    input.value = 'hel'
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))

    await new Promise(r => setTimeout(r, 20))

    // Suggestions should appear
    const suggestions = root.querySelector('#ac-suggestions')
    expect(suggestions).not.toBeNull()
    const items = suggestions.querySelectorAll('li')
    expect(items.length).toBe(3)
  })

  it('re-mounting on parent re-render preserves functionality', async () => {
    const root = document.getElementById('root')
    root.innerHTML = ''

    // Parent component that mounts a child via create+inst.mount
    const Child = component('Child', {
      state: { count: 0 },
      update: { inc: (s) => ({ count: s.count + 1 }) },
      view: (state, { send }) => html`
        <button id="child-btn" @click=${() => send('inc')}>Child: ${state.count}</button>
      `,
    })

    const Parent = component('Parent', {
      state: { parentCount: 0 },
      update: { inc: (s) => ({ parentCount: s.parentCount + 1 }) },
      view: (state, { send }) => html`
        <div>
          <div id="child-slot"></div>
          <button id="parent-btn" @click=${() => send('inc')}>Parent: ${state.parentCount}</button>
        </div>
      `,
      mount: (el) => {
        let childInst = null
        let childUnmount = null

        function mountChild() {
          if (childUnmount) { childUnmount(); childUnmount = null }
          const slot = el.querySelector('#child-slot')
          if (!slot) return
          childInst = Child.create()
          childUnmount = childInst.mount(slot)
        }

        mountChild()
        Parent.loop.subscribe(() => {
          requestAnimationFrame(() => mountChild())
        })
      }
    })

    Parent.mount(root)

    // Click child button
    let childBtn = root.querySelector('#child-btn')
    childBtn.click()
    await new Promise(r => setTimeout(r, 20))
    childBtn = root.querySelector('#child-btn')
    expect(childBtn.textContent).toContain('Child: 1')

    // Click parent button (triggers re-render, destroys child slot, re-mounts child)
    root.querySelector('#parent-btn').click()
    await new Promise(r => setTimeout(r, 50))

    // Child should be re-mounted and functional
    childBtn = root.querySelector('#child-btn')
    expect(childBtn).not.toBeNull()
    childBtn.click()
    await new Promise(r => setTimeout(r, 20))
    childBtn = root.querySelector('#child-btn')
    expect(childBtn.textContent).toContain('Child: 1') // fresh instance, starts at 0 then 1
  })
})
