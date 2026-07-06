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

  it('generates z-index rules', () => {
    const rules = utility({ groups: ['zIndex'] })
    expect(rules.find(r => r.selector === '.z-10')).toBeDefined()
    expect(rules.find(r => r.selector === '.z-auto')).toBeDefined()
  })

  it('generates opacity rules', () => {
    const rules = utility({ groups: ['opacity'] })
    expect(rules.find(r => r.selector === '.opacity-0')).toBeDefined()
    expect(rules.find(r => r.selector === '.opacity-100')).toBeDefined()
  })

  it('generates flex-grow/shrink rules', () => {
    const rules = utility({ groups: ['flexGrow'] })
    expect(rules.find(r => r.selector === '.flex-grow')).toBeDefined()
    expect(rules.find(r => r.selector === '.flex-shrink-0')).toBeDefined()
  })

  it('generates gap-x/gap-y rules', () => {
    const rules = utility({ groups: ['gapXY'] })
    expect(rules.find(r => r.selector === '.gap-x-4')).toBeDefined()
    expect(rules.find(r => r.selector === '.gap-y-2')).toBeDefined()
  })

  it('generates inset rules', () => {
    const rules = utility({ groups: ['inset'] })
    expect(rules.find(r => r.selector === '.top-0')).toBeDefined()
    expect(rules.find(r => r.selector === '.inset-4')).toBeDefined()
    expect(rules.find(r => r.selector === '.inset-x-2')).toBeDefined()
  })

  it('generates transition rules', () => {
    const rules = utility({ groups: ['transition'] })
    expect(rules.find(r => r.selector === '.transition-all')).toBeDefined()
    expect(rules.find(r => r.selector === '.duration-200')).toBeDefined()
    expect(rules.find(r => r.selector === '.ease-linear')).toBeDefined()
  })

  it('generates outline rules', () => {
    const rules = utility({ groups: ['outline'] })
    expect(rules.find(r => r.selector === '.outline-none')).toBeDefined()
    expect(rules.find(r => r.selector === '.outline-solid')).toBeDefined()
  })

  it('generates visibility rules', () => {
    const rules = utility({ groups: ['visibility'] })
    expect(rules.find(r => r.selector === '.visible')).toBeDefined()
    expect(rules.find(r => r.selector === '.invisible')).toBeDefined()
  })

  it('generates pointer-events rules', () => {
    const rules = utility({ groups: ['pointerEvents'] })
    expect(rules.find(r => r.selector === '.pointer-events-none')).toBeDefined()
  })

  it('generates resize rules', () => {
    const rules = utility({ groups: ['resize'] })
    expect(rules.find(r => r.selector === '.resize-none')).toBeDefined()
  })

  it('generates user-select rules', () => {
    const rules = utility({ groups: ['userSelect'] })
    expect(rules.find(r => r.selector === '.select-none')).toBeDefined()
  })

  it('generates overflow-x/y rules', () => {
    const rules = utility({ groups: ['overflowXY'] })
    expect(rules.find(r => r.selector === '.overflow-x-auto')).toBeDefined()
    expect(rules.find(r => r.selector === '.overflow-y-hidden')).toBeDefined()
  })

  it('generates transform rules', () => {
    const rules = utility({ groups: ['transform'] })
    expect(rules.find(r => r.selector === '.transform-none')).toBeDefined()
    expect(rules.find(r => r.selector === '.transform-scale-150')).toBeDefined()
  })

  it('generates order rules', () => {
    const rules = utility({ groups: ['order'] })
    expect(rules.find(r => r.selector === '.order-first')).toBeDefined()
    expect(rules.find(r => r.selector === '.order-5')).toBeDefined()
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
    // New groups in v0.2.0
    expect(utilityDefs.zIndex).toBeDefined()
    expect(utilityDefs.opacity).toBeDefined()
    expect(utilityDefs.flexGrow).toBeDefined()
    expect(utilityDefs.gapXY).toBeDefined()
    expect(utilityDefs.inset).toBeDefined()
    expect(utilityDefs.transition).toBeDefined()
    expect(utilityDefs.outline).toBeDefined()
    expect(utilityDefs.visibility).toBeDefined()
    expect(utilityDefs.pointerEvents).toBeDefined()
    expect(utilityDefs.resize).toBeDefined()
    expect(utilityDefs.userSelect).toBeDefined()
    expect(utilityDefs.overflowXY).toBeDefined()
    expect(utilityDefs.transform).toBeDefined()
    expect(utilityDefs.order).toBeDefined()
  })
})
