/**
 * Structural schemas — object, array, tuple, record.
 *
 * These compose primitive schemas into compound data shapes.
 * Chainable methods use `this` to support method chaining.
 *
 * @module @uploop/schema/structural
 */
import { schema, ok, failAt, wrapSchema } from './core.js'

// ── Object ──────────────────────────────────────────────────

export function object(shape = {}, opts = {}) {
  const { strict = false, passthrough = !strict } = opts

  function validate(value) {
    if (value === null || value === undefined) {
      return failAt('', 'must be an object', 'type.object')
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      return failAt('', 'must be a plain object', 'type.object')
    }

    const result = {}
    const allErrors = []
    const shapeKeys = Object.keys(shape)

    for (const key of shapeKeys) {
      const fieldSchema = shape[key]
      const fieldValue = value[key]

      if (fieldValue === undefined) {
        // Only `optional` allows the field to be missing.
        // `nullable` allows null but still requires the key to be present.
        const desc = typeof fieldSchema.describe === 'function' ? fieldSchema.describe() : {}
        if (desc.optional) continue
        allErrors.push({ path: key, message: 'required', code: 'required' })
        continue
      }

      const fieldResult = typeof fieldSchema.validate === 'function'
        ? fieldSchema.validate(fieldValue)
        : ok(fieldValue)

      if (fieldResult.ok) {
        result[key] = fieldResult.value
      } else {
        for (const err of (fieldResult.errors || [])) {
          allErrors.push({
            path: key + (err.path ? '.' + err.path : ''),
            message: err.message,
            code: err.code
          })
        }
      }
    }

    if (passthrough) {
      for (const key of Object.keys(value)) {
        if (!shapeKeys.includes(key) && !(key in result)) {
          result[key] = value[key]
        }
      }
    } else if (strict) {
      for (const key of Object.keys(value)) {
        if (!shapeKeys.includes(key)) {
          allErrors.push({ path: key, message: 'unknown field', code: 'object.unknown_key' })
        }
      }
    }

    if (allErrors.length > 0) {
      return { ok: false, value: result, errors: allErrors }
    }

    return ok(result)
  }

  const base = schema('object', { type: 'object', validate })
  const shapeMeta = Object.fromEntries(
    Object.entries(shape).map(([k, v]) => [k, typeof v.describe === 'function' ? v.describe() : v])
  )

  const inst = wrapSchema(base, 'object', 'object', {
    _shape: shape,
    _opts: { strict, passthrough },

    strict() {
      return object(shape, { strict: true, passthrough: false })
    },

    passthrough() {
      return object(shape, { strict: false, passthrough: true })
    },

    extend(additions) {
      return object({ ...shape, ...additions }, opts)
    },

    pick(keys) {
      const picked = {}
      for (const k of keys) {
        if (shape[k]) picked[k] = shape[k]
      }
      return object(picked, opts)
    },

    omit(keys) {
      const omitted = {}
      for (const [k, v] of Object.entries(shape)) {
        if (!keys.includes(k)) omitted[k] = v
      }
      return object(omitted, opts)
    },

    partial() {
      const partialShape = {}
      for (const [k, v] of Object.entries(shape)) {
        partialShape[k] = typeof v.optional === 'function' ? v.optional() : v
      }
      return object(partialShape, opts)
    },

    required() {
      return object(shape, opts)
    },

    describe() {
      return {
        kind: 'uploop.schema',
        name: 'object',
        type: 'object',
        fields: shapeMeta,
        strict,
        passthrough
      }
    }
  })

  return inst
}

// ── Array ───────────────────────────────────────────────────

export function array(itemSchema) {
  function validate(value) {
    if (!Array.isArray(value)) return failAt('', 'must be an array', 'type.array')

    const result = []
    const allErrors = []

    for (let i = 0; i < value.length; i++) {
      const itemResult = typeof itemSchema.validate === 'function'
        ? itemSchema.validate(value[i])
        : ok(value[i])

      if (itemResult.ok) {
        result.push(itemResult.value)
      } else {
        for (const err of (itemResult.errors || [])) {
          allErrors.push({
            path: `[${i}]` + (err.path ? '.' + err.path : ''),
            message: err.message,
            code: err.code
          })
        }
      }
    }

    if (allErrors.length > 0) {
      return { ok: false, value: result, errors: allErrors }
    }

    return ok(result)
  }

  const base = schema('array', { type: 'array', validate })

  function makeArray(prev) {
    const inst = wrapSchema(prev || base, 'array', 'array', {
      min(n) {
        const copy = makeArray(this)
        const prevFn = copy._validateFn
        copy._validateFn = (v) => {
          const r = prevFn(v)
          if (!r.ok) return r
          if (r.value.length < n) return failAt('', `must have at least ${n} items`, 'array.too_few')
          return r
        }
        return copy
      },

      max(n) {
        const copy = makeArray(this)
        const prevFn = copy._validateFn
        copy._validateFn = (v) => {
          const r = prevFn(v)
          if (!r.ok) return r
          if (r.value.length > n) return failAt('', `must have at most ${n} items`, 'array.too_many')
          return r
        }
        return copy
      },

      length(n) {
        const copy = makeArray(this)
        const prevFn = copy._validateFn
        copy._validateFn = (v) => {
          const r = prevFn(v)
          if (!r.ok) return r
          if (r.value.length !== n) return failAt('', `must have exactly ${n} items`, 'array.length')
          return r
        }
        return copy
      },

      nonEmpty() {
        return this.min(1)
      },

      unique() {
        const copy = makeArray(this)
        const prevFn = copy._validateFn
        copy._validateFn = (v) => {
          const r = prevFn(v)
          if (!r.ok) return r
          const seen = new Set()
          for (let i = 0; i < r.value.length; i++) {
            const key = typeof r.value[i] === 'object' ? JSON.stringify(r.value[i]) : r.value[i]
            if (seen.has(key)) return failAt(`[${i}]`, 'duplicate value', 'array.duplicate')
            seen.add(key)
          }
          return r
        }
        return copy
      },

      describe() {
        const itemDesc = typeof itemSchema.describe === 'function' ? itemSchema.describe() : itemSchema
        return {
          kind: 'uploop.schema',
          name: 'array',
          type: 'array',
          items: itemDesc
        }
      }
    })
    return inst
  }

  return makeArray()
}

// ── Tuple ───────────────────────────────────────────────────

export function tuple(schemas) {
  function validate(value) {
    if (!Array.isArray(value)) return failAt('', 'must be an array', 'type.array')
    if (value.length !== schemas.length) {
      return failAt('', `must have exactly ${schemas.length} items`, 'tuple.length')
    }

    const result = []
    const allErrors = []

    for (let i = 0; i < schemas.length; i++) {
      const itemResult = typeof schemas[i].validate === 'function'
        ? schemas[i].validate(value[i])
        : ok(value[i])

      if (itemResult.ok) {
        result.push(itemResult.value)
      } else {
        for (const err of (itemResult.errors || [])) {
          allErrors.push({ path: `[${i}]` + (err.path ? '.' + err.path : ''), message: err.message, code: err.code })
        }
      }
    }

    if (allErrors.length > 0) return { ok: false, value: result, errors: allErrors }
    return ok(result)
  }

  return schema('tuple', { type: 'tuple', validate })
}

// ── Record ──────────────────────────────────────────────────

export function record(keySchema, valueSchema) {
  function validate(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return failAt('', 'must be an object', 'type.object')
    }

    const result = {}
    const allErrors = []

    for (const [k, v] of Object.entries(value)) {
      const keyResult = typeof keySchema.validate === 'function'
        ? keySchema.validate(k)
        : ok(k)

      if (!keyResult.ok) {
        for (const err of (keyResult.errors || [])) {
          allErrors.push({ path: `{${k}}`, message: 'key: ' + err.message, code: err.code })
        }
        continue
      }

      const valResult = typeof valueSchema.validate === 'function'
        ? valueSchema.validate(v)
        : ok(v)

      if (valResult.ok) {
        result[k] = valResult.value
      } else {
        for (const err of (valResult.errors || [])) {
          allErrors.push({ path: k + (err.path ? '.' + err.path : ''), message: err.message, code: err.code })
        }
      }
    }

    if (allErrors.length > 0) return { ok: false, value: result, errors: allErrors }
    return ok(result)
  }

  return schema('record', { type: 'record', validate })
}
