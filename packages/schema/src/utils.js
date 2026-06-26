/**
 * Schema utilities — isSchema, isEntity, diff, fromJSON, coerce helpers.
 * @module @uploop/schema/utils
 */
import { schema as createSchema, ok, failAt } from './core.js'

// ── Type Guards ────────────────────────────────────────────

export function isSchema(obj) {
  return obj && obj.kind === 'uploop.schema'
}

export function isEntity(obj) {
  return obj && obj.kind === 'uploop.entity'
}

export function isIntent(obj) {
  return obj && obj.kind === 'uploop.intent'
}

// ── diff() — Schema Structural Comparison ─────────────────

/**
 * Compare two entity schemas structurally.
 * Returns added, removed, changed fields.
 *
 * @param {Object} a — entity schema
 * @param {Object} b — entity schema
 * @returns {Object} { added, removed, changed, breaking }
 */
export function diff(a, b) {
  const descA = typeof a.describe === 'function' ? a.describe() : a
  const descB = typeof b.describe === 'function' ? b.describe() : b

  const added = []
  const removed = []
  const changed = []

  const fieldsA = descA.fields || {}
  const fieldsB = descB.fields || {}

  for (const [name, fb] of Object.entries(fieldsB)) {
    if (!fieldsA[name]) {
      added.push({ path: name, type: fb.type, optional: fb.optional || false })
    }
  }

  for (const [name, fa] of Object.entries(fieldsA)) {
    if (!fieldsB[name]) {
      const wasRequired = !fa.optional && !fa.nullable
      removed.push({ path: name, type: fa.type, wasRequired })
    } else {
      const fb = fieldsB[name]
      if (fa.type !== fb.type) {
        changed.push({ path: name, from: fa.type, to: fb.type, breaking: true })
      } else if ((fa.optional !== fb.optional)) {
        changed.push({ path: name, fromOptional: fa.optional, toOptional: fb.optional, breaking: !fa.optional && fb.optional === undefined })
      }
    }
  }

  const breaking = removed.some(r => r.wasRequired) || changed.some(c => c.breaking)

  return { added, removed, changed, breaking }
}

// ── coerce() — Type Coercion ───────────────────────────────

const COERCE_MAP = {
  string: (v) => String(v),
  number: (v) => { const n = Number(v); return isNaN(n) ? v : n },
  boolean: (v) => {
    if (typeof v === 'boolean') return v
    if (v === 'true' || v === '1' || v === 1) return true
    if (v === 'false' || v === '0' || v === 0) return false
    return v
  },
  integer: (v) => { const n = parseInt(v, 10); return isNaN(n) ? v : n },
  date: (v) => { const d = new Date(v); return isNaN(d.getTime()) ? v : d }
}

/**
 * Attempt to coerce a value to match a schema's type before validation.
 * Useful for form data, query params, etc.
 *
 * @param {Object} schema
 * @param {*} value
 * @returns {*} coerced value
 */
export function coerceValue(schema, value) {
  if (value === null || value === undefined) return value
  const desc = typeof schema.describe === 'function' ? schema.describe() : schema
  const type = desc.type || 'string'
  const coercer = COERCE_MAP[type]
  if (coercer) return coercer(value)
  return value
}

/**
 * Coerce an entire object against an entity schema.
 *
 * @param {Object} entitySchema
 * @param {Object} data
 * @returns {Object} coerced + validated result
 */
export function coerceEntity(entitySchema, data) {
  const desc = typeof entitySchema.describe === 'function' ? entitySchema.describe() : {}
  const fields = desc.fields || {}
  const result = { ...data }

  for (const [name, fieldDef] of Object.entries(fields)) {
    if (name in result) {
      const fieldSchema = entitySchema._shape?.[name]
      if (fieldSchema) {
        result[name] = coerceValue(fieldSchema, result[name])
      } else {
        // No field schema — use type from describe
        const coercer = COERCE_MAP[fieldDef.type]
        if (coercer) result[name] = coercer(result[name])
      }
    }
  }

  // Validate after coercion
  if (typeof entitySchema.validate === 'function') {
    return entitySchema.validate(result)
  }

  return { ok: true, value: result, errors: [] }
}

// ── fromJSON() — Hydrate Schema from Manifest ──────────────

/**
 * Reconstruct an executable schema from its describe() JSON output.
 * This is how the client hydrates server-sent schema manifests.
 *
 * Note: Functions (validate, transform, etc.) cannot be serialized,
 * so fromJSON produces a schema that uses the describe metadata for
 * type-checking. For full validation, use the original entity() definition.
 *
 * @param {Object} manifest — from entity.describe() or schema.describe()
 * @returns {Object} reconstructed schema object
 */
export function fromJSON(manifest) {
  if (!manifest) throw new Error('fromJSON requires a manifest object')

  if (manifest.kind === 'uploop.entity') {
    return entityFromJSON(manifest)
  }

  return schemaFromJSON(manifest)
}

function schemaFromJSON(manifest) {
  const { name = 'schema', type = 'any', meta = {} } = manifest

  function validate(value) {
    const vt = typeof value
    if (type === 'string' && vt !== 'string') return failAt('', `expected string, got ${vt}`, 'type')
    if (type === 'number' && vt !== 'number') return failAt('', `expected number, got ${vt}`, 'type')
    if (type === 'boolean' && vt !== 'boolean') return failAt('', `expected boolean, got ${vt}`, 'type')
    if (type === 'array' && !Array.isArray(value)) return failAt('', `expected array, got ${vt}`, 'type')
    return ok(value)
  }

  return createSchema(name, { type, validate, meta })
}

function entityFromJSON(manifest) {
  const { entity: entityName, fields = {}, meta: entityMeta = {} } = manifest

  function validate(value) {
    if (!value || typeof value !== 'object') return failAt('', 'expected object', 'type')
    const errors = []
    for (const [fn, fd] of Object.entries(fields)) {
      if (fd.computed) continue
      const fv = value[fn]
      if (fv === undefined) {
        if (!fd.optional && !fd.nullable) errors.push({ path: fn, message: 'required', code: 'required' })
        continue
      }
      // Basic type check
      const vt = typeof fv
      if (fd.type === 'string' && vt !== 'string') errors.push({ path: fn, message: `expected string, got ${vt}`, code: 'type' })
      else if (fd.type === 'number' && vt !== 'number') errors.push({ path: fn, message: `expected number, got ${vt}`, code: 'type' })
      else if (fd.type === 'boolean' && vt !== 'boolean') errors.push({ path: fn, message: `expected boolean, got ${vt}`, code: 'type' })
    }
    if (errors.length > 0) return { ok: false, value, errors }
    return ok(value)
  }

  return {
    kind: 'uploop.entity',
    entityName,
    _entityMeta: entityMeta,
    _shape: {},
    validate,
    safeParse(v) { return this.validate(v) },
    assert(v) { const r = this.validate(v); if (!r.ok) throw new Error(r.errors.map(e => e.message).join('; ')); return r.value },
    describe() { return manifest },
    coerce(data) { return this.validate(data) }
  }
}
