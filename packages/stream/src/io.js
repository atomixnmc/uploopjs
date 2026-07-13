/**
 * Stream Reader/Writer — framed streaming over binary channels.
 * @module @uploop/stream/io
 */
import { MAGIC, readHeader } from './frame.js'

export function createStreamReader(registry) {
  let buffer = new Uint8Array(0)

  function feed(chunk) {
    const incoming = chunk instanceof Uint8Array ? chunk :
      chunk instanceof ArrayBuffer ? new Uint8Array(chunk) :
      new Uint8Array(chunk.buffer || chunk)
    const combined = new Uint8Array(buffer.length + incoming.length)
    combined.set(buffer)
    combined.set(incoming, buffer.length)
    buffer = combined
  }

  function *consume() {
    while (buffer.length >= 2) {
      // Check magic at start of buffer
      const view = new DataView(buffer.buffer, buffer.byteOffset, Math.min(buffer.length, 2))
      if (view.getUint16(0, true) !== MAGIC) {
        buffer = buffer.slice(1) // Skip non-frame byte
        continue
      }

      if (buffer.length < 15) break // Need full header

      const hv = new DataView(buffer.buffer, buffer.byteOffset, 15)
      const header = readHeader(hv, 0)
      const totalSize = header.totalSize

      if (buffer.length < totalSize) break // Wait for more data

      const frameSlice = buffer.slice(0, totalSize)
      buffer = buffer.slice(totalSize)

      try {
        const result = registry.decode(frameSlice.buffer.slice(frameSlice.byteOffset, frameSlice.byteOffset + totalSize))
        yield { entity: result.entity, data: result.data, size: totalSize }
      } catch (e) {
        yield { entity: 'error', data: null, error: e.message, size: totalSize }
      }
    }
  }

  function pending() { return buffer.length }

  return { feed, consume, pending }
}

export function createStreamWriter(registry) {
  function frame(entityName, data) {
    return registry.encode(entityName, data)
  }

  function batch(messages) {
    let total = 0
    const bufs = []
    for (const [entityName, data] of messages) {
      const buf = registry.encode(entityName, data)
      bufs.push(new Uint8Array(buf))
      total += buf.byteLength
    }
    const combined = new Uint8Array(total)
    let off = 0
    for (const b of bufs) { combined.set(b, off); off += b.length }
    return combined.buffer
  }

  function *streamArray(entityName, items, opts = {}) {
    const chunkSize = opts.chunkSize || 100
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize)
      yield batch(chunk.map(item => [entityName, item]))
    }
  }

  return { frame, batch, streamArray }
}
