# v0.7.x — @uploop/flows 🟢

> **Status:** v0.3.0 — Profiles, Algorithms, Executor, Actor & Reactive patterns shipped  
> **Date:** 2026-06-27  
> **Tests:** 167 (flows) + 237 (schema+stream+core) = 404 total — zero regressions

## Overview

`@uploop/flows` is the breakthrough execution layer of Uploop. It provides pre-tuned profiles, production-quality algorithms, a lane-based execution engine, worker pools, and first-class actor/reactive programming patterns — all built on HyperGraph.

## Package Version History

| Version | Deliverable | Tests |
|---------|------------|-------|
| `0.1.0` | 24 flow profiles, registry, builder, pipelines | 17 |
| `0.2.0` | 50 enterprise profiles + 12 deep algorithm implementations | 100 |
| `0.3.0` | Execution engine, worker pool, actor & reactive patterns | 167 |

## Phase 1 — Core Flow Engine ✅ (v0.1.0)

- [x] `src/registry.js` — 74 flow profiles with tuning, lanes, detection heuristics
- [x] `src/builder.js` — `createFlow()`, `createMixedFlow()`
- [x] `test/flows.test.js` — 11 tests

### 74 Flow Profiles

| Category | Count | Profiles |
|----------|-------|---------|
| UI | 6 | form, list, dashboard, chat, infiniteScroll, searchTypeahead |
| Real-Time | 3 | realtimeCollab, liveLeaderboard, liveCursor |
| Data | 13 | dataGrid, dataPipeline, analyticsRealtime, mapReduce, windowedAggregation, deduplicationFilter, enrichmentPipeline, schemaMigration, dataMasking, snapshotManager, timeSeriesCompaction, joinOperator, fanOutFanIn |
| Media | 5 | videoPlayer, canvas2D, webGL3D, animation, imageEditor |
| Infra | 13 | offlineFirst, ssrHydration, serviceWorker, connectionPool, objectPool, batchProcessor, priorityQueue, workStealing, shardedCache, writeBehindCache, readThroughCache, gossipProtocol, consistentHashing |
| Games | 3 | turnBased, realTime, physics |
| AI | 1 | aiAgent |
| Enterprise | 10 | eventBus, messageRouter, deadLetterQueue, idempotencyGuard, sagaOrchestrator, eventSourcing, cqrsPipeline, changeDataCapture, workflowEngine, outboxPattern |
| Resilience | 10 | circuitBreaker, rateLimiter, retryWithBackoff, bulkhead, gracefulShutdown, healthCheck, featureFlag, distributedLock, auditTrail, reconciliationLoop |
| Streaming | 10 | websocketMultiplexer, serverSentEvents, adaptiveBitrate, jitterBuffer, forwardErrorCorrection, mediaTranscoder, videoSegmenter, liveTranscription, thumbnailGenerator, streamReplay |

## Phase 2 — Breakthrough Strategies ✅

- [x] `src/strategies.js` — 10 reusable strategy functions
- [x] `src/report.js` — `generateReport()`, `generateAllFlowsComparison()`
- [x] `test/strategies.test.js` — 9 tests

### 10 Strategies

| Strategy | What it does |
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

## Phase 3 — Pipelines & Event Streams ✅

- [x] `src/pipeline.js` — `pipeline()`, `queue()`, `eventStream()`
- [x] Composable: `.map()`, `.filter()`, `.tap()`, `.validate()`, `.debounce()`, `.sink()`, `.into()`, `.catch()`
- [x] Queue with concurrency control (fifo/lifo/priority)
- [x] Event stream with emit/on/pipe/replay/history

## Phase 4 — 12 Production-Quality Algorithm Implementations ✅ (v0.2.0)

- [x] `src/profiles/circuitBreaker.js` — 3-state machine (CLOSED/OPEN/HALF_OPEN), sliding window failure counting, fallback
- [x] `src/profiles/rateLimiter.js` — Token bucket, sliding window, fixed window algorithms; per-key isolation
- [x] `src/profiles/retryWithBackoff.js` — Exponential/linear/fixed backoff with full jitter, retryable predicate
- [x] `src/profiles/batchProcessor.js` — Size+latency triggered flush, groupBy, backpressure modes
- [x] `src/profiles/priorityQueue.js` — Binary min-heap per level, aging, per-level concurrency, starvation prevention
- [x] `src/profiles/deduplicationFilter.js` — 2-stage Bloom + LRU, configurable false positive rate
- [x] `src/profiles/eventBus.js` — Wildcard pub/sub (* segment, > recursive), replay, stats
- [x] `src/profiles/idempotencyGuard.js` — Key-based LRU cache with TTL, response replay, error caching
- [x] `src/profiles/deadLetterQueue.js` — Per-source ring buffer, TTL auto-expiry, alert threshold
- [x] `src/profiles/bulkhead.js` — Semaphore-based concurrency per partition, queue timeout
- [x] `src/profiles/sagaOrchestrator.js` — Compensating transactions, reverse-order rollback, per-step timeout
- [x] `src/profiles/fanOutFanIn.js` — Scatter-gather with partial policies, aggregate, timeout
- [x] `test/profiles.test.js` — 80 tests

## Phase 5 — Advanced Execution Engine ✅ (v0.3.0)

- [x] `src/executor.js` — Lane-based scheduling (critical/hot/warm/cold/idle), batch dispatcher, frame budgets, abort contexts, lane router, execution monitor
- [x] `src/workerPool.js` — Worker thread pool with load balancing, transferable support, dead worker detection
- [x] `test/executor.test.js` — 33 tests

### 5 Execution Lanes

| Lane | Mechanism | Budget | Use case |
|------|-----------|--------|----------|
| `critical` | microtask | ∞ | State commits, DB writes |
| `hot` | requestAnimationFrame | 4ms | UI paint, game loop |
| `warm` | postTask / microtask | 8ms | Data derivation, API |
| `cold` | requestIdleCallback | 50ms | Prefetch, analytics |
| `idle` | setTimeout(0) | ∞ | Logs, cleanup |

### Documented JS Runtime Limitations

All 6 constraints documented with Long (v1.0) solutions: no true parallelism, cooperative multitasking, GC pauses, timer granularity, no I/O priority, worker startup cost.

## Phase 6 — Actor & Reactive Patterns ✅ (v0.3.0)

- [x] `src/actor.js` — `createActor()` with sequential mailbox, send/tell/ask, child spawning, `createActorSystem()` with supervision tree
- [x] `src/reactive.js` — `createSignal()`, `createComputed()`, `createEffect()`, `batch()`, `createReactiveStore()`, `createResource()`, `reactiveFromGraph()`
- [x] `test/patterns.test.js` — 34 tests

### Pattern Choice Guide

| Pattern | When | API |
|---------|------|-----|
| **Actor** | Distributed state, fault isolation, supervision | `createActor()`, `send/tell/ask` |
| **Reactive** | UI-derived data, computed views, form wiring | `createSignal()`, `createComputed()` |
| **Pipeline/Queue** | Stream processing, ETL, batch work | `pipeline()`, `queue()` |
| **HyperGraph** | Complex relationships, multi-entity graphs | `createGraph()` |

## Phase 7 — Remaining

- [ ] Deep executor integration — route actual graph updates through selected executor
- [ ] Per-subgraph flow routing in `createMixedFlow()`
- [ ] Real benchmarks (not estimates): search typeahead, data grid, chat at scale
- [ ] Long runtime benchmarks (v1.0): compare JS vs native execution

## Comparison Stats (vs React/Solid)

| Metric | React | Solid | Uploop |
|--------|-------|-------|--------|
| Total LOC (5 scenarios) | 196 | 148 | **69** |
| Hook/Primitive count | 25 | 18 | 22 |
| Manual boilerplate | 20 | 13 | **0** |
| Search re-renders (5 keystrokes) | 15 | 15 updates | **2** changes |
| Built-in profiles | 0 | 0 | **74** |
| Production algorithms | 0 (3rd-party) | 0 (3rd-party) | **12** |
| Execution engine | 1 strategy | 1 strategy | **5 lanes** |
| Pattern primitives | 1 (hooks) | 1 (signals) | **4** (actor/reactive/pipeline/graph) |

## Package File Layout

```
packages/flows/
├── src/
│   ├── index.js           # Public API
│   ├── registry.js        # 74 flow profiles + suggestFlow()
│   ├── builder.js          # createFlow(), createMixedFlow()
│   ├── strategies.js       # 10 breakthrough strategies
│   ├── pipeline.js         # pipeline(), queue(), eventStream()
│   ├── report.js           # generateReport()
│   ├── executor.js         # Lane scheduler, batch, frame budget, abort context, lane router, monitor
│   ├── workerPool.js       # Worker thread pool
│   ├── actor.js            # Actor model + supervision system
│   ├── reactive.js         # Signals, computed, effects, store, resource
│   └── profiles/
│       ├── index.js
│       ├── circuitBreaker.js
│       ├── rateLimiter.js
│       ├── retryWithBackoff.js
│       ├── batchProcessor.js
│       ├── priorityQueue.js
│       ├── deduplicationFilter.js
│       ├── eventBus.js
│       ├── idempotencyGuard.js
│       ├── deadLetterQueue.js
│       ├── bulkhead.js
│       ├── sagaOrchestrator.js
│       └── fanOutFanIn.js
├── test/
│   ├── flows.test.js       # 11 tests
│   ├── strategies.test.js  # 9 tests
│   ├── profiles.test.js    # 80 tests
│   ├── executor.test.js    # 33 tests
│   └── patterns.test.js    # 34 tests
├── README.md
└── package.json
```
