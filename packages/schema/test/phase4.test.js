/** @uploop/schema — Phase 4 Tests (infer, utils, store) */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  entity, string, number, boolean, enumeration, ref, computed, clearRegistry, array,
  toJSONSchema, toTypeScript, toGraphQL, toFormSchema,
  isSchema, isEntity, isIntent, diff, fromJSON, intent
} from '../src/index.js'
import { storeFromEntity } from '../../store/src/store-entity.js'

beforeEach(() => clearRegistry())

describe('toJSONSchema()', () => {
  it('converts entity to JSON Schema', () => {
    const User = entity('User', { name: string().min(1), email: string().email(), age: number().integer().min(0).optional() })
    const js = toJSONSchema(User)
    expect(js.$schema).toContain('json-schema.org')
    expect(js.type).toBe('object')
    expect(js.properties.name.type).toBe('string')
    expect(js.properties.email.format).toBe('email')
    expect(js.required).toContain('name')
    expect(js.required).toContain('email')
    expect(js.required).not.toContain('age')
  })
  it('handles enums', () => {
    const S = entity('S', { role: enumeration(['a', 'b']) })
    expect(toJSONSchema(S).properties.role.enum).toEqual(['a', 'b'])
  })
  it('handles computed fields', () => {
    const S = entity('S', { price: number(), total: computed(['price'], p => p.price) })
    expect(toJSONSchema(S).properties.total.readOnly).toBe(true)
  })
})

describe('toTypeScript()', () => {
  it('generates interface', () => {
    const ts = toTypeScript(entity('User', { name: string(), email: string().email(), age: number().optional() }))
    expect(ts).toContain('export interface User')
    expect(ts).toContain('name: string')
    expect(ts).toContain('age?: number')
  })
  it('handles enums', () => {
    expect(toTypeScript(entity('S', { role: enumeration(['a','b']) }))).toContain("'a'")
  })
})

describe('toGraphQL()', () => {
  it('generates SDL', () => {
    const gql = toGraphQL(entity('User', { name: string(), age: number() }))
    expect(gql).toContain('type User {')
    expect(gql).toContain('name: String!')
  })
  it('marks optional without !', () => {
    expect(toGraphQL(entity('S', { name: string(), bio: string().optional() }))).toContain('bio: String')
  })
  it('skips computed', () => {
    expect(toGraphQL(entity('S', { price: number(), total: computed(['price'], p => p.price) }))).not.toContain('total')
  })
})

describe('toFormSchema()', () => {
  it('generates form fields', () => {
    const f = toFormSchema(entity('User', { name: string(), email: string().email(), age: number().integer() }))
    expect(f).toHaveLength(3)
    expect(f[1].inputType).toBe('email')
    expect(f[2].inputType).toBe('number')
  })
  it('marks optional', () => {
    expect(toFormSchema(entity('S', { name: string(), bio: string().optional() })).find(x => x.name === 'bio').required).toBe(false)
  })
})

describe('type guards', () => {
  it('isEntity / isSchema', () => {
    const u = entity('U', { name: string() })
    expect(isEntity(u)).toBe(true)
    expect(isSchema(u)).toBe(false)
    expect(isSchema(string())).toBe(true)
  })
  it('isIntent', () => {
    expect(isIntent(intent({ name: 'str' }))).toBe(true)
  })
})

describe('diff()', () => {
  it('detects added/removed/changed', () => {
    expect(diff(entity('U', { n: string() }), entity('U', { n: string(), e: string() })).added).toHaveLength(1)
    expect(diff(entity('U', { n: string(), e: string() }), entity('U', { n: string() })).removed).toHaveLength(1)
    expect(diff(entity('U', { a: number() }), entity('U', { a: string() })).changed).toHaveLength(1)
    expect(diff(entity('U', { n: string() }), entity('U', { n: string() })).breaking).toBe(false)
  })
})

describe('fromJSON()', () => {
  it('roundtrips', () => {
    const u = entity('User', { name: string(), age: number().integer().min(0) })
    const r = fromJSON(JSON.parse(JSON.stringify(u.describe())))
    expect(r.validate({ name: 'Alice', age: 30 }).ok).toBe(true)
    expect(r.validate({ name: 123 }).ok).toBe(false)
  })
})

describe('storeFromEntity()', () => {
  it('CRUD operations', () => {
    const u = entity('User', { name: string(), age: number() })
    const s = storeFromEntity(u)
    expect(s.get()['User.name']).toBe('')
    s.send('setName', 'Alice')
    expect(s.get()['User.name']).toBe('Alice')
    s.send('set', { name: 'Bob', age: 25 })
    expect(s.get()['User.age']).toBe(25)
    s.send('reset')
    expect(s.get()['User.name']).toBe('')
  })
  it('validates on set', () => {
    const s = storeFromEntity(entity('User', { age: number().min(0) }))
    s.send('setAge', -5)
    expect(s.get()['User.age']).toBe(0) // unchanged
  })
})
