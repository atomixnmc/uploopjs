/**
 * @uploop/schema — Phase 1 Tests
 *
 * Covers: core, primitives, structural, modifiers, compose
 */
import { describe, it, expect } from 'vitest'
import {
  schema, ok, fail, failAt, mergeResults, ValidationError,
  string, number, boolean, date, literal, enumeration,
  object, array, tuple, record,
  optional, nullable, withDefault, transform, pipe,
  extend, merge, pick, omit, partial, lazy
} from '../src/index.js'

// ── Core: schema(), ok(), fail() ────────────────────────────

describe('core — schema()', () => {
  it('creates a schema that validates values', () => {
    const Name = schema('Name', {
      type: 'string',
      validate(v) {
        if (typeof v !== 'string') return fail('must be string')
        if (v.length === 0) return fail('must not be empty')
        return ok(v)
      }
    })

    expect(Name.validate('Alice')).toEqual({ ok: true, value: 'Alice', errors: [] })
    const r = Name.validate('')
    expect(r.ok).toBe(false)
    expect(r.errors[0].message).toBe('must not be empty')
  })

  it('returns ok for any value when no validator is provided (schemaless by default)', () => {
    const Any = schema('Any', { type: 'any' })
    expect(Any.validate(42).ok).toBe(true)
    expect(Any.validate('hello').ok).toBe(true)
    expect(Any.validate(null).ok).toBe(true)
  })

  it('exports kind and type', () => {
    const S = schema('Test', { type: 'number', validate: () => ok(1) })
    expect(S.kind).toBe('uploop.schema')
    expect(S.type).toBe('number')
    expect(S.name).toBe('Test')
  })
})

describe('core — ValidationError', () => {
  it('throws with formatted messages', () => {
    const r = { ok: false, errors: [{ path: 'name', message: 'required', code: 'required' }] }
    const err = new ValidationError(r)
    expect(err.message).toContain('name: required')
    expect(err.errors).toEqual(r.errors)
  })
})

describe('core — mergeResults', () => {
  it('merges multiple validation results', () => {
    const r1 = ok({ a: 1 })
    const r2 = ok({ b: 2 })
    const r3 = failAt('c', 'bad', 'invalid')
    const merged = mergeResults(r1, r2, r3)
    expect(merged.ok).toBe(false)
    expect(merged.value).toEqual({ a: 1, b: 2 })
    expect(merged.errors).toHaveLength(1)
  })
})

describe('core — schema modifiers', () => {
  it('optional() allows undefined', () => {
    const S = string().optional()
    expect(S.validate(undefined).ok).toBe(true)
    expect(S.validate('hello').ok).toBe(true)
  })

  it('nullable() allows null', () => {
    const S = string().nullable()
    expect(S.validate(null).ok).toBe(true)
    expect(S.validate('hello').ok).toBe(true)
  })

  it('withDefault() supplies default value', () => {
    const S = string().withDefault('default')
    const r = S.validate(undefined)
    expect(r.ok).toBe(true)
    expect(r.value).toBe('default')

    // with factory
    const S2 = number().withDefault(() => 42)
    expect(S2.validate(undefined).value).toBe(42)
  })

  it('transform() modifies value before validation', () => {
    const S = string().transform(v => v.trim())
    const r = S.validate('  hello  ')
    expect(r.value).toBe('hello')
  })

  it('pipe() chains schemas', () => {
    const Trimmed = string().trim()
    const NotEmpty = schema('NotEmpty', {
      type: 'string',
      validate(v) {
        if (v.length === 0) return fail('must not be empty')
        return ok(v)
      }
    })
    const S = Trimmed.pipe(NotEmpty)
    expect(S.validate('  hello  ').ok).toBe(true)
    expect(S.validate('   ').ok).toBe(false)
  })
})

// ── Primitives ─────────────────────────────────────────────

describe('primitives — string()', () => {
  it('validates string type', () => {
    const S = string()
    expect(S.validate('hello').ok).toBe(true)
    expect(S.validate(42).ok).toBe(false)
    expect(S.validate(null).ok).toBe(false)
  })

  it('min() and max() constrain length', () => {
    const S = string().min(2).max(5)
    expect(S.validate('ab').ok).toBe(true)
    expect(S.validate('a').ok).toBe(false)
    expect(S.validate('abcdef').ok).toBe(false)
  })

  it('length() requires exact length', () => {
    const S = string().length(3)
    expect(S.validate('abc').ok).toBe(true)
    expect(S.validate('ab').ok).toBe(false)
  })

  it('email() validates email format', () => {
    const S = string().email()
    expect(S.validate('alice@example.com').ok).toBe(true)
    expect(S.validate('not-an-email').ok).toBe(false)
  })

  it('url() validates URL format', () => {
    const S = string().url()
    expect(S.validate('https://example.com').ok).toBe(true)
    expect(S.validate('not-a-url').ok).toBe(false)
  })

  it('uuid() validates UUID format', () => {
    const S = string().uuid()
    expect(S.validate('550e8400-e29b-41d4-a716-446655440000').ok).toBe(true)
    expect(S.validate('not-uuid').ok).toBe(false)
  })

  it('regex() validates against pattern', () => {
    const S = string().regex(/^[a-z]+$/, 'only lowercase')
    expect(S.validate('abc').ok).toBe(true)
    expect(S.validate('ABC').ok).toBe(false)
  })

  it('trim() removes whitespace', () => {
    const S = string().trim()
    expect(S.validate('  hello  ').value).toBe('hello')
  })

  it('lowercase() / uppercase() transforms', () => {
    expect(string().lowercase().validate('HELLO').value).toBe('hello')
    expect(string().uppercase().validate('hello').value).toBe('HELLO')
  })

  it('presets work', () => {
    expect(string('email').validate('a@b.com').ok).toBe(true)
    expect(string('url').validate('https://x.com').ok).toBe(true)
    expect(string('uuid').validate('550e8400-e29b-41d4-a716-446655440000').ok).toBe(true)
  })
})

describe('primitives — number()', () => {
  it('validates number type', () => {
    const S = number()
    expect(S.validate(42).ok).toBe(true)
    expect(S.validate('42').ok).toBe(false)
    expect(S.validate(NaN).ok).toBe(false)
  })

  it('min() and max() constrain range', () => {
    const S = number().min(0).max(100)
    expect(S.validate(50).ok).toBe(true)
    expect(S.validate(-1).ok).toBe(false)
    expect(S.validate(101).ok).toBe(false)
  })

  it('integer() rejects floats', () => {
    const S = number().integer()
    expect(S.validate(42).ok).toBe(true)
    expect(S.validate(42.5).ok).toBe(false)
  })

  it('positive() / negative()', () => {
    expect(number().positive().validate(1).ok).toBe(true)
    expect(number().positive().validate(0).ok).toBe(false)
    expect(number().negative().validate(-1).ok).toBe(true)
  })

  it('finite() rejects Infinity', () => {
    expect(number().finite().validate(Infinity).ok).toBe(false)
    expect(number().finite().validate(42).ok).toBe(true)
  })
})

describe('primitives — boolean()', () => {
  it('validates boolean type', () => {
    expect(boolean().validate(true).ok).toBe(true)
    expect(boolean().validate(false).ok).toBe(true)
    expect(boolean().validate(1).ok).toBe(false)
    expect(boolean().validate('true').ok).toBe(false)
  })
})

describe('primitives — date()', () => {
  it('validates date type', () => {
    expect(date().validate(new Date()).ok).toBe(true)
    expect(date().validate('2024-01-01').ok).toBe(true)
    expect(date().validate('not-a-date').ok).toBe(false)
  })

  it('min() / max() constrain range', () => {
    const S = date().min('2024-01-01').max('2024-12-31')
    expect(S.validate('2024-06-15').ok).toBe(true)
    expect(S.validate('2023-01-01').ok).toBe(false)
  })

  it('past() / future()', () => {
    const past = date().past()
    expect(past.validate(new Date('2020-01-01')).ok).toBe(true)
    const future = date().future()
    expect(future.validate(new Date('2030-01-01')).ok).toBe(true)
  })
})

describe('primitives — literal()', () => {
  it('matches exact value', () => {
    const S = literal('hello')
    expect(S.validate('hello').ok).toBe(true)
    expect(S.validate('world').ok).toBe(false)
  })
})

describe('primitives — enumeration()', () => {
  it('matches one of allowed values', () => {
    const S = enumeration(['a', 'b', 'c'])
    expect(S.validate('a').ok).toBe(true)
    expect(S.validate('d').ok).toBe(false)
  })
})

// ── Structural ─────────────────────────────────────────────

describe('structural — object()', () => {
  it('validates object shape', () => {
    const User = object({
      name: string(),
      age: number().integer().min(0)
    })

    const r = User.validate({ name: 'Alice', age: 30 })
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ name: 'Alice', age: 30 })
  })

  it('returns errors for invalid fields', () => {
    const User = object({
      name: string(),
      age: number().integer()
    })

    const r = User.validate({ name: 123, age: 'old' })
    expect(r.ok).toBe(false)
    expect(r.errors.length).toBeGreaterThanOrEqual(1)
  })

  it('passthrough keeps unknown keys by default', () => {
    const S = object({ name: string() })
    const r = S.validate({ name: 'Alice', extra: 42 })
    expect(r.ok).toBe(true)
    expect(r.value.extra).toBe(42)
  })

  it('strict() rejects unknown keys', () => {
    const S = object({ name: string() }, { strict: true })
    const r = S.validate({ name: 'Alice', extra: 42 })
    expect(r.ok).toBe(false)
  })

  it('reports missing required fields', () => {
    const S = object({ name: string(), email: string() })
    const r = S.validate({ name: 'Alice' })
    expect(r.ok).toBe(false)
    const emailErr = r.errors.find(e => e.path === 'email')
    expect(emailErr).toBeTruthy()
    expect(emailErr.code).toBe('required')
  })

  it('allows optional fields', () => {
    const S = object({
      name: string(),
      bio: string().optional()
    })
    expect(S.validate({ name: 'Alice' }).ok).toBe(true)
    expect(S.validate({ name: 'Alice', bio: 'Hi' }).ok).toBe(true)
  })

  it('extend() adds fields', () => {
    const Base = object({ name: string() })
    const Extended = Base.extend({ age: number() })
    expect(Extended.validate({ name: 'Alice', age: 30 }).ok).toBe(true)
  })

  it('pick() selects subset', () => {
    const S = object({ name: string(), age: number(), email: string() })
    const Picked = S.pick(['name', 'email'])
    expect(Picked.validate({ name: 'Alice', email: 'a@b.com', age: 999 }).ok).toBe(true)
  })

  it('omit() removes fields', () => {
    const S = object({ name: string(), age: number(), email: string() })
    const Omitted = S.omit(['email'])
    expect(Omitted.validate({ name: 'Alice', age: 30 }).ok).toBe(true)
    const r = Omitted.validate({ name: 'Alice', age: 30, email: 'x' })
    // passthrough by default, so extra keys are kept
    expect(r.ok).toBe(true)
  })

  it('partial() makes all fields optional', () => {
    const S = object({ name: string(), age: number() })
    const Partial = S.partial()
    expect(Partial.validate({}).ok).toBe(true)
    expect(Partial.validate({ name: 'Alice' }).ok).toBe(true)
  })

  it('describe() exports shape metadata', () => {
    const S = object({ name: string().min(1), age: number().integer() })
    const d = S.describe()
    expect(d.type).toBe('object')
    expect(d.fields).toBeDefined()
    expect(d.fields.name).toBeDefined()
    expect(d.fields.age).toBeDefined()
  })
})

describe('structural — array()', () => {
  it('validates array type', () => {
    const S = array(string())
    expect(S.validate(['a', 'b']).ok).toBe(true)
    expect(S.validate('not-array').ok).toBe(false)
  })

  it('validates each element', () => {
    const S = array(number().positive())
    expect(S.validate([1, 2, 3]).ok).toBe(true)
    const r = S.validate([1, -2, 3])
    expect(r.ok).toBe(false)
  })

  it('min() / max() / length()', () => {
    expect(array(string()).min(2).validate(['a']).ok).toBe(false)
    expect(array(string()).max(2).validate(['a', 'b', 'c']).ok).toBe(false)
    expect(array(string()).length(2).validate(['a', 'b']).ok).toBe(true)
    expect(array(string()).length(2).validate(['a']).ok).toBe(false)
  })

  it('nonEmpty()', () => {
    expect(array(string()).nonEmpty().validate([]).ok).toBe(false)
    expect(array(string()).nonEmpty().validate(['a']).ok).toBe(true)
  })

  it('unique() detects duplicates', () => {
    const S = array(number()).unique()
    expect(S.validate([1, 2, 3]).ok).toBe(true)
    expect(S.validate([1, 2, 2]).ok).toBe(false)
  })

  it('describe() exports item type', () => {
    const S = array(string().email())
    const d = S.describe()
    expect(d.type).toBe('array')
    expect(d.items).toBeDefined()
    expect(d.items.type).toBe('string')
  })
})

describe('structural — tuple()', () => {
  it('validates fixed-length array', () => {
    const S = tuple([string(), number(), boolean()])
    expect(S.validate(['hello', 42, true]).ok).toBe(true)
    expect(S.validate(['hello', 42]).ok).toBe(false)
    expect(S.validate(['hello', 'world', true]).ok).toBe(false)
  })
})

describe('structural — record()', () => {
  it('validates key-value pairs', () => {
    const S = record(string(), number())
    expect(S.validate({ a: 1, b: 2 }).ok).toBe(true)
    const r = S.validate({ a: 1, b: 'bad' })
    expect(r.ok).toBe(false)
  })
})

// ── Modifiers (standalone functions) ───────────────────────

describe('modifiers — standalone', () => {
  it('optional() wraps schema', () => {
    const S = optional(string())
    expect(S.validate(undefined).ok).toBe(true)
    expect(S.validate('hello').ok).toBe(true)
  })

  it('nullable() wraps schema', () => {
    const S = nullable(string())
    expect(S.validate(null).ok).toBe(true)
  })

  it('withDefault() wraps schema', () => {
    const S = withDefault(string(), 'fallback')
    expect(S.validate(undefined).value).toBe('fallback')
  })

  it('transform() wraps schema', () => {
    const S = transform(string(), v => v.toUpperCase())
    expect(S.validate('hello').value).toBe('HELLO')
  })
})

// ── Composition ────────────────────────────────────────────

describe('compose — extend()', () => {
  it('adds fields to object schema', () => {
    const Base = object({ name: string() })
    const Extended = extend(Base, { age: number() })
    expect(Extended.validate({ name: 'Alice', age: 30 }).ok).toBe(true)
  })
})

describe('compose — merge()', () => {
  it('combines multiple object schemas', () => {
    const A = object({ name: string() })
    const B = object({ age: number() })
    const C = merge(A, B)
    expect(C.validate({ name: 'Alice', age: 30 }).ok).toBe(true)
  })
})

describe('compose — pick()', () => {
  it('selects subset of fields', () => {
    const S = object({ name: string(), age: number(), email: string() })
    const Picked = pick(S, ['name', 'email'])
    expect(Picked.validate({ name: 'Alice', email: 'a@b.com' }).ok).toBe(true)
  })
})

describe('compose — omit()', () => {
  it('removes fields', () => {
    const S = object({ name: string(), age: number(), secret: string() })
    const Public = omit(S, ['secret'])
    expect(Public.validate({ name: 'Alice', age: 30 }).ok).toBe(true)
  })
})

describe('compose — partial()', () => {
  it('makes all fields optional', () => {
    const S = object({ name: string(), age: number() })
    const Partial = partial(S)
    expect(Partial.validate({}).ok).toBe(true)
  })
})

describe('compose — lazy()', () => {
  it('defers schema resolution', () => {
    // Recursive: TreeNode = { value: string, children: TreeNode[] }
    const TreeNode = lazy(() => object({
      value: string(),
      children: array(TreeNode)
    }))

    const tree = {
      value: 'root',
      children: [
        { value: 'child1', children: [] },
        { value: 'child2', children: [{ value: 'grandchild', children: [] }] }
      ]
    }

    const r = TreeNode.validate(tree)
    expect(r.ok).toBe(true)
  })

  it('describe() shows unresolved or resolved type', () => {
    const S = lazy(() => string())
    const d = S.describe()
    expect(d.type).toBe('lazy')
    // Trigger resolution
    S.validate('hello')
    const d2 = S.describe()
    expect(d2.type).toBe('lazy')
  })
})

// ── AI-Readability: describe() ─────────────────────────────

describe('AI-readability — describe()', () => {
  it('schema.describe() exports plain object (no functions)', () => {
    const Name = schema('Name', {
      type: 'string',
      validate: () => ok('test'),
      meta: { description: 'A name', example: 'Alice', aiRole: 'identity.name' }
    })
    const d = Name.describe()
    expect(typeof d).toBe('object')
    expect(d.kind).toBe('uploop.schema')
    expect(d.name).toBe('Name')
    expect(d.type).toBe('string')
    expect(d.meta.description).toBe('A name')
    expect(d.meta.aiRole).toBe('identity.name')
    // No functions leaked
    expect(JSON.stringify(d)).not.toContain('function')
  })

  it('object.describe() includes field definitions', () => {
    const User = object({
      name: string().min(1).max(100),
      email: string().email()
    })
    const d = User.describe()
    expect(d.fields.name).toBeDefined()
    expect(d.fields.email).toBeDefined()
    expect(JSON.stringify(d)).not.toContain('function')
  })

  it('all exports are JSON-serializable', () => {
    const schemas = [
      string().min(1).max(100).describe(),
      number().integer().positive().describe(),
      object({ name: string() }).describe(),
      array(string()).describe()
    ]
    for (const d of schemas) {
      expect(() => JSON.stringify(d)).not.toThrow()
    }
  })
})
