// ─── Batch Style Creation ─────────────────────────────────────
// Create multiple classes at once, define keyframes, at-rules.
// Builds on top of the chain.js and dynamic.js primitives.

import { getSheet } from './inject.js'
import { camelToKebab } from './dynamic.js'

let _uid = 0
function uid() { return ++_uid }

/**
 * Create multiple CSS classes at once from a map of style objects.
 *
 * @param {Object<string, Object>} styles - Map of selector => style object
 * @param {CSSStyleSheet} [sheet] - Target sheet (default: global)
 * @returns {Object<string, { className: string, css: string }>}
 *
 * @example
 * const { btn, icon } = batch({
 *   btn:  { bg: 'blue', color: 'white', px: 4, py: 2 },
 *   icon: { w: 1, h: 1, fill: 'currentColor' },
 * })
 * element.className = btn.className
 */
export function batch(styles, sheet) {
  sheet = sheet || (typeof document !== 'undefined' ? getSheet() : null)
  const results = {}
  for (const [name, styleObj] of Object.entries(styles)) {
    const className = `up-batch-${name}-${uid()}`
    const css = Object.entries(styleObj)
      .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
      .join('; ')
    if (sheet) {
      try { sheet.insertRule(`.${className} { ${css} }`) } catch (e) { /* skip */ }
    }
    results[name] = { className, css }
  }
  return results
}

/**
 * Keyframe step descriptor.
 * @typedef {[string, Object<string, string>]} KeyframeStep
 *   e.g. ['from', { transform: 'scale(0)', opacity: 0 }]
 *   or   ['50%', { transform: 'scale(0.5)' }]
 */

/**
 * Create a @keyframes animation and return the animation name.
 *
 * @param {string} name - Animation name (used as class/animation-name)
 * @param {KeyframeStep[]} steps - Array of [keyframe, style] pairs
 * @param {CSSStyleSheet} [sheet] - Target sheet
 * @returns {string} Animation name
 *
 * @example
 * keyframes('slide-in', [
 *   ['from', { transform: 'translateX(-100%)', opacity: 0 }],
 *   ['to',   { transform: 'translateX(0)', opacity: 1 }],
 * ])
 * // Injects @keyframes slide-in { from { ... } to { ... } }
 * // Returns 'slide-in'
 */
export function keyframes(name, steps, sheet) {
  if (typeof document === 'undefined' && !sheet) return name
  sheet = sheet || (typeof document !== 'undefined' ? getSheet() : null)
  if (!sheet) return name

  const blocks = steps.map(([key, style]) => {
    const decls = Object.entries(style)
      .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
      .join('; ')
    return `${key} { ${decls} }`
  }).join('\n')

  try {
    sheet.insertRule(`@keyframes ${name} { ${blocks} }`, sheet.cssRules.length)
  } catch (e) { /* skip */ }

  return name
}

/**
 * Create a CSS @media rule with nested style objects.
 *
 * @param {string} query - Media query string (e.g. '(min-width: 768px)')
 * @param {Object} styles - Map of selector => style object
 * @param {CSSStyleSheet} [sheet] - Target sheet
 * @returns {boolean} Whether the rule was successfully inserted
 *
 * @example
 * atMedia('(min-width: 768px)', {
 *   '.container': { width: '50%' },
 * })
 */
export function atMedia(query, styles, sheet) {
  if (!sheet && typeof document === 'undefined') return false
  if (!sheet) sheet = sheet === undefined ? getSheet() : null
  if (!sheet) return false

  const blocks = Object.entries(styles).map(([sel, style]) => {
    const decls = Object.entries(style)
      .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
      .join('; ')
    return `${sel} { ${decls} }`
  }).join('\n')

  try {
    sheet.insertRule(`@media ${query} { ${blocks} }`, sheet.cssRules.length)
    return true
  } catch (e) {
    return false
  }
}
