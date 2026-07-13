/**
 * Minimal test to verify resource save/restore works in isolation.
 */
import { describe, it, expect } from 'vitest'

describe('resource save/restore isolation', () => {
  it('register + save + restore works in isolation', () => {
    let saved = null
    let called = 0

    const resources = {
      _map: new Map(),
      register(name, handlers) {
        this._map.set(name, handlers)
      },
      save() {
        const snap = new Map()
        for (const [n, h] of this._map) {
          if (h.save) snap.set(n, h.save())
        }
        return snap
      },
      restore(s, root) {
        if (!s || typeof s.has !== 'function') { called = -1; return }
        called = this._map.size
        for (const [n, h] of this._map) {
          if (h.restore) {
            try { h.restore(s.get(n), root) } catch (e) { saved = 'error:' + e.message }
          }
        }
      }
    }

    resources.register('c', {
      save: () => { saved = 'saved'; return 'ok' },
      restore: (data) => { saved = 'restored:' + data }
    })

    const snap = resources.save()

    // Test direct call (snap Map first, then root element)
    resources.restore(snap, {})
    expect(called).toBe(1)

    // Test with call() to force this binding
    called = 0
    resources.restore.call(resources, snap, {})
    expect(called).toBe(1)
  })
})
