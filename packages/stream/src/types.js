/**
 * Binary type definitions — field type encoders and decoders.
 * Maps uploop-schema types to fixed-size or length-prefixed binary layouts.
 *
 * Type ID table (1 byte per field):
 *   0x00 = null
 *   0x01 = bool
 *   0x02 = u8 / 0x03 = i8
 *   0x04 = u16 / 0x05 = i16
 *   0x06 = u32 / 0x07 = i32
 *   0x08 = u64 / 0x09 = i64
 *   0x0A = f32 / 0x0B = f64
 *   0x10 = string (len-prefixed UTF-8)
 *   0x11 = uuid (16 bytes raw)
 *   0x12 = date (8 bytes i64 unix ms)
 *   0x13 = binary (len-prefixed raw bytes)
 *   0x14 = enum (1-2 bytes index)
 *   0x20 = table (4 bytes offset to nested vtable+data)
 *   0x21 = array (4 bytes len + packed items)
 *
 * @module @uploop/stream/types
 */

export const TYPE = {
  NULL: 0x00, BOOL: 0x01,
  U8: 0x02, I8: 0x03, U16: 0x04, I16: 0x05, U32: 0x06, I32: 0x07, U64: 0x08, I64: 0x09,
  F32: 0x0A, F64: 0x0B,
  STR: 0x10, UUID: 0x11, DATE: 0x12, BIN: 0x13, ENUM: 0x14,
  TABLE: 0x20, ARRAY: 0x21
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// ── Encode ─────────────────────────────────────────────────

export function encodeBool(view, offset, value) { view.setUint8(offset, value ? 1 : 0); return 1 }
export function decodeBool(view, offset) { return [view.getUint8(offset) === 1, 1] }

export function encodeU8(view, offset, value) { view.setUint8(offset, value); return 1 }
export function decodeU8(view, offset) { return [view.getUint8(offset), 1] }

export function encodeI32(view, offset, value) { view.setInt32(offset, value, true); return 4 }
export function decodeI32(view, offset) { return [view.getInt32(offset, true), 4] }

export function encodeU32(view, offset, value) { view.setUint32(offset, value, true); return 4 }
export function decodeU32(view, offset) { return [view.getUint32(offset, true), 4] }

export function encodeF64(view, offset, value) { view.setFloat64(offset, value, true); return 8 }
export function decodeF64(view, offset) { return [view.getFloat64(offset, true), 8] }

export function encodeI64(view, offset, value) {
  const big = BigInt(value); view.setBigInt64(offset, big, true); return 8
}
export function decodeI64(view, offset) { return [Number(view.getBigInt64(offset, true)), 8] }

export function encodeStr(view, offset, str) {
  const bytes = encoder.encode(str)
  view.setUint32(offset, bytes.length, true)
  new Uint8Array(view.buffer, view.byteOffset + offset + 4, bytes.length).set(bytes)
  return 4 + bytes.length
}
export function decodeStr(view, offset) {
  const len = view.getUint32(offset, true)
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset + 4, len)
  return [decoder.decode(bytes), 4 + len]
}

export function encodeUUID(view, offset, uuid) {
  const hex = uuid.replace(/-/g, '')
  for (let i = 0; i < 16; i++) view.setUint8(offset + i, parseInt(hex.slice(i * 2, i * 2 + 2), 16))
  return 16
}
export function decodeUUID(view, offset) {
  const parts = []
  for (let i = 0; i < 16; i++) parts.push(view.getUint8(offset + i).toString(16).padStart(2, '0'))
  return [`${parts[0]}${parts[1]}${parts[2]}${parts[3]}-${parts[4]}${parts[5]}-${parts[6]}${parts[7]}-${parts[8]}${parts[9]}-${parts[10]}${parts[11]}${parts[12]}${parts[13]}${parts[14]}${parts[15]}`, 16]
}

export function encodeDate(view, offset, date) {
  const ms = date instanceof Date ? date.getTime() : new Date(date).getTime()
  view.setBigInt64(offset, BigInt(ms), true); return 8
}
export function decodeDate(view, offset) { return [new Date(Number(view.getBigInt64(offset, true))), 8] }

export function encodeBytes(view, offset, bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  view.setUint32(offset, arr.length, true)
  new Uint8Array(view.buffer, view.byteOffset + offset + 4, arr.length).set(arr)
  return 4 + arr.length
}
export function decodeBytes(view, offset) {
  const len = view.getUint32(offset, true)
  return [new Uint8Array(view.buffer, view.byteOffset + offset + 4, len), 4 + len]
}

// ── Field type → encoder mapping ──────────────────────────

const ENCODERS = {
  string:  { type: TYPE.STR,  encode: (v, o, d) => encodeStr(d, o, String(v ?? '')), decode: (d, o) => decodeStr(d, o), size: (v) => 4 + encoder.encode(String(v ?? '')).length },
  number:  { type: TYPE.F64,  encode: (v, o, d) => encodeF64(d, o, Number(v ?? 0)), decode: (d, o) => decodeF64(d, o), size: () => 8 },
  boolean: { type: TYPE.BOOL, encode: (v, o, d) => encodeBool(d, o, !!v), decode: (d, o) => decodeBool(d, o), size: () => 1 },
  date:    { type: TYPE.DATE, encode: (v, o, d) => encodeDate(d, o, v), decode: (d, o) => decodeDate(d, o), size: () => 8 },
  uuid:    { type: TYPE.UUID, encode: (v, o, d) => encodeUUID(d, o, String(v ?? '')), decode: (d, o) => decodeUUID(d, o), size: () => 16 },
  ref:     { type: TYPE.STR,  encode: (v, o, d) => encodeStr(d, o, String(v ?? '')), decode: (d, o) => decodeStr(d, o), size: (v) => 4 + encoder.encode(String(v ?? '')).length },
  enum:    { type: TYPE.STR,  encode: (v, o, d) => encodeStr(d, o, String(v ?? '')), decode: (d, o) => decodeStr(d, o), size: (v) => 4 + encoder.encode(String(v ?? '')).length },
  array:   { type: TYPE.ARRAY },
  object:  { type: TYPE.TABLE },
  computed:{ type: TYPE.NULL }
}

export function getFieldEncoder(fieldType, format) {
  if (fieldType === 'string' && format === 'uuid') return ENCODERS.uuid
  return ENCODERS[fieldType] || ENCODERS.string
}

// ── Type ID label ──────────────────────────────────────────

export function typeLabel(id) {
  for (const [k, v] of Object.entries(TYPE)) { if (v === id) return k.toLowerCase() }
  return 'unknown'
}
