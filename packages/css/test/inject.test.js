// ─── Inject Tests ─────────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getSheet, inject, removeSheet, createAdoptedSheet, insertOnce, clearRuleRegistry, injectBase } from '../src/inject.js'

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

  it('dedup: skips already-injected rules', () => {
    removeSheet()
    const first = inject({ groups: ['display'] })
    const second = inject({ groups: ['display'] })
    // Second call should skip all rules (dedup)
    expect(second.skipped).toBe(first.count)
    expect(second.count).toBe(0)
  })

  it('force option re-injects skipped rules', () => {
    removeSheet()
    const first = inject({ groups: ['display'] })
    const second = inject({ groups: ['display'], force: true })
    expect(second.count).toBe(first.count)
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

describe('clearRuleRegistry()', () => {
  it('clears the dedup registry', () => {
    removeSheet()
    const first = inject({ groups: ['display'] })
    clearRuleRegistry()
    const second = inject({ groups: ['display'] })
    expect(second.count).toBe(first.count)
  })
})

describe('injectBase()', () => {
  it('injects only base CSS variables', () => {
    removeSheet()
    const result = injectBase()
    expect(result.count).toBeGreaterThan(0)
  })
})

describe('insertOnce()', () => {
  it('inserts a rule and returns true', () => {
    const sheet = getSheet()
    const ok = insertOnce(sheet, '.test-once { color: red }')
    expect(ok).toBe(true)
  })

  it('returns false for duplicate insert', () => {
    const sheet = getSheet()
    insertOnce(sheet, '.test-dupe { color: blue }')
    const ok = insertOnce(sheet, '.test-dupe { color: blue }')
    expect(ok).toBe(false)
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
