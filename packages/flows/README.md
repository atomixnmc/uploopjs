# @uploop/flows

Pre-tuned execution profiles with breakthrough strategies. The graph decides the executor. The flow tunes the executor.

## Install

```bash
npm install @uploop/flows
```

## Why

Most frameworks ship **one execution strategy** for everything — React always reconciles, Solid always reacts, Kafka always pipelines. Uploop has 7 executor archetypes. `@uploop/flows` selects the right one, tunes its parameters, and assigns lane routing per use case.

## Quick Start

```js
import { createGraph } from '@uploop/core'
import { createFlow, flows } from '@uploop/flows'

const searchGraph = createGraph({
  nodes: {
    query:   { type: 'data',   default: '' },
    results: { type: 'data',   default: [] },
    search:  { type: 'update', reads: ['query'], writes: ['results'],
               debounce: 200, interruptible: true,
               run: async (s, q, { signal }) => {
                 const r = await fetch(`/api?q=${q}`, { signal })
                 return { results: await r.json() }
               }
    }
  }
})

const tuned = createFlow(searchGraph, flows.searchTypeahead)
// → Auto-applied: 200ms debounce, AbortController, LRU cache, ring buffer
```

## 74 Flow Profiles

| Category | Count | Key Profiles |
|----------|-------|-------------|
| **UI** | 6 | form, list, dashboard, chat, infiniteScroll, searchTypeahead |
| **Real-Time** | 3 | realtimeCollab, liveLeaderboard, liveCursor |
| **Data** | 13 | dataGrid, dataPipeline, analyticsRealtime, mapReduce, windowedAggregation, deduplicationFilter, enrichmentPipeline, schemaMigration, dataMasking, snapshotManager, timeSeriesCompaction, joinOperator, fanOutFanIn |
| **Media** | 5 | videoPlayer, canvas2D, webGL3D, animation, imageEditor |
| **Infra** | 13 | offlineFirst, ssrHydration, serviceWorker, connectionPool, objectPool, batchProcessor, priorityQueue, workStealing, shardedCache, writeBehindCache, readThroughCache, gossipProtocol, consistentHashing |
| **Games** | 3 | turnBased, realTime, physics |
| **AI** | 1 | aiAgent |
| **Enterprise** | 10 | eventBus, messageRouter, deadLetterQueue, idempotencyGuard, sagaOrchestrator, eventSourcing, cqrsPipeline, changeDataCapture, workflowEngine, outboxPattern |
| **Resilience** | 10 | circuitBreaker, rateLimiter, retryWithBackoff, bulkhead, gracefulShutdown, healthCheck, featureFlag, distributedLock, auditTrail, reconciliationLoop |
| **Streaming** | 10 | websocketMultiplexer, serverSentEvents, adaptiveBitrate, jitterBuffer, forwardErrorCorrection, mediaTranscoder, videoSegmenter, liveTranscription, thumbnailGenerator, streamReplay |

## API

### `createFlow(graph, profile)`

Apply a flow profile to a graph. Returns a tuned graph with executor selection, lane routing, and parameter tuning.

```js
const tuned = createFlow(graph, 'form')
// or by reference
const tuned = createFlow(graph, flows.form)
// or mixed — per-subgraph tuning
const tuned = createMixedFlow(graph, {
  subgraphs: { sidebar: 'list', main: 'dashboard', chat: 'chat' }
})
```

### `listFlows(filter?)`

List all available flow profiles, optionally filtered by category.

```js
listFlows()                          // all 74
listFlows({ category: 'enterprise' }) // 10 enterprise flows
```

### `suggestFlow(graph)`

Heuristic flow recommendation based on graph structure.

```js
const { recommended, alternatives, reasoning } = suggestFlow(myGraph)
```

## 10 Breakthrough Strategies

| Strategy | What It Does |
|----------|-------------|
| `temperatureLaneRouter` | Route hot→RAF, warm→microtask, cold→idle |
| `dependencyBatchOptimizer` | Merge view notifications via dependency analysis |
| `criticalPathScheduler` | Topological sort prevents glitches |
| `eventRateClassifier` | Auto-classify nodes from write frequency |
| `orphanDetector` | Detect + prune unreferenced data nodes |
| `mergeImpactAnalyzer` | Quantify batching savings |
| `frameBudgetEnforcer` | Per-frame time budgets, yield when over |
| `backpressureController` | Per-lane drop/coalesce/queue policies |
| `cacheAwareSkipper` | Skip updates within cache TTL |
| `predictivePrefetcher` | Prefetch cold data during idle |

## Composable Primitives

```js
import { pipeline, queue, eventStream } from '@uploop/flows'

// Pipeline — chainable transforms
pipeline()
  .map(enrich)
  .filter(valid)
  .debounce(300)
  .validate(schema)
  .sink(handler)
  .catch(onError)

// Queue — concurrency-controlled work
const q = queue({ concurrency: 5, mode: 'fifo' })
q.enqueue(job1)
q.enqueue(job2)

// Event stream — pub/sub with replay
const stream = eventStream()
stream.on('user.*', handler)
stream.emit('user.login', { id: 1 })
stream.replay('user.login') // → [{ id: 1 }]
```

## Enterprise Flow Examples

### Circuit Breaker
```js
// Wrap any external call with circuit breaker protection
const breaker = createFlow(graph, flows.circuitBreaker)
// → Fails open after 5 failures. Half-open probe after 30s. Auto-fallback.
```

### Saga Orchestrator
```js
// Distributed transaction with automatic compensation
const saga = createFlow(graph, flows.sagaOrchestrator)
// → Order → Payment → Inventory → Shipment. Any failure triggers compensate chain.
```

### Change Data Capture
```js
// Tail database WAL, fanout to search index + cache invalidator
const cdc = createFlow(graph, flows.changeDataCapture)
// → Polls every 1s. Fans out to ElasticSearch indexer + Redis cache invalidator.
```

## License

MIT
