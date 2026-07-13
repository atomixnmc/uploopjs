import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { component, createLoop } from '@uploop/core'
import { component as htmlComponent, html } from '@uploop/html'
import { renderToString, hydrate } from '../src/index.js'

// Setup jsdom
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
global.document = dom.window.document
global.HTMLElement = dom.window.HTMLElement
global.customElements = { define() {} }

describe('SSR — renderToString', () => {
  it('renders a simple component to HTML string', () => {
    const Counter = component('Counter', {
      state: { count: 0 },
      view: (s) => html`<div>Count: ${s.count}</div>`
    })

    const result = renderToString(Counter, { count: 5 })
    expect(result).toContain('Count: 5')
    expect(result).toContain('<div>')
  })

  it('renders component with bindings (markers preserved for hydration)', () => {
    const Form = component('Form', {
      state: { text: 'hello' },
      view: (s, { send }) => html`<input .value=${s.text} @input=${() => send('input')} />`
    })

    const result = renderToString(Form)
    expect(result).toContain('data-up-prop')
    expect(result).toContain('data-up-event')
  })

  it('renders component with nested children', () => {
    const Child = component('Child', {
      state: { name: 'world' },
      view: (s) => html`<span>Hello ${s.name}</span>`
    })

    const Parent = component('Parent', {
      view: () => html`<div>${Child({ name: 'uploop' })}</div>`
    })

    const result = renderToString(Parent)
    expect(result).toContain('Hello uploop')
  })
})

describe('Hydration', () => {
  it('hydrates server-rendered HTML with event listeners', () => {
    const calls = []
    const Counter = htmlComponent('Counter', {
      state: { count: 0 },
      update: { inc: (s) => ({ count: s.count + 1 }) },
      view: (s, { send }) => {
        const handler = () => { calls.push('click'); send('inc') }
        return html`<div><span>${s.count}</span><button @click=${handler}>+</button></div>`
      }
    })

    // Server render
    const serverHTML = renderToString(Counter, { count: 0 })

    // Client hydrate
    const target = document.createElement('div')
    target.innerHTML = serverHTML

    const inst = hydrate(Counter, target, {}, { count: 0 })

    // Button should exist in DOM
    const btn = target.querySelector('button')
    expect(btn).toBeTruthy()
    expect(target.innerHTML).toContain('button')
  })

  it('hydrated component accepts server state', () => {
    const Counter = htmlComponent('Counter', {
      state: { count: 0 },
      view: (s) => html`<div>Count: ${s.count}</div>`
    })

    const target = document.createElement('div')
    target.innerHTML = '<div>Count: 42</div>'

    const inst = hydrate(Counter, target, {}, { count: 42 })
    expect(inst.loop.get().count).toBe(42)
  })
})

describe('Services', () => {
  it('createService wraps a loop with CRUD methods', async () => {
    const { createService } = await import('../src/service.js')

    const loop = createLoop({
      state: { items: [] },
      update: {
        add: (s, item) => ({ items: [...s.items, item] }),
        remove: (s, id) => ({ items: s.items.filter(i => i.id !== id) })
      }
    })

    const service = createService(loop, {
      methods: {
        find: () => loop.get().items,
        create: (data) => { loop.send('add', data); return data },
        remove: (id) => { loop.send('remove', id); return { id } }
      }
    })

    const created = await service.create({ id: 1, name: 'test' })
    expect(created.name).toBe('test')

    const found = await service.find()
    expect(found.length).toBe(1)
  })

  it('createService emits real-time events', async () => {
    const { createService } = await import('../src/service.js')

    const loop = createLoop({
      state: { items: [] },
      update: { add: (s, item) => ({ items: [...s.items, item] }) }
    })

    const service = createService(loop, {
      methods: { create: (data) => { loop.send('add', data); return data } }
    })

    const events = []
    service.on('created', (data) => events.push(data))

    await service.create({ id: 1 })
    expect(events.length).toBe(1)
    expect(events[0].id).toBe(1)
  })

  it('createServiceApp manages multiple services', async () => {
    const { createServiceApp } = await import('../src/service.js')
    const app = createServiceApp()

    const loop1 = createLoop({ state: { count: 0 } })
    const loop2 = createLoop({ state: { name: 'test' } })

    app.use('counter', { loop: loop1, methods: { find: () => loop1.get() } })
    app.use('users', { loop: loop2, methods: { find: () => loop2.get() } })

    expect(app.service('counter')).toBeTruthy()
    expect(app.service('users')).toBeTruthy()
    expect(Object.keys(app.services)).toEqual(['counter', 'users'])
  })
})
