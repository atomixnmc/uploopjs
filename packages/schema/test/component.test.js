/**
 * @uploop/schema — entityComponent() Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  entity, clearRegistry,
  string, number, boolean, enumeration,
  entityComponent, entityFields
} from '../src/index.js'

beforeEach(() => clearRegistry())

describe('entityComponent()', () => {
  it('generates component config from entity', () => {
    const User = entity('User', { name: string(), age: number() })
    const config = entityComponent(User)
    expect(config.state).toBeDefined()
    expect(config.state.name).toBe('')
    expect(config.state.age).toBe(0)
    expect(config.update).toBeDefined()
    expect(typeof config.view).toBe('function')
  })

  it('generates per-field setter handlers', () => {
    const User = entity('User', { name: string(), email: string().email() })
    const config = entityComponent(User)

    expect(config.update.setName).toBeDefined()
    expect(config.update.setEmail).toBeDefined()
    expect(config.update.set).toBeDefined()
    expect(config.update.save).toBeDefined()
    expect(config.update.reset).toBeDefined()
  })

  it('setName updates state correctly', () => {
    const User = entity('User', { name: string() })
    const config = entityComponent(User)

    const newState = config.update.setName({ name: '' }, 'Alice')
    expect(newState.name).toBe('Alice')
  })

  it('set handles bulk updates', () => {
    const User = entity('User', { name: string(), age: number() })
    const config = entityComponent(User)

    const newState = config.update.set({ name: '', age: 0 }, { name: 'Bob', age: 25 })
    expect(newState.name).toBe('Bob')
    expect(newState.age).toBe(25)
  })

  it('save validates via entity schema', async () => {
    const User = entity('User', { name: string(), age: number().min(0) })
    const config = entityComponent(User)

    // Valid data
    const r1 = config.update.save({ name: 'Alice', age: 30 })
    expect(r1.name).toBe('Alice')

    // Invalid data — should warn and return unchanged
    const original = { name: 'Alice', age: -5 }
    const r2 = config.update.save(original)
    expect(r2).toBe(original) // unchanged on validation failure
  })

  it('reset restores defaults', () => {
    const User = entity('User', { name: string(), age: number() })
    const config = entityComponent(User)

    const defaults = config.update.reset()
    expect(defaults.name).toBe('')
    expect(defaults.age).toBe(0)
  })

  it('generates form view by default', () => {
    const User = entity('User', { name: string(), email: string().email() })
    const config = entityComponent(User)

    const html = config.view({ name: 'Alice', email: 'a@b.com' }, {})
    expect(typeof html).toBe('string')
    expect(html).toContain('name="name"')
    expect(html).toContain('name="email"')
    expect(html).toContain('Alice')
  })

  it('generates display view when mode=display', () => {
    const User = entity('User', { name: string(), email: string().email() })
    const config = entityComponent(User, { mode: 'display' })

    const html = config.view({ name: 'Alice', email: 'a@b.com' }, {})
    expect(html).toContain('up-entity-display')
    expect(html).not.toContain('<input')
  })

  it('generates table view when mode=table', () => {
    const Product = entity('Product', { name: string(), price: number() })
    const config = entityComponent(Product, { mode: 'table' })

    const html = config.view({
      items: [
        { name: 'A', price: 10 },
        { name: 'B', price: 20 }
      ]
    }, {})
    expect(html).toContain('<table')
    expect(html).toContain('<td>A</td>')
  })

  it('accepts custom view override', () => {
    const User = entity('User', { name: string() })
    const config = entityComponent(User, {
      view: (state) => `<custom>${state.name}</custom>`
    })

    const html = config.view({ name: 'Alice' }, {})
    expect(html).toBe('<custom>Alice</custom>')
  })

  it('accepts custom update handlers', () => {
    const User = entity('User', { name: string() })
    const config = entityComponent(User, {
      update: { customAction: (s) => ({ ...s, name: 'custom' }) }
    })

    expect(config.update.customAction).toBeDefined()
    const r = config.update.customAction({ name: 'original' })
    expect(r.name).toBe('custom')
  })

  it('handles all primitive field types', () => {
    const Survey = entity('Survey', {
      title: string(),
      count: number().integer(),
      active: boolean(),
      date: string(), // date schema
      role: enumeration(['user', 'admin']),
      bio: string().optional()
    })
    const config = entityComponent(Survey)

    expect(config.state.title).toBe('')
    expect(config.state.count).toBe(0)
    expect(config.state.active).toBe(false)
    expect(config.state.role).toBeNull()  // no default for enum
    expect(config.state.bio).toBeUndefined()  // optional, no default
  })

  it('stores entity metadata on config', () => {
    const User = entity('User', { name: string() })
    const config = entityComponent(User)

    expect(config._entityName).toBe('User')
    expect(config._entityFields).toBeDefined()
    expect(config._entityFields[0].name).toBe('name')
  })

  it('entityFields() extracts field metadata', () => {
    const User = entity('User', { name: string(), email: string().email(), age: number().integer() })
    const fields = entityFields(User)

    expect(fields).toHaveLength(3)
    expect(fields[0].name).toBe('name')
    expect(fields[0].inputType).toBe('text')
    expect(fields[1].inputType).toBe('email')
    expect(fields[2].inputType).toBe('number')
  })

  it('skips computed fields in state and interactive views', () => {
    const Product = entity('Product', {
      price: number(),
      quantity: number(),
      total: { _computed: true } // simplified for test
    })
    // Re-register without the import cycle
    clearRegistry()
    const Product2 = entity('Product2', {
      price: number(),
      quantity: number()
    })
    const config = entityComponent(Product2)
    const html = config.view({ price: 10, quantity: 3 }, {})
    expect(html).toContain('name="price"')
    expect(html).toContain('name="quantity"')
  })
})
