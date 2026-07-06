// ─── Style Object Composition ─────────────────────────────────
// Pure functions for composing, extending, and transforming
// CSS style objects. No DOM, no side effects.

import { camelToKebab } from './dynamic.js'

/**
 * Merge multiple style objects into one (rightmost wins).
 * Returns a new object — does not mutate inputs.
 *
 * @param {...Object} styles
 * @returns {Object}
 *
 * @example
 * const base = { color: 'red', fontSize: '1rem' }
 * const over = { color: 'blue' }
 * compose(base, over) // → { color: 'blue', fontSize: '1rem' }
 */
export function compose(...styles) {
  return Object.assign({}, ...styles)
}

/**
 * Immutable extend — wraps compose for readability.
 *
 * @param {Object} base
 * @param {Object} overrides
 * @returns {Object}
 *
 * @example
 * const btn = { padding: '0.5rem 1rem', color: 'white' }
 * const largeBtn = extend(btn, { padding: '1rem 2rem' })
 */
export function extend(base, overrides) {
  return Object.assign({}, base, overrides)
}

/**
 * Clone a style object (shallow copy).
 *
 * @param {Object} obj
 * @returns {Object}
 */
export function clone(obj) {
  return Object.assign({}, obj)
}

/**
 * Pick a subset of properties from a style object.
 *
 * @param {Object} obj
 * @param {...string} keys - Property names to keep
 * @returns {Object}
 *
 * @example
 * pick({ color: 'red', bg: 'blue', px: 4 }, 'color', 'px')
 * // → { color: 'red', px: 4 }
 */
export function pick(obj, ...keys) {
  const result = {}
  for (const key of keys) {
    if (key in obj) result[key] = obj[key]
  }
  return result
}

/**
 * Omit properties from a style object.
 *
 * @param {Object} obj
 * @param {...string} keys - Property names to remove
 * @returns {Object}
 *
 * @example
 * omit({ color: 'red', bg: 'blue', px: 4 }, 'bg')
 * // → { color: 'red', px: 4 }
 */
export function omit(obj, ...keys) {
  const result = Object.assign({}, obj)
  for (const key of keys) {
    delete result[key]
  }
  return result
}

/**
 * Convert a JS style object to an HTML inline style string.
 *
 * @param {Object} obj - Style object with camelCase or kebab-case keys
 * @returns {string}
 *
 * @example
 * styleToInline({ color: 'red', fontSize: '1rem' })
 * // → "color: red; font-size: 1rem"
 */
export function styleToInline(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join('; ')
}

/**
 * Deep-merge two style objects (nested objects are merged recursively).
 *
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
 */
export function deepMerge(target, source) {
  const result = Object.assign({}, target)
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value) &&
        result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], value)
    } else {
      result[key] = value
    }
  }
  return result
}
