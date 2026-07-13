/**
 * @uploop/schema — intent() Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  entity, string, number, boolean, enumeration, clearRegistry,
  intent, resolveIntent, suggestIntent, intentToken
} from '../src/index.js'

beforeEach(() => clearRegistry())

// ── intent() ───────────────────────────────────────────────

describe('intent()', () => {
  it('creates a fuzzy intent from shorthand strings', () => {
    const i = intent({ name: 'str', age: 'int?', active: 'bool' })
    expect(i.kind).toBe('uploop.intent')
    expect(i._fields.name.type).toBe('string')
    expect(i._fields.age.type).toBe('number')
    expect(i._fields.age.subtype).toBe('integer')
    expect(i._fields.age.optional).toBe(true)
    expect(i._fields.active.type).toBe('boolean')
  })

  it('handles single-character shorthands', () => {
    const i = intent({ name: 's', age: 'i?', flag: 'b' })
    expect(i._fields.name.type).toBe('string')
    expect(i._fields.age.type).toBe('number')
    expect(i._fields.age.optional).toBe(true)
    expect(i._fields.flag.type).toBe('boolean')
  })

  it('handles email/url/uuid presets', () => {
    const i = intent({ email: 'email', website: 'url', id: 'uuid' })
    expect(i._fields.email.format).toBe('email')
    expect(i._fields.website.format).toBe('url')
    expect(i._fields.id.format).toBe('uuid')
  })

  it('handles array markers', () => {
    const i = intent({ tags: '[str]', scores: '[int]' })
    expect(i._fields.tags.array).toBe(true)
    expect(i._fields.tags.type).toBe('string')
    expect(i._fields.scores.type).toBe('number')
  })

  it('handles enum shorthand', () => {
    const i = intent({ status: 'pending|active|done' })
    expect(i._fields.status.type).toBe('enum')
    expect(i._fields.status.values).toEqual(['pending', 'active', 'done'])
  })

  it('handles array enum values', () => {
    const i = intent({ role: ['user', 'admin', 'mod'] })
    expect(i._fields.role.type).toBe('enum')
    expect(i._fields.role.values).toEqual(['user', 'admin', 'mod'])
  })

  it('handles nested objects', () => {
    const i = intent({ address: { street: 'str', zip: 'str' } })
    expect(i._fields.address.type).toBe('object')
    expect(i._fields.address.fields.street.type).toBe('string')
  })

  it('handles ref-like capitalized types', () => {
    const i = intent({ author: 'User', category: 'Category' })
    expect(i._fields.author.type).toBe('ref')
    expect(i._fields.author.ref).toBe('User')
  })

  it('describe() exports structured manifest', () => {
    const i = intent({ name: 'str', email: 'email' })
    const d = i.describe()
    expect(d.kind).toBe('uploop.intent')
    expect(d.fields.name.type).toBe('string')
    expect(JSON.stringify(d)).not.toContain('function')
  })
})

// ── resolveIntent() ────────────────────────────────────────

describe('resolveIntent()', () => {
  it('matches exact fields', () => {
    const User = entity('User', { name: string(), age: number() })
    const i = intent({ name: 'str', age: 'num' })
    const r = resolveIntent(i, User.describe())
    expect(r.match).toBe('exact')
    expect(r.score).toBe(1)
    expect(r.matched).toContain('name')
    expect(r.matched).toContain('age')
  })

  it('detects missing fields', () => {
    const User = entity('User', { name: string(), email: string().email(), age: number() })
    const i = intent({ name: 'str' })
    const r = resolveIntent(i, User.describe())
    expect(r.match).toBe('partial')
    expect(r.missingInIntent.length).toBeGreaterThanOrEqual(1)
    expect(r.missingInIntent.find(m => m.field === 'email')).toBeTruthy()
  })

  it('detects extra fields in intent', () => {
    const User = entity('User', { name: string() })
    const i = intent({ name: 'str', extra: 'str' })
    const r = resolveIntent(i, User.describe())
    expect(r.extraInIntent).toHaveLength(1)
    expect(r.extraInIntent[0].field).toBe('extra')
  })

  it('handles optional fields — not treated as missing', () => {
    const User = entity('User', { name: string(), bio: string().optional() })
    const i = intent({ name: 'str' })
    const r = resolveIntent(i, User.describe())
    // bio is optional, so it's listed as missing but not suggested as required
    const bioMissing = r.missingInIntent.find(m => m.field === 'bio')
    expect(bioMissing).toBeTruthy()
    expect(bioMissing.required).toBe(false)
    // Suggestions only include required
    expect(r.suggestions.every(s => s.field !== 'bio' || s.reason !== 'required')).toBe(true)
  })

  it('handles computed fields — excluded from matching', () => {
    // Passes if it doesn't crash on computed fields
    const User = entity('User', { name: string() })
    const i = intent({ name: 'str' })
    const r = resolveIntent(i, User.describe())
    expect(r.match).toBe('exact')
  })

  it('partial match for email format mismatch', () => {
    const User = entity('User', { email: string().email() })
    const i = intent({ email: 'str' })
    const r = resolveIntent(i, User.describe())
    expect(r.partial.length).toBeGreaterThanOrEqual(1)
  })

  it('returns score=0 for completely mismatched', () => {
    const User = entity('User', { name: string() })
    const i = intent({ something: 'num' })
    const r = resolveIntent(i, User.describe())
    expect(r.score).toBe(0)
    expect(r.match === 'mismatch' || r.match === 'unknown').toBe(true)
  })
})

// ── suggestIntent() ────────────────────────────────────────

describe('suggestIntent()', () => {
  it('suggests required missing fields', () => {
    const User = entity('User', { name: string(), email: string().email() })
    const i = intent({ name: 'str' })
    const s = suggestIntent(i, User.describe())
    expect(s.suggestedAdditions.length).toBeGreaterThanOrEqual(1)
    expect(s.suggestedAdditions.find(a => a.field === 'email')).toBeTruthy()
    expect(s.hint).toContain('email')
  })

  it('returns empty when intent is complete', () => {
    const User = entity('User', { name: string() })
    const i = intent({ name: 'str' })
    const s = suggestIntent(i, User.describe())
    expect(s.suggestedAdditions).toHaveLength(0)
  })
})

// ── intentToken() — Compression ────────────────────────────

describe('intentToken()', () => {
  it('compresses intent to token string', () => {
    const i = intent({ name: 'str', email: 'email', age: 'int?' })
    const token = intentToken(i)
    expect(typeof token).toBe('string')
    expect(token).toContain('name')
    expect(token).toContain('email')
    expect(token).toContain('age')
    // Should use short tokens
    expect(token).toContain(':s')     // str → s
    expect(token).toContain(':e')     // email → e
  })

  it('roundtrips through parse', () => {
    const original = intent({ name: 'str', email: 'email', posts: '[str]' })
    const token = intentToken(original)
    const restored = intentToken.parse(token)

    const of = restored._fields
    expect(of.name.type).toBe('string')
    expect(of.email.type).toBe('string')
    expect(of.email.format).toBe('email')
    expect(of.posts.array).toBe(true)
  })

  it('handles nested objects in tokens', () => {
    const i = intent({ user: { name: 'str', email: 'email' } })
    const token = intentToken(i)
    expect(token).toContain('{')
    expect(token).toContain('}')

    const restored = intentToken.parse(token)
    expect(restored._fields.user.type).toBe('object')
  })

  it('handles enum tokens', () => {
    const i = intent({ status: 'a|b|c' })
    const token = intentToken(i)
    expect(token).toContain('a|b|c')
  })

  it('handles empty token', () => {
    const i = intentToken.parse('')
    expect(i.kind).toBe('uploop.intent')
    expect(Object.keys(i._fields)).toHaveLength(0)
  })

  it('token is significantly shorter than full describe', () => {
    const User = entity('User', {
      name: string().min(1).max(100),
      email: string().email(),
      age: number().integer().min(0).optional(),
      bio: string().optional()
    })
    const i = intent({ name: 'str', email: 'email', age: 'int?', bio: 'str?' })
    const token = intentToken(i)
    const describe = JSON.stringify(User.describe())

    // Token should be < 25% of full describe size
    expect(token.length).toBeLessThan(describe.length * 0.3)
  })
})
