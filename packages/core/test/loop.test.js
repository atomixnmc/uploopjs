import { describe, it, expect } from 'vitest'
import { createLoop, createSignal, createFrame, batch } from '../src/index.js'

describe('createLoop', () => {
  it('initializes with state', () => {
    const loop = createLoop({ state: { count: 0 } })
    expect(loop.get()).toEqual({ count: 0 })
  })

  it('processes updates via send', () => {
    const loop = createLoop({
      state: { count: 0 },
      update: {
        inc: (s) => ({ count: s.count + 1 })
      }
    })
    loop.send('inc')
    expect(loop.get()).toEqual({ count: 1 })
  })

  it('accepts payload args', () => {
    const loop = createLoop({
      state: { count: 0 },
      update: {
        add: (s, n) => ({ count: s.count + n })
      }
    })
    loop.send('add', 5)
    expect(loop.get()).toEqual({ count: 5 })
  })

  it('notifies subscribers on state change', async () => {
    const loop = createLoop({
      state: { count: 0 },
      update: { inc: (s) => ({ count: s.count + 1 }) }
    })
    const results = []
    loop.subscribe((s) => results.push(s.count))
    loop.send('inc')
    loop.send('inc')
    await new Promise(r => setTimeout(r, 0))
    expect(results).toContain(1)
    expect(results).toContain(2)
  })

  it('can set state directly', () => {
    const loop = createLoop({ state: { count: 0 } })
    loop.set({ count: 10 })
    expect(loop.get()).toEqual({ count: 10 })
  })

  it('can set state via function', () => {
    const loop = createLoop({ state: { count: 0 } })
    loop.set((prev) => ({ count: prev.count + 1 }))
    expect(loop.get()).toEqual({ count: 1 })
  })

  it('registers nodes in describe()', () => {
    const loop = createLoop({
      name: 'test',
      state: { x: 1 },
      update: { inc: (s) => ({ x: s.x + 1 }) }
    })
    const desc = loop.describe()
    expect(desc.kind).toBe('uploop.loop')
    expect(desc.name).toBe('test')
    expect(desc.nodes.state).toBeDefined()
    expect(desc.nodes.inc).toBeDefined()
  })

  it('supports on() for runtime update registration', () => {
    const loop = createLoop({ state: { count: 0 } })
    loop.on('inc', (s) => ({ count: s.count + 1 }))
    loop.send('inc')
    expect(loop.get()).toEqual({ count: 1 })
  })
})

describe('createSignal', () => {
  it('stores and retrieves value', () => {
    const s = createSignal(42)
    expect(s.get()).toBe(42)
  })

  it('updates value', () => {
    const s = createSignal(0)
    s.set(1)
    expect(s.get()).toBe(1)
  })

  it('notifies subscribers', () => {
    const s = createSignal(0)
    const results = []
    s.subscribe((v) => results.push(v))
    s.set(1)
    s.set(2)
    expect(results).toEqual([1, 2])
  })

  it('supports functional setter', () => {
    const s = createSignal(0)
    s.set((v) => v + 1)
    expect(s.get()).toBe(1)
  })
})

describe('createFrame', () => {
  it('schedules and executes microtasks', async () => {
    const frame = createFrame('micro')
    const results = []
    frame.schedule(() => results.push(1))
    frame.schedule(() => results.push(2))
    await new Promise(r => setTimeout(r, 0))
    expect(results).toEqual([1, 2])
  })

  it('flush executes pending work', () => {
    const frame = createFrame('manual')
    const results = []
    frame.schedule(() => results.push(1))
    frame.schedule(() => results.push(2))
    expect(results).toEqual([])
    frame.flush()
    expect(results).toEqual([1, 2])
  })
})
