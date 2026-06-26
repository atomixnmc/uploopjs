/**
 * Schema inference & export — toJSONSchema(), toTypeScript().
 *
 * Converts uploop schema/entity definitions to standard formats
 * that other tools and AI agents can consume.
 *
 * @module @uploop/schema/infer
 */

// ── toJSONSchema() ─────────────────────────────────────────

/**
 * Convert an entity or schema to JSON Schema Draft 2020-12.
 *
 * @param {Object} entityOrSchema — entity() or any schema
 * @returns {Object} JSON Schema object
 */
export function toJSONSchema(entityOrSchema) {
  const desc = typeof entityOrSchema.describe === 'function'
    ? entityOrSchema.describe()
    : entityOrSchema

  if (!desc) return { type: 'object' }

  // Entity → object with properties
  if (desc.kind === 'uploop.entity') {
    return entityToJSONSchema(desc)
  }

  // Schema → type mapping
  return schemaToJSONSchema(desc)
}

function entityToJSONSchema(desc) {
  const properties = {}
  const required = []

  for (const [name, field] of Object.entries(desc.fields || {})) {
    properties[name] = fieldToJSONSchema(field)
    if (!field.optional && !field.nullable && !field.computed) {
      required.push(name)
    }
  }

  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties,
    title: desc.entity || 'Entity'
  }

  if (required.length > 0) schema.required = required
  if (desc.meta?.description) schema.description = desc.meta.description

  return schema
}

function fieldToJSONSchema(field) {
  if (!field) return {}

  const schema = {}

  switch (field.type) {
    case 'string':
      schema.type = 'string'
      if (field.min !== undefined) schema.minLength = field.min
      if (field.max !== undefined) schema.maxLength = field.max
      if (field.meta?.format === 'email') schema.format = 'email'
      else if (field.meta?.format === 'url') schema.format = 'uri'
      else if (field.meta?.format === 'uuid') schema.format = 'uuid'
      if (field.meta?.regex) schema.pattern = field.meta.regex.source
      break
    case 'number':
      schema.type = field.integer ? 'integer' : 'number'
      if (field.min !== undefined) schema.minimum = field.min
      if (field.max !== undefined) schema.maximum = field.max
      break
    case 'boolean':
      schema.type = 'boolean'
      break
    case 'date':
      schema.type = 'string'
      schema.format = 'date-time'
      break
    case 'enum':
      schema.type = 'string'
      schema.enum = field.values || field.meta?.values || []
      break
    case 'ref':
      schema.type = 'string'
      if (field.meta?.format === 'uuid') schema.format = 'uuid'
      if (field.relation) schema.description = `Reference to ${field.relation.ref}`
      break
    case 'array':
      schema.type = 'array'
      if (field.items) schema.items = fieldToJSONSchema(field.items)
      else schema.items = { type: 'string' }
      if (field.minItems !== undefined) schema.minItems = field.minItems
      if (field.maxItems !== undefined) schema.maxItems = field.maxItems
      break
    case 'object':
      schema.type = 'object'
      if (field.fields) {
        schema.properties = {}
        for (const [k, v] of Object.entries(field.fields)) {
          schema.properties[k] = fieldToJSONSchema(v)
        }
      }
      break
    case 'literal':
      schema.const = field.meta?.example
      break
    case 'computed':
      schema.type = field.subtype || 'string'
      schema.readOnly = true
      break
    default:
      schema.type = 'string'
  }

  if (field.description) schema.description = field.description
  if (field.meta?.description) schema.description = field.meta.description
  if (field.meta?.example !== undefined) schema.examples = [field.meta.example]
  if (field.default !== undefined && field.default !== '<fn>') schema.default = field.default

  return schema
}

function schemaToJSONSchema(desc) {
  if (!desc) return {}
  const s = fieldToJSONSchema(desc)
  if (desc.name) s.title = desc.name
  return s
}

// ── toTypeScript() ─────────────────────────────────────────

/**
 * Convert an entity to a TypeScript interface string.
 *
 * @param {Object} entityOrSchema
 * @returns {string} TypeScript interface
 */
export function toTypeScript(entityOrSchema) {
  const desc = typeof entityOrSchema.describe === 'function'
    ? entityOrSchema.describe()
    : entityOrSchema

  if (!desc) return 'export type Unknown = Record<string, any>'

  if (desc.kind === 'uploop.entity') {
    return entityToTypeScript(desc)
  }

  return `export type ${desc.name || 'Type'} = ${fieldToTypeScript(desc)}`
}

function entityToTypeScript(desc) {
  const name = desc.entity || 'Entity'
  const lines = []
  lines.push(`export interface ${name} {`)

  for (const [fieldName, field] of Object.entries(desc.fields || {})) {
    const optional = field.optional || field.nullable ? '?' : ''
    const tsType = fieldToTypeScript(field)
    const comment = field.meta?.description ? `  /** ${field.meta.description} */` : ''
    if (comment) lines.push(comment)
    lines.push(`  ${fieldName}${optional}: ${tsType};`)
  }

  lines.push('}')
  return lines.join('\n')
}

function fieldToTypeScript(field) {
  if (!field) return 'unknown'

  let type

  switch (field.type) {
    case 'string':
      if (field.meta?.format === 'email') type = 'string'
      else if (field.meta?.format === 'uuid') type = 'string'
      else type = 'string'
      break
    case 'number':
      type = field.integer ? 'number' : 'number'
      break
    case 'boolean':
      type = 'boolean'
      break
    case 'date':
      type = 'Date'
      break
    case 'enum':
      if (field.values) type = field.values.map(v => `'${v}'`).join(' | ')
      else if (field.meta?.values) type = field.meta.values.map(v => `'${v}'`).join(' | ')
      else type = 'string'
      break
    case 'ref':
      type = field.relation?.ref || field.meta?.ref || 'string'
      break
    case 'array':
      if (field.items) type = `${fieldToTypeScript(field.items)}[]`
      else type = 'string[]'
      break
    case 'object':
      if (field.fields) {
        const props = Object.entries(field.fields)
          .map(([k, v]) => `${k}: ${fieldToTypeScript(v)}`)
          .join('; ')
        type = `{ ${props} }`
      } else {
        type = 'Record<string, any>'
      }
      break
    case 'literal':
      type = typeof field.meta?.example === 'string' ? `'${field.meta.example}'` : String(field.meta?.example ?? 'unknown')
      break
    case 'computed':
      type = 'unknown'
      break
    default:
      type = 'unknown'
  }

  if (field.nullable) type += ' | null'

  return type
}

// ── toGraphQL() ────────────────────────────────────────────

/**
 * Convert an entity to GraphQL type definition string (SDL).
 *
 * @param {Object} entityOrSchema
 * @returns {string} GraphQL SDL
 */
export function toGraphQL(entityOrSchema) {
  const desc = typeof entityOrSchema.describe === 'function'
    ? entityOrSchema.describe()
    : entityOrSchema

  if (!desc || desc.kind !== 'uploop.entity') return ''

  const name = desc.entity || 'Entity'
  const lines = []
  lines.push(`type ${name} {`)

  for (const [fieldName, field] of Object.entries(desc.fields || {})) {
    if (field.computed) continue
    const required = !field.optional && !field.nullable ? '!' : ''
    const gqlType = fieldToGraphQLType(field)
    lines.push(`  ${fieldName}: ${gqlType}${required}`)
  }

  lines.push('}')
  return lines.join('\n')
}

function fieldToGraphQLType(field) {
  switch (field.type) {
    case 'string': return 'String'
    case 'number': return field.integer ? 'Int' : 'Float'
    case 'boolean': return 'Boolean'
    case 'date': return 'String'
    case 'enum': return 'String'
    case 'ref': return (field.relation?.ref || field.meta?.ref || 'ID') + '!'
    case 'array': return field.items ? `[${fieldToGraphQLType(field.items)}]` : '[String]'
    case 'object': return 'JSON'
    default: return 'String'
  }
}

// ── toFormSchema() ─────────────────────────────────────────

/**
 * Convert an entity to a form field array for form generators.
 *
 * @param {Object} entityOrSchema
 * @returns {Array<Object>} Array of { name, type, label, required, ... }
 */
export function toFormSchema(entityOrSchema) {
  const desc = typeof entityOrSchema.describe === 'function'
    ? entityOrSchema.describe()
    : entityOrSchema

  if (!desc || desc.kind !== 'uploop.entity') return []

  return Object.entries(desc.fields || {})
    .filter(([_, f]) => !f.computed)
    .map(([name, field]) => {
      const formField = {
        name,
        type: field.type,
        label: name.charAt(0).toUpperCase() + name.slice(1),
        required: !field.optional && !field.nullable
      }

      switch (field.type) {
        case 'string':
          if (field.meta?.format === 'email') formField.inputType = 'email'
          else if (field.meta?.format === 'url') formField.inputType = 'url'
          else formField.inputType = 'text'
          if (field.min) formField.minLength = field.min
          if (field.max) formField.maxLength = field.max
          break
        case 'number':
          formField.inputType = 'number'
          if (field.integer) formField.step = 1
          if (field.min !== undefined) formField.min = field.min
          if (field.max !== undefined) formField.max = field.max
          break
        case 'boolean':
          formField.inputType = 'checkbox'
          break
        case 'date':
          formField.inputType = 'date'
          break
        case 'enum':
          formField.inputType = 'select'
          formField.options = field.values || field.meta?.values || []
          break
        case 'ref':
          formField.inputType = 'text'
          formField.label += ' ID'
          break
        default:
          formField.inputType = 'text'
      }

      if (field.meta?.description) formField.description = field.meta.description
      if (field.default !== undefined && field.default !== '<fn>') formField.default = field.default

      return formField
    })
}
