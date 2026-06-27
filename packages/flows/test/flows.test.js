import { describe, it, expect } from 'vitest'
import { createGraph } from '../../core/src/index.js'
import { flows, listFlows, suggestFlow, createFlow } from '../src/index.js'

describe('flows registry', () => {
  it('has 24 flow profiles', () => {
    expect(Object.keys(flows).length).toBe(24)
  })
  it('each flow has required fields', () => {
    for (const [name, flow] of Object.entries(flows)) {
      expect(flow.name).toBe(name)
      expect(flow.category).toBeTruthy()
      expect(flow.executors.length).toBeGreaterThan(0)
      expect(flow.tuning).toBeDefined()
      expect(flow.lanes).toBeDefined()
    }
  })
  it('listFlows() filters by category', () => {
    expect(listFlows({ category: 'ui' }).length).toBe(6)
  })
})

describe('suggestFlow()', () => {
  it('suggests based on graph structure', () => {
    const g = createGraph({ name: 'test', nodes: { name: { type: 'data', default: '' }, email: { type: 'data', default: '' } } })
    const s = suggestFlow(g)
    expect(typeof s.recommended).toBe('string')
    expect(s.reasoning.length).toBeGreaterThan(0)
    g.dispose()
  })
})

describe('createFlow()', () => {
  it('applies flow and preserves graph API', () => {
    const graph = createGraph({
      name: 'ctr', nodes: { count: { type: 'data', default: 0 },
        inc: { type: 'update', reads: ['count'], writes: ['count'], run: (s) => ({ count: s.count + 1 }) } },
      on: { click: 'inc' }
    })
    const tuned = createFlow(graph, 'form')
    expect(tuned.flowName).toBe('form')
    expect(tuned.getNode('count')).toBe(0)
    tuned.send('click')
    expect(tuned.getNode('count')).toBe(1)
    expect(tuned.describe().flow).toBe('form')
    tuned.dispose()
  })

  it('by profile object', () => {
    const g = createGraph({ nodes: { x: { type: 'data', default: 0 } } })
    const t = createFlow(g, flows.searchTypeahead)
    expect(t.getTuning().debounce).toBe(200)
    g.dispose()
  })

  it('laneOf pattern matching', () => {
    const g = createGraph({ nodes: { x: { type: 'data', default: 0 } } })
    const t = createFlow(g, 'chat')
    expect(t.laneOf('messages.incoming')).toBe('hot')
    expect(t.laneOf('messages.history')).toBe('cold')
    g.dispose()
  })

  it('throws for unknown flow', () => {
    const g = createGraph({ nodes: { x: { type: 'data', default: 0 } } })
    expect(() => createFlow(g, 'nope')).toThrow()
    g.dispose()
  })
})
