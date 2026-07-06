// ─── CSS Injection ────────────────────────────────────────────
// Sheet management: inject into DOM, adopt stylesheets, dedup registry.

import { utility, utilityDefs } from './utility.js'

let _globalSheet = null

/**
 * Registry of already-injected rule selectors (dedup).
 * Key: `selector { css }` string → boolean
 * @type {Set<string>}
 */
const _injectedRules = new Set()

/**
 * Get or create the global Uploop stylesheet.
 * @returns {CSSStyleSheet|null}
 */
export function getSheet() {
  if (_globalSheet) return _globalSheet
  if (typeof document === 'undefined') return null
  const style = document.createElement('style')
  style.setAttribute('data-uploop', 'utilities')
  document.head.appendChild(style)
  _globalSheet = style.sheet
  return _globalSheet
}

/**
 * Low-level insert with dedup. Returns true if rule was inserted.
 * @param {CSSStyleSheet} sheet
 * @param {string} rule - e.g. ".m-4 { margin: 4rem }"
 * @returns {boolean}
 */
export function insertOnce(sheet, rule) {
  if (_injectedRules.has(rule)) return false
  _injectedRules.add(rule)
  try {
    sheet.insertRule(rule, sheet.cssRules.length)
    return true
  } catch (e) {
    return false
  }
}

/**
 * Inject utility CSS into the global stylesheet (with dedup).
 *
 * @param {Object} [config]
 * @param {Object} [config.spacing] - Spacing scale override
 * @param {Object} [config.colors] - Color token override
 * @param {string[]} [config.groups] - Which utility groups to generate (default: all)
 * @param {boolean} [config.variants] - Whether to include hover/focus/responsive variants
 * @param {string[]} [config.variantList] - Specific variants to generate
 * @param {boolean} [config.force] - Skip dedup and force re-injection
 * @returns {{ sheet: CSSStyleSheet, count: number, skipped: number }}
 */
export function inject(config = {}) {
  const sheet = getSheet()
  if (!sheet) return { sheet: null, count: 0, skipped: 0 }

  let rules = utility({
    groups: config.groups,
    tokens: { spacing: config.spacing, colors: config.colors }
  })

  // Inject rules with dedup
  let count = 0
  let skipped = 0
  for (const rule of rules) {
    const ruleStr = `${rule.selector} { ${rule.css} }`
    if (!config.force && _injectedRules.has(ruleStr)) {
      skipped++
      continue
    }
    _injectedRules.add(ruleStr)
    try {
      sheet.insertRule(ruleStr, sheet.cssRules.length)
      count++
    } catch (e) { /* syntax error */ }
  }
  return { sheet, count, skipped }
}

/**
 * Injected only base CSS variables without utility rules (lazy mode).
 * @param {Object} [config]
 * @returns {{ sheet: CSSStyleSheet, count: number }}
 */
export function injectBase(config = {}) {
  const sheet = getSheet()
  if (!sheet) return { sheet: null, count: 0 }

  // Inject only a small set of CSS variable rules
  const baseCSS = `
    :root {
      --up-font-sans: sans-serif;
      --up-font-serif: serif;
      --up-font-mono: monospace;
    }
  `
  try {
    sheet.insertRule(':root { --up-font-sans: sans-serif; --up-font-serif: serif; --up-font-mono: monospace; }')
    return { sheet, count: 1 }
  } catch (e) {
    return { sheet, count: 0 }
  }
}

/**
 * Clear the injected rules registry.
 * Useful when tokens change and rules need re-injection.
 */
export function clearRuleRegistry() {
  _injectedRules.clear()
}

/**
 * Remove the global Uploop stylesheet from the DOM.
 */
export function removeSheet() {
  if (!_globalSheet) return
  const style = _globalSheet.ownerNode
  if (style && style.parentNode) {
    style.parentNode.removeChild(style)
  }
  _globalSheet = null
  _injectedRules.clear()
}

/**
 * Create a CSSStyleSheet for Shadow DOM adoption.
 *
 * @param {Object} [config]
 * @param {Object} [config.spacing]
 * @param {Object} [config.colors]
 * @param {string[]} [config.groups]
 * @returns {CSSStyleSheet|null}
 */
export function createAdoptedSheet(config = {}) {
  if (typeof CSSStyleSheet === 'undefined') return null
  const sheet = new CSSStyleSheet()
  const rules = utility({
    groups: config.groups,
    tokens: { spacing: config.spacing, colors: config.colors }
  })
  for (const rule of rules) {
    try { sheet.insertRule(`${rule.selector} { ${rule.css} }`) } catch (e) { /* skip dupes */ }
  }
  return sheet
}
