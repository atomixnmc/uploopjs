import { describe, it, expect } from 'vitest'
import { createLoop } from '../src/index.js'

describe('createLoop async metadata (v0.3.0)', () => {
  it('debounce delays handler execution', async () => {
    const calls = []
    const loop = createLoop({
      state: { value: 0 },
      update: {
        update: { debounce: 50, run: (s, v) => { calls.push(v); return { value: s.value + v } } }
      }
    })
    loop.send('update', 1)
    loop.send('update', 2)
    loop.send('update', 3)
    expect(calls).toEqual([])
    await new Promise(r => setTimeout(r, 100))
    expect(calls).toEqual([3])
    expect(loop.get().value).toBe(3)
  })

  it('error config catches errors (object handler)', async () => {
    const loop = createLoop({
      state: { data: null },
      error: { fetch: { retry: 2, fallback: { data: 'fallback' } } },
      update: { fetch: { run: () => { throw new Error('boom') } } }
    })
    loop.send('fetch')
    await new Promise(r => setTimeout(r, 10))
    expect(loop.getError('fetch').message).toBe('boom')
  })

  it('clearError resets error state', () => {
    const loop = createLoop({
      state: { data: null },
      error: { fetch: { retry: 2 } },
      update: { fetch: { run: () => { throw new Error('boom') } } }
    })
    loop.send('fetch')
    expect(loop.getError('fetch')).toBeTruthy()
    loop.clearError('fetch')
    expect(loop.getError('fetch')).toBeNull()
  })

  it('interruptible aborts previous execution', async () => {
    const aborted = []
    const loop = createLoop({
      state: { results: [] },
      update: {
        search: {
          interruptible: true,
          run: async (s, query, { signal } = {}) => {
            return new Promise((resolve, reject) => {
              if (signal) signal.addEventListener('abort', () => { aborted.push(query); reject(new Error('x')) })
              setTimeout(() => resolve({ results: [query] }), 50)
            })
          }
        }
      }
    })
    loop.send('search', 'a')
    await new Promise(r => setTimeout(r, 10))
    loop.send('search', 'b')
    await new Promise(r => setTimeout(r, 100))
    expect(aborted).toContain('a')
  })

  it('isPending tracks async handler via object form', async () => {
    const loop = createLoop({
      state: { ready: false },
      update: { load: { run: async (s) => { await new Promise(r => setTimeout(r, 50)); return { ready: true } } } }
    })
    loop.send('load')
    expect(loop.isPending('load')).toBe(true)
    await new Promise(r => setTimeout(r, 100))
    expect(loop.isPending('load')).toBe(false)
    expect(loop.get().ready).toBe(true)
  })

  it('getMeta returns handler metadata', () => {
    const loop = createLoop({
      state: { x: 0 },
      update: { update: { debounce: 300, interruptible: true, run: (s) => s } }
    })
    expect(loop.getMeta('update')).toEqual({ debounce: 300, interruptible: true })
  })

  it('getMeta returns null for plain handlers', () => {
    const loop = createLoop({ state: { x: 0 }, update: { plain: (s) => s } })
    expect(loop.getMeta('plain')).toBeNull()
  })
})

describe('createLoop cache (v0.3.0)', () => {
  it('getCached returns value and freshness', () => {
    const loop = createLoop({ state: { items: [1, 2, 3] }, cache: { items: { ttl: 60000 } } })
    const c = loop.getCached('items')
    expect(c.value).toEqual([1, 2, 3])
    expect(c.fresh).toBe(true)
    expect(c.age).toBeLessThan(100)
  })

  it('cache updates on set', () => {
    const loop = createLoop({ state: { items: [] }, cache: { items: { ttl: 60000 } } })
    loop.set({ items: [1, 2] })
    expect(loop.getCached('items').value).toEqual([1, 2])
  })

  it('invalidateCache forces expired', () => {
    const loop = createLoop({ state: { items: [1] }, cache: { items: { ttl: 60000 } } })
    loop.invalidateCache('items')
    expect(loop.getCached('items').expired).toBe(true)
  })

  it('clearCache removes entries', () => {
    const loop = createLoop({ state: { a: 1, b: 2 }, cache: { a: { ttl: 1000 }, b: { ttl: 1000 } } })
    loop.clearCache()
    expect(loop.getCached('a').fresh).toBe(true)
  })

  it('cache TTL expiry works', async () => {
    const loop = createLoop({ state: { items: [1] }, cache: { items: { ttl: 10 } } })
    expect(loop.getCached('items').fresh).toBe(true)
    await new Promise(r => setTimeout(r, 30))
    expect(loop.getCached('items').expired).toBe(true)
  })
})

describe('createLoop dev-mode (v0.3.0)', () => {
  it('validate finds unused keys', () => {
    const loop = createLoop({
      name: 'test', state: { used: 0, unused: 0 },
      update: { handler: (s) => ({ used: s.used + 1 }) },
      dev: true
    })
    loop.send('handler')
    expect(loop.validate().unusedKeys).toContain('unused')
  })

  it('dev mode warns on unknown events', () => {
    const msgs = []
    const orig = console.warn
    console.warn = (m) => msgs.push(m)
    try {
      const loop = createLoop({ name: 'test', state: { x: 0 }, dev: true })
      loop.send('unknown')
      expect(msgs.some(m => m.includes('unknown'))).toBe(true)
    } finally { console.warn = orig }
  })

  it('non-dev mode is silent', () => {
    const msgs = []
    const orig = console.warn
    console.warn = (m) => msgs.push(m)
    try {
      const loop = createLoop({ name: 'test', state: { x: 0 }, dev: false })
      loop.send('unknown')
      expect(msgs.filter(m => m.includes('[Uploop:dev]')).length).toBe(0)
    } finally { console.warn = orig }
  })
})
