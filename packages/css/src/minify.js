// ─── CSS Minification & Optimization ──────────────────────────
// Pure functions for CSS text optimization. No DOM, no side effects.

/**
 * Minify a CSS string by removing unnecessary whitespace.
 *
 * @param {string} css - Raw CSS text
 * @returns {string}
 *
 * @example
 * minifyCSS("color: red ; font-size: 1rem")
 * // → "color:red;font-size:1rem"
 */
export function minifyCSS(css) {
  return css
    .replace(/\s*:\s*/g, ':')
    .replace(/\s*;\s*/g, ';')
    .replace(/\s*\{\s*/g, '{')
    .replace(/\s*\}\s*/g, '}')
    .replace(/\s*,\s*/g, ',')
    .replace(/;\}/g, '}')
    .replace(/^\s+|\s+$/g, '')
}

/**
 * Remove duplicate CSS declarations (last value wins).
 *
 * @param {string} css - Semi-colon separated declarations
 * @returns {string}
 *
 * @example
 * dedupDeclarations("color: red; color: blue")
 * // → "color: blue"
 */
export function dedupDeclarations(css) {
  const decls = css.split(';').map(d => d.trim()).filter(Boolean)
  const seen = new Map()
  for (const decl of decls) {
    const colon = decl.indexOf(':')
    if (colon === -1) continue
    const prop = decl.slice(0, colon).trim()
    seen.set(prop, decl.slice(colon + 1).trim())
  }
  return [...seen.entries()].map(([p, v]) => `${p}: ${v}`).join('; ')
}

/**
 * Normalize pixel values to rem based on a base font size.
 *
 * @param {string} css - CSS declarations
 * @param {number} [basePx=16] - Base font size in px
 * @returns {string}
 *
 * @example
 * normalizeUnits("padding: 16px; font-size: 32px")
 * // → "padding: 1rem; font-size: 2rem"
 */
export function normalizeUnits(css, basePx = 16) {
  return css.replace(/(\d+(?:\.\d+)?)\s*px/g, (_, val) => {
    const rem = parseFloat(val) / basePx
    return rem === Math.floor(rem) ? `${rem}rem` : `${rem.toFixed(4)}rem`
  })
}

/**
 * Vendor-prefix known CSS properties that need prefixes.
 * Currently prefixes: transform, appearance, user-select, backdrop-filter.
 *
 * @param {string} prop - CSS property name
 * @returns {string[]} - Property names including prefix variants
 *
 * @example
 * prefixProp('transform') // → ['-webkit-transform', 'transform']
 */
export function prefixProp(prop) {
  const needsPrefix = {
    transform: true,
    appearance: true,
    'user-select': true,
    'backdrop-filter': true,
  }
  if (needsPrefix[prop]) {
    return [`-webkit-${prop}`, prop]
  }
  return [prop]
}

/**
 * Vendor-prefix declarations in a CSS string.
 *
 * @param {string} css - CSS declarations
 * @returns {string}
 *
 * @example
 * prefixCSS("transform: rotate(90deg)")
 * // → "-webkit-transform: rotate(90deg); transform: rotate(90deg)"
 */
export function prefixCSS(css) {
  return css.split(';').map(decl => {
    decl = decl.trim()
    if (!decl) return ''
    const colon = decl.indexOf(':')
    if (colon === -1) return decl
    const prop = decl.slice(0, colon).trim()
    const val = decl.slice(colon + 1).trim()
    const prefixed = prefixProp(prop)
    return prefixed.map(p => `${p}: ${val}`).join('; ')
  }).join('; ')
}
