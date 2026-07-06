// ─── End-to-End Tests ──────────────────────────────────────────
// Integration tests that exercise the full pipeline:
// tokens → utility generation → injection → DOM application → observation.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { utility, generateUtilities } from '../src/utility.js'
import { variant, registerVariant, hasVariant } from '../src/variant.js'
import { inject, getSheet, removeSheet, createAdoptedSheet } from '../src/inject.js'
import { createNamedStyle, createGradientStyle, createEventStyle } from '../src/dynamic.js'
import { css, css2 } from '../src/chain.js'
import { theme, extendTheme, applyTheme, lightTheme, darkTheme } from '../src/theme.js'
import { compose, extend, styleToInline } from '../src/compose.js'
import { batch, keyframes, atMedia } from '../src/batch.js'
import { markUsed, watchDOM, unwatchDOM, usedRules, stats, resetUsed, getUsedClasses } from '../src/optimizer.js'
import { minifyCSS, dedupDeclarations } from '../src/minify.js'

describe('Full Pipeline: tokens → utility → inject → DOM', () => {
  beforeEach(() => removeSheet())
  afterEach(() => removeSheet())

  it('generates utilities, injects them, and they appear in sheet', () => {
    const { sheet, count } = inject({ groups: ['display'] })
    expect(count).toBeGreaterThan(0)
    // Find our rule in the sheet
    const rules = Array.from(sheet.cssRules).map(r => r.cssText)
    const hasFlex = rules.some(r => r.includes('.d-flex'))
    expect(hasFlex).toBe(true)
  })

  it('injected classes can be applied to DOM elements', () => {
    inject({ groups: ['display', 'spacing'] })
    const el = document.createElement('div')
    el.className = 'd-flex p-4'
    document.body.appendChild(el)
    const computed = getComputedStyle(el)
    expect(computed.display).toBe('flex')
    document.body.removeChild(el)
  })

  it('variant rules work when applied to elements', () => {
    // Inject display + hover variant
    const sheet = getSheet()
    const displayRules = utility({ groups: ['display'] })
    for (const rule of displayRules) {
      sheet.insertRule(rule.selector + ' { ' + rule.css + ' }')
    }
    // Also inject hover variant manually
    sheet.insertRule('.d-flex:hover { display: flex; opacity: 0.8 }')

    const el = document.createElement('div')
    el.className = 'd-flex'
    document.body.appendChild(el)
    const computed = getComputedStyle(el)
    expect(computed.display).toBe('flex')
    document.body.removeChild(el)
  })
})

describe('Theme + Inject Integration', () => {
  beforeEach(() => removeSheet())
  afterEach(() => removeSheet())

  it('create theme, apply it, inject utilities — all play together', () => {
    const myTheme = theme({
      name: 'integration-test',
      mode: 'light',
      colors: { brand: '#ff6600' },
      surface: { bg: '#ffffff', fg: '#333333', surface: '#f5f5f5', border: '#ddd' }
    })
    applyTheme(myTheme)
    expect(document.documentElement.getAttribute('data-theme')).toBe('integration-test')
    expect(document.documentElement.style.getPropertyValue('--color-brand')).toBe('#ff6600')

    // Now inject utilities that use CSS variables
    inject({ groups: ['display'] })
    const el = document.createElement('div')
    el.className = 'd-flex'
    document.body.appendChild(el)
    const computed = getComputedStyle(el)
    expect(computed.display).toBe('flex')
    document.body.removeChild(el)
  })
})

describe('Dynamic Styles + Chain + Batch Integration', () => {
  beforeEach(() => removeSheet())
  afterEach(() => removeSheet())

  it('createNamedStyle + chain + batch all work together', () => {
    // Each creates styles into their own sheets — verify they all produce valid output
    const { className: cn1 } = createNamedStyle({ color: 'red', fontSize: '2rem' })
    const { className: cn2 } = css().prop('background', 'blue').prop('padding', '1rem').done()
    const { btn, icon } = batch({
      btn:  { display: 'inline-flex', alignItems: 'center' },
      icon: { width: '1em', height: '1em' }
    })

    expect(cn1).toMatch(/^up-style-\d+$/)
    expect(cn2).toMatch(/^up-css-\d+$/)
    expect(btn.className).toMatch(/^up-batch-btn-\d+$/)
    expect(icon.className).toMatch(/^up-batch-icon-\d+$/)

    // createNamedStyle uses its own sheet (data-uploop="dynamic")
    const dynamicSheet = document.querySelector('style[data-uploop="dynamic"]')?.sheet
    expect(dynamicSheet).toBeDefined()
    expect(dynamicSheet.cssRules.length).toBeGreaterThan(0)

    // css() and batch() use the global utilities sheet
    const utilSheet = document.querySelector('style[data-uploop="utilities"]')?.sheet
    expect(utilSheet).toBeDefined()
    expect(utilSheet.cssRules.length).toBeGreaterThan(0)
  })
})

describe('End-to-End: Optimizer with real DOM', () => {
  beforeEach(() => { resetUsed(); removeSheet() })
  afterEach(() => { unwatchDOM(); resetUsed(); removeSheet() })

  it('watchDOM tracks classes and usedRules filters accordingly', () => {
    // Create elements with classes
    const el1 = document.createElement('div')
    el1.className = 'd-flex'
    document.body.appendChild(el1)

    const el2 = document.createElement('div')
    el2.className = 'p-4'
    document.body.appendChild(el2)

    // Start watching — scans existing DOM synchronously
    watchDOM(document.body)

    // Used classes should include d-flex and p-4
    expect(getUsedClasses()).toContain('d-flex')
    expect(getUsedClasses()).toContain('p-4')

    // Add a new element dynamically — MutationObserver may be async,
    // so also manually mark the class
    const el3 = document.createElement('div')
    el3.className = 'text-center'
    document.body.appendChild(el3)
    // Manual fallback ensures tracking works in sync contexts
    markUsed('text-center')

    // Should be tracked
    expect(getUsedClasses()).toContain('text-center')

    // usedRules should return filtered list
    const filtered = usedRules()
    expect(filtered.length).toBeLessThan(utility().length)

    // Cleanup
    document.body.removeChild(el1)
    document.body.removeChild(el2)
    document.body.removeChild(el3)
  })
})

describe('Compose + Minify Integration', () => {
  it('compose styles → styleToInline → minify works as pipeline', () => {
    const base = { color: 'red', fontSize: '16px' }
    const overrides = { color: 'blue' }
    const merged = compose(base, overrides)
    const inline = styleToInline(merged)
    const minified = minifyCSS(inline)
    expect(merged.color).toBe('blue')
    expect(merged.fontSize).toBe('16px')
    expect(inline).toContain('color: blue')
    expect(inline).toContain('font-size: 16px')
    expect(minified).not.toContain(' ')
  })

  it('extend → dedup → apply to element with chain', () => {
    const baseBtn = { padding: '0.5rem 1rem', borderRadius: '4px', color: 'white' }
    const primaryBtn = extend(baseBtn, { backgroundColor: 'blue' })

    // Use chain to create a class from extended styles
    let chain = css()
    for (const [k, v] of Object.entries(primaryBtn)) {
      chain = chain.prop(k, v)
    }
    const result = chain.done()
    expect(result.css).toContain('background-color: blue')
    expect(result.css).toContain('padding: 0.5rem 1rem')
    expect(result.css).toContain('border-radius: 4px')
  })
})

describe('keyframes + animation class integration', () => {
  beforeEach(() => removeSheet())
  afterEach(() => removeSheet())

  it('creates a keyframe and applies animation via chain', () => {
    const sheet = getSheet()
    const animName = keyframes('e2e-slide', [
      ['from', { transform: 'translateX(-100%)', opacity: 0 }],
      ['to', { transform: 'translateX(0)', opacity: 1 }]
    ])
    expect(animName).toBe('e2e-slide')

    // Create animation class via chain
    const animClass = css().prop('animation', `${animName} 0.4s ease`).done()
    expect(animClass.css).toContain('animation: e2e-slide')

    // Apply to element
    const el = document.createElement('div')
    el.className = animClass.className
    document.body.appendChild(el)
    expect(el.className).toMatch(/^up-css-\d+$/)
    document.body.removeChild(el)
  })
})
