// ─── Compose Tests ─────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  compose,
  extend,
  clone,
  pick,
  omit,
  styleToInline,
  deepMerge
} from '../src/compose.js'

describe('compose()', () => {
  it('merges multiple style objects (rightmost wins)', () => {
    const result = compose(
      { color: 'red', fontSize: '1rem' },
      { color: 'blue' }
    )
    expect(result).toEqual({ color: 'blue', fontSize: '1rem' })
  })

  it('returns empty object for no args', () => {
    expect(compose()).toEqual({})
  })

  it('does not mutate inputs', () => {
    const a = { color: 'red' }
    const b = { bg: 'blue' }
    compose(a, b)
    expect(a).toEqual({ color: 'red' })
    expect(b).toEqual({ bg: 'blue' })
  })
})

describe('extend()', () => {
  it('creates new object with overrides', () => {
    const base = { padding: '1rem', color: 'white' }
    const result = extend(base, { padding: '2rem' })
    expect(result.padding).toBe('2rem')
    expect(result.color).toBe('white')
  })

  it('does not mutate base', () => {
    const base = { color: 'red' }
    extend(base, { color: 'blue' })
    expect(base.color).toBe('red')
  })
})

describe('clone()', () => {
  it('shallow copies a style object', () => {
    const original = { color: 'red', bg: 'blue' }
    const copy = clone(original)
    expect(copy).toEqual(original)
    expect(copy).not.toBe(original)
  })
})

describe('pick()', () => {
  it('picks selected properties', () => {
    const result = pick({ color: 'red', bg: 'blue', px: 4 }, 'color', 'px')
    expect(result).toEqual({ color: 'red', px: 4 })
  })

  it('ignores missing keys', () => {
    const result = pick({ color: 'red' }, 'color', 'nonexistent')
    expect(result).toEqual({ color: 'red' })
  })

  it('returns empty object when no keys match', () => {
    const result = pick({ color: 'red' }, 'bg')
    expect(result).toEqual({})
  })
})

describe('omit()', () => {
  it('omits specified properties', () => {
    const result = omit({ color: 'red', bg: 'blue', px: 4 }, 'bg')
    expect(result).toEqual({ color: 'red', px: 4 })
  })

  it('omits multiple properties', () => {
    const result = omit({ a: 1, b: 2, c: 3, d: 4 }, 'b', 'd')
    expect(result).toEqual({ a: 1, c: 3 })
  })

  it('does not mutate original', () => {
    const original = { color: 'red', bg: 'blue' }
    omit(original, 'bg')
    expect(original.bg).toBe('blue')
  })
})

describe('styleToInline()', () => {
  it('converts camelCase to kebab-case inline style', () => {
    const result = styleToInline({ color: 'red', fontSize: '1rem' })
    expect(result).toBe('color: red; font-size: 1rem')
  })

  it('handles empty object', () => {
    expect(styleToInline({})).toBe('')
  })

  it('passes through kebab-case keys unchanged', () => {
    const result = styleToInline({ 'background-color': 'blue', padding: '1rem' })
    expect(result).toContain('background-color: blue')
    expect(result).toContain('padding: 1rem')
  })
})

describe('deepMerge()', () => {
  it('merges nested objects recursively', () => {
    const a = { nested: { a: 1, b: 2 }, flat: 'x' }
    const b = { nested: { b: 3, c: 4 }, flat: 'y' }
    const result = deepMerge(a, b)
    expect(result).toEqual({ nested: { a: 1, b: 3, c: 4 }, flat: 'y' })
  })

  it('does not mutate inputs', () => {
    const a = { nested: { x: 1 } }
    const b = { nested: { y: 2 } }
    deepMerge(a, b)
    expect(a.nested).toEqual({ x: 1 })
    expect(b.nested).toEqual({ y: 2 })
  })

  it('overrides non-object values', () => {
    const result = deepMerge({ a: 1 }, { a: 2 })
    expect(result.a).toBe(2)
  })

  it('does not merge arrays', () => {
    const result = deepMerge({ items: [1, 2] }, { items: [3, 4] })
    expect(result.items).toEqual([3, 4])
  })
})
