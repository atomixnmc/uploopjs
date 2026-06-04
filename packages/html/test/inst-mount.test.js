/**
 * Test: inst.mount(el) path works correctly after ?? bug fix.
 *
 * The exec.replace?.(...) ?? (el.innerHTML = ...) pattern caused
 * innerHTML to be set twice, wiping post-processing hooks. This test
 * verifies the fix: inst.mount correctly renders and handles events.
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

describe('inst.mount(el) path', () => {
  it('renders correctly and handles event-driven state changes', async () => {
    const root = document.getElementById('root')

    const Counter = component('Counter', {
      state: { count: 0 },
      update: {
        inc: (s) => ({ count: s.count + 1 })
      },
      view: (state, { send }) => html`
        <div>
          <span id="count-display">${state.count}</span>
          <button id="inc-btn" @click=${() => send('inc')}>+</button>
        </div>
      `,
    })

    // Use inst.mount path (the one that had the ?? bug)
    const inst = Counter.create()
    const unmount = inst.mount(root)

    // After mount, the count display should show 0 and button should work
    let display = root.querySelector('#count-display')
    expect(display).not.toBeNull()
    expect(display.textContent).toBe('0')

    // Click the button
    const btn = root.querySelector('#inc-btn')
    expect(btn).not.toBeNull()
    btn.click()

    await new Promise(r => setTimeout(r, 20))

    // After event, count should be 1
    display = root.querySelector('#count-display')
    expect(display).not.toBeNull()
    expect(display.textContent).toBe('1')

    // Click again
    btn.click()
    await new Promise(r => setTimeout(r, 20))

    display = root.querySelector('#count-display')
    expect(display.textContent).toBe('2')

    unmount()
  })

  it('preserves event bindings after state changes', async () => {
    const root = document.getElementById('root')
    root.innerHTML = ''

    const Toggle = component('Toggle', {
      state: { on: false },
      update: {
        toggle: (s) => ({ on: !s.on })
      },
      view: (state, { send }) => html`
        <div>
          <span id="status">${state.on ? 'ON' : 'OFF'}</span>
          <button id="tgl-btn" @click=${() => send('toggle')}>Toggle</button>
        </div>
      `,
    })

    const inst = Toggle.create()
    inst.mount(root)

    const btn = root.querySelector('#tgl-btn')
    const status = root.querySelector('#status')

    expect(status.textContent).toBe('OFF')
    btn.click()
    await new Promise(r => setTimeout(r, 20))
    expect(root.querySelector('#status').textContent).toBe('ON')
    btn.click()
    await new Promise(r => setTimeout(r, 20))
    expect(root.querySelector('#status').textContent).toBe('OFF')

    // 5 rapid toggles — event bindings should survive each re-render
    for (let i = 0; i < 5; i++) {
      root.querySelector('#tgl-btn').click()
      await new Promise(r => setTimeout(r, 10))
    }
    expect(root.querySelector('#status').textContent).toBe('ON')
  })

  it('supports props via create({ ... })', async () => {
    const root = document.getElementById('root')
    root.innerHTML = ''

    const Greeter = component('Greeter', {
      state: { name: 'World' },
      view: (state) => html`<span id="greeting">Hello ${state.name}</span>`,
    })

    const inst = Greeter.create({ name: 'Alice' })
    inst.mount(root)

    const span = root.querySelector('#greeting')
    expect(span.textContent).toBe('Hello Alice')
  })

  it('calls mount hook', async () => {
    const root = document.getElementById('root')
    root.innerHTML = ''

    let hookCalled = false
    let hookEl = null

    const WithHook = component('WithHook', {
      view: () => html`<div id="hook-target"></div>`,
      mount: (el, ctx) => {
        hookCalled = true
        hookEl = el
      }
    })

    const inst = WithHook.create()
    inst.mount(root)

    expect(hookCalled).toBe(true)
    expect(hookEl).not.toBeNull()
    expect(hookEl.querySelector('#hook-target')).not.toBeNull()
  })

  it('resource registered in mount hook survives re-render', async () => {
    const root = document.getElementById('root')
    root.innerHTML = ''

    let saved = null
    let restored = null

    const WithResource = component('WithResource', {
      state: { count: 0 },
      update: { inc: (s) => ({ count: s.count + 1 }) },
      view: (state, { send }) => html`
        <div>
          <canvas id="test-canvas" register-resource="test-canvas" width="50" height="50"></canvas>
          <button id="res-inc" @click=${() => send('inc')}>Inc</button>
          <span id="res-count">${state.count}</span>
        </div>
      `,
      mount: (el, ctx) => {
        ctx.registerResource('test-canvas', {
          save: () => { saved = true; return {} },
          restore: (data) => { restored = true }
        })
      }
    })

    const inst = WithResource.create()
    inst.mount(root)

    const canvas = root.querySelector('#test-canvas')
    expect(canvas).not.toBeNull()

    // Trigger re-render
    root.querySelector('#res-inc').click()
    await new Promise(r => setTimeout(r, 20))

    // Resource save/restore should have been called
    expect(saved).toBe(true)
    expect(restored).toBe(true)

    // Canvas should still exist
    expect(root.querySelector('#test-canvas')).not.toBeNull()
  })
})
