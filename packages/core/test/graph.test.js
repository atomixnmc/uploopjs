import { describe, it, expect } from 'vitest'
import { createGraph } from '../src/index.js'

describe('createGraph', () => {
  it('creates a graph with data nodes', () => {
    const g = createGraph({
      name: 'test',
      nodes: {
        count: { type: 'data', default: 0, lifetime: 'transient' }
      }
    })
    expect(g.get().count).toBe(0)
    expect(g.nodes.names).toEqual(['count'])
    expect(g.nodes.types).toEqual({ count: 'data' })
  })

  it('processes events through update nodes', () => {
    const g = createGraph({
      name: 'counter',
      nodes: {
        count: { type: 'data', default: 0 },
        inc: { type: 'update', reads: ['count'], writes: ['count'], run: (s) => ({ count: s.count + 1 }) }
      },
      on: { click: 'inc' }
    })

    expect(g.get().count).toBe(0)
    g.send('click')
    expect(g.get().count).toBe(1)
    g.send('click')
    expect(g.get().count).toBe(2)
  })

  it('notifies views when data changes', async () => {
    const viewResults = []
    const g = createGraph({
      name: 'test',
      nodes: {
        count: { type: 'data', default: 0 },
        inc: { type: 'update', reads: ['count'], writes: ['count'], run: (s) => ({ count: s.count + 1 }) },
        display: { type: 'view', reads: ['count'], run: (data) => { viewResults.push(data.count) } }
      },
      on: { click: 'inc' }
    })

    g.send('click')
    await new Promise(r => setTimeout(r, 0))
    expect(viewResults).toContain(1)
  })

  it('supports multiple data nodes', () => {
    const g = createGraph({
      name: 'form',
      nodes: {
        name: { type: 'data', default: '' },
        email: { type: 'data', default: '' }
      }
    })
    expect(g.get()).toEqual({ name: '', email: '' })
  })

  it('exports rich describe() manifest', () => {
    const g = createGraph({
      name: 'search',
      nodes: {
        query: { type: 'data', default: '', lifetime: 'transient' },
        results: { type: 'data', default: [], lifetime: 'cold' },
        search: { type: 'update', reads: ['query'], writes: ['results'], run: () => ({}) }
      },
      on: { input: 'search' }
    })

    const desc = g.describe()
    expect(desc.kind).toBe('uploop.graph')
    expect(desc.name).toBe('search')
    expect(desc.nodes.query.lifetime).toBe('transient')
    expect(desc.nodes.results.lifetime).toBe('cold')
    expect(desc.nodes.search.reads).toEqual(['query'])
    expect(desc.nodes.search.writes).toEqual(['results'])
    expect(desc.nodes.search.run).toBeUndefined() // functions stripped
  })

  it('supports direct set on data nodes', () => {
    const g = createGraph({
      nodes: { x: { type: 'data', default: 0 } }
    })
    g.set('x', 42)
    expect(g.getNode('x')).toBe(42)
  })

  it('enforces maxEventDepth guard', () => {
    let rejected = []
    const g = createGraph({
      maxEventDepth: 3,
      nodes: {
        count: { type: 'data', default: 0 },
        a: { type: 'update', reads: ['count'], writes: ['count'], run: (s) => { g.send('b'); return s } },
        b: { type: 'update', reads: ['count'], writes: ['count'], run: (s) => { g.send('a'); return s } }
      },
      on: { a: 'a', b: 'b' },
      onEventRejected: (ev) => rejected.push(ev.type)
    })
    g.send('a')
    expect(rejected.length).toBeGreaterThan(0)
    expect(g.events.rejected).toBeGreaterThan(0)
  })
})
