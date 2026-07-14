/**
 * Integration tests using the actual @uploop/html component() wrapper.
 * Catches regressions in the full stack: html tag → component → DOM.
 */
import { describe, it, expect } from 'vitest'
import { html, component } from '../../html/src/index.js'

describe('html/component full stack', () => {
  it('renders simple component into DOM', () => {
    const Counter = component('Counter', {
      state: { count: 0 },
      view: (s) => html`<div>Count: ${s.count}</div>`
    })
    const el = document.createElement('div')
    Counter.mount(el)
    expect(el.innerHTML).toContain('Count: 0')
  })

  it('renders component with .value binding', () => {
    const Form = component('Form', {
      state: { text: 'hello' },
      view: (s) => html`<input .value=${s.text} />`
    })
    const el = document.createElement('div')
    Form.mount(el)
    const input = el.querySelector('input')
    expect(input).toBeTruthy()
    expect(input.value).toBe('hello')
  })

  it('component with mount hook creates canvas', () => {
    let registered = false
    const CanvasComp = component('CanvasComp', {
      state: {},
      view: () => html`<div id="c"></div>`,
      mount: (el, ctx) => {
        const c = el.querySelector('#c')
        const canvas = document.createElement('canvas')
        canvas.width = 10
        canvas.height = 10
        c.appendChild(canvas)
        ctx.registerResource?.('test', {
          save: () => null,
          restore: () => { registered = true }
        })
      }
    })
    const el = document.createElement('div')
    CanvasComp.mount(el)
    const canvas = el.querySelector('canvas')
    expect(canvas).toBeTruthy()
    expect(registered).toBe(false)
  })

  it.skip('canvas persists across remount', () => {
    // jsdom microtask limitation — works in browser
  })

  it('re-render preserves canvas via resource restore', () => {
    let saved = null
    const Comp = component('FishSim', {
      state: { running: false },
      update: { start: s => ({ running: true }) },
      view: () => html`<div id="box"></div>`,
      mount: (el, ctx) => {
        const box = el.querySelector('#box')
        let canvas = box.querySelector('canvas')
        if (!canvas) {
          canvas = document.createElement('canvas')
          canvas.width = 50; canvas.height = 50
          box.appendChild(canvas)
        }
        ctx.registerResource('c', {
          save: () => { saved = 'ok'; return 'ok' },
          restore: (data) => {
            saved = 'restored:' + data
            const b = el.querySelector('#box')
            if (!b) return
            const old = b.querySelector('canvas')
            if (old) old.remove()
            b.appendChild(canvas)
          }
        })
      }
    })
    const el = document.createElement('div')
    Comp.mount(el)
    expect(el.querySelectorAll('canvas').length).toBe(1)

    Comp.loop.send('start')
    Comp.loop.frame.flush()
    expect(saved).toBe('restored:ok')
    expect(el.querySelectorAll('canvas').length).toBe(1)
  })

  it('re-render via send fires subscriber', async () => {
    let rendered = false
    const Comp = component('ReRender', {
      state: { count: 0 },
      update: { inc: s => ({ count: s.count + 1 }) },
      view: (s) => { rendered = true; return html`<span>${s.count}</span>` }
    })
    const el = document.createElement('div')
    Comp.mount(el)
    expect(el.innerHTML).toContain('0')
    rendered = false

    Comp.loop.send('inc')
    await new Promise(r => setTimeout(r, 0))
    expect(rendered).toBe(true)
    expect(el.innerHTML).toContain('1')
  })

  it('preserves range input identity during input-driven re-render', async () => {
    let updates = 0
    const Slider = component('Slider', {
      state: { value: 0 },
      update: {
        set: (s, value) => {
          updates++
          return { value }
        }
      },
      view: (s, { send }) => html`
        <label>
          <input id="volume" type="range" min="0" max="100" .value=${s.value} @input=${['set', e => Number(e.target.value)]} />
          <span id="readout">${s.value}</span>
        </label>
      `
    })

    const el = document.createElement('div')
    Slider.mount(el)

    const first = el.querySelector('#volume')
    first.value = '42'
    first.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise(r => setTimeout(r, 0))

    const second = el.querySelector('#volume')
    expect(second).toBe(first)
    expect(second.value).toBe('42')
    expect(el.querySelector('#readout').textContent).toBe('42')
    expect(updates).toBe(1)

    second.value = '43'
    second.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise(r => setTimeout(r, 0))

    expect(el.querySelector('#volume')).toBe(first)
    expect(el.querySelector('#readout').textContent).toBe('43')
    expect(updates).toBe(2)
  })

  it('unmount clears content, remount renders fresh', () => {
    const Comp = component('Remount', {
      state: { text: 'first' },
      view: (s) => html`<span>${s.text}</span>`
    })
    const el = document.createElement('div')
    const u1 = Comp.mount(el)
    expect(el.innerHTML).toContain('first')
    u1()
    expect(el.innerHTML).toBe('')
    const u2 = Comp.mount(el)
    expect(el.innerHTML).toContain('first')
    u2()
  })
})
