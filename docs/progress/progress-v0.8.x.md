# v0.8.x — @uploop/stream 🟢

> **Status:** In Progress (Phase 1-2 + server example complete, Phase 3 pending)  
> **Date:** 2026-06-26  
> **Tests:** 9 (stream) + 245 (flows+schema+core) = 254 total — zero regressions

## Overview

`@uploop/stream` provides schema-to-binary codec with zero-copy reads, self-framing protocol, and streaming reader/writer. Entity definitions ARE the wire format.

## Phase 1 — Core Codec ✅

- [x] `src/types.js` — Binary type definitions (15 types), encode/decode per type
- [x] `src/frame.js` — Frame protocol: magic "UL", version, flags, entity ID, VTable offset, size
- [x] `src/codec.js` — `createStreamCodec(entity)` → `{ encode, decode, view, size, encodeFrame }`
- [x] `test/stream.test.js` — 9 tests

### Binary Frame Layout

```
[Magic:2][Version:2][Flags:1][EntityID:2][TotalSize:4][RootOffset:4][VTable+Data...]
```
HEADER_SIZE = 15 bytes. VTable stores field types + offsets. Data follows.

### Supported Binary Types

| Type | Bytes | Description |
|------|-------|-------------|
| STR (0x10) | 4+N | Length-prefixed UTF-8 |
| UUID (0x11) | 16 | Raw UUID bytes |
| DATE (0x12) | 8 | Unix ms as i64 |
| F64 (0x0B) | 8 | IEEE 754 double |
| BOOL (0x01) | 1 | 0x00 or 0x01 |
| NULL (0x00) | 0 | Field not present |

### Wire Size Comparison

| Payload | JSON | Uploop Stream |
|---------|------|---------------|
| ChatMessage (5 fields) | ~200 bytes | ~82 bytes (59% smaller) |
| 1MB binary | ~1.3MB (base64) | ~1MB (zero-copy) |

## Phase 2 — Registry & Streaming ✅

- [x] `src/registry.js` — `createStreamRegistry()`, multi-entity codec management
- [x] `src/io.js` — `createStreamReader()` (feed + consume generator), `createStreamWriter()` (frame, batch, streamArray)
- [x] Reader handles partial frames, batch splitting, non-frame byte skipping
- [x] Writer supports individual frames, batched messages, stream array

## Phase 3 — Remaining

- [ ] Delta encoding — only send changed fields between messages
- [ ] VTable pooling — share identical vtables across messages (12% smaller)
- [ ] Compression — per-message deflate/LZ4 with threshold
- [ ] Fragmentation — split large messages (>64KB) into fragments
- [ ] Encryption — optional AES-GCM per-frame
- [ ] Schema compatibility — `isCompatible()` version checking
- [ ] Performance benchmarks vs JSON.stringify, MessagePack, Protobuf

## Phase 4 — Integration

- [x] `server-examples/stream/server.mjs` — Binary WebSocket chat with pipeline
- [ ] Full binary client (browser reader/writer via @uploop/stream)
- [ ] Schema manifest endpoint integration with @uploop/schema wire protocol
- [ ] Integration test: binary roundtrip through actual WebSocket

## Package Files

```
packages/stream/src/
├── index.js      # Public API
├── types.js      # 15 binary field types, encoders/decoders
├── frame.js      # Frame protocol (MAGIC, HEADER_SIZE, readHeader, writeHeader, buildFrame)
├── codec.js      # createStreamCodec(entity) — encode/decode/view
├── registry.js   # createStreamRegistry — multi-entity codec
└── io.js         # createStreamReader, createStreamWriter
```
