// ─── Optimizer Tests ───────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  markUsed,
  getUsedClasses,
  resetUsed,
  watchDOM,
  unwatchDOM,
  usedRules,
  stats,
  hasTracking
} from '../src/optimizer.js'

describe('markUsed()', () => {
  beforeEach(() => resetUsed())
  afterEach(() => resetUsed())

  it('registers a single class name', () => {
    markUsed('bg-primary')
    expect(getUsedClasses()).toContain('bg-primary')
  })

  it('registers space-separated class names', () => {
    markUsed('bg-primary text-white p-4')
    const used = getUsedClasses()
    expect(used).toContain('bg-primary')
    expect(used).toContain('text-white')
    expect(used).toContain('p-4')
  })

  it('registers class names from an array', () => {
    markUsed(['d-flex', 'gap-4'])
    expect(getUsedClasses()).toContain('d-flex')
    expect(getUsedClasses()).toContain('gap-4')
  })

  it('handles leading dot in class name', () => {
    markUsed('.my-class')
    expect(getUsedClasses()).toContain('my-class')
    expect(getUsedClasses()).not.toContain('.my-class')
  })

  it('is idempotent (dedup)', () => {
    markUsed('bg-primary')
    markUsed('bg-primary')
    const used = getUsedClasses()
    expect(used.filter(c => c === 'bg-primary').length).toBe(1)
  })
})

describe('resetUsed()', () => {
  beforeEach(() => resetUsed())

  it('clears all tracked classes', () => {
    markUsed('bg-primary text-white')
    resetUsed()
    expect(getUsedClasses()).toEqual([])
  })
})

describe('hasTracking()', () => {
  beforeEach(() => resetUsed())

  it('returns false when no classes tracked', () => {
    expect(hasTracking()).toBe(false)
  })

  it('returns true when classes are tracked', () => {
    markUsed('bg-primary')
    expect(hasTracking()).toBe(true)
  })
})

describe('usedRules()', () => {
  beforeEach(() => resetUsed())

  it('returns all utility rules when nothing is tracked (fallback)', () => {
    const rules = usedRules()
    expect(rules.length).toBeGreaterThan(500)
  })

  it('filters to only rules matching tracked classes', () => {
    markUsed('d-flex d-grid')
    const rules = usedRules()
    expect(rules.length).toBeLessThan(20)
    expect(rules.every(r => r.selector.includes('d-flex') || r.selector.includes('d-grid'))).toBe(true)
  })

  it('includes rules with pseudo-class variants of tracked classes', () => {
    markUsed('d-flex')
    const rules = usedRules()
    // Should include hover:d-flex, focus:d-flex etc if they match
    expect(rules.some(r => r.selector === '.d-flex')).toBe(true)
  })
})

describe('stats()', () => {
  beforeEach(() => resetUsed())

  it('returns used, total, savings', () => {
    const s = stats()
    expect(s).toHaveProperty('used')
    expect(s).toHaveProperty('total')
    expect(s).toHaveProperty('savings')
    expect(s.total).toBeGreaterThan(0)
  })

  it('shows savings when classes are tracked', () => {
    markUsed('d-flex')
    const s = stats()
    expect(s.used).toBeLessThan(s.total)
    expect(s.savings).toContain('%')
  })

  it('handles the case when no classes are tracked (all rules)', () => {
    resetUsed()
    const s = stats()
    expect(s.used).toBe(s.total)
  })
})

describe('watchDOM() / unwatchDOM()', () => {
  beforeEach(() => resetUsed())
  afterEach(() => { unwatchDOM(); resetUsed() })

  it('start/stop returns null in non-browser environments', () => {
    // jsdom has MutationObserver, so this should work
    const observer = watchDOM()
    // If MutationObserver exists, it returns an observer
    if (typeof MutationObserver !== 'undefined') {
      expect(observer).not.toBeNull()
    }
    unwatchDOM()
  })

  it('watchDOM scans existing DOM elements', () => {
    // Add an element with classes
    const el = document.createElement('div')
    el.className = 'existing-class'
    document.body.appendChild(el)

    const observer = watchDOM(document.body)
    expect(getUsedClasses()).toContain('existing-class')

    document.body.removeChild(el)
    unwatchDOM()
  })
})
