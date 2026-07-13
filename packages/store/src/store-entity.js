import { createLoop } from '@uploop/core'

/**
 * Create a store from an entity schema.
 * Auto-generates state and update handlers from entity fields.
 *
 * @param {Object} entitySchema — from @uploop/schema entity()
 * @param {Object} [opts]
 * @param {string} [opts.name] — store name
 * @returns {Object} store
 */
export function storeFromEntity(entitySchema, opts = {}) {
  const { name } = opts
  const desc = typeof entitySchema.describe === 'function' ? entitySchema.describe() : { fields: {}, entity: 'Entity' }
  const entityName = name || desc.entity || 'Entity'
  const fields = desc.fields || {}

  // Build initial state
  const state = {}
  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    if (fieldDef.computed) continue
    let dv = fieldDef.default
    if (dv === undefined) {
      if (fieldDef.type === 'string') dv = ''
      else if (fieldDef.type === 'number') dv = 0
      else if (fieldDef.type === 'boolean') dv = false
      else if (fieldDef.type === 'array') dv = []
      else dv = null
    }
    if (typeof dv === 'function') dv = dv()
    if (dv === '<fn>') dv = null
    state[entityName + '.' + fieldName] = dv
  }

  // Build update handlers
  const update = {}

  // Per-field setters
  for (const fieldName of Object.keys(fields)) {
    const cap = fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
    const key = entityName + '.' + fieldName
    update['set' + cap] = (s, value) => {
      // Validate via entity schema
      const current = {}
      for (const [k, v] of Object.entries(s)) {
        const short = k.replace(entityName + '.', '')
        current[short] = v
      }
      current[fieldName] = value
      if (typeof entitySchema.validate === 'function') {
        const result = entitySchema.validate(current)
        if (!result.ok) {
          console.warn(`[Uploop] ${entityName}.${fieldName} validation failed:`, result.errors)
          return s // don't update if invalid
        }
      }
      return { ...s, [key]: value }
    }
  }

  // Bulk set
  update.set = (s, partial) => {
    const updates = {}
    for (const [field, value] of Object.entries(partial)) {
      const key = entityName + '.' + field
      if (key in s || Object.keys(fields).includes(field)) {
        updates[key] = value
      }
    }
    return { ...s, ...updates }
  }

  // Reset to defaults
  update.reset = () => ({ ...state })

  const loop = createLoop({ name: entityName, state, update })

  return {
    get: loop.get,
    set: loop.set,
    send: loop.send,
    subscribe: loop.subscribe,
    on: loop.on,
    effect: loop.effect,
    describe: loop.describe,
    dispose: loop.dispose,
    validate() {
      const current = {}
      for (const [k, v] of Object.entries(loop.get())) {
        const short = k.replace(entityName + '.', '')
        current[short] = v
      }
      return typeof entitySchema.validate === 'function'
        ? entitySchema.validate(current)
        : { ok: true, value: current, errors: [] }
    }
  }
}
