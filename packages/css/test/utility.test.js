// ─── Utility Tests ────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { utility, generateUtilities, utilityDefs } from '../src/utility.js'

describe('utility()', () => {
  it('generates spacing rules', () => {
    const rules = utility({ groups: ['spacing'] })
    expect(rules.length).toBeGreaterThan(0)
    const m0 = rules.find(r => r.selector === '.m-0')
    expect(m0).toBeDefined()
    expect(m0.css).toContain('margin: 0rem')
  })

  it('generates color rules', () => {
    const rules = utility({ groups: ['colors'] })
    const textPrimary = rules.find(r => r.selector === '.text-primary')
    expect(textPrimary).toBeDefined()
    expect(textPrimary.css).toContain('color: #646cff')

    const bgPrimary = rules.find(r => r.selector === '.bg-primary')
    expect(bgPrimary).toBeDefined()
    expect(bgPrimary.css).toContain('background-color: #646cff')
  })

  it('generates display rules', () => {
    const rules = utility({ groups: ['display'] })
    expect(rules.find(r => r.selector === '.d-flex')).toBeDefined()
    expect(rules.find(r => r.selector === '.d-grid')).toBeDefined()
    expect(rules.find(r => r.selector === '.d-none')).toBeDefined()
  })

  it('generates flex rules', () => {
    const rules = utility({ groups: ['flex'] })
    expect(rules.find(r => r.selector === '.flex-row')).toBeDefined()
    expect(rules.find(r => r.selector === '.justify-center')).toBeDefined()
    expect(rules.find(r => r.selector === '.items-start')).toBeDefined()
    expect(rules.find(r => r.selector === '.flex-wrap-wrap')).toBeDefined()
  })

  it('maps flex shorthand to CSS values', () => {
    const rules = utility({ groups: ['flex'] })
    const justifyBetween = rules.find(r => r.selector === '.justify-between')
    expect(justifyBetween.css).toContain('space-between')
  })

  it('generates grid rules', () => {
    const rules = utility({ groups: ['grid'] })
    const cols3 = rules.find(r => r.selector === '.grid-cols-3')
    expect(cols3).toBeDefined()
    expect(cols3.css).toContain('repeat(3, 1fr)')
  })

  it('generates sizing rules', () => {
    const rules = utility({ groups: ['sizing'] })
    expect(rules.find(r => r.selector === '.w-4')).toBeDefined()
    expect(rules.find(r => r.selector === '.h-0')).toBeDefined()
  })

  it('generates typography rules', () => {
    const rules = utility({ groups: ['typography'] })
    expect(rules.find(r => r.selector === '.text-center')).toBeDefined()
    expect(rules.find(r => r.selector === '.text-uppercase')).toBeDefined()
    expect(rules.find(r => r.selector === '.font-bold')).toBeDefined()
    expect(rules.find(r => r.selector === '.font-sans')).toBeDefined()
  })

  it('generates border rules', () => {
    const rules = utility({ groups: ['borders'] })
    expect(rules.find(r => r.selector === '.border-solid')).toBeDefined()
    expect(rules.find(r => r.selector === '.border-dashed')).toBeDefined()
  })

  it('generates shadow rules', () => {
    const rules = utility({ groups: ['shadows'] })
    const shadow = rules.find(r => r.selector === '.shadow-4')
    expect(shadow).toBeDefined()
    expect(shadow.css).toContain('box-shadow')
  })

  it('generates position rules', () => {
    const rules = utility({ groups: ['position'] })
    expect(rules.find(r => r.selector === '.pos-relative')).toBeDefined()
    expect(rules.find(r => r.selector === '.pos-absolute')).toBeDefined()
  })

  it('handles unknown groups gracefully', () => {
    const rules = utility({ groups: ['nonexistent'] })
    expect(rules).toEqual([])
  })

  it('generates all groups by default', () => {
    const rules = utility()
    expect(rules.length).toBeGreaterThan(500)
  })
})

describe('generateUtilities()', () => {
  it('is an alias for utility()', () => {
    const a = generateUtilities()
    const b = utility()
    expect(a.length).toBe(b.length)
  })
})

describe('utilityDefs', () => {
  it('has all expected definition groups', () => {
    expect(utilityDefs.spacing).toBeDefined()
    expect(utilityDefs.colors).toBeDefined()
    expect(utilityDefs.display).toBeDefined()
    expect(utilityDefs.flex).toBeDefined()
    expect(utilityDefs.grid).toBeDefined()
    expect(utilityDefs.sizing).toBeDefined()
    expect(utilityDefs.typography).toBeDefined()
    expect(utilityDefs.borders).toBeDefined()
    expect(utilityDefs.shadows).toBeDefined()
    expect(utilityDefs.position).toBeDefined()
    expect(utilityDefs.overflow).toBeDefined()
    expect(utilityDefs.cursor).toBeDefined()
    expect(utilityDefs.background).toBeDefined()
  })
})
