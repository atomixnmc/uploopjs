// ─── Color Calculation Utilities ──────────────────────────────
// Lighten, darken, shade generation, contrast detection.
// All functions are pure — no DOM, no side effects.

/**
 * Parse a hex color string into RGB components.
 * Accepts `#rgb`, `#rrggbb`, `#rrggbbaa` formats.
 *
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number, a?: number } | null}
 */
export function hexToRgb(hex) {
  hex = hex.replace(/^#/, '')
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  if (hex.length < 6) return null
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null
  const result = { r, g, b }
  if (hex.length >= 8) {
    result.a = Math.round((parseInt(hex.slice(6, 8), 16) / 255) * 100) / 100
  }
  return result
}

/**
 * Convert RGB components to a hex string.
 *
 * @param {number} r - Red (0–255)
 * @param {number} g - Green (0–255)
 * @param {number} b - Blue (0–255)
 * @returns {string} `#rrggbb`
 */
export function rgbToHex(r, g, b) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Lighten a hex color by a percentage.
 *
 * @param {string} hex - Input color
 * @param {number} amount - 0–100 (0 = no change, 100 = white)
 * @returns {string} Lightened hex color
 *
 * @example lighten('#646cff', 30) → '#b3b7ff'
 */
export function lighten(hex, amount) {
  return shade(hex, amount)
}

/**
 * Darken a hex color by a percentage.
 *
 * @param {string} hex - Input color
 * @param {number} amount - 0–100 (0 = no change, 100 = black)
 * @returns {string} Darkened hex color
 *
 * @example darken('#646cff', 30) → '#3a3fb2'
 */
export function darken(hex, amount) {
  return shade(hex, -amount)
}

/**
 * Shift a color lighter (positive amount) or darker (negative).
 *
 * @param {string} hex
 * @param {number} amount - -100 to 100
 * @returns {string}
 */
export function shade(hex, amount) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const p = amount / 100
  const r = rgb.r + (255 - rgb.r) * p
  const g = rgb.g + (255 - rgb.g) * p
  const b = rgb.b + (255 - rgb.b) * p
  return rgbToHex(r, g, b)
}

// ─── Internal memoization ─────────────────────────────────────

const _shadeCache = new Map()
const _mapCache = new Map()

function memoKey(hex, count) { return `${hex}:${count}` }

/**
 * Generate a range of shades from light to dark around a base color.
 * Results are memoized by (hex, count).
 *
 * @param {string} hex - Base color
 * @param {number} [count=9] - Number of shades
 * @returns {string[]}
 */
export function shades(hex, count = 9) {
  const key = memoKey(hex, count)
  if (_shadeCache.has(key)) return _shadeCache.get(key)
  const result = []
  const half = Math.floor(count / 2)
  for (let i = 0; i < count; i++) {
    const amount = ((i - half) / half) * 50
    result.push(shade(hex, amount))
  }
  _shadeCache.set(key, result)
  return result
}

/**
 * Generate named shade variants like Tailwind's `red-100`..`red-900`.
 *
 * @param {string} hex - Base color
 * @param {number} [count=10] - Number of variants
 * @returns {Object<string, string>} `{ '100': '#...', '200': '#...', ... }`
 *
 * @example shadeMap('#646cff') → { '50':'#eeeefd', '100':'#d4d6ff', ..., '900':'#191c5e' }
 */
export function shadeMap(hex, count = 10) {
  const key = memoKey(hex, count)
  if (_mapCache.has(key)) return _mapCache.get(key)
  const map = {}
  const list = shades(hex, count)
  for (let i = 0; i < list.length; i++) {
    const k = i === 0 ? '50' : String(i * 100)
    map[k] = list[i]
  }
  _mapCache.set(key, map)
  return map
}

/**
 * Add alpha transparency to a hex color.
 *
 * @param {string} hex
 * @param {number} opacity - 0–1
 * @returns {string} rgba() string
 *
 * @example alpha('#646cff', 0.5) → 'rgba(100, 108, 255, 0.5)'
 */
export function alpha(hex, opacity) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, opacity))})`
}

/**
 * Determine whether black or white text has better contrast
 * on a given background color (WCAG luminance calculation).
 *
 * @param {string} hex - Background color
 * @returns {'#000'|'#fff'} Black or white
 *
 * @example contrast('#646cff') → '#fff'  (white text on purple)
 * @example contrast('#ffc107') → '#000'  (black text on yellow)
 */
export function contrast(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#000'
  // Relative luminance (sRGB)
  const toLinear = (c) => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const l = 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b)
  return l > 0.179 ? '#000' : '#fff'
}

/**
 * Generate CSS custom property shade map for a color name.
 * Produces `--color-primary-50`, `--color-primary-100`, ..., `--color-primary-900`.
 *
 * @param {string} name - Color name (e.g. 'primary')
 * @param {string} hex - Base color
 * @param {number} [count=10]
 * @returns {Object<string, string>}
 */
export function colorShadeVars(name, hex, count = 10) {
  const vars = {}
  const map = shadeMap(hex, count)
  vars[`--color-${name}`] = hex
  for (const [key, val] of Object.entries(map)) {
    vars[`--color-${name}-${key}`] = val
  }
  return vars
}

/**
 * Build shade CSS variable objects for every color in a theme's color map.
 *
 * @param {Object<string, string>} colorMap - { primary: '#646cff', ... }
 * @param {number} [count=10]
 * @returns {Object<string, string>} Flat CSS variable map
 */
export function themeShadeVars(colorMap, count = 10) {
  const vars = {}
  for (const [name, hex] of Object.entries(colorMap)) {
    if (hex === 'transparent') continue
    Object.assign(vars, colorShadeVars(name, hex, count))
  }
  return vars
}
