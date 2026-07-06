// ─── Dynamic Style Tests ──────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  camelToKebab,
  createNamedStyle,
  createGradientStyle,
  createEventStyle
} from '../src/dynamic.js'

describe('camelToKebab()', () => {
  it('converts camelCase to kebab-case', () => {
    expect(camelToKebab('fontSize')).toBe('font-size')
    expect(camelToKebab('backgroundColor')).toBe('background-color')
    expect(camelToKebab('borderRadius')).toBe('border-radius')
  })

  it('passes through already kebab-case', () => {
    expect(camelToKebab('color')).toBe('color')
    expect(camelToKebab('margin')).toBe('margin')
  })
})

describe('createNamedStyle()', () => {
  it('returns a className and css', () => {
    const result = createNamedStyle({ color: 'red', fontSize: '1rem' })
    expect(result.className).toMatch(/^up-style-\d+$/)
    expect(result.css).toContain('color: red')
    expect(result.css).toContain('font-size: 1rem')
  })

  it('converts camelCase properties to kebab-case', () => {
    const result = createNamedStyle({ backgroundColor: 'blue' })
    expect(result.css).toContain('background-color: blue')
  })
})

describe('createGradientStyle()', () => {
  it('creates a linear gradient class', () => {
    const result = createGradientStyle({
      colors: ['red', 'blue'],
      dir: 'to bottom'
    })
    expect(result.className).toMatch(/^up-grad-\d+$/)
    expect(result.gradient).toContain('linear-gradient')
    expect(result.gradient).toContain('to bottom')
    expect(result.gradient).toContain('red')
    expect(result.gradient).toContain('blue')
  })

  it('works without direction', () => {
    const result = createGradientStyle({ colors: ['red', 'blue'] })
    expect(result.gradient).toContain('linear-gradient')
    expect(result.gradient).not.toContain('to bottom')
  })
})

describe('createEventStyle()', () => {
  it('creates a hover style by default', () => {
    const result = createEventStyle({ color: 'red' })
    expect(result.className).toMatch(/^up-ev-\d+$/)
    expect(result.event).toBe('hover')
    expect(result.css).toContain('color: red')
  })

  it('accepts custom event type', () => {
    const result = createEventStyle({ event: 'focus', outline: 'none' })
    expect(result.event).toBe('focus')
    expect(result.css).toContain('outline: none')
  })

  it('excludes event and name from CSS', () => {
    const result = createEventStyle({ event: 'hover', name: 'test', color: 'red' })
    expect(result.css).not.toContain('event')
    expect(result.css).not.toContain('name')
    expect(result.css).toContain('color: red')
  })
})
