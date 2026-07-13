import { describe, it, expect, beforeEach } from 'vitest'
import { entity, string, number, boolean, clearRegistry } from '../../schema/src/index.js'
import { createStreamCodec, createStreamRegistry, createStreamReader, createStreamWriter, isFrame } from '../src/index.js'

beforeEach(() => clearRegistry())

describe('createStreamCodec', () => {
  it('encodes and decodes an entity', () => {
    const User = entity('User', { name: string(), age: number() })
    const codec = createStreamCodec(User)
    const buf = codec.encode({ name: 'Alice', age: 30 })
    expect(buf).toBeInstanceOf(ArrayBuffer)
    const d = codec.decode(buf)
    expect(d.name).toBe('Alice')
    expect(d.age).toBe(30)
  })

  it('isFrame detects valid frames', () => {
    const buf = createStreamCodec(entity('U', { n: string() })).encode({ n: 'x' })
    expect(isFrame(buf)).toBe(true)
    expect(isFrame(new ArrayBuffer(10))).toBe(false)
  })

  it('zero-copy view reads fields', () => {
    const codec = createStreamCodec(entity('U', { name: string(), age: number() }))
    const v = codec.view(codec.encode({ name: 'Bob', age: 25 }))
    expect(v.field('name')).toBe('Bob')
    expect(v.field('age')).toBe(25)
  })

  it('size estimates frame size', () => {
    const s = createStreamCodec(entity('U', { name: string(), age: number() })).size({ name: 'Alice', age: 30 })
    expect(s).toBeGreaterThan(20)
  })

  it('handles null/undefined values', () => {
    const codec = createStreamCodec(entity('U', { name: string(), bio: string().optional() }))
    const d = codec.decode(codec.encode({ name: 'Alice' }))
    expect(d.name).toBe('Alice')
    expect(d.bio === null || d.bio === '').toBe(true)
  })
})

describe('createStreamRegistry', () => {
  it('roundtrips multiple entities', () => {
    const reg = createStreamRegistry()
    reg.register(entity('User', { name: string() }))
    reg.register(entity('Post', { title: string() }))
    const { entity: e1, data: d1 } = reg.decode(reg.encode('User', { name: 'Alice' }))
    expect(e1).toBe('User')
    expect(d1.name).toBe('Alice')
    const { entity: e2, data: d2 } = reg.decode(reg.encode('Post', { title: 'Hi' }))
    expect(e2).toBe('Post')
    expect(d2.title).toBe('Hi')
  })
})

describe('Stream Reader/Writer', () => {
  it('roundtrip', () => {
    const reg = createStreamRegistry()
    reg.register(entity('Msg', { text: string() }))
    const w = createStreamWriter(reg), r = createStreamReader(reg)
    r.feed(w.frame('Msg', { text: 'hello' }))
    const msgs = [...r.consume()]
    expect(msgs[0].data.text).toBe('hello')
  })

  it('handles partial frames', () => {
    const reg = createStreamRegistry()
    reg.register(entity('Msg', { text: string() }))
    const w = createStreamWriter(reg), r = createStreamReader(reg)
    const frame = new Uint8Array(w.frame('Msg', { text: 'world' }))
    const half = frame.length >> 1
    r.feed(frame.slice(0, half))
    expect([...r.consume()]).toHaveLength(0)
    r.feed(frame.slice(half))
    expect([...r.consume()][0].data.text).toBe('world')
  })

  it('batch sends multiple', () => {
    const reg = createStreamRegistry()
    reg.register(entity('Msg', { text: string() }))
    const w = createStreamWriter(reg), r = createStreamReader(reg)
    r.feed(w.batch([['Msg', { text: 'a' }], ['Msg', { text: 'b' }]]))
    const msgs = [...r.consume()]
    expect(msgs[0].data.text).toBe('a')
    expect(msgs[1].data.text).toBe('b')
  })
})
