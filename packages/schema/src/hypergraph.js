/**
 * HyperGraph integration — bridge between @uploop/schema entities and @uploop/core graphs.
 *
 * Converts entity definitions into createGraph() configurations:
 *   - Data nodes: one per entity field, with defaults + metadata
 *   - Update nodes: auto-generated set/validate handlers (optional)
 *   - Edges: from relation ref() declarations
 *
 * @module @uploop/schema/hypergraph
 */
import { listEntities, getEntity } from './relational.js'

/**
 * Convert one or more entity schemas into a createGraph() config.
 *
 * @param {Array<Object>} entities — entity schemas from entity()
 * @param {Object} [extra={}] — additional graph config (nodes, edges, on, etc.)
 * @returns {Object} createGraph() compatible config
 *
 * @example
 * const User = entity('User', { name: string(), email: string().email() })
 * const graph = createGraph(toGraph([User]))
 */
export function toGraph(entities, extra = {}) {
  /** @type {Object<string, Object>} */
  const nodes = { ...(extra.nodes || {}) }
  /** @type {Array<[string, string]>} */
  const edges = [...(extra.edges || [])]
  /** @type {Object<string, string>} */
  const on = { ...(extra.on || {}) }

  for (const ent of entities) {
    const desc = typeof ent.describe === 'function' ? ent.describe() : null
    if (!desc || desc.kind !== 'uploop.entity') continue

    const entityName = desc.entity
    const meta = ent._entityMeta || {}

    // Create data nodes for each field
    for (const [fieldName, fieldDef] of Object.entries(desc.fields)) {
      const nodeName = entityName + '.' + fieldName
      const fieldSchema = ent._shape?.[fieldName]

      // Determine default value
      let defaultValue = null
      if (fieldDef.default !== undefined) {
        defaultValue = fieldDef.default
      } else if (fieldDef.type === 'string') {
        defaultValue = ''
      } else if (fieldDef.type === 'number') {
        defaultValue = 0
      } else if (fieldDef.type === 'boolean') {
        defaultValue = false
      } else if (fieldDef.type === 'array') {
        defaultValue = []
      } else if (fieldDef.type === 'ref') {
        defaultValue = null
      }

      nodes[nodeName] = {
        type: 'data',
        default: defaultValue,
        // Entity metadata → HyperGraph node metadata
        temperature: meta.temperature || 'warm',
        lifetime: meta.lifetime || 'session',
        ...(meta.cache ? { cache: meta.cache } : {}),
        ...(meta.consistency ? { consistency: meta.consistency } : {})
      }
    }

    // Create edges from relations
    if (desc.edges) {
      for (const [from, to] of desc.edges) {
        edges.push([from, to])
      }
    }

    // Auto-generate a set handler for the entity (optional, opt-in via extra.generateCRUD)
    if (extra.generateCRUD) {
      const setNodeName = entityName + '.set'
      const allFields = Object.keys(desc.fields)
      const dataFields = allFields.filter(f => !desc.fields[f].computed)
      const nodeNames = dataFields.map(f => entityName + '.' + f)

      nodes[setNodeName] = {
        type: 'update',
        reads: nodeNames,
        writes: nodeNames,
        run(data, partial) {
          // Validate and set entity data
          const result = ent.validate({ ...data, ...partial })
          if (!result.ok) {
            console.warn('[Uploop] Entity set validation failed:', result.errors)
            return {} // don't update if invalid
          }
          const updates = {}
          for (const field of dataFields) {
            if (field in result.value) {
              updates[entityName + '.' + field] = result.value[field]
            }
          }
          return updates
        }
      }

      on[entityName + '.set'] = setNodeName
    }
  }

  return {
    name: extra.name || 'schema-graph',
    nodes,
    edges,
    on,
    maxEventDepth: extra.maxEventDepth,
    maxEventsPerTransaction: extra.maxEventsPerTransaction,
    onUnknownEvent: extra.onUnknownEvent,
    onEventRejected: extra.onEventRejected
  }
}

/**
 * Convert a single entity into a createLoop() compatible config.
 * Useful for creating a store from an entity.
 *
 * @param {Object} entitySchema — entity schema
 * @returns {Object} createLoop() compatible config
 */
export function fromSchema(entitySchema) {
  const desc = typeof entitySchema.describe === 'function' ? entitySchema.describe() : null
  if (!desc || desc.kind !== 'uploop.entity') {
    throw new Error('fromSchema() requires an entity schema')
  }

  const entityName = desc.entity
  const initialState = {}
  const updateHandlers = {}

  for (const [fieldName, fieldDef] of Object.entries(desc.fields)) {
    const key = entityName + '.' + fieldName

    // Default value
    if (fieldDef.default !== undefined) {
      initialState[key] = fieldDef.default
    } else if (fieldDef.type === 'string') {
      initialState[key] = ''
    } else if (fieldDef.type === 'number') {
      initialState[key] = 0
    } else if (fieldDef.type === 'boolean') {
      initialState[key] = false
    } else if (fieldDef.type === 'array') {
      initialState[key] = []
    } else {
      initialState[key] = null
    }

    // Auto-generate setter for each field
    const setterName = 'set' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
    updateHandlers[setterName] = (state, value) => {
      const updates = { [key]: value }
      // Validate the full entity with this partial update
      const current = {}
      for (const [k] of Object.entries(state)) {
        const short = k.replace(entityName + '.', '')
        current[short] = state[k]
      }
      current[fieldName] = value
      const result = entitySchema.validate(current)
      if (!result.ok) {
        console.warn('[Uploop] Validation failed for', setterName, ':', result.errors)
      }
      return updates
    }
  }

  // Bulk set handler
  updateHandlers['set'] = (state, partial) => {
    const updates = {}
    for (const [field, value] of Object.entries(partial)) {
      updates[entityName + '.' + field] = value
    }
    return updates
  }

  return {
    name: entityName,
    state: initialState,
    update: updateHandlers
  }
}
