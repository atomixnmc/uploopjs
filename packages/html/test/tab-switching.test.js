/**
 * End-to-end tests simulating the demo app tab switching.
 */
import { describe, it, expect, vi } from 'vitest'
import { html, applyBindings } from '../../html/src/html.js'

// Simulate the html wrapper's component() with DOM execution
import { component as coreComponent } from '@uploop/core'
import { createDOMExecution } from '@uploop/core'

function wrapComponent(name, config) {
  const base = createDOMExecution()
  const resources = {
    _map: new Map(),
    register(name, handlers) {
      if (!this._map.has(name)) this._map.set(name, handlers)
    },
    save() {
      const snap = new Map()
      for (const [n, h] of this._map) {
        if (h.save) try { snap.set(n, h.save()) } catch (e) {}
      }
      return snap
    },
    restore(s, root) {
      if (!s || typeof s.has !== 'function') return
      for (const [n, h] of this._map) {
        if (h.restore && s.has(n)) try { h.restore(s.get(n), root) } catch (e) {}
      }
    }
  }

  const exec = {
    strategy: base.strategy,
    render: base.render,
    replace: base.replace,
    mount: base.mount,
    unmount: base.unmount,
    hooks: {
      preReplace(target) {
        const snap = base.hooks.preReplace(target)
        snap._resources = resources.save()
        return snap
      },
      postReplace(target, snap = {}) {
        base.hooks.postReplace(target, snap)
        if (snap._bindings?.length > 0) {
          applyBindings(target, snap._bindings, () => {}, {})
        }
        if (resources.restore && snap._resources) {
          resources.restore(target, snap._resources)
        }
      }
    }
  }

  const origView = config.view
  return coreComponent(name, {
    ...config,
    execution: exec,
    view: origView && typeof origView === 'function'
      ? (state, ctx) => origView(state, { ...ctx, html })
      : origView
  })
}

describe('demo app tab switching', () => {
  it('renders html template into element', () => {
    const Comp = wrapComponent('Counter', {
      state: { count: 0 },
      view: () => html`<div>Count: ${'0'}</div>`
    })
    const el = document.createElement('div')
    Comp.mount(el)
    expect(el.innerHTML).toContain('Count: 0')
  })

  it('renders complex template with bindings', () => {
    const viewFn = (state) => html`
      <div id="container">
        <input .value=${state.text} data-testid="input" />
        <button @click=${() => {}}>Click</button>
      </div>
    `
    const Comp = wrapComponent('Test', {
      state: { text: 'hello' },
      view: viewFn
    })
    const el = document.createElement('div')
    Comp.mount(el)
    expect(el.innerHTML).toContain('id="container"')
    expect(el.querySelector('input')?.value).toBe('hello')
  })

  it('survives unmount and remount (tab switch simulation)', () => {
    const Comp = wrapComponent('Tab', {
      state: { text: 'tab content' },
      view: (s) => html`<div>${s.text}</div>`
    })
    const slot = document.createElement('div')

    // First mount
    const unmount = Comp.mount(slot)
    expect(slot.innerHTML).toContain('tab content')

    // Unmount (switch away)
    unmount()
    expect(slot.innerHTML).toBe('')

    // Remount (switch back)
    const unmount2 = Comp.mount(slot)
    expect(slot.innerHTML).toContain('tab content')
    unmount2()
  })

  it('canvas resource survives remount', () => {
    let canvasRef = null

    const Comp = wrapComponent('CanvasTest', {
      state: { running: false },
      view: () => html`<div id="canvas-container"></div>`,
      mount: (el, ctx) => {
        const container = el.querySelector('#canvas-container')
        if (!container) return
        // Remove any existing canvas
        const existing = container.querySelector('canvas')
        if (existing) existing.remove()

        // Use existing canvas ref or create new
        if (!canvasRef) {
          canvasRef = document.createElement('canvas')
          canvasRef.width = 100
          canvasRef.height = 100
        }
        container.appendChild(canvasRef)

        ctx.registerResource('test-canvas', {
          save: () => null,
          restore: () => {
            const cont = el.querySelector('#canvas-container')
            if (!cont) return
            const old = cont.querySelector('canvas')
            if (old && old !== canvasRef) old.remove()
            if (!cont.contains(canvasRef)) cont.appendChild(canvasRef)
          }
        })
      }
    })

    const slot = document.createElement('div')
    const unmount = Comp.mount(slot)

    // Canvas should be in DOM
    expect(slot.querySelector('canvas')).toBeTruthy()
    expect(canvasRef).toBeTruthy()

    // Unmount kills canvas
    unmount()
    expect(slot.innerHTML).toBe('')
    expect(slot.querySelector('canvas')).toBeFalsy()

    // Remount should restore canvas
    const unmount2 = Comp.mount(slot)
    expect(slot.querySelector('canvas')).toBeTruthy()
    // Should be the SAME canvas element (restored)
    expect(slot.querySelector('canvas')).toBe(canvasRef)

    unmount2()
  })

  it('re-render preserves registered resources', () => {
    let canvasRef = null

    const Comp = wrapComponent('RenderTest', {
      state: { count: 0 },
      view: (s) => html`<div id="container">${s.count}</div>`,
      mount: (el, ctx) => {
        if (!canvasRef) {
          canvasRef = document.createElement('canvas')
          canvasRef.width = 50
          canvasRef.height = 50
        }
        const container = el.querySelector('#container')
        container?.appendChild(canvasRef)
        ctx.registerResource('c', {
          save: () => null,
          restore: () => {
            const c = el.querySelector('#container')
            const old = c?.querySelector('canvas')
            if (old && old !== canvasRef) old.remove()
            if (c && !c.contains(canvasRef)) c.appendChild(canvasRef)
          }
        })
      }
    })

    const slot = document.createElement('div')
    Comp.mount(slot)
    expect(slot.querySelector('canvas')).toBeTruthy()

    // Re-render (state change triggers innerHTML replacement)
    Comp.loop.set({ count: 1 })
    // Force synchronous render by calling mount again
    Comp.mount(slot)

    // Canvas should still be there after re-render
    expect(slot.querySelector('canvas')).toBeTruthy()
    expect(slot.querySelector('canvas')).toBe(canvasRef)
    expect(slot.innerHTML).toContain('1')
  })
})
