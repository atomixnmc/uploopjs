/**
 * Schema composition — extend, merge, pick, omit, partial, required, lazy.
 *
 * These operate on object schemas to produce new object schemas.
 *
 * @module @uploop/schema/compose
 */
import { object } from './structural.js'

/**
 * Extend an object schema with additional fields.
 * @param {Object} base — base object schema
 * @param {Object<string, Object>} additions — new field schemas
 * @returns {Object} new object schema
 */
export function extend(base, additions) {
  const shape = { ...(base._shape || {}), ...additions }
  return object(shape, base._opts || {})
}

/**
 * Merge multiple object schemas into one.
 * Later schemas override earlier for same-named fields.
 * @param {...Object} schemas
 * @returns {Object} new object schema
 */
export function merge(...schemas) {
  const shape = {}
  for (const s of schemas) {
    if (s._shape) Object.assign(shape, s._shape)
  }
  return object(shape)
}

/**
 * Pick a subset of fields from an object schema.
 * @param {Object} schema
 * @param {Array<string>} keys
 * @returns {Object} new object schema
 */
export function pick(schema, keys) {
  if (typeof schema.pick === 'function') return schema.pick(keys)
  const shape = {}
  const baseShape = schema._shape || {}
  for (const k of keys) {
    if (baseShape[k]) shape[k] = baseShape[k]
  }
  return object(shape, schema._opts || {})
}

/**
 * Omit fields from an object schema.
 * @param {Object} schema
 * @param {Array<string>} keys
 * @returns {Object} new object schema
 */
export function omit(schema, keys) {
  if (typeof schema.omit === 'function') return schema.omit(keys)
  const shape = {}
  const baseShape = schema._shape || {}
  for (const [k, v] of Object.entries(baseShape)) {
    if (!keys.includes(k)) shape[k] = v
  }
  return object(shape, schema._opts || {})
}

/**
 * Make all fields optional.
 * @param {Object} schema
 * @returns {Object} new object schema
 */
export function partial(schema) {
  if (typeof schema.partial === 'function') return schema.partial()
  const shape = {}
  const baseShape = schema._shape || {}
  for (const [k, v] of Object.entries(baseShape)) {
    shape[k] = typeof v.optional === 'function' ? v.optional() : v
  }
  return object(shape, schema._opts || {})
}

/**
 * Make all fields required (explicit no-op, already default).
 * @param {Object} schema
 * @returns {Object} new object schema
 */
export function required(schema) {
  if (typeof schema.required === 'function') return schema.required()
  return schema
}

/**
 * Lazy schema — defers evaluation until first use.
 * Used for recursive schemas.
 *
 * @param {Function} fn — () => Schema
 * @returns {Object} lazy schema that calls fn on first validate/describe
 */
export function lazy(fn) {
  let _cached = null

  function _resolve() {
    if (!_cached) _cached = fn()
    return _cached
  }

  return {
    kind: 'uploop.schema',
    name: 'lazy',
    type: 'lazy',

    validate(value) {
      return _resolve().validate(value)
    },

    safeParse(value) {
      return _resolve().safeParse(value)
    },

    assert(value) {
      return _resolve().assert(value)
    },

    coerce(value) {
      return _resolve().coerce(value)
    },

    optional() { return _resolve().optional() },
    nullable() { return _resolve().nullable() },
    withDefault(v) { return _resolve().withDefault(v) },
    transform(fn) { return _resolve().transform(fn) },
    pipe(other) { return _resolve().pipe(other) },

    describe() {
      return {
        kind: 'uploop.schema',
        name: 'lazy',
        type: 'lazy',
        resolvesTo: typeof _cached?.describe === 'function' ? _cached.describe() : '<unresolved>'
      }
    }
  }
}
