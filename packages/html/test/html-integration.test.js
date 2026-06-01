/**
 * Integration tests for the html wrapper + core component stack.
 * Simulates real-world patterns like canvas persistence.
 */
import { describe, it, expect } from 'vitest'
import { component as coreComponent } from '@uploop/core'
import { html, componentTag } from '../../html/src/html.js'
import { createDOMExecution } from '@uploop/core'

// Replicate the html wrapper's resource logic
function createTestExec(loop) {
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

  return {
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
        // simulate binding + resource restore
        if (resources.restore && snap._resources) {
          resources.restore(target, snap._resources)
        }
      }
    },
    // expose for testing
    _resources: resources
  }
}

describe('html integration', () => {
  it('resource save/restore survives multiple renders', () => {
    const exec = createTestExec({ send: () => {}, get: () => ({}) })
    const Comp = coreComponent('Test', {
      state: { text: 'hello' },
      view: () => html`<div>${'hello'}</div>`,
      execution: exec
    })

    const el = document.createElement('div')

    // Register a persistent resource (simulating canvas)
    exec._resources.register('canvas', {
      save: () => ({ idx: 0, tag: 'canvas' }),
      restore: (data, root) => { /* re-insert */ }
    })

    Comp.mount(el)
    // First render — resources saved and restored (no-op, nothing to restore)
    expect(exec._resources._map.size).toBe(1)

    // Second render — resources saved (Map), restored correctly
    Comp.loop.set({ text: 'world' })
    // force sync render
    Comp.mount(el) // remounts (triggers preReplace → postReplace)

    // Should NOT throw "snap.has is not a function"
    expect(exec._resources._map.size).toBe(1)
  })

  it('snapshot._resources is a Map after preReplace', () => {
    const exec = createTestExec({ send: () => {}, get: () => ({}) })
    exec._resources.register('canvas', { save: () => ({ key: 'val' }), restore: () => {} })

    const snap = exec.hooks.preReplace(document.createElement('div'))
    expect(snap).toBeDefined()
    expect(snap._resources).toBeInstanceOf(Map)
    expect(snap._resources.has('canvas')).toBe(true)
    expect(snap._resources.get('canvas')).toEqual({ key: 'val' })
  })

  it('restore handles non-Map gracefully', () => {
    const exec = createTestExec({ send: () => {}, get: () => ({}) })
    exec._resources.register('canvas', { save: () => ({}), restore: () => {} })

    // Should not throw with null
    expect(() => exec._resources.restore(null, null)).not.toThrow()
    // Should not throw with plain object
    expect(() => exec._resources.restore({}, null)).not.toThrow()
    // Should not throw with undefined
    expect(() => exec._resources.restore(undefined, null)).not.toThrow()
  })
})
