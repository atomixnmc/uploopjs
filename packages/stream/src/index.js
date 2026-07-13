/**
 * @uploop/stream — Schema-to-binary codec, zero-copy, self-framing streams.
 *
 * @module @uploop/stream
 */
export { createStreamCodec } from './codec.js'
export { createStreamRegistry } from './registry.js'
export { createStreamReader, createStreamWriter } from './io.js'
export { isFrame, MAGIC, HEADER_SIZE, readHeader, writeHeader, buildFrame } from './frame.js'
export { TYPE, typeLabel, getFieldEncoder } from './types.js'
