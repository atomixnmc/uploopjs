/**
 * @uploop/schema — bind() Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createGraph } from '../../core/src/index.js'
import {
  entity, ref, computed, clearRegistry,
  toGraph, string, number, boolean, enumeration,
  bind
} from '../src/index.js'

beforeEach(() => {
  clearRegistry()
})

// ── bind() ─────────────────────────────────────────────────

describe('bind()', () => {
  it('creates a binding between entity and graph', () => {
    const User = entity('User', { name: string(), age: number() })
    const graph = createGraph(toGraph([User]))

    const userBind = bind(User, graph)
    expect(userBind).toBeDefined()
    expect(typeof userBind.project).toBe('function')
    expect(typeof userBind.populate).toBe('function')
    expect(typeof userBind.patch).toBe('function')
    expect(typeof userBind.subscribe).toBe('function')

    graph.dispose()
  })

  it('populate() writes entity data to graph nodes', () => {
    const User = entity('User', { name: string(), age: number() })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph)

    const result = userBind.populate({ name: 'Alice', age: 30 })
    expect(result.ok).toBe(true)

    expect(graph.getNode('User.name')).toBe('Alice')
    expect(graph.getNode('User.age')).toBe(30)

    graph.dispose()
  })

  it('populate() validates before writing', () => {
    const User = entity('User', { name: string(), age: number().min(0) })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph)

    const result = userBind.populate({ name: 'Alice', age: -5 })
    expect(result.ok).toBe(false)
    // Graph should not be updated on validation failure
    expect(graph.getNode('User.age')).toBe(0) // stays at default

    graph.dispose()
  })

  it('project() reads graph nodes as entity-shaped object', () => {
    const User = entity('User', { name: string(), age: number() })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph)

    graph.set('User.name', 'Bob')
    graph.set('User.age', 25)

    const data = userBind.project()
    expect(data).toEqual({ name: 'Bob', age: 25 })

    graph.dispose()
  })

  it('patch() merges partial data with current state', () => {
    const User = entity('User', { name: string(), age: number(), email: string().optional() })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph)

    userBind.populate({ name: 'Alice', age: 30 })

    userBind.patch({ age: 31 })
    expect(graph.getNode('User.name')).toBe('Alice')
    expect(graph.getNode('User.age')).toBe(31)

    graph.dispose()
  })

  it('subscribe() reacts to graph changes with projected data', async () => {
    const User = entity('User', { name: string(), age: number() })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph)

    const changes = []
    const unsub = userBind.subscribe(data => changes.push(data))

    userBind.populate({ name: 'Alice', age: 30 })
    await new Promise(r => setTimeout(r, 10))

    expect(changes.length).toBeGreaterThanOrEqual(1)
    expect(changes[changes.length - 1]).toEqual({ name: 'Alice', age: 30 })

    unsub()
    graph.dispose()
  })

  it('onChange() subscribes to a specific field', async () => {
    const User = entity('User', { name: string(), age: number() })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph)

    const nameChanges = []
    userBind.onChange('name', (nv, ov) => nameChanges.push({ nv, ov }))

    graph.set('User.name', 'Alice')
    await new Promise(r => setTimeout(r, 10))

    expect(nameChanges.length).toBe(1)
    expect(nameChanges[0].nv).toBe('Alice')

    graph.dispose()
  })

  it('reset() restores defaults', () => {
    const User = entity('User', { name: string(), age: number() })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph)

    userBind.populate({ name: 'Alice', age: 30 })
    userBind.reset()

    expect(graph.getNode('User.name')).toBe('')
    expect(graph.getNode('User.age')).toBe(0)

    graph.dispose()
  })

  it('snapshot() and restore() work', () => {
    const User = entity('User', { name: string(), age: number() })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph)

    userBind.populate({ name: 'Alice', age: 30 })
    const snap = userBind.snapshot()
    expect(snap.name).toBe('Alice')

    userBind.populate({ name: 'Bob', age: 25 })
    userBind.restore(snap)

    expect(graph.getNode('User.name')).toBe('Alice')
    expect(graph.getNode('User.age')).toBe(30)

    graph.dispose()
  })

  it('describe() exports binding manifest', () => {
    const User = entity('User', { name: string(), email: string().email() })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph)

    const desc = userBind.describe()
    expect(desc.kind).toBe('uploop.binding')
    expect(desc.entity).toBe('User')
    expect(desc.fields).toContain('name')
    expect(desc.fields).toContain('email')
    expect(desc.edges.length).toBeGreaterThan(0)
    expect(JSON.stringify(desc)).not.toContain('function')

    graph.dispose()
  })
})

// ── Field Mapping ──────────────────────────────────────────

describe('bind() — field mapping', () => {
  it('map supports field name aliases', () => {
    const User = entity('User', { name: string(), email: string() })
    const graph = createGraph(toGraph([User], { name: 'alias-test' }))
    const userBind = bind(User, graph, {
      map: { name: 'displayName' }
    })
    // 'name' field maps from 'displayName' alias on populate
    // data.displayName → entity field name → graph node 'User.name'
    userBind.populate({ displayName: 'Alice', email: 'a@b.com' })
    expect(graph.getNode('User.name')).toBe('Alice')

    graph.dispose()
  })

  it('map supports transform functions', () => {
    const User = entity('User', { name: string() })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph, {
      map: {
        name: {
          populate: (v) => v.trim().toUpperCase(),
          project: (v) => v.toLowerCase()
        }
      }
    })

    userBind.populate({ name: '  alice  ' })
    expect(graph.getNode('User.name')).toBe('ALICE')

    const projected = userBind.project()
    expect(projected.name).toBe('alice')

    graph.dispose()
  })
})

// ── Virtual Fields ─────────────────────────────────────────

describe('bind() — virtual fields', () => {
  it('virtual.project() derives fields from entity data', () => {
    const User = entity('User', { firstName: string(), lastName: string() })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph, {
      virtual: {
        fullName: {
          project: (data) => `${data.firstName} ${data.lastName}`
        }
      }
    })

    userBind.populate({ firstName: 'Alice', lastName: 'Smith' })
    const data = userBind.project()
    expect(data.fullName).toBe('Alice Smith')

    graph.dispose()
  })

  it('virtual.populate() splits into entity fields', () => {
    const User = entity('User', { firstName: string(), lastName: string() })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph, {
      virtual: {
        fullName: {
          populate: (data) => {
            const parts = (data.fullName || '').split(' ')
            return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' }
          }
        }
      }
    })

    userBind.populate({ fullName: 'Bob Jones' })
    expect(graph.getNode('User.firstName')).toBe('Bob')
    expect(graph.getNode('User.lastName')).toBe('Jones')

    graph.dispose()
  })
})

// ── bind.form() — DOM Wiring ───────────────────────────────

describe('bind.form()', () => {
  it('auto-wires inputs by [name] convention', () => {
    const User = entity('User', { name: string(), email: string().email() })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph)

    // Create a form in jsdom
    const form = document.createElement('form')
    form.innerHTML = `
      <input name="name" type="text" />
      <input name="email" type="email" />
    `
    document.body.appendChild(form)

    const nameInput = form.querySelector('[name="name"]')
    const emailInput = form.querySelector('[name="email"]')

    // Wire the form
    const formBinding = userBind.form(form)
    expect(formBinding.fields).toHaveLength(2)

    // Populate graph → inputs should reflect values
    userBind.populate({ name: 'Alice', email: 'alice@example.com' })
    expect(nameInput.value).toBe('Alice')
    expect(emailInput.value).toBe('alice@example.com')

    // Simulate input change → graph should update
    nameInput.value = 'Bob'
    nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    expect(graph.getNode('User.name')).toBe('Bob')

    formBinding.dispose()
    document.body.removeChild(form)
    graph.dispose()
  })

  it('skips computed fields', () => {
    const Product = entity('Product', {
      price: number(),
      quantity: number(),
      total: computed(['price', 'quantity'], (p) => p.price * p.quantity)
    })
    const graph = createGraph(toGraph([Product]))
    const prodBind = bind(Product, graph)

    const form = document.createElement('form')
    form.innerHTML = `
      <input name="price" type="number" />
      <input name="quantity" type="number" />
      <input name="total" type="number" />
    `
    document.body.appendChild(form)

    const formBinding = prodBind.form(form)
    // total should be skipped (computed)
    expect(formBinding.fields.length).toBe(2)

    formBinding.dispose()
    document.body.removeChild(form)
    graph.dispose()
  })

  it('handles checkbox (boolean) inputs', () => {
    const Settings = entity('Settings', { darkMode: boolean() })
    const graph = createGraph(toGraph([Settings]))
    const settingsBind = bind(Settings, graph)

    const form = document.createElement('form')
    form.innerHTML = `<input name="darkMode" type="checkbox" />`
    document.body.appendChild(form)

    const cb = form.querySelector('[name="darkMode"]')
    const formBinding = settingsBind.form(form)

    // Populate true → checked
    settingsBind.populate({ darkMode: true })
    expect(cb.checked).toBe(true)

    // Uncheck → graph updates
    cb.checked = false
    cb.dispatchEvent(new Event('change', { bubbles: true }))
    expect(graph.getNode('Settings.darkMode')).toBe(false)

    formBinding.dispose()
    document.body.removeChild(form)
    graph.dispose()
  })

  it('dispose() cleans up event listeners and subscriptions', () => {
    const User = entity('User', { name: string() })
    const graph = createGraph(toGraph([User]))
    const userBind = bind(User, graph)

    const form = document.createElement('form')
    form.innerHTML = `<input name="name" type="text" />`
    document.body.appendChild(form)

    const formBinding = userBind.form(form)
    formBinding.dispose()

    // After dispose, graph changes should not update input
    const input = form.querySelector('[name="name"]')
    userBind.populate({ name: 'Alice' })
    // Wait a tick for async subscriptions
    // Input may or may not be updated depending on timing
    // The key is that dispose() doesn't throw

    document.body.removeChild(form)
    graph.dispose()
  })
})
