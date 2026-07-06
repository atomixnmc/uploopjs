// ─── Minify Tests ──────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  minifyCSS,
  dedupDeclarations,
  normalizeUnits,
  prefixProp,
  prefixCSS
} from '../src/minify.js'

describe('minifyCSS()', () => {
  it('removes whitespace around colons and semicolons', () => {
    const result = minifyCSS('color: red ; font-size: 1rem')
    expect(result).toBe('color:red;font-size:1rem')
  })

  it('removes trailing semicolon before closing brace', () => {
    const result = minifyCSS('color: red; }')
    expect(result).toBe('color:red}')
  })

  it('removes whitespace around braces', () => {
    const result = minifyCSS('.foo { color: red }')
    expect(result).toBe('.foo{color:red}')
  })

  it('handles empty string', () => {
    expect(minifyCSS('')).toBe('')
  })
})

describe('dedupDeclarations()', () => {
  it('keeps last value for duplicate properties', () => {
    const result = dedupDeclarations('color: red; color: blue')
    expect(result).toBe('color: blue')
  })

  it('preserves unique properties', () => {
    const result = dedupDeclarations('color: red; font-size: 1rem')
    expect(result).toContain('color: red')
    expect(result).toContain('font-size: 1rem')
  })

  it('handles empty string', () => {
    expect(dedupDeclarations('')).toBe('')
  })

  it('ignores malformed declarations', () => {
    const result = dedupDeclarations('color: red; bad-decl')
    expect(result).toContain('color: red')
  })
})

describe('normalizeUnits()', () => {
  it('converts px to rem', () => {
    const result = normalizeUnits('padding: 16px; font-size: 32px')
    expect(result).toContain('padding: 1rem')
    expect(result).toContain('font-size: 2rem')
  })

  it('honors custom basePx', () => {
    const result = normalizeUnits('width: 100px', 10)
    expect(result).toContain('width: 10rem')
  })

  it('leaves rem values unchanged', () => {
    const result = normalizeUnits('padding: 1rem')
    expect(result).toContain('padding: 1rem')
  })

  it('handles decimal px values', () => {
    const result = normalizeUnits('margin: 8.5px')
    expect(result).toContain('rem')
  })

  it('handles string with no px values', () => {
    const result = normalizeUnits('display: flex')
    expect(result).toContain('display: flex')
  })
})

describe('prefixProp()', () => {
  it('returns prefixed variants for transform', () => {
    const result = prefixProp('transform')
    expect(result).toEqual(['-webkit-transform', 'transform'])
  })

  it('returns prefixed variants for appearance', () => {
    const result = prefixProp('appearance')
    expect(result).toEqual(['-webkit-appearance', 'appearance'])
  })

  it('returns only the property for non-prefixed props', () => {
    const result = prefixProp('color')
    expect(result).toEqual(['color'])
  })
})

describe('prefixCSS()', () => {
  it('adds vendor prefixes to declarations', () => {
    const result = prefixCSS('transform: rotate(90deg)')
    expect(result).toContain('-webkit-transform: rotate(90deg)')
    expect(result).toContain('transform: rotate(90deg)')
  })

  it('leaves non-prefixed properties alone', () => {
    const result = prefixCSS('color: red')
    expect(result).toBe('color: red')
  })

  it('handles multiple declarations', () => {
    const result = prefixCSS('transform: scale(2); color: blue')
    expect(result).toContain('-webkit-transform: scale(2)')
    expect(result).toContain('transform: scale(2)')
    expect(result).toContain('color: blue')
  })
})
