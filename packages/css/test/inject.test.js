// ─── Inject Tests ─────────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getSheet, inject, removeSheet, createAdoptedSheet } from '../src/inject.js'

describe('getSheet()', () => {
  it('returns a CSSStyleSheet instance', () => {
    const sheet = getSheet()
    expect(sheet).toBeInstanceOf(CSSStyleSheet)
  })

  it('returns the same sheet on subsequent calls', () => {
    const a = getSheet()
    const b = getSheet()
    expect(a).toBe(b)
  })

  it('creates a style element in the document head', () => {
    removeSheet() // clean slate
    getSheet()
    const style = document.querySelector('style[data-uploop="utilities"]')
    expect(style).not.toBeNull()
  })
})

describe('inject()', () => {
  it('injects utility rules into the global sheet', () => {
    removeSheet()
    const result = inject()
    expect(result.sheet).toBeInstanceOf(CSSStyleSheet)
    expect(result.count).toBeGreaterThan(100)
  })

  it('respects groups option', () => {
    removeSheet()
    const result = inject({ groups: ['display'] })
    expect(result.count).toBeLessThan(20)
    expect(result.count).toBeGreaterThan(0)
  })

  it('respects custom spacing', () => {
    removeSheet()
    const result = inject({ spacing: { 0: 0, 1: 2 }, groups: ['spacing'] })
    // Should have rules for 0 and 1 only
    expect(result.count).toBeGreaterThan(0)
  })
})

describe('removeSheet()', () => {
  it('removes the style element from DOM', () => {
    inject()
    const before = document.querySelector('style[data-uploop="utilities"]')
    expect(before).not.toBeNull()
    removeSheet()
    const after = document.querySelector('style[data-uploop="utilities"]')
    expect(after).toBeNull()
  })
})

describe('createAdoptedSheet()', () => {
  it('returns a CSSStyleSheet', () => {
    const sheet = createAdoptedSheet()
    expect(sheet).toBeInstanceOf(CSSStyleSheet)
    expect(sheet.cssRules.length).toBeGreaterThan(100)
  })

  it('respects groups option', () => {
    const sheet = createAdoptedSheet({ groups: ['display'] })
    expect(sheet.cssRules.length).toBeLessThan(20)
  })
})
