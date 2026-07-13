/**
 * Stream Registry — multi-entity codec management.
 *
 * @module @uploop/stream/registry
 */
import { createStreamCodec } from './codec.js'
import { isFrame, readHeader } from './frame.js'

export function createStreamRegistry() {
  const codecs = new Map()   // name → codec
  const idMap = new Map()    // id → name
  let nextId = 1

  function register(entitySchema, opts = {}) {
    const desc = typeof entitySchema.describe === 'function' ? entitySchema.describe() : entitySchema
    const name = desc.entity || 'Entity'
    const eid = opts.id || nextId++
    const codec = createStreamCodec(entitySchema, { ...opts, entityId: eid })
    codecs.set(name, codec)
    idMap.set(eid, name)
    return eid
  }

  function encode(entityName, data) {
    const codec = codecs.get(entityName)
    if (!codec) throw new Error(`Unknown entity: ${entityName}`)
    return codec.encode(data)
  }

  function decode(buffer) {
    if (!isFrame(buffer)) {
      // Try as raw JSON fallback
      try { const s = new TextDecoder().decode(buffer instanceof ArrayBuffer ? buffer : buffer.buffer || buffer); return { entity: 'raw', data: JSON.parse(s) } }
      catch { throw new Error('Not a valid Uploop frame or JSON') }
    }
    const header = readHeader(new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer))
    const name = idMap.get(header.entityId) || `entity_${header.entityId}`
    const codec = codecs.get(name)
    if (!codec) throw new Error(`No codec for entity: ${name}`)
    return { entity: name, data: codec.decode(buffer) }
  }

  function describe() {
    const entities = {}
    for (const [name, codec] of codecs) {
      entities[name] = { id: idMap.get([...idMap].find(([_, v]) => v === name)?.[0]), fieldCount: codec.fieldCount }
    }
    return { kind: 'uploop.stream.registry', entities, version: 1 }
  }

  return { register, encode, decode, describe, codecs, idMap }
}
