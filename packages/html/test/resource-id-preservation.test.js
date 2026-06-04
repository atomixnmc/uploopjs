/**
 * Test: register-resource preserves elements with id across re-renders.
 *
 * Reproduces: Canvas/Paint example losing state when Inspector tabs clicked.
 * Root cause hypothesis: innerHTML replacement creates a duplicate element
 * with the same id, and getElementById returns the wrong one.
 */
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost'
})
globalThis.document = dom.window.document
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.customElements = { define: () => {}, get: () => null }
globalThis.DOMParser = dom.window.DOMParser

import { html, component } from '../src/index.js'

describe('register-resource with id preservation', () => {
  it('preserves element and its children across re-renders', async () => {
    const root = document.getElementById('app')

    // Create a component with a register-resource div that has an id
    const TestComp = component('TestComp', {
      state: { toggle: false },
      update: {
        flip: (s) => ({ toggle: !s.toggle })
      },
      view: (state, { send }) => html`
        <div>
          <div id="demo-slot" register-resource="demo-slot"
               style="min-height:100px;border:1px solid #ccc;">
          </div>
          <button id="flip-btn" @click=${() => send('flip')}>Flip</button>
        </div>
      `,
    })

    TestComp.mount(root)

    // After first render, the demo-slot div should exist exactly once
    let slots = root.querySelectorAll('#demo-slot')
    expect(slots.length).toBe(1)

    const originalSlot = slots[0]

    // Manually add a child to simulate mounted component
    const canvas = document.createElement('canvas')
    canvas.id = 'paint-canvas'
    canvas.width = 100
    canvas.height = 100
    originalSlot.appendChild(canvas)

    // Verify child is there
    expect(originalSlot.children.length).toBe(1)
    expect(originalSlot.querySelector('#paint-canvas')).not.toBeNull()

    // Trigger re-render (simulates clicking Inspector tab)
    document.getElementById('flip-btn').click()

    // Wait for microtasks (inline render is synchronous, but just in case)
    await new Promise(r => setTimeout(r, 10))

    // After re-render: the demo-slot should still exist exactly once
    slots = root.querySelectorAll('#demo-slot')
    expect(slots.length).toBe(1, 'should not have duplicate #demo-slot elements')

    const preservedSlot = slots[0]

    // The preserved slot should be the SAME DOM element (or at least have the canvas)
    const preservedCanvas = preservedSlot.querySelector('#paint-canvas')
    expect(preservedCanvas).not.toBeNull('canvas child should survive re-render')
    expect(preservedCanvas.width).toBe(100)
  })

  it('getElementById returns the preserved element not the duplicate', async () => {
    const root = document.getElementById('app')
    root.innerHTML = ''

    const TestComp2 = component('TestComp2', {
      state: { count: 0 },
      update: {
        inc: (s) => ({ count: s.count + 1 })
      },
      view: (state, { send }) => html`
        <div>
          <div id="persistent-panel" register-resource="persistent-panel"></div>
          <button id="inc-btn" @click=${() => send('inc')}>Inc</button>
        </div>
      `,
    })

    TestComp2.mount(root)

    // Get the original element via getElementById
    const original = document.getElementById('persistent-panel')
    expect(original).not.toBeNull()
    original._marker = 'ORIGINAL'

    // Trigger re-render
    document.getElementById('inc-btn').click()
    await new Promise(r => setTimeout(r, 10))

    // getElementById should return the ORIGINAL (with _marker), not a new empty one
    const afterRender = document.getElementById('persistent-panel')
    expect(afterRender).not.toBeNull()
    expect(afterRender._marker).toBe('ORIGINAL',
      'getElementById should return preserved element, not new duplicate')

    // Should be exactly one
    expect(root.querySelectorAll('#persistent-panel').length).toBe(1)
  })

  it('multiple re-renders do not accumulate duplicates', async () => {
    const root = document.getElementById('app')
    root.innerHTML = ''

    const TestComp3 = component('TestComp3', {
      state: { count: 0 },
      update: {
        inc: (s) => ({ count: s.count + 1 })
      },
      view: (state, { send }) => html`
        <div>
          <div id="stable-slot" register-resource="stable-slot"></div>
          <button id="inc3-btn" @click=${() => send('inc')}>Inc</button>
        </div>
      `,
    })

    TestComp3.mount(root)

    // Add child
    const el = document.getElementById('stable-slot')
    el._marker = 'KEPT'

    // Trigger 5 re-renders
    for (let i = 0; i < 5; i++) {
      document.getElementById('inc3-btn').click()
      await new Promise(r => setTimeout(r, 10))

      // After each render, should be exactly one
      const count = root.querySelectorAll('#stable-slot').length
      expect(count).toBe(1, `render ${i + 1}: should have exactly 1 #stable-slot, got ${count}`)

      // And it should still be the marked element
      const current = document.getElementById('stable-slot')
      expect(current._marker).toBe('KEPT', `render ${i + 1}: element should be preserved`)
    }
  })
})
