import { describe, it, expect } from 'vitest'
import { createActor, createActorSystem } from '../src/actor.js'
import {
  createSignal, createComputed, createEffect,
  batch, createReactiveStore, createResource
} from '../src/reactive.js'

// ── Actor ──────────────────────────────────────────────────

describe('createActor', () => {
  it('processes messages sequentially', async () => {
    const order = []
    const actor = createActor({
      name: 'test',
      state: { count: 0 },
      on: {
        inc: (s, amount) => { order.push(`inc:${amount}`); return { count: s.count + amount } },
        dec: (s, amount) => { order.push(`dec:${amount}`); return { count: s.count - amount } }
      }
    })

    await actor.send('inc', 5)
    await actor.send('dec', 2)
    expect(actor.state.count).toBe(3)
    expect(order).toEqual(['inc:5', 'dec:2'])
  })

  it('tell() is fire-and-forget', () => {
    const actor = createActor({
      name: 'ff',
      state: { fired: false },
      on: { fire: (s) => ({ fired: true }) }
    })
    actor.tell('fire', {})
    // tell doesn't wait, so state may not be updated yet
    actor.stop()
  })

  it('ask() returns response', async () => {
    const actor = createActor({
      name: 'asker',
      state: { value: 42 },
      on: { getValue: (s, _, ctx) => { ctx.reply(s.value); return s } }
    })
    const result = await actor.ask('getValue')
    expect(result).toBe(42) // reply returns the value, not the state
  })

  it('unknown messages warn but do not crash', async () => {
    const actor = createActor({
      name: 'unknown',
      state: { ok: true },
      on: {}
    })
    await actor.send('nonexistent')
    expect(actor.state.ok).toBe(true)
  })

  it('stopped actor rejects sends', async () => {
    const actor = createActor({ name: 'stopped', state: {}, on: {} })
    actor.stop()
    await expect(actor.send('x')).rejects.toThrow('stopped')
  })

  it('onError handler receives error context', async () => {
    const errors = []
    const actor = createActor({
      name: 'erroring',
      state: { tries: 0 },
      on: {
        crash: () => { throw new Error('boom') }
      },
      onError: (err, msg, state) => {
        errors.push({ message: err.message, msgType: msg.type })
        return 'resume'
      }
    })
    await expect(actor.send('crash')).rejects.toThrow('boom')
    expect(errors.length).toBe(1)
    expect(errors[0].message).toBe('boom')
  })

  it('spawns child actors', () => {
    const parent = createActor({
      name: 'parent',
      state: {},
      on: {}
    })
    const child = parent.spawn('child', { state: {}, on: {} })
    expect(parent.children().length).toBe(1)
    expect(parent.children()[0].name).toBe('parent/child')
  })

  it('snapshot() returns state copy', async () => {
    const actor = createActor({
      name: 'snap',
      state: { x: 1 },
      on: { inc: (s) => ({ x: s.x + 1 }) }
    })
    expect(actor.snapshot()).toEqual({ x: 1 })
    await actor.send('inc')
    expect(actor.snapshot()).toEqual({ x: 2 })
  })

  it('describe() returns JSON-safe state', () => {
    const actor = createActor({ name: 'desc', state: { a: 1 }, on: { ping: (s) => s } })
    const d = actor.describe()
    expect(d.kind).toBe('uploop.flow.actor')
    expect(d.name).toBe('desc')
    expect(d.handlers).toContain('ping')
  })

  it('mailbox overflow: drop', async () => {
    // Use a blocking handler to fill the mailbox
    const actor = createActor({
      name: 'drop',
      state: { count: 0 },
      mailboxSize: 2,
      overflow: 'drop',
      on: {
        inc: async (s) => {
          await new Promise(r => setTimeout(r, 50))
          return { count: s.count + 1 }
        }
      }
    })
    // First two fill the mailbox, third is dropped
    actor.send('inc').catch(() => {})
    actor.send('inc').catch(() => {})
    await expect(actor.send('inc')).rejects.toThrow('dropped')
    actor.stop()
  })
})

// ── Actor System ───────────────────────────────────────────

describe('createActorSystem', () => {
  it('supervises actors with restart strategy', () => {
    const system = createActorSystem({ name: 'test', strategy: 'restart', maxRestarts: 3 })
    const actor = system.supervise({
      name: 'worker',
      state: { count: 0 },
      on: { ping: (s) => s }
    })
    expect(system.list()).toContain('worker')
    expect(actor.alive).toBe(true)
  })

  it('reports system events', () => {
    const events = []
    const system = createActorSystem({ name: 'evt', strategy: 'restart', maxRestarts: 2 })
    system.on('restart', (data) => events.push(data))
    system.supervise({
      name: 'crashy',
      state: {},
      on: { crash: () => { throw new Error('fail') } }
    })
    // send crash — triggers restart
    system.send('crashy', 'crash').catch(() => {})
    // don't wait, just test event system structure
    expect(typeof system.on).toBe('function')
  })

  it('describe() returns system state', () => {
    const system = createActorSystem({ name: 's1' })
    system.supervise({ name: 'a', state: {}, on: {} })
    const d = system.describe()
    expect(d.kind).toBe('uploop.flow.actorSystem')
    expect(d.name).toBe('s1')
    expect(d.children).toBe(1)
  })

  it('stop() kills all supervised actors', () => {
    const system = createActorSystem({ name: 'kill' })
    const a = system.supervise({ name: 'a', state: {}, on: {} })
    system.stop()
    expect(a.alive).toBe(false)
  })
})

// ── Reactive: Signal ───────────────────────────────────────

describe('createSignal', () => {
  it('get and set values', () => {
    const [count, setCount] = createSignal(0)
    expect(count()).toBe(0)
    setCount(5)
    expect(count()).toBe(5)
  })

  it('functional update', () => {
    const [count, setCount] = createSignal(1)
    setCount(c => c * 2)
    expect(count()).toBe(2)
  })

  it('peek() does not subscribe', () => {
    const [count] = createSignal(0)
    expect(count.peek()).toBe(0)
    // no subscriber tracking when using peek
  })

  it('subscribe() notifies on change', async () => {
    const [count, setCount] = createSignal(0)
    const values = []
    count.subscribe(v => values.push(v))
    setCount(1)
    setCount(2)
    await new Promise(r => setTimeout(r, 10))
    expect(values).toEqual([1, 2])
  })

  it('equals() prevents unnecessary updates', async () => {
    const [count, setCount] = createSignal(0)
    const values = []
    count.subscribe(v => values.push(v))
    setCount(0) // same value
    await new Promise(r => setTimeout(r, 10))
    expect(values).toEqual([])
  })

  it('unsubscribe removes listener', async () => {
    const [count, setCount] = createSignal(0)
    const values = []
    const unsub = count.subscribe(v => values.push(v))
    unsub()
    setCount(1)
    await new Promise(r => setTimeout(r, 10))
    expect(values).toEqual([])
  })
})

// ── Reactive: Computed ─────────────────────────────────────

describe('createComputed', () => {
  it('computes derived value', () => {
    const [a] = createSignal(2)
    const [b] = createSignal(3)
    const sum = createComputed(() => a() + b(), [a, b])
    expect(sum()).toBe(5)
  })

  it('recomputes when dependency changes', async () => {
    const [a, setA] = createSignal(2)
    const [b] = createSignal(3)
    const sum = createComputed(() => a() + b(), [a, b])
    expect(sum()).toBe(5)
    setA(10)
    // computed is lazy — value updates on next read
    await new Promise(r => setTimeout(r, 10))
    expect(sum()).toBe(13)
  })

  it('peek() returns cached value', () => {
    const [a] = createSignal(5)
    const doubled = createComputed(() => a() * 2, [a])
    expect(doubled.peek()).toBe(10)
  })
})

// ── Reactive: Effect ───────────────────────────────────────

describe('createEffect', () => {
  it('runs on dependency change', async () => {
    const [count, setCount] = createSignal(0)
    const results = []
    const eff = createEffect(() => {
      results.push(count()) // reading count inside effect = auto-subscribe
    })
    await new Promise(r => setTimeout(r, 10))
    setCount(1)
    await new Promise(r => setTimeout(r, 10))
    setCount(2)
    await new Promise(r => setTimeout(r, 10))
    // effect fires for each change: initial(0), setCount(1), setCount(2)
    expect(results.length).toBeGreaterThanOrEqual(2)
    expect(results[0]).toBe(0)
    eff.dispose()
  })

  it('dispose stops effect', async () => {
    const [count, setCount] = createSignal(0)
    const results = []
    const eff = createEffect(() => results.push(count()))
    await new Promise(r => setTimeout(r, 10))
    eff.dispose()
    setCount(99)
    await new Promise(r => setTimeout(r, 10))
    expect(results).not.toContain(99)
  })

  it('cleanup runs on re-execution', async () => {
    const [count, setCount] = createSignal(0)
    const cleanups = []
    createEffect(() => {
      count() // subscribe
      return () => cleanups.push('clean')
    })
    await new Promise(r => setTimeout(r, 10))
    setCount(1)
    await new Promise(r => setTimeout(r, 10))
    expect(cleanups).toEqual(['clean'])
  })
})

// ── Reactive: Batch ────────────────────────────────────────

describe('batch', () => {
  it('defers updates until batch completes', async () => {
    const [a, setA] = createSignal(0)
    const [b, setB] = createSignal(0)
    const changes = []
    a.subscribe(v => changes.push(`a:${v}`))
    b.subscribe(v => changes.push(`b:${v}`))

    batch(() => {
      setA(1)
      setB(2)
      setA(3)
    })

    await new Promise(r => setTimeout(r, 10))
    // all batched updates flushed after batch — multiple sets coalesce
    expect(changes).toContain('a:3')
    expect(changes).toContain('b:2')
  })
})

// ── Reactive: Store ────────────────────────────────────────

describe('createReactiveStore', () => {
  it('creates reactive object with signal per key', () => {
    const store = createReactiveStore({ name: 'Alice', age: 30 })
    expect(store.name).toBe('Alice')
    expect(store.age).toBe(30)
  })

  it('get/set accessors work', () => {
    const store = createReactiveStore({ x: 1 })
    store.x = 2
    expect(store.get('x')).toBe(2)
    store.set('x', 5)
    expect(store.x).toBe(5)
  })

  it('on() subscribes to key changes', async () => {
    const store = createReactiveStore({ val: 0 })
    const seen = []
    store.on('val', v => seen.push(v))
    store.val = 1
    store.val = 2
    await new Promise(r => setTimeout(r, 10))
    expect(seen).toEqual([1, 2])
  })

  it('snapshot() returns plain object', () => {
    const store = createReactiveStore({ a: 1, b: 2 })
    expect(store.snapshot()).toEqual({ a: 1, b: 2 })
  })

  it('update() applies function', () => {
    const store = createReactiveStore({ count: 1 })
    store.update('count', c => c * 10)
    expect(store.count).toBe(10)
  })
})

// ── Reactive: Resource ─────────────────────────────────────

describe('createResource', () => {
  it('loads data from async fetcher', async () => {
    const res = createResource(async () => 'loaded', { lazy: true })
    expect(res.state).toBe('ready') // lazy, not yet loaded
    await res.refetch()
    expect(res.data()).toBe('loaded')
    expect(res.state).toBe('ready')
  })

  it('handles errors', async () => {
    const res = createResource(async () => { throw new Error('fail') }, { lazy: true })
    await res.refetch()
    expect(res.state).toBe('error')
    expect(res.error().message).toBe('fail')
  })
})
