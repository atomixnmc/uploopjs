/**
 * Binary Frame Protocol — self-framing messages for streaming.
 *
 * Frame layout:
 *   [Magic:2] [Version:2] [Flags:1] [EntityID:2] [TotalSize:4] [RootOffset:4] [VTable+Data...]
 *
 *   Magic:     0x55 0x4C ("UL" = Uploop)
 *   Version:   schema version (for compatibility)
 *   Flags:     bitfield (0x01=compressed, 0x02=fragmented, 0x04=encrypted)
 *   EntityID:  entity ID from registry (1-65535)
 *   TotalSize: total frame size in bytes
 *   RootOffset: byte offset from frame start to root table
 *
 * @module @uploop/stream/frame
 */

export const MAGIC = 0x554C  // "UL"
export const HEADER_SIZE = 15  // 2+2+1+2+4+4 (magic+version+flags+entityId+totalSize+rootOffset)

/**
 * Write frame header into a DataView at offset.
 * Returns bytes written (always HEADER_SIZE).
 */
export function writeHeader(view, offset, { version = 1, flags = 0, entityId = 0, totalSize = 0, rootOffset = 0 } = {}) {
  view.setUint16(offset, MAGIC, true)
  view.setUint16(offset + 2, version, true)
  view.setUint8(offset + 4, flags)
  view.setUint16(offset + 5, entityId, true)
  view.setUint32(offset + 7, totalSize, true)
  view.setUint32(offset + 11, rootOffset, true)
  return HEADER_SIZE
}

/**
 * Read frame header from DataView at offset.
 */
export function readHeader(view, offset = 0) {
  const magic = view.getUint16(offset, true)
  if (magic !== MAGIC) throw new Error(`Invalid magic: 0x${magic.toString(16)}`)
  return {
    magic,
    version: view.getUint16(offset + 2, true),
    flags: view.getUint8(offset + 4),
    entityId: view.getUint16(offset + 5, true),
    totalSize: view.getUint32(offset + 7, true),
    rootOffset: view.getUint32(offset + 11, true),
    compressed: !!(view.getUint8(offset + 4) & 0x01),
    fragmented: !!(view.getUint8(offset + 4) & 0x02)
  }
}

/**
 * Build a complete frame buffer: header + vtable + data.
 */
export function buildFrame(entityId, version, vtableBuffer, dataBuffer) {
  const totalSize = HEADER_SIZE + vtableBuffer.byteLength + dataBuffer.byteLength
  const rootOffset = HEADER_SIZE + vtableBuffer.byteLength
  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)

  writeHeader(view, 0, { version, entityId, totalSize, rootOffset })

  // Copy vtable
  new Uint8Array(buffer, HEADER_SIZE, vtableBuffer.byteLength).set(new Uint8Array(vtableBuffer))

  // Copy data
  new Uint8Array(buffer, rootOffset, dataBuffer.byteLength).set(new Uint8Array(dataBuffer))

  return buffer
}

/**
 * Check if buffer starts with valid Uploop frame magic.
 */
export function isFrame(buffer) {
  if (buffer.byteLength < 4) return false
  const view = new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer)
  return view.getUint16(0, true) === MAGIC
}
