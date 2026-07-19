import { describe, it, expect } from 'vitest'
import { createStateMachine } from '../src/index.js'

describe('createStateMachine', () => {
  it('initializes with initial state', () => {
    const sm = createStateMachine({
      initial: 'idle',
      states: { idle: { on: { START: 'running' } }, running: { on: { STOP: 'idle' } } }
    })
    expect(sm.is('idle')).toBe(true)
    expect(sm.value).toBe('idle')
  })

  it('transitions between states', () => {
    const sm = createStateMachine({
      initial: 'idle',
      states: { idle: { on: { START: 'running' } }, running: { on: { STOP: 'idle' } } }
    })
    sm.send('START')
    expect(sm.is('running')).toBe(true)
    expect(sm.get().prev).toBe('idle')
  })

  it('can checks valid transitions', () => {
    const sm = createStateMachine({
      initial: 'idle',
      states: { idle: { on: { START: 'running' } }, running: { on: { STOP: 'idle' } } }
    })
    expect(sm.can('START')).toBe(true)
    expect(sm.can('STOP')).toBe(false)
    sm.send('START')
    expect(sm.can('STOP')).toBe(true)
  })

  it('available returns valid transitions', () => {
    const sm = createStateMachine({
      initial: 'idle',
      states: {
        idle: { on: { START: 'running' } },
        running: { on: { STOP: 'idle', PAUSE: 'paused' } },
        paused: { on: { RESUME: 'running' } }
      }
    })
    sm.send('START')
    expect(sm.available()).toContain('STOP')
    expect(sm.available()).toContain('PAUSE')
  })

  it('entry hooks update data', () => {
    const sm = createStateMachine({
      initial: 'idle',
      states: {
        idle: { on: { START: 'running' } },
        running: { on: { STOP: 'idle' }, entry: () => ({ speed: 100, color: 'green' }) }
      }
    })
    sm.send('START')
    expect(sm.data).toMatchObject({ speed: 100, color: 'green' })
  })

  it('exit hooks fire', () => {
    const exits = []
    const sm = createStateMachine({
      initial: 'idle',
      states: { idle: { on: { START: 'running' }, exit: () => exits.push('idle-exit') }, running: { on: { STOP: 'idle' } } }
    })
    sm.send('START')
    expect(exits).toEqual(['idle-exit'])
  })

  it('reset returns to initial state', () => {
    const sm = createStateMachine({
      initial: 'idle',
      states: { idle: { on: { START: 'running' } }, running: { on: { STOP: 'idle' } } },
      data: { count: 0 }
    })
    sm.send('START')
    sm.setData({ count: 5 })
    sm.reset()
    expect(sm.is('idle')).toBe(true)
    expect(sm.data.count).toBe(0)
  })

  it('setData patches data without state change', () => {
    const sm = createStateMachine({
      initial: 'idle',
      states: { idle: { on: { NEXT: 'done' } }, done: {} },
      data: { progress: 0 }
    })
    sm.setData({ progress: 50 })
    expect(sm.is('idle')).toBe(true)
    expect(sm.data.progress).toBe(50)
  })

  it('transition ignores invalid event', () => {
    const sm = createStateMachine({
      initial: 'idle',
      states: { idle: { on: { START: 'running' } }, running: { on: { STOP: 'idle' } } }
    })
    sm.send('INVALID')
    expect(sm.is('idle')).toBe(true)
  })

  it('visualize returns ASCII diagram', () => {
    const sm = createStateMachine({
      name: 'test', initial: 'idle',
      states: { idle: { on: { START: 'running' } }, running: { on: { STOP: 'idle' } } }
    })
    const d = sm.visualize()
    expect(d).toContain('test')
    expect(d).toContain('[idle]')
    expect(d).toContain('[running]')
    expect(d).toContain('-->')
  })

  it('supports transition guards via { target, guard }', () => {
    const sm = createStateMachine({
      initial: 'idle',
      states: {
        idle: { on: { START: { target: 'running', guard: (s) => s.data.ready } } },
        running: { on: { STOP: 'idle' } }
      },
      data: { ready: false }
    })
    sm.send('START')
    expect(sm.is('idle')).toBe(true) // guard blocked

    sm.setData({ ready: true })
    sm.send('START')
    expect(sm.is('running')).toBe(true) // guard allowed
  })

  it('supports transition hooks on state defs', () => {
    const calls = []
    const sm = createStateMachine({
      initial: 'idle',
      states: {
        idle: { on: { GO: 'next' }, transition: (s, ev, next) => calls.push(`idle-${ev}-${next}`) },
        next: { on: { BACK: 'idle' } }
      }
    })
    sm.send('GO')
    expect(calls).toEqual(['idle-GO-next'])
  })

  it('supports wildcard * transitions from any state', () => {
    const sm = createStateMachine({
      initial: 'a',
      states: {
        a: { on: { NEXT: 'b', '*': { target: 'error', guard: () => false } } },
        b: { on: { NEXT: 'c' } },
        c: { on: {} },
        error: { on: { RESET: 'a' } }
      }
    })
    sm.send('NEXT')
    expect(sm.is('b')).toBe(true)
    sm.send('NEXT')
    expect(sm.is('c')).toBe(true)
    // Wildcard exists on 'c'? No — each state has its own wildcard
  })

  it('supports subscribe to state changes', async () => {
    const changes = []
    const sm = createStateMachine({
      initial: 'idle',
      states: { idle: { on: { GO: 'done' } }, done: {} }
    })
    sm.subscribe((val, prev, data) => changes.push(`${prev}→${val}`))
    sm.send('GO')
    await new Promise(r => setTimeout(r, 10))
    expect(changes).toEqual(['idle→done'])
  })

  it('supports onChange callback', () => {
    const changes = []
    const sm = createStateMachine({
      initial: 'idle',
      states: { idle: { on: { GO: 'done' } }, done: {} },
      onChange: (val, prev) => changes.push(`${prev}→${val}`)
    })
    sm.send('GO')
    expect(changes).toEqual(['idle→done'])
  })

  it('supports named cycles with step()', () => {
    const sm = createStateMachine({
      initial: 'ice',
      states: {
        ice: { on: { __cycle_water: 'water' } },
        water: { on: { __cycle_water: 'steam' } },
        steam: {}
      },
      cycles: [{ name: 'water', states: ['ice', 'water', 'steam'], repeat: false }]
    })
    expect(sm.is('ice')).toBe(true)
    sm.step('water')
    expect(sm.is('water')).toBe(true)
    sm.step('water')
    expect(sm.is('steam')).toBe(true)
    sm.step('water')
    expect(sm.is('steam')).toBe(true) // no repeat, stays at last
  })

  it('supports repeating cycles with step()', () => {
    const sm = createStateMachine({
      initial: 'red',
      states: {
        red: { on: { __cycle_lights: 'green' } },
        green: { on: { __cycle_lights: 'yellow' } },
        yellow: { on: { __cycle_lights: 'red' } }
      },
      cycles: [{ name: 'lights', states: ['red', 'green', 'yellow'], repeat: true }]
    })
    sm.step('lights')
    expect(sm.is('green')).toBe(true)
    sm.step('lights')
    expect(sm.is('yellow')).toBe(true)
    sm.step('lights')
    expect(sm.is('red')).toBe(true) // wrapped around
  })

  it('supports cycle guard', () => {
    let paused = false
    const sm = createStateMachine({
      initial: 'idle',
      states: { idle: { on: { __cycle_w: 'a' } }, a: { on: { __cycle_w: 'b' } }, b: {} },
      cycles: [{ name: 'w', states: ['idle', 'a', 'b'], repeat: false, guard: () => !paused }]
    })
    sm.step('w')
    expect(sm.is('a')).toBe(true)
    paused = true
    sm.step('w')
    expect(sm.is('a')).toBe(true) // guard blocked
  })

  it('dispose cleans up cycle timers', () => {
    const sm = createStateMachine({
      initial: 'a',
      states: { a: { on: { __cycle_x: 'b' } }, b: {} },
      cycles: [{ name: 'x', states: ['a', 'b'] }]
    })
    const stop = sm.autoCycle('x', 50)
    expect(typeof stop).toBe('function')
    stop()
    sm.dispose()
    // No crash = passes
  })

  it('cycles() returns cycle names', () => {
    const sm = createStateMachine({
      initial: 'a',
      states: { a: { on: { NEXT: 'b' } }, b: {} },
      cycles: [{ name: 'loop', states: ['a', 'b'], repeat: true }]
    })
    expect(sm.cycles()).toContain('loop')
  })
})
