/**
 * Stream Codec — schema-to-binary encode/decode (sequential layout).
 * @module @uploop/stream/codec
 */
import { getFieldEncoder } from './types.js'
import { buildFrame, HEADER_SIZE } from './frame.js'

export function createStreamCodec(entitySchema, opts = {}) {
  const desc = typeof entitySchema.describe === 'function' ? entitySchema.describe() : entitySchema
  const fields = desc.fields || {}
  const fieldNames = Object.keys(fields).filter(k => !fields[k].computed)
  const version = opts.version || 1
  const entityId = opts.entityId || 0

  // ── Encode (sequential) ────────────────────────────────

  function encode(data) {
    // Pass 1: compute sizes and record offsets
    const layout = []
    let dataOffset = 0
    for (const name of fieldNames) {
      const fd = fields[name]
      const fmt = fd.meta?.format || fd.format
      const enc = getFieldEncoder(fd.type, fmt)
      const value = data ? data[name] : undefined
      layout.push({ name, type: fd.type, format: fmt, encoder: enc, offset: dataOffset, value })
      dataOffset += enc.size ? enc.size(value) : 8
    }

    // VTable
    const vtableSize = 4 + fieldNames.length * 3
    const vtableBuf = new ArrayBuffer(vtableSize)
    const vv = new DataView(vtableBuf)
    vv.setUint16(0, vtableSize, true)
    vv.setUint16(2, fieldNames.length, true)
    for (let i = 0; i < layout.length; i++) {
      vv.setUint8(4 + i * 3, layout[i].encoder.type)
      vv.setUint16(5 + i * 3, layout[i].offset, true)
    }

    // Data
    const dataBuf = new ArrayBuffer(dataOffset)
    const dv = new DataView(dataBuf)
    for (const f of layout) {
      const value = data?.[f.name]
      if (value === null || value === undefined) continue
      f.encoder.encode(value, f.offset, dv)
    }

    return buildFrame(entityId, version, vtableBuf, dataBuf)
  }

  // ── Decode ──────────────────────────────────────────────

  function decode(buffer) {
    const v = makeView(buffer)
    const result = {}
    for (const fn of fieldNames) {
      try { result[fn] = v.field(fn) } catch (e) { result[fn] = null }
    }
    return result
  }

  // ── Zero-Copy View ──────────────────────────────────────

  function view(buffer) {
    return makeView(buffer)
  }

  function makeView(buffer) {
    const buf = buffer instanceof ArrayBuffer ? buffer :
               (buffer.buffer || buffer)
    const byteOff = buffer.byteOffset || 0
    const dv = new DataView(buf)
    const totalSize = dv.getUint32(byteOff + 7, true)
    const rootOffset = dv.getUint32(byteOff + 11, true)
    const vtableOff = byteOff + HEADER_SIZE
    const vtableSize = dv.getUint16(vtableOff, true)
    const fieldCount = dv.getUint16(vtableOff + 2, true)
    const dataStart = byteOff + rootOffset

    // Parse vtable
    const vtableFields = []
    for (let i = 0; i < fieldCount; i++) {
      const typeId = dv.getUint8(vtableOff + 4 + i * 3)
      const fOff = dv.getUint16(vtableOff + 5 + i * 3, true)
      vtableFields.push({ typeId, offset: fOff })
    }

    function field(name) {
      const idx = fieldNames.indexOf(name)
      if (idx === -1 || idx >= vtableFields.length) return undefined
      const fi = vtableFields[idx]
      const fd = fields[name] || {}
      const fmt = fd.meta?.format || fd.format
      const enc = getFieldEncoder(fd.type, fmt)
      const [val] = enc.decode(dv, dataStart + fi.offset)
      return val
    }

    return {
      field,
      fields() { return [...fieldNames] },
      totalSize,
      byteLength: totalSize,
      release() {}
    }
  }

  // ── Size ────────────────────────────────────────────────

  function size(data) {
    let s = 0
    for (const name of fieldNames) {
      const fd = fields[name]
      const fmt = fd.meta?.format || fd.format
      const enc = getFieldEncoder(fd.type, fmt)
      s += enc.size ? enc.size(data?.[name]) : 8
    }
    return HEADER_SIZE + 4 + fieldNames.length * 3 + s
  }

  return {
    encode, decode, view, encodeFrame: encode, size,
    entityName: desc.entity || 'Entity',
    fieldCount: fieldNames.length
  }
}
