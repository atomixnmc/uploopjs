// ─── Utility Generator ────────────────────────────────────────
// Composable utility class definitions and generation.

import {
  spacing as defaultSpacing,
  spacingTiny,
  colors as defaultColors,
  fontSize as defaultFontSize,
  fontWeight,
  breakpoints,
  relativeScales
} from './tokens.js'

/**
 * Utility definition registry.
 *
 * Each entry is a factory function `(tokens) => Rule[]`
 * where a Rule is `{ selector: string, css: string }`.
 *
 * This design allows lazy evaluation with different token sets
 * and makes it easy to add/remove utility groups.
 */
export const utilityDefs = {

  // ── Spacing ──────────────────────────────────────────────

  spacing: (tokens) => {
    const rules = []
    const sp = tokens.spacing || defaultSpacing
    for (const [key, val] of Object.entries(sp)) {
      const rem = `${val}rem`
      for (const p of ['m', 'mt', 'mr', 'mb', 'ml', 'mx', 'my']) {
        rules.push({ selector: `.${p}-${key}`, css: cssForPrefix(p, rem) })
      }
      for (const p of ['p', 'pt', 'pr', 'pb', 'pl', 'px', 'py']) {
        rules.push({ selector: `.${p}-${key}`, css: cssForPrefix(p, rem) })
      }
      rules.push({ selector: `.gap-${key}`, css: `gap: ${rem}` })
      rules.push({ selector: `.rounded-${key}`, css: `border-radius: ${rem}` })
    }
    return rules
  },

  // ── Colors ───────────────────────────────────────────────

  colors: (tokens) => {
    const rules = []
    const cl = tokens.colors || defaultColors
    for (const [name, hex] of Object.entries(cl)) {
      rules.push({ selector: `.text-${name}`, css: `color: ${hex}` })
      rules.push({ selector: `.bg-${name}`, css: `background-color: ${hex}` })
      rules.push({ selector: `.border-${name}`, css: `border-color: ${hex}` })
    }
    return rules
  },

  // ── Display ──────────────────────────────────────────────

  display: () => {
    const rules = []
    for (const v of ['block', 'inline-block', 'inline', 'flex', 'grid', 'none', 'contents']) {
      rules.push({ selector: `.d-${v}`, css: `display: ${v}` })
    }
    return rules
  },

  // ── Flex ─────────────────────────────────────────────────

  flex: () => {
    const rules = []
    for (const v of ['row', 'column', 'row-reverse', 'column-reverse']) {
      rules.push({ selector: `.flex-${v}`, css: `flex-direction: ${v}` })
    }
    for (const v of ['start', 'end', 'center', 'between', 'around', 'evenly']) {
      rules.push({ selector: `.justify-${v}`, css: `justify-content: ${mapFlex(v)}` })
      rules.push({ selector: `.items-${v}`, css: `align-items: ${mapFlex(v)}` })
    }
    for (const v of ['nowrap', 'wrap', 'wrap-reverse']) {
      rules.push({ selector: `.flex-wrap-${v}`, css: `flex-wrap: ${v}` })
    }
    return rules
  },

  // ── Grid ─────────────────────────────────────────────────

  grid: () => {
    const rules = []
    for (let i = 1; i <= 12; i++) {
      rules.push({ selector: `.grid-cols-${i}`, css: `grid-template-columns: repeat(${i}, 1fr)` })
    }
    return rules
  },

  // ── Sizing ───────────────────────────────────────────────

  sizing: (tokens) => {
    const rules = []
    const sp = tokens.spacing || defaultSpacing
    for (const [key, val] of Object.entries(sp)) {
      const rem = `${val}rem`
      for (const p of ['w', 'h', 'min-w', 'min-h', 'max-w', 'max-h']) {
        const prop = p.replace('-', '-')  // min-w → min-width, etc. handled at CSS level
        rules.push({ selector: `.${p}-${key}`, css: `${cssProp(p)}: ${rem}` })
      }
    }
    return rules
  },

  // ── Typography ───────────────────────────────────────────

  typography: (tokens) => {
    const rules = []
    const fs = tokens.fontSize || defaultFontSize

    // Text align
    for (const v of ['left', 'center', 'right', 'justify']) {
      rules.push({ selector: `.text-${v}`, css: `text-align: ${v}` })
    }
    // Text transform
    for (const v of ['uppercase', 'lowercase', 'capitalize', 'none']) {
      rules.push({ selector: `.text-${v}`, css: `text-transform: ${v}` })
    }
    // Font weight
    for (const [name, val] of Object.entries(fontWeight)) {
      rules.push({ selector: `.font-${name}`, css: `font-weight: ${val}` })
    }
    // Font size (rem-based)
    for (const [key, val] of Object.entries(fs)) {
      rules.push({ selector: `.text-${key}`, css: `font-size: ${val}rem` })
    }
    // Line height
    for (const [key, val] of Object.entries(fs)) {
      rules.push({ selector: `.leading-${key}`, css: `line-height: ${val}rem` })
    }
    // Letter spacing
    for (const [key, val] of Object.entries(spacingTiny)) {
      rules.push({ selector: `.tracking-${key}`, css: `letter-spacing: ${val}rem` })
    }
    // Font family shortcuts
    rules.push({ selector: '.font-sans', css: 'font-family: sans-serif' })
    rules.push({ selector: '.font-serif', css: 'font-family: serif' })
    rules.push({ selector: '.font-mono', css: 'font-family: monospace' })

    return rules
  },

  // ── Borders ──────────────────────────────────────────────

  borders: (tokens) => {
    const rules = []
    const sp = tokens.spacing || defaultSpacing
    // Border style
    for (const v of ['solid', 'dashed', 'dotted', 'double', 'none']) {
      rules.push({ selector: `.border-${v}`, css: `border-style: ${v}` })
    }
    // Border width
    for (const [key, val] of Object.entries(sp)) {
      rules.push({ selector: `.border-${key}`, css: `border-width: ${val}rem` })
    }
    return rules
  },

  // ── Shadows ──────────────────────────────────────────────

  shadows: (tokens) => {
    const rules = []
    const sp = tokens.spacing || defaultSpacing
    for (const [key, val] of Object.entries(sp)) {
      rules.push({ selector: `.shadow-${key}`, css: `box-shadow: 0 ${val * 0.25}rem ${val * 0.5}rem rgba(0,0,0,0.15)` })
    }
    return rules
  },

  // ── Position ─────────────────────────────────────────────

  position: () => {
    const rules = []
    for (const v of ['static', 'relative', 'absolute', 'fixed', 'sticky']) {
      rules.push({ selector: `.pos-${v}`, css: `position: ${v}` })
    }
    return rules
  },

  // ── Overflow ─────────────────────────────────────────────

  overflow: () => {
    const rules = []
    for (const v of ['hidden', 'auto', 'scroll', 'visible']) {
      rules.push({ selector: `.overflow-${v}`, css: `overflow: ${v}` })
    }
    return rules
  },

  // ── Cursor ───────────────────────────────────────────────

  cursor: () => {
    const rules = []
    for (const v of ['pointer', 'grab', 'move', 'not-allowed', 'wait', 'help']) {
      rules.push({ selector: `.cursor-${v}`, css: `cursor: ${v}` })
    }
    return rules
  },

  // ── Background ───────────────────────────────────────────

  background: () => {
    const rules = []
    for (const v of ['left', 'center', 'right']) {
      rules.push({ selector: `.bg-pos-${v}`, css: `background-position: ${v}` })
    }
    for (const v of ['auto', 'cover', 'contain']) {
      rules.push({ selector: `.bg-size-${v}`, css: `background-size: ${v}` })
    }
    for (const v of ['no-repeat', 'repeat', 'repeat-x', 'repeat-y']) {
      rules.push({ selector: `.bg-repeat-${v}`, css: `background-repeat: ${v}` })
    }
    return rules
  }
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Generate utility rules from selected groups.
 *
 * @param {Object} [opts]
 * @param {string[]} [opts.groups] - Which utility groups to include. Default: all.
 * @param {Object} [opts.tokens] - Token overrides (colors, spacing, fontSize)
 * @returns {{ selector: string, css: string }[]}
 */
export function utility(opts = {}) {
  const groups = opts.groups || Object.keys(utilityDefs)
  const tokens = opts.tokens || {}
  const rules = []
  for (const name of groups) {
    const def = utilityDefs[name]
    if (def) rules.push(...def(tokens))
  }
  return rules
}

/**
 * Generate all utilities (convenience alias).
 * @param {Object} [tokens] - Token overrides
 * @returns {{ selector: string, css: string }[]}
 */
export function generateUtilities(tokens) {
  return utility({ tokens })
}

// ─── Mapping Helpers ──────────────────────────────────────────

/** Map shorthand flex values to CSS keywords. */
function mapFlex(v) {
  const m = { start: 'flex-start', end: 'flex-end', between: 'space-between', around: 'space-around', evenly: 'space-evenly' }
  return m[v] || v
}

/** Convert shorthand prefix to CSS property name. */
function cssProp(prefix) {
  const m = {
    w: 'width', h: 'height',
    'min-w': 'min-width', 'min-h': 'min-height',
    'max-w': 'max-width', 'max-h': 'max-height'
  }
  return m[prefix] || prefix
}

/** Convert shorthand prefix to CSS property+value declarations. */
function cssForPrefix(prefix, value) {
  const map = {
    m: 'margin', mt: 'margin-top', mr: 'margin-right', mb: 'margin-bottom', ml: 'margin-left',
    mx: 'margin-left; margin-right', my: 'margin-top; margin-bottom',
    p: 'padding', pt: 'padding-top', pr: 'padding-right', pb: 'padding-bottom', pl: 'padding-left',
    px: 'padding-left; padding-right', py: 'padding-top; padding-bottom'
  }
  const props = (map[prefix] || prefix).split('; ')
  return props.map(p => `${p}: ${value}`).join('; ')
}
