// ─── Variant Engine ───────────────────────────────────────────
// Pseudo-class, responsive, and dark mode variant generation.

import { breakpoints } from './tokens.js'
import { utility } from './utility.js'

/**
 * Registered variant generators.
 * Each is a function: (selector, css) => string
 *
 * The framework calls these to wrap a base rule with
 * a pseudo-class or media query.
 */
export const variants = {}

/**
 * Register a custom variant generator.
 *
 * @param {string} name - Variant name (used in prefix: hover:bg-red)
 * @param {(selector: string, css: string) => string} fn - Generator
 *
 * @example
 * registerVariant('hover', (sel, css) => `${sel}:hover { ${css} }`)
 */
export function registerVariant(name, fn) {
  variants[name] = fn
}

// ─── Built-in Variants ────────────────────────────────────────

registerVariant('hover', (sel, css) => `${sel}:hover { ${css} }`)
registerVariant('focus', (sel, css) => `${sel}:focus { ${css} }`)
registerVariant('focus-visible', (sel, css) => `${sel}:focus-visible { ${css} }`)
registerVariant('active', (sel, css) => `${sel}:active { ${css} }`)
registerVariant('disabled', (sel, css) => `${sel}[disabled] { ${css} }`)

// Dark mode (prefers-color-scheme)
registerVariant('dark', (sel, css) => `@media (prefers-color-scheme: dark) { ${sel} { ${css} } }`)

// Responsive variants from breakpoints
for (const [bp, px] of Object.entries(breakpoints)) {
  if (bp === 'z') continue
  registerVariant(bp, (sel, css) => `@media (min-width: ${px}px) { ${sel} { ${css} } }`)
}

/**
 * Apply variants to a set of utility rules.
 *
 * @param {Object} opts
 * @param {string[]} opts.apply - Variant names to apply (e.g. ['hover', 'md'])
 * @param {string[]} [opts.groups] - Utility groups to generate
 * @param {Object} [opts.tokens] - Token overrides
 * @returns {{ selector: string, css: string }[]}
 *
 * @example
 * // Generate hover variants for color utilities
 * variant({ apply: ['hover'], groups: ['colors'] })
 * // → [{ selector: '.hover\\:text-primary:hover', css: 'color: #646cff' }, ...]
 */
export function variant(opts = {}) {
  const apply = opts.apply || []
  const baseRules = utility({ groups: opts.groups, tokens: opts.tokens })
  const result = []

  for (const rule of baseRules) {
    // Add base rule as-is
    result.push(rule)

    for (const vName of apply) {
      const gen = variants[vName]
      if (!gen) continue
      // Escape selector for use in variant (colon in class name)
      const safeName = vName.replace(/[^a-z0-9-]/g, '')
      const variantSel = rule.selector.replace(/^\./, `.${safeName}\\:`)
      const variantRule = gen(variantSel, rule.css)
      // Parse the generator output back into { selector, css }
      const parsed = parseVariantRule(variantRule)
      if (parsed) result.push(parsed)
    }
  }
  return result
}

/**
 * Check if a variant by the given name exists.
 * @param {string} name
 * @returns {boolean}
 */
export function hasVariant(name) {
  return name in variants
}

/**
 * Get list of all registered variant names.
 * @returns {string[]}
 */
export function variantNames() {
  return Object.keys(variants)
}

// ─── Internal ─────────────────────────────────────────────────

/** Parse a generated variant string back into structured rule. */
function parseVariantRule(ruleStr) {
  // Media query: @media (query) { selector { css } }
  if (ruleStr.startsWith('@media')) {
    const outerOpen = ruleStr.indexOf('{')
    const outerClose = ruleStr.lastIndexOf('}')
    if (outerOpen === -1 || outerClose === -1) return null
    // Inner content: selector { css }
    const inner = ruleStr.slice(outerOpen + 1, outerClose).trim()
    const innerOpen = inner.indexOf('{')
    const innerClose = inner.lastIndexOf('}')
    if (innerOpen === -1 || innerClose === -1) return null
    const selector = inner.slice(0, innerOpen).trim()
    const css = inner.slice(innerOpen + 1, innerClose).trim()
    return { selector, css }
  }
  // Simple: selector:pseudo { css }
  const m2 = ruleStr.match(/^([^{]+)\{([^}]+)\}$/)
  if (m2) {
    return { selector: m2[1].trim(), css: m2[2].trim() }
  }
  return null
}
