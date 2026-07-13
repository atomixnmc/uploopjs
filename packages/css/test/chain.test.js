// ─── Chain Tests ───────────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { css, css2, parseCSS } from '../src/chain.js'
import { getSheet, removeSheet } from '../src/inject.js'

describe('css() - ChainBuilder', () => {
  it('returns a chain builder with prop()', () => {
    const c = css()
    expect(c.prop).toBeDefined()
    expect(c.prop('color', 'red')).toBe(c) // chainable
  })

  it('done() returns { className, css }', () => {
    const result = css().prop('color', 'red').prop('font-size', '1rem').done()
    expect(result.className).toMatch(/^up-css-\d+$/)
    expect(result.css).toContain('color: red')
    expect(result.css).toContain('font-size: 1rem')
  })

  it('toString() returns className', () => {
    const c = css().prop('color', 'blue')
    const str = c.toString()
    expect(str).toMatch(/^up-css-\d+$/)
  })

  it('done() is idempotent', () => {
    const c = css().prop('color', 'red')
    const a = c.done()
    const b = c.done()
    expect(a).toBe(b)
    expect(a.className).toBe(b.className)
  })
})

describe('css().merge()', () => {
  it('merges from another ChainBuilder', () => {
    const base = css().prop('padding', '1rem').prop('margin', '0')
    const merged = css().prop('color', 'red').merge(base).done()
    expect(merged.css).toContain('color: red')
    expect(merged.css).toContain('padding: 1rem')
    expect(merged.css).toContain('margin: 0')
  })

  it('merges from a plain object', () => {
    const merged = css().prop('color', 'red').merge({ padding: '1rem', margin: '0' }).done()
    expect(merged.css).toContain('color: red')
    expect(merged.css).toContain('padding: 1rem')
  })
})

describe('css().clone()', () => {
  it('creates an independent fork', () => {
    const base = css().prop('padding', '1rem')
    const fork = base.clone().prop('color', 'blue')
    const baseResult = base.done()
    const forkResult = fork.done()
    expect(baseResult.css).not.toContain('color')
    expect(forkResult.css).toContain('color: blue')
    expect(forkResult.css).toContain('padding: 1rem')
  })

  it('mutating clone does not affect original', () => {
    const base = css().prop('color', 'red')
    const fork = base.clone()
    fork.prop('color', 'blue')
    expect(base.done().css).toContain('color: red')
    expect(fork.done().css).toContain('color: blue')
  })
})

describe('css().select()', () => {
  it('uses custom selector', () => {
    const result = css().select('.my-custom-class').prop('color', 'red').done()
    expect(result.className).toMatch(/^my-custom-class$/)
  })

  it('injects rule with custom selector', () => {
    const sheet = getSheet()
    // Clear previous rules from other tests
    const c = css().select('custom-btn').prop('bg', 'blue').done()
    // Should have injected the rule
    expect(c.className).toBe('custom-btn')
  })
})

describe('css().apply()', () => {
  it('creates a class with applied class references', () => {
    const result = css().apply('bg-primary', 'p-4').prop('opacity', 0.9).done()
    // @apply entries are metadata references, not serialized in CSS
    expect(result.css).toContain('opacity: 0.9')
    expect(result.css).not.toContain('@apply')
  })
})

describe('css().inline()', () => {
  it('generates inline style string without injection', () => {
    const style = css().prop('color', 'red').prop('padding', '1rem').inline()
    expect(style).toBe('color: red; padding: 1rem')
  })

  it('returns empty string for no declarations', () => {
    const style = css().inline()
    expect(style).toBe('')
  })
})

describe('css().when()', () => {
  it('adds a variant condition', () => {
    const result = css().prop('bg', 'blue').when('hover', c => c.prop('bg', 'darkblue')).done()
    expect(result.css).toContain('bg: blue')
  })

  it('can chain multiple variants', () => {
    const result = css()
      .prop('color', 'black')
      .when('hover', c => c.prop('color', 'blue'))
      .when('focus', c => c.prop('outline', 'none'))
      .done()
    expect(result.css).toContain('color: black')
  })
})

describe('css().export()', () => {
  it('returns { className, css } without DOM injection', () => {
    const sheet = getSheet()
    const before = sheet.cssRules.length
    const result = css().prop('color', 'red').export()
    // No rule should be injected
    expect(sheet.cssRules.length).toBe(before)
    expect(result.className).toMatch(/^up-css-\d+$/)
    expect(result.css).toContain('color: red')
  })
})

describe('css().decls getter', () => {
  it('returns a snapshot of current declarations', () => {
    const c = css().prop('color', 'red').prop('padding', '1rem')
    const d = c.decls
    expect(d).toEqual({ color: 'red', padding: '1rem' })
    // Mutating snapshot should not affect chain
    d.color = 'blue'
    expect(c.done().css).toContain('color: red')
  })
})

describe('css2() - Proxy convenience', () => {
  it('sets CSS properties via method calls', () => {
    const result = css2().color('red').fontSize('2rem').rounded('8px').done()
    expect(result.css).toContain('color: red')
    expect(result.css).toContain('font-size: 2rem')
    expect(result.css).toContain('border-radius: 8px')
  })

  it('supports padding/ margin shorthand expansions', () => {
    const result = css2().p(4).px(2).py(1).m(0).mx('auto').done()
    expect(result.css).toContain('padding: 4')
    expect(result.css).toContain('padding-left: 2')
    expect(result.css).toContain('padding-right: 2')
    expect(result.css).toContain('padding-top: 1')
    expect(result.css).toContain('padding-bottom: 1')
    expect(result.css).toContain('margin: 0')
    expect(result.css).toContain('margin-left: auto')
    expect(result.css).toContain('margin-right: auto')
  })

  it('supports bg/text/rounded shorthands', () => {
    const result = css2().bg('primary').text('white').rounded('md').done()
    expect(result.css).toContain('background-color: primary')
    expect(result.css).toContain('color: white')
    expect(result.css).toContain('border-radius: md')
  })

  it('is chainable with standard methods too', () => {
    const result = css2().bg('blue').prop('border', '1px solid').done()
    expect(result.css).toContain('background-color: blue')
    expect(result.css).toContain('border: 1px solid')
  })

  it('supports deep shorthand methods alongside merge', () => {
    const proxy = css2()
    proxy.bg('red')
    const base = css().prop('font-size', '1rem')
    proxy.merge(base)
    const result = proxy.done()
    expect(result.css).toContain('background-color: red')
    expect(result.css).toContain('font-size: 1rem')
  })
})

describe('css().props()', () => {
  it('sets multiple properties from an object', () => {
    const result = css().props({ color: 'red', fontSize: '1rem', padding: '0.5rem' }).done()
    expect(result.css).toContain('color: red')
    expect(result.css).toContain('font-size: 1rem')
    expect(result.css).toContain('padding: 0.5rem')
  })

  it('converts camelCase to kebab-case', () => {
    const result = css().props({ backgroundColor: 'blue', borderRadius: '8px' }).done()
    expect(result.css).toContain('background-color: blue')
    expect(result.css).toContain('border-radius: 8px')
  })

  it('is chainable with other methods', () => {
    const result = css().props({ color: 'red' }).prop('font-size', '1rem').done()
    expect(result.css).toContain('color: red')
    expect(result.css).toContain('font-size: 1rem')
  })

  it('handles empty object gracefully', () => {
    const result = css().props({}).done()
    expect(result.css).toBe('')
  })

  it('ignores null/undefined', () => {
    const result = css().props(null).done()
    expect(result.css).toBe('')
  })
})

describe('css tagged template', () => {
  it('parses single rule into graph and json', () => {
    const result = css`
      .btn { color: red; font-size: 1rem }
    `
    expect(result.graph).toEqual({
      '.btn': { color: 'red', 'font-size': '1rem' }
    })
    expect(result.json).toHaveLength(1)
    expect(result.json[0]).toEqual({
      selector: '.btn',
      css: 'color: red; font-size: 1rem'
    })
  })

  it('parses multiple rules', () => {
    const result = css`
      .btn { color: red }
      .icon { width: 1em; height: 1em }
    `
    expect(Object.keys(result.graph)).toHaveLength(2)
    expect(result.graph['.btn']).toEqual({ color: 'red' })
    expect(result.graph['.icon']).toEqual({ width: '1em', height: '1em' })
    expect(result.json).toHaveLength(2)
  })

  it('includes text property with original CSS', () => {
    const result = css`.foo { color: blue }`
    expect(result.text).toBe('.foo { color: blue }')
  })

  it('handles empty input', () => {
    const result = css``
    expect(result.graph).toEqual({})
    expect(result.json).toEqual([])
    expect(result.text).toBe('')
  })

  it('handles trailing semicolons correctly', () => {
    const result = css`
      .card { color: red; font-size: 1rem; }
    `
    expect(result.graph['.card']).toEqual({ color: 'red', 'font-size': '1rem' })
  })

  it('handles inline single-line format', () => {
    const result = css`.btn { color: red; font-size: 1rem }`
    expect(result.graph['.btn']).toEqual({ color: 'red', 'font-size': '1rem' })
  })
})

describe('parseCSS()', () => {
  it('parses CSS string', () => {
    const result = parseCSS('.card { padding: 1rem; margin: 0 }')
    expect(result.graph['.card']).toEqual({ padding: '1rem', margin: '0' })
    expect(result.json).toHaveLength(1)
    expect(result.json[0].selector).toBe('.card')
    expect(result.text).toBe('.card { padding: 1rem; margin: 0 }')
  })

  it('handles empty string', () => {
    const result = parseCSS('')
    expect(result.graph).toEqual({})
    expect(result.json).toEqual([])
    expect(result.text).toBe('')
  })
})
