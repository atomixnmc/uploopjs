import { describe, it, expect, vi } from 'vitest'
import { component } from '../src/component.js'

// Minimal execution target for testing
function mockExec() {
  let _html = ''
  return {
    strategy: 'replace',
    render: (t) => String(t),
    replace: (el, html) => { _html = html; if (el) el._html = html },
    mount: (el, html) => { el._html = html; return () => { el._html = '' } },
    unmount: (el) => { el._html = '' },
    hooks: {
      preReplace: () => ({}),
      postReplace: () => {}
    },
    get lastHtml() { return _html }
  }
}

describe('component', () => {
  it('creates a component descriptor', () => {
    const exec = mockExec()
    const Counter = component('Counter', {
      state: { count: 0 },
      update: { inc: s => ({ count: s.count + 1 }) },
      view: s => `Count: ${s.count}`,
      execution: exec
    })
    expect(Counter).toBeTypeOf('function')
    expect(Counter.loop).toBeDefined()
    expect(Counter.describe()).toHaveProperty('kind', 'uploop.loop')
  })

  it('renders view to string', () => {
    const exec = mockExec()
    const Counter = component('Counter', {
      state: { count: 5 },
      view: s => `Count: ${s.count}`,
      execution: exec
    })
    expect(Counter.render()).toBe('Count: 5')
  })

  it('mounts and renders to element', () => {
    const exec = mockExec()
    const Counter = component('Counter', {
      state: { count: 0 },
      view: s => `Count: ${s.count}`,
      execution: exec
    })
    const el = { _html: '', setAttribute: () => {}, removeAttribute: () => {} }
    const unmount = Counter.mount(el)
    expect(exec.lastHtml).toBe('Count: 0')
    unmount()
  })

  it('sends events and re-renders', async () => {
    const exec = mockExec()
    const Counter = component('Counter', {
      state: { count: 0 },
      update: { inc: s => ({ count: s.count + 1 }) },
      view: s => `Count: ${s.count}`,
      execution: exec
    })
    const el = { _html: '', setAttribute: () => {}, removeAttribute: () => {} }
    Counter.mount(el)
    expect(exec.lastHtml).toBe('Count: 0')

    Counter.loop.send('inc')
    // Wait for microtask (frame scheduler)
    await new Promise(r => setTimeout(r, 0))
    expect(exec.lastHtml).toBe('Count: 1')

    Counter.loop.send('inc')
    await new Promise(r => setTimeout(r, 0))
    expect(exec.lastHtml).toBe('Count: 2')
  })

  it('passes bindings through execution snapshot', () => {
    const postReplace = vi.fn()
    const exec = {
      strategy: 'replace',
      render: (t) => String(t),
      replace: () => {},
      mount: () => () => {},
      unmount: () => {},
      hooks: {
        preReplace: () => ({ focus: 'saved' }),
        postReplace
      }
    }
    const TestComp = component('Test', {
      state: { text: 'hello' },
      view: () => ({ toString: () => '<div>hello</div>', bindings: [{ type: 'event', name: 'click', value: () => {} }] }),
      execution: exec
    })
    const el = { _html: '', setAttribute: () => {}, removeAttribute: () => {} }
    TestComp.mount(el)

    expect(postReplace).toHaveBeenCalledTimes(1)
    const snapshot = postReplace.mock.calls[0][1]
    expect(snapshot.bindings).toEqual([{ type: 'event', name: 'click', value: expect.any(Function) }])
    expect(snapshot.focus).toBe('saved')
  })

  it('does not throw when no execution target', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const Counter = component('Counter', {
      state: { count: 0 },
      view: s => `Count: ${s.count}`,
    })
    expect(Counter).toBeDefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('without an execution target'))
    warn.mockRestore()
  })

  it('creates instances via create()', () => {
    const exec = mockExec()
    const Counter = component('Counter', {
      state: { count: 0 },
      update: { inc: s => ({ count: s.count + 1 }) },
      view: s => `Count: ${s.count}`,
      execution: exec
    })
    const inst = Counter.create({ count: 5 })
    expect(inst.loop.get()).toEqual({ count: 5 })
    expect(inst.render()).toBe('Count: 5')

    inst.loop.send('inc')
    expect(inst.render()).toBe('Count: 6')
  })

  it('instance mount works without resource corruption', () => {
    const exec = mockExec()
    const Counter = component('Counter', {
      state: { count: 0 },
      view: s => `${s.count}`,
      execution: exec
    })
    const inst = Counter.create()
    const el = { _html: '', setAttribute: () => {}, removeAttribute: () => {} }
    const unmount = inst.mount(el)
    expect(el._html).toBe('0')
    inst.loop.send('inc') // should update state but not re-render (no subscribe)
    unmount()
  })
})
