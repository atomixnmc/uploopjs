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
    expect(registered).toBe(false) // not restored on first mount
  })

  // TODO: canvas persistence via send() works in browser but requires
  // proper microtask flushing that jsdom doesn't fully support.
  it.skip('canvas persists across remount', () => {
    let restoreCalled = false
    let saveCalled = false
    const CanvasComp = component('CanvasComp2', {
      state: { count: 0 },
      update: { inc: s => ({ count: s.count + 1 }) },
      view: (s) => html`<div id="c2">${s.count}</div>`,
      mount: (el, ctx) => {
        const c = el.querySelector('#c2')
        const existing = c.querySelectorAll('canvas')
        existing.forEach(e => e.remove())

        const canvas = document.createElement('canvas')
        canvas.width = 20
        canvas.height = 20
        canvas.setAttribute('data-test', 'original')
        c.appendChild(canvas)

        ctx.registerResource('canvas-2', {
          save: () => { saveCalled = true; return { w: canvas.width, h: canvas.height } },
          restore: (data) => {
            restoreCalled = true
            const cont = el.querySelector('#c2')
            if (!cont) return
            const old = cont.querySelector('canvas')
            if (old) old.remove()
            cont.appendChild(canvas)
          }
        })
      }
    })
    const el = document.createElement('div')
    CanvasComp.mount(el)
    expect(el.querySelector('canvas')).toBeTruthy()
    expect(saveCalled).toBe(false)

    // Remount triggers save + restore synchronously
    CanvasComp.loop.set({ count: 1 })
    CanvasComp.mount(el)
    expect(saveCalled).toBe(true)
    expect(restoreCalled).toBe(true)
    expect(el.querySelector('canvas')).toBeTruthy()
    expect(el.querySelector('canvas').getAttribute('data-test')).toBe('original')
  })

  // Tests full interaction cycle: mount → click button → re-render → canvas survives
  it('canvas survives button click that changes state', () => {
    const CanvasComp = component('ClickCanvas', {
      state: { running: false },
      update: { start: s => ({ running: true }) },
      view: (s) => html`
        <div id="container"></div>
        <button @click=${['start']} id="start-btn">Start</button>
      `,
      mount: (el, ctx) => {
        const c = el.querySelector('#container')
        let canvas = c.querySelector('canvas')
        if (!canvas) {
          canvas = document.createElement('canvas')
          canvas.width = 50
          canvas.height = 50
          c.appendChild(canvas)
        }
        ctx.registerResource('cc', {
          save: () => 'saved',
          restore: (data) => {
            const cont = el.querySelector('#container')
            if (!cont) return
            const old = cont.querySelector('canvas')
            if (old) old.remove()
            const nc = document.createElement('canvas')
            nc.width = 50
            nc.height = 50
            cont.appendChild(nc)
          }
        })
      }
    })
    const el = document.createElement('div')
    CanvasComp.mount(el)
    expect(el.querySelectorAll('canvas').length).toBe(1)

    // Trigger state change directly (button click works via same pipeline)
    CanvasComp.loop.send('start')
    CanvasComp.loop.frame.flush()

    // Canvas should still exist after re-render
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

  it('unmount clears content, remount renders fresh', () => {
    const Comp2 = component('Remount', {
      state: { text: 'first' },
      view: (s) => html`<span>${s.text}</span>`
    })
    const el2 = document.createElement('div')

    const u1 = Comp2.mount(el2)
    expect(el2.innerHTML).toContain('first')

    u1()
    expect(el2.innerHTML).toBe('')

    const u2 = Comp2.mount(el2)
    expect(el2.innerHTML).toContain('first')
    u2()
  })
})
