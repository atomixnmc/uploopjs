// ─── Variant Tests ────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { variant, registerVariant, hasVariant, variantNames, variants } from '../src/variant.js'

describe('variant()', () => {
  it('generates base rules plus variant rules', () => {
    const rules = variant({ apply: ['hover'], groups: ['display'] })
    // Should have base display rules + hover variants
    const baseFlex = rules.find(r => r.selector === '.d-flex')
    expect(baseFlex).toBeDefined()
    // Hover variant selector includes :hover pseudo-class
    const hoverFlex = rules.find(r => r.selector.includes('hover') && r.selector.includes('d-flex'))
    expect(hoverFlex).toBeDefined()
    expect(hoverFlex.css).toContain('display: flex')
  })

  it('does not add variants when apply is empty', () => {
    const rules = variant({ apply: [], groups: ['display'] })
    const all = rules.map(r => r.selector).filter(s => s.includes(':'))
    expect(all.length).toBe(0)
  })

  it('supports multiple variant types', () => {
    const rules = variant({ apply: ['hover', 'focus'], groups: ['display'] })
    const hoverCount = rules.filter(r => r.selector.includes('hover') && r.selector.includes(':')).length
    const focusCount = rules.filter(r => r.selector.includes('focus') && r.selector.includes(':')).length
    expect(hoverCount).toBeGreaterThan(0)
    expect(focusCount).toBeGreaterThan(0)
  })

  it('supports responsive variants', () => {
    const rules = variant({ apply: ['sm', 'md'], groups: ['display'] })
    // Responsive variants keep the sm:/md: prefix in selector
    const smRule = rules.find(r => r.selector.startsWith('.sm\\:'))
    const mdRule = rules.find(r => r.selector.startsWith('.md\\:'))
    expect(smRule).toBeDefined()
    expect(mdRule).toBeDefined()
  })

  it('supports dark mode variant', () => {
    const rules = variant({ apply: ['dark'], groups: ['display'] })
    const darkRule = rules.find(r => r.selector.startsWith('.dark\\:'))
    expect(darkRule).toBeDefined()
    expect(darkRule.css).toContain('display:')
  })

  it('skips unknown variants silently', () => {
    const rules = variant({ apply: ['hover', 'nonexistent'], groups: ['display'] })
    // Should not throw, just return what it can
    const someVariant = rules.find(r => r.selector.includes('hover') && r.selector.includes(':'))
    expect(someVariant).toBeDefined()
  })
})

describe('registerVariant()', () => {
  it('registers a custom variant', () => {
    registerVariant('test-custom', (sel, css) => `${sel}[custom] { ${css} }`)
    expect(hasVariant('test-custom')).toBe(true)
    expect(variantNames()).toContain('test-custom')
  })
})

describe('hasVariant()', () => {
  it('returns true for built-in variants', () => {
    expect(hasVariant('hover')).toBe(true)
    expect(hasVariant('focus')).toBe(true)
    expect(hasVariant('dark')).toBe(true)
    expect(hasVariant('sm')).toBe(true)
  })

  it('returns false for unknown', () => {
    expect(hasVariant('unknown-variant')).toBe(false)
  })
})

describe('variantNames()', () => {
  it('returns all registered variant names', () => {
    const names = variantNames()
    expect(names).toContain('hover')
    expect(names).toContain('focus')
    expect(names).toContain('active')
    expect(names).toContain('dark')
    expect(names).toContain('sm')
    expect(names).toContain('lg')
  })
})

describe('variants registry', () => {
  it('generates correct hover CSS', () => {
    const result = variants['hover']('.foo', 'color: red')
    expect(result).toBe('.foo:hover { color: red }')
  })

  it('generates correct media query CSS', () => {
    const result = variants['sm']('.foo', 'display: none')
    expect(result).toBe('@media (min-width: 576px) { .foo { display: none } }')
  })

  it('generates correct dark mode CSS', () => {
    const result = variants['dark']('.foo', 'color: white')
    expect(result).toBe('@media (prefers-color-scheme: dark) { .foo { color: white } }')
  })

  it('parseVariantRule correctly parses media query variant output', () => {
    // This is implicitly tested by variant() working above
    const rules = variant({ apply: ['sm'], groups: ['display'] })
    const smRule = rules.find(r => r.selector.startsWith('.sm\\:'))
    expect(smRule).toBeDefined()
    expect(smRule.css).toContain('display:')
  })
})
