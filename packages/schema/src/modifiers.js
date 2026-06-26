/**
 * Modifiers — optional, nullable, withDefault, transform, pipe.
 *
 * These are convenience exports that call the chainable methods
 * on schema instances. They can be used as:
 *
 *   optional(string())      → same as string().optional()
 *   withDefault(string(), '') → same as string().withDefault('')
 *
 * @module @uploop/schema/modifiers
 */

/**
 * Make a schema optional (accept undefined).
 * @param {Object} schema
 * @returns {Object}
 */
export function optional(schema) {
  if (typeof schema.optional !== 'function') {
    throw new Error('Schema does not support optional()')
  }
  return schema.optional()
}

/**
 * Make a schema nullable (accept null).
 * @param {Object} schema
 * @returns {Object}
 */
export function nullable(schema) {
  if (typeof schema.nullable !== 'function') {
    throw new Error('Schema does not support nullable()')
  }
  return schema.nullable()
}

/**
 * Set a default value for a schema.
 * @param {Object} schema
 * @param {*} value — default value or factory function
 * @returns {Object}
 */
export function withDefault(schema, value) {
  if (typeof schema.withDefault !== 'function') {
    throw new Error('Schema does not support withDefault()')
  }
  return schema.withDefault(value)
}

/**
 * Attach a transform function to a schema.
 * Transform runs BEFORE validation.
 * @param {Object} schema
 * @param {Function} fn — (value) => transformedValue
 * @returns {Object}
 */
export function transform(schema, fn) {
  if (typeof schema.transform !== 'function') {
    throw new Error('Schema does not support transform()')
  }
  return schema.transform(fn)
}

/**
 * Pipe a value through multiple schemas left-to-right.
 * Each schema validates/transforms in order.
 * @param {...Object} schemas
 * @returns {Object}
 */
export function pipe(...schemas) {
  if (schemas.length === 0) throw new Error('pipe() requires at least one schema')
  let result = schemas[0]
  for (let i = 1; i < schemas.length; i++) {
    result = result.pipe(schemas[i])
  }
  return result
}
