/**
 * Relational schemas — entity(), ref(), computed().
 *
 * Entities connect schema to the HyperGraph engine. Each entity
 * wraps an object schema and adds:
 *   - Registration in the global entity registry
 *   - Relation tracking (ref() fields become HyperGraph edges)
 *   - Metadata (temperature, lifetime, owner, cache, consistency)
 *   - AI-readable describe() manifest
 *
 * @module @uploop/schema/relational
 */
import { schema, ok, failAt, ValidationError } from './core.js'
import { object } from './structural.js'
import { string, number, boolean, enumeration } from './primitives.js'

// ── Global Entity Registry ─────────────────────────────────

const _entityRegistry = new Map()

export function registerEntity(entitySchema) {
  _entityRegistry.set(entitySchema.entityName, entitySchema)
}

export function getEntity(name) {
  return _entityRegistry.get(name)
}

export function listEntities() {
  return [..._entityRegistry.values()]
}

export function clearRegistry() {
  _entityRegistry.clear()
}

// ── ref() — Relation Reference ─────────────────────────────

export function ref(entityName, opts = {}) {
  const inverse = opts.inverse || null
  const relType = opts.type || 'manyToOne'

  function validate(value) {
    if (value === null || value === undefined) return ok(value)
    if (typeof value === 'string') return ok(value)
    return failAt('', `must be a reference to ${entityName} (string id)`, 'ref.invalid')
  }

  const refSchema = schema('ref<' + entityName + '>', {
    type: 'ref',
    validate,
    meta: { ref: entityName, relation: relType, inverse }
  })

  refSchema._ref = entityName
  refSchema._relationType = relType
  refSchema._inverse = inverse

  return refSchema
}

// ── computed() — Derived Field ─────────────────────────────

export function computed(dependencies, fn, opts = {}) {
  function validate(value) {
    return ok(value)
  }

  const compSchema = schema('computed', {
    type: 'computed',
    validate,
    meta: { dependencies, computed: true }
  })

  compSchema._computed = true
  compSchema._dependencies = dependencies
  compSchema._compute = fn

  return compSchema
}

// ── entity() — Named Entity ─────────────────────────────────

export function entity(name, fields = {}, meta = {}) {
  const shape = {}
  const relations = []
  const computedFields = []

  for (const [fieldName, fieldSchema] of Object.entries(fields)) {
    if (fieldSchema._ref) {
      relations.push({
        field: fieldName,
        ref: fieldSchema._ref,
        type: fieldSchema._relationType || 'manyToOne',
        inverse: fieldSchema._inverse || null
      })
    }
    if (fieldSchema._computed) {
      computedFields.push({
        field: fieldName,
        dependencies: fieldSchema._dependencies || [],
      })
    }
    shape[fieldName] = fieldSchema
  }

  // Build validation shape WITHOUT computed fields (they are derived)
  const validationShape = {}
  for (const [fn, fs] of Object.entries(shape)) {
    if (!fs._computed) validationShape[fn] = fs
  }
  const objSchema = object(validationShape)

  function validate(value) {
    const result = objSchema.validate(value)
    // Apply computed fields to the result value
    if (computedFields.length > 0 && result.value) {
      for (const cf of computedFields) {
        const fieldSchema = shape[cf.field]
        if (fieldSchema && fieldSchema._compute) {
          try {
            result.value[cf.field] = fieldSchema._compute(result.value)
          } catch (e) { /* skip on error */ }
        }
      }
    }
    return result
  }

  const entitySchema = {
    kind: 'uploop.entity',
    entityName: name,
    _shape: shape,
    _validationShape: validationShape,
    _relations: relations,
    _computedFields: computedFields,
    _entityMeta: {
      temperature: meta.temperature || 'warm',
      lifetime: meta.lifetime || 'session',
      owner: meta.owner || 'client',
      consistency: meta.consistency || 'eventual',
      cache: meta.cache || null,
      description: meta.description || '',
      aiRole: meta.aiRole || '',
      aiHints: meta.aiHints || null,
      tags: meta.tags || [],
      ...meta
    },

    validate,
    safeParse(value) { return this.validate(value) },
    assert(value) {
      const r = this.validate(value)
      if (!r.ok) throw new ValidationError(r)
      return r.value
    },

    describe() {
      const fieldDefs = {}
      for (const [fieldName, fieldSchema] of Object.entries(shape)) {
        const fd = typeof fieldSchema.describe === 'function' ? fieldSchema.describe() : { type: 'any' }
        const rel = relations.find(r => r.field === fieldName)
        if (rel) fd.relation = { ref: rel.ref, type: rel.type, inverse: rel.inverse }
        const cf = computedFields.find(c => c.field === fieldName)
        if (cf) {
          fd.computed = true
          fd.dependencies = cf.dependencies
        }
        fieldDefs[fieldName] = fd
      }

      const edges = relations.map(r => [name + '.' + r.field, r.ref + '.id'])

      return {
        kind: 'uploop.entity',
        entity: name,
        fields: fieldDefs,
        relations,
        edges,
        meta: { ...entitySchema._entityMeta }
      }
    },

    getRelations() { return [...relations] },
    getComputed() { return [...computedFields] },
    hasRelation(entityName) { return relations.some(r => r.ref === entityName) },
    toObjectSchema() { return objSchema },

    extend(additions) { return entity(name, { ...fields, ...additions }, meta) },
    pick(keys) {
      const p = {}
      for (const k of keys) { if (fields[k]) p[k] = fields[k] }
      return entity(name, p, meta)
    },
    omit(keys) {
      const o = {}
      for (const [k, v] of Object.entries(fields)) { if (!keys.includes(k)) o[k] = v }
      return entity(name, o, meta)
    },
    partial() {
      const p = {}
      for (const [k, v] of Object.entries(fields)) {
        p[k] = typeof v.optional === 'function' ? v.optional() : v
      }
      return entity(name, p, meta)
    }
  }

  registerEntity(entitySchema)
  return entitySchema
}

/**
 * Materialize an entity from an AI intent at runtime.
 * Converts intent field descriptors to actual schema primitives.
 *
 * @param {string} name — entity name
 * @param {Object} intentObj — from intent()
 * @param {Object} [meta] — entity metadata
 * @returns {Object} entity schema
 */
entity.fromIntent = function (name, intentObj, meta = {}) {
  const fields = {}
  const intentFields = intentObj._fields || intentObj.shape || {}

  for (const [fieldName, fieldDef] of Object.entries(intentFields)) {
    let fieldSchema
    const type = fieldDef.type

    if (type === 'enum' && fieldDef.values) {
      fieldSchema = enumeration(fieldDef.values)
    } else if (type === 'object' && fieldDef.fields) {
      // Nested object — just use object() for now
      fieldSchema = object(convertIntentFields(fieldDef.fields))
    } else if (type === 'ref') {
      fieldSchema = ref(fieldDef.ref || 'Entity')
    } else if (type === 'number') {
      let s = number()
      if (fieldDef.subtype === 'integer') s = s.integer()
      fieldSchema = s
    } else if (type === 'boolean') {
      fieldSchema = boolean()
    } else {
      // string (default)
      let s = string()
      if (fieldDef.format === 'email') s = s.email()
      else if (fieldDef.format === 'url') s = s.url()
      else if (fieldDef.format === 'uuid') s = s.uuid()
      fieldSchema = s
    }

    if (fieldDef.optional) fieldSchema = fieldSchema.optional()
    if (fieldDef.nullable) fieldSchema = fieldSchema.nullable()

    fields[fieldName] = fieldSchema
  }

  return entity(name, fields, meta)
}

function convertIntentFields(intentFields) {
  const result = {}
  for (const [k, v] of Object.entries(intentFields)) {
    if (v.type === 'string') result[k] = string()
    else if (v.type === 'number') result[k] = number()
    else result[k] = string()
  }
  return result
}
