import { describe, it, expect } from 'vitest'
import { createGraph } from '../../core/src/index.js'
import { flows, listFlows, suggestFlow, createFlow } from '../src/index.js'

describe('flows registry', () => {
  it('has 74 flow profiles (24 original + 50 enterprise)', () => {
    expect(Object.keys(flows).length).toBe(74)
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
    expect(listFlows({ category: 'enterprise' }).length).toBe(10)
    expect(listFlows({ category: 'resilience' }).length).toBe(10)
    expect(listFlows({ category: 'streaming' }).length).toBe(10)
  })
  it('all 10 categories present', () => {
    const cats = new Set(Object.values(flows).map(f => f.category))
    expect(cats).toContain('ui')
    expect(cats).toContain('real-time')
    expect(cats).toContain('data')
    expect(cats).toContain('media')
    expect(cats).toContain('infra')
    expect(cats).toContain('games')
    expect(cats).toContain('ai')
    expect(cats).toContain('enterprise')
    expect(cats).toContain('resilience')
    expect(cats).toContain('streaming')
  })
  it('enterprise flows use etl-guru and ring-buffer executors', () => {
    const enterprise = listFlows({ category: 'enterprise' })
    for (const f of enterprise) {
      expect(f.executors.some(e => ['etl-guru', 'ring-buffer', 'reactive-tower'].includes(e))).toBe(true)
    }
  })
  it('resilience flows define circuit breaker / retry / rate limit patterns', () => {
    const resilience = listFlows({ category: 'resilience' })
    const names = resilience.map(f => f.name)
    expect(names).toContain('circuitBreaker')
    expect(names).toContain('rateLimiter')
    expect(names).toContain('retryWithBackoff')
    expect(names).toContain('bulkhead')
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
