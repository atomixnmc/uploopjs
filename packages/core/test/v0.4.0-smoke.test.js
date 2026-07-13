/**
 * v0.4.0 Integration Smoke Tests
 *
 * Verifies:
 * 1. Graph engine plan()
 * 2. Template parts for diffing
 * 3. Patch execution strategy
 * 4. DataFlow features (subscriptions, critical path, orphans, etc.)
 * 5. Frame lane auto-selection
 * 6. Event causal chain
 */
import { describe, it, expect } from 'vitest'
import { createGraph } from '../src/graph.js'
import { createDOMExecution, createRunner } from '../src/execution.js'
import { html, patchTemplate } from '../../html/src/html.js'

// ── Breakthrough 1: Graph Engine plan() ──────────────────

describe('v0.4.0 — Graph Engine', () => {
  it('plan() returns affected views for changed data', () => {
    const graph = createGraph({
      name: 'test',
      nodes: {
        count: { type: 'data', default: 0 },
        message: { type: 'data', default: 'hello' },
        inc: { type: 'update', reads: ['count'], writes: ['count'], run: (s) => ({ count: s.count + 1 }) },
        counterView: { type: 'view', reads: ['count'], run: () => {} },
        msgView: { type: 'view', reads: ['message'], run: () => {} },
      },
      edges: [['inc-click', 'inc']]
    })

    const plan = graph.plan(['count'])
    expect(plan.views).toContain('counterView')
    expect(plan.views).not.toContain('msgView')
    expect(plan.changed).toEqual(['count'])
  })

  it('whatReads / whatWrites return correct dependencies', () => {
    const graph = createGraph({
      name: 'test',
      nodes: {
        count: { type: 'data', default: 0 },
        inc: { type: 'update', reads: ['count'], writes: ['count'], run: (s) => ({ count: s.count + 1 }) },
        counterView: { type: 'view', reads: ['count'], run: () => {} },
      }
    })

    expect(graph.whatReads('count')).toContain('counterView')
    expect(graph.whatReads('count')).toContain('inc')
    expect(graph.whatWrites('count')).toContain('inc')
  })

  it('serialize / fromJSON roundtrips', () => {
    const graph = createGraph({
      name: 'test',
      nodes: {
        count: { type: 'data', default: 42 },
        counterView: { type: 'view', reads: ['count'], run: () => {} },
      }
    })

    graph.set('count', 99)
    const json = graph.serialize()
    const restored = createGraph.fromJSON(json)

    expect(restored.get().count).toBe(99)
    expect(restored.describe().name).toBe('test')
  })

  it('topologicalSort returns valid order', () => {
    const graph = createGraph({
      name: 'test',
      nodes: {
        a: { type: 'data', default: 0 },
        b: { type: 'data', default: 0 },
        updateA: { type: 'update', reads: [], writes: ['a'], run: () => ({ a: 1 }) },
        updateB: { type: 'update', reads: ['a'], writes: ['b'], run: (s) => ({ b: s.a + 1 }) },
      }
    })

    const sorted = graph.topologicalSort()
    const idxA = sorted.indexOf('updateA')
    const idxB = sorted.indexOf('updateB')
    expect(idxA).toBeLessThan(idxB)
  })

  it('plan returns frame lane from data temperature', () => {
    const graph = createGraph({
      name: 'test',
      nodes: {
        mouseX: { type: 'data', default: 0, temperature: 'hot' },
        config: { type: 'data', default: {}, temperature: 'cold' },
        tracker: { type: 'view', reads: ['mouseX'], run: () => {} },
        settings: { type: 'view', reads: ['config'], run: () => {} },
      }
    })

    expect(graph.plan(['mouseX']).frame).toBe('visual')
    expect(graph.plan(['config']).frame).toBe('idle')
  })
})

// ── Breakthrough 2: Template Parts ───────────────────────

describe('v0.4.0 — Template Parts', () => {
  it('html() returns parts array with values', () => {
    const count = 5
    const result = html`<div>Count: ${count}</div>`

    expect(result.parts).toBeDefined()
    expect(result.parts.length).toBe(1)
    expect(result.parts[0].type).toBe('text')
    expect(result.parts[0].value).toBe(5)
  })

  it('parts record event, prop, and bool bindings', () => {
    const result = html`<div>
      <button @click=${() => {}}>Click</button>
      <input .value=${'hello'} />
      <input ?disabled=${true} />
    </div>`

    expect(result.parts.length).toBe(3)
    expect(result.parts.find(p => p.type === 'event')).toBeTruthy()
    expect(result.parts.find(p => p.type === 'prop')).toBeTruthy()
    expect(result.parts.find(p => p.type === 'bool')).toBeTruthy()
  })

  it('template string does NOT contain markers (backward compat)', () => {
    const result = html`<div>Count: ${42}</div>`
    expect(result.template).not.toContain('<!--up:')
    expect(result.template).toContain('Count: 42')
  })

  it('parts values() getter returns value map', () => {
    const result = html`<div>Hello ${'world'}, count: ${42}</div>`
    const vals = result.values()
    expect(Object.keys(vals).length).toBe(2)
  })
})

// ── Breakthrough 3: Patch Execution ──────────────────────

describe('v0.4.0 — Patch Execution', () => {
  it('createDOMExecution supports patch method', () => {
    const exec = createDOMExecution()
    expect(exec.patch).toBeDefined()
  })

  it('createRunner computes delta and updates DOM', () => {
    const exec = createDOMExecution()
    const runner = createRunner(exec)
    const oldOutput = html`<input .value=${'old'} />`
    const newOutput = html`<input .value=${'new'} />`
    const target = document.createElement('div')
    runner.mount(target, oldOutput, {})
    runner.update(newOutput, {})
    expect(target.innerHTML).toContain('data-up-prop')
    runner.unmount()
  })
})

// ── v0.4.0: DataFlow Features ────────────────────────────

describe('v0.4.0 — DataFlow Features', () => {
  it('onDataChange subscribes to specific data node', () => {
    const graph = createGraph({
      name: 'test',
      nodes: {
        count: { type: 'data', default: 0 },
        name: { type: 'data', default: 'alice' },
      }
    })

    const changes = []
    graph.onDataChange('count', (nv, ov) => changes.push({ nv, ov }))
    graph.set('count', 5)
    graph.set('name', 'bob')

    expect(changes.length).toBe(1)
    expect(changes[0]).toEqual({ nv: 5, ov: 0 })
  })

  it('criticalPath finds longest dependency chain', () => {
    const graph = createGraph({
      name: 'test',
      nodes: {
        raw: { type: 'data', default: '' },
        validated: { type: 'data', default: '' },
        displayed: { type: 'data', default: '' },
        validate: { type: 'update', reads: ['raw'], writes: ['validated'], run: (s) => ({ validated: s.raw }) },
        format: { type: 'update', reads: ['validated'], writes: ['displayed'], run: (s) => ({ displayed: s.validated }) },
        view: { type: 'view', reads: ['displayed'], run: () => {} },
      }
    })

    const cp = graph.criticalPath()
    expect(cp.length).toBeGreaterThanOrEqual(2)
  })

  it('findOrphans detects unused data nodes', () => {
    const graph = createGraph({
      name: 'test',
      nodes: {
        used: { type: 'data', default: 0 },
        orphan: { type: 'data', default: 0 },
        update: { type: 'update', reads: ['used'], writes: ['used', 'orphan'], run: (s) => ({ used: s.used + 1 }) },
        view: { type: 'view', reads: ['used'], run: () => {} },
      }
    })

    const orphans = graph.findOrphans()
    expect(orphans.find(o => o.name === 'orphan')).toBeTruthy()
  })

  it('events.rate tracks event frequency', () => {
    const graph = createGraph({
      name: 'test',
      nodes: { count: { type: 'data', default: 0 }, inc: { type: 'update', reads: ['count'], writes: ['count'], run: (s) => ({ count: s.count + 1 }) } },
      on: { click: 'inc' }
    })
    graph.send('click')
    graph.send('click')
    expect(graph.events.rate('click').total).toBe(2)
  })

  it('hot events detection', () => {
    const graph = createGraph({
      name: 'test',
      nodes: { count: { type: 'data', default: 0 }, inc: { type: 'update', reads: ['count'], writes: ['count'], run: (s) => ({ count: s.count + 1 }) } },
      on: { click: 'inc' }
    })
    for (let i = 0; i < 50; i++) graph.send('click')
    expect(graph.events.hot(0).length).toBeGreaterThanOrEqual(1)
  })

  it('mergeStats shows view deduplication benefit', () => {
    const graph = createGraph({
      name: 'test',
      nodes: {
        x: { type: 'data', default: 0 },
        y: { type: 'data', default: 0 },
        view: { type: 'view', reads: ['x', 'y'], run: () => {} },
      }
    })
    const stats = graph.mergeStats(['x', 'y'])
    expect(stats.viewsNotified).toBe(1)
    expect(stats.saved).toBe(1)
  })

  it('diff detects structural changes', () => {
    const g1 = createGraph({ name: 'a', nodes: { x: { type: 'data', default: 0 } } })
    const g2 = createGraph({ name: 'a', nodes: { x: { type: 'data', default: 0 }, y: { type: 'data', default: 1 } } })
    expect(g1.diff(g2).added).toContain('y')
  })

  it('trackCausality records event chain', () => {
    const graph = createGraph({
      name: 'test', trackCausality: true,
      nodes: { count: { type: 'data', default: 0 }, inc: { type: 'update', reads: ['count'], writes: ['count'], run: (s) => ({ count: s.count + 1 }) } },
      on: { click: 'inc' }
    })
    graph.send('click')
    expect(graph.eventChain().length).toBe(1)
  })

  it('heuristic infers temperature from event rate', () => {
    const graph = createGraph({
      name: 'test', heuristic: true,
      nodes: { count: { type: 'data', default: 0 }, inc: { type: 'update', reads: ['count'], writes: ['count'], run: (s) => ({ count: s.count + 1 }) } },
      on: { click: 'inc' }
    })
    for (let i = 0; i < 20; i++) graph.send('click')
    expect(graph.inferTemperature('count', {})).toBe('hot')
  })
})
