// ─── CSS Injection ────────────────────────────────────────────
// Sheet management: inject into DOM, create adopted stylesheets.

import { utility, utilityDefs } from './utility.js'

let _globalSheet = null

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
 * Inject utility CSS into the global stylesheet.
 *
 * @param {Object} [config]
 * @param {Object} [config.spacing] - Spacing scale override
 * @param {Object} [config.colors] - Color token override
 * @param {string[]} [config.groups] - Which utility groups to generate (default: all)
 * @param {boolean} [config.variants] - Whether to include hover/focus/responsive variants
 * @param {string[]} [config.variantList] - Specific variants to generate
 * @returns {{ sheet: CSSStyleSheet, count: number }}
 */
export function inject(config = {}) {
  const sheet = getSheet()
  if (!sheet) return { sheet: null, count: 0 }

  let rules = utility({
    groups: config.groups,
    tokens: { spacing: config.spacing, colors: config.colors }
  })

  // Inject rules
  let count = 0
  for (const rule of rules) {
    try { sheet.insertRule(`${rule.selector} { ${rule.css} }`, sheet.cssRules.length); count++ } catch (e) { /* dupe */ }
  }
  return { sheet, count }
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
