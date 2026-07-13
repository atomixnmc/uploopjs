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
})
