// ─── Batch Tests ───────────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { batch, keyframes, atMedia } from '../src/batch.js'
import { getSheet, removeSheet } from '../src/inject.js'

describe('batch()', () => {
  beforeEach(() => {
    removeSheet()
  })

  it('creates multiple named classes', () => {
    const result = batch({
      btn: { bg: 'blue', color: 'white', padding: '0.5rem 1rem' },
      icon: { width: '1em', height: '1em' }
    })
    expect(result.btn).toBeDefined()
    expect(result.icon).toBeDefined()
    expect(result.btn.className).toMatch(/^up-batch-btn-\d+$/)
    expect(result.icon.className).toMatch(/^up-batch-icon-\d+$/)
    expect(result.btn.css).toContain('color: white')
    expect(result.icon.css).toContain('width: 1em')
  })

  it('converts camelCase to kebab-case', () => {
    const result = batch({
      card: { backgroundColor: '#fff', borderRadius: '8px' }
    })
    expect(result.card.css).toContain('background-color: #fff')
    expect(result.card.css).toContain('border-radius: 8px')
  })

  it('injects rules into the global sheet', () => {
    const sheet = getSheet()
    const before = sheet.cssRules.length
    batch({ test: { color: 'red' } })
    expect(sheet.cssRules.length).toBe(before + 1)
  })

  it('handles empty styles gracefully', () => {
    const result = batch({})
    expect(result).toEqual({})
  })
})

describe('keyframes()', () => {
  beforeEach(() => {
    removeSheet()
  })

  it('creates a @keyframes rule with from/to steps', () => {
    const sheet = getSheet()
    const before = sheet.cssRules.length
    const name = keyframes('test-slide', [
      ['from', { transform: 'translateX(-100%)', opacity: 0 }],
      ['to', { transform: 'translateX(0)', opacity: 1 }]
    ])
    expect(name).toBe('test-slide')
    expect(sheet.cssRules.length).toBe(before + 1)
  })

  it('creates a @keyframes rule with percentage steps', () => {
    const sheet = getSheet()
    const before = sheet.cssRules.length
    keyframes('test-pulse', [
      ['0%', { opacity: 0 }],
      ['50%', { opacity: 0.5 }],
      ['100%', { opacity: 1 }]
    ])
    expect(sheet.cssRules.length).toBe(before + 1)
  })

  it('converts camelCase keys to kebab-case', () => {
    const sheet = getSheet()
    const before = sheet.cssRules.length
    keyframes('test-fade', [
      ['from', { backgroundColor: 'red' }],
      ['to', { backgroundColor: 'blue' }]
    ])
    // Rule should contain kebab-case background-color
    const lastRule = sheet.cssRules[sheet.cssRules.length - 1]
    expect(lastRule.cssText).toContain('background-color')
  })
})

describe('atMedia()', () => {
  beforeEach(() => {
    removeSheet()
  })

  it('creates a @media rule with nested styles', () => {
    const sheet = getSheet()
    const before = sheet.cssRules.length
    const ok = atMedia('(min-width: 768px)', {
      '.container': { width: '50%' }
    })
    expect(ok).toBe(true)
    expect(sheet.cssRules.length).toBe(before + 1)
  })

  it('returns false if no sheet available', () => {
    const ok = atMedia('(min-width: 768px)', {
      '.foo': { color: 'red' }
    }, null)
    expect(ok).toBe(false)
  })

  it('handles multiple selectors in media query', () => {
    const sheet = getSheet()
    const before = sheet.cssRules.length
    atMedia('(max-width: 576px)', {
      '.mobile-hide': { display: 'none' },
      '.mobile-stack': { flexDirection: 'column' }
    })
    expect(sheet.cssRules.length).toBe(before + 1)
  })
})
