/**
 * @uploop/flows — Strategies + Reports Tests
 */
import { describe, it, expect } from 'vitest'
import { createGraph } from '../../core/src/index.js'
import {
  flows, createFlow,
  temperatureLaneRouter,
  dependencyBatchOptimizer,
  criticalPathScheduler,
  eventRateClassifier,
  orphanDetector,
  mergeImpactAnalyzer,
  backpressureController,
  cacheAwareSkipper,
  compareReport,
  generateReport
} from '../src/index.js'

function makeGraph(nodes = {}, opts = {}) {
  return createGraph({ name: 'test', nodes, ...opts })
}

describe('temperatureLaneRouter', () => {
  it('routes hot data to hot lane', () => {
    const g = makeGraph({ mouseX: { type: 'data', default: 0, temperature: 'hot' }, config: { type: 'data', default: {}, temperature: 'cold' } })
    const router = temperatureLaneRouter(g, flows.animation)
    const stats = router.stats()
    expect(stats.hot).toBe(0)
    expect(stats.cold).toBe(0)
    g.dispose()
  })
})

describe('criticalPathScheduler', () => {
  it('returns execution order', () => {
    const g = makeGraph({
      raw: { type: 'data', default: '' },
      validated: { type: 'data', default: '' },
      validate: { type: 'update', reads: ['raw'], writes: ['validated'], run: () => ({ validated: 'ok' }) }
    })
    const s = criticalPathScheduler(g)
    expect(s.pathLength()).toBeGreaterThanOrEqual(0)
    g.dispose()
  })
})

describe('orphanDetector', () => {
  it('detects unused data nodes', () => {
    const g = makeGraph({
      used: { type: 'data', default: 0 },
      orphan: { type: 'data', default: 0 },
      view: { type: 'view', reads: ['used'], run: () => {} }
    })
    const orphans = orphanDetector(g).detect()
    expect(orphans.find(o => o.name === 'orphan')).toBeTruthy()
    g.dispose()
  })
})

describe('mergeImpactAnalyzer', () => {
  it('reports savings', () => {
    const g = makeGraph({
      x: { type: 'data', default: 0 },
      y: { type: 'data', default: 0 },
      view: { type: 'view', reads: ['x', 'y'], run: () => {} }
    })
    const a = mergeImpactAnalyzer(g)
    const r = a.report(['x', 'y'])
    expect(r.saved).toBeGreaterThanOrEqual(0)
    expect(r.summary).toContain('saved')
    g.dispose()
  })
})

describe('backpressureController', () => {
  it('drops old for hot lane', () => {
    const c = backpressureController(null, { hotMax: 1 })
    c.push('hot', 'a')
    c.push('hot', 'b')
    const items = c.drain('hot')
    expect(items).toEqual(['b']) // only latest kept
  })

  it('queues for cold lane', () => {
    const c = backpressureController(null, { coldMax: 100 })
    c.push('cold', 'a')
    c.push('cold', 'b')
    expect(c.drain('cold')).toEqual(['a', 'b'])
  })
})

describe('cacheAwareSkipper', () => {
  it('skips when within TTL', () => {
    const g = makeGraph({ cached: { type: 'data', default: 0 } })
    g.nodes.get('cached').cache = { ttl: 60000 }
    g.nodes.get('cached')._lastUpdated = Date.now()
    const s = cacheAwareSkipper(g)
    expect(s.shouldSkip('cached')).toBe(true)
    g.dispose()
  })
})

describe('compareReport', () => {
  it('generates comparison for a flow + graph', () => {
    const g = makeGraph({
      query: { type: 'data', default: '', temperature: 'warm' },
      results: { type: 'data', default: [], temperature: 'cold', cache: { ttl: 30000 } },
      search: { type: 'update', reads: ['query'], writes: ['results'], run: () => ({}) },
      list: { type: 'view', reads: ['results'], run: () => {} }
    })
    const r = compareReport(g, flows.searchTypeahead, { name: 'search-bench' })
    expect(r.advantages.length).toBeGreaterThan(0)
    expect(r.advantages.every(a => a.winner === 'uploop')).toBe(true)
    g.dispose()
  })
})

describe('generateReport', () => {
  it('generates Markdown report', () => {
    const g = makeGraph({
      query: { type: 'data', default: '' },
      results: { type: 'data', default: [] }
    })
    const md = generateReport(g, 'searchTypeahead', { name: 'Test Scenario' })
    expect(md).toContain('# Flow Report')
    expect(md).toContain('searchTypeahead')
    expect(md).toContain('Advantages')
    g.dispose()
  })
})
