// ─── Theme Tests ──────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { theme, extendTheme, applyTheme, lightTheme, darkTheme } from '../src/theme.js'

describe('theme()', () => {
  it('creates a default light theme', () => {
    const t = theme()
    expect(t.name).toBe('default')
    expect(t.mode).toBe('light')
    expect(t.colors.primary).toBe('#646cff')
    expect(t.spacing[4]).toBe(4)
  })

  it('accepts color overrides', () => {
    const t = theme({ colors: { primary: '#ff0000' } })
    expect(t.colors.primary).toBe('#ff0000')
    expect(t.colors.secondary).toBe('#6c757d') // unchanged
  })

  it('accepts spacing overrides', () => {
    const t = theme({ spacing: { 4: 8 } })
    expect(t.spacing[4]).toBe(8)
    expect(t.spacing[0]).toBe(0) // unchanged
  })

  it('accepts a name', () => {
    const t = theme({ name: 'brand' })
    expect(t.name).toBe('brand')
  })

  it('generates CSS variables', () => {
    const t = theme({ name: 'test' })
    expect(t.cssVars).toBeDefined()
    expect(t.cssVars['--color-primary']).toBe('#646cff')
    expect(t.cssVars['--spacing-4']).toBe('4rem')
    expect(t.cssVars['--fontSize-2']).toBe('2rem')
  })

  it('generates cssVarsString', () => {
    const t = theme({ name: 'test' })
    expect(t.cssVarsString).toContain('--color-primary: #646cff')
    expect(t.cssVarsString).toContain('--spacing-0: 0rem')
  })
})

describe('extendTheme()', () => {
  it('creates a new theme with overrides', () => {
    const base = theme({ name: 'base', colors: { primary: '#111' } })
    const extended = extendTheme(base, { name: 'ext', colors: { primary: '#222' } })
    expect(extended.name).toBe('ext')
    expect(extended.colors.primary).toBe('#222')
    expect(extended.colors.secondary).toBe('#6c757d') // from base
  })

  it('does not mutate original', () => {
    const base = theme({ name: 'base' })
    extendTheme(base, { colors: { primary: '#999' } })
    expect(base.colors.primary).toBe('#646cff')
  })

  it('uses default extended name when none provided', () => {
    const base = theme({ name: 'base' })
    const ext = extendTheme(base)
    expect(ext.name).toBe('base-extended')
  })
})

describe('applyTheme()', () => {
  it('sets data attributes and CSS vars on root', () => {
    const t = theme({ name: 'mytheme', mode: 'dark' })
    applyTheme(t, document.documentElement)
    expect(document.documentElement.getAttribute('data-theme')).toBe('mytheme')
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#646cff')
  })

  it('accepts custom root element', () => {
    const div = document.createElement('div')
    const t = theme({ name: 'scoped' })
    applyTheme(t, div)
    expect(div.getAttribute('data-theme')).toBe('scoped')
    expect(div.style.getPropertyValue('--color-primary')).toBe('#646cff')
  })
})

describe('pre-built themes', () => {
  it('lightTheme is a valid theme', () => {
    expect(lightTheme.name).toBe('light')
    expect(lightTheme.mode).toBe('light')
    expect(lightTheme.cssVars).toBeDefined()
  })

  it('darkTheme inverts surface colors', () => {
    expect(darkTheme.name).toBe('dark')
    expect(darkTheme.mode).toBe('dark')
    expect(darkTheme.colors.light).toBe('#1e1e2e')
    expect(darkTheme.colors.dark).toBe('#e8e8ed')
  })
})
