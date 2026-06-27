# v0.7.x — @uploop/flows 🟢

> **Status:** In Progress (Phases 1-4 complete, 50 enterprise flows added, Phase 5 remaining)  
> **Date:** 2026-06-27  
> **Tests:** 20 (flows) + 234 (schema+stream+core) = 254 total — zero regressions

## Overview

`@uploop/flows` provides pre-tuned execution profiles, breakthrough strategies, and composable pipelines. The graph decides the executor. The flow tunes the executor.

## Phase 1 — Core Flow Engine ✅

- [x] `src/registry.js` — 24 flow profiles with tuning, lanes, detection heuristics
- [x] `src/builder.js` — `createFlow()`, `createMixedFlow()`
- [x] `src/index.js` — public API
- [x] `test/flows.test.js` — 8 tests

### 24 Flow Profiles

| Category | Flows |
|----------|-------|
| UI (6) | `form`, `list`, `dashboard`, `chat`, `infiniteScroll`, `searchTypeahead` |
| Real-Time (3) | `realtimeCollab`, `liveLeaderboard`, `liveCursor` |
| Data (3) | `dataGrid`, `dataPipeline`, `analyticsRealtime` |
| Media (5) | `videoPlayer`, `canvas2D`, `webGL3D`, `animation`, `imageEditor` |
| Infra (3) | `offlineFirst`, `ssrHydration`, `serviceWorker` |
| Games (3) | `turnBased`, `realTime`, `physics` |
| AI (1) | `aiAgent` |

## Phase 2 — Breakthrough Strategies ✅

- [x] `src/strategies.js` — 10 reusable strategy functions
- [x] `src/examples.js` — Uploop vs React vs Solid code comparisons
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
- [x] Composable pipeline: `.map()`, `.filter()`, `.tap()`, `.validate()`, `.debounce()`, `.sink()`, `.into()`, `.catch()`
- [x] Queue with concurrency control (fifo/lifo/priority)
- [x] Event stream with emit/on/pipe/replay/history

## Phase 4 — Examples & Comparisons ✅

- [x] `examples-other-lib/examples-react.js` — 5 React scenarios with hook tax stats
- [x] `examples-other-lib/examples-solid.js` — 5 Solid scenarios with primitive tax stats
- [x] `examples-other-lib/comparison-stats.js` — Measured LOC, hooks, boilerplate, rerenders
- [x] `examples-other-lib/architecture-comparison.md` — Full report with tables

## Phase 5 — Remaining

- [x] 50 enterprise/high-performance flows added to registry (74 total: 24 original + 50 new)
- [x] Package README.md with API docs, flow reference, usage examples
- [ ] Deep executor integration — route actual graph updates through selected executor
- [ ] Per-subgraph flow routing in `createMixedFlow()`
- [ ] Real benchmarks (not estimates): search typeahead, data grid, chat at scale
- [ ] More flow profiles for edge cases (file upload, payment flow, auth flow)
- [ ] Integration with server-examples

### New Flow Categories (v0.7.x expansion)

| Category | Count | Highlights |
|----------|-------|-----------|
| Enterprise Messaging | 10 | eventBus, sagaOrchestrator, cqrsPipeline, CDC, outboxPattern |
| Resilience & Reliability | 10 | circuitBreaker, rateLimiter, retryWithBackoff, bulkhead, featureFlag |
| Data Processing | 10 | mapReduce, windowedAggregation, enrichmentPipeline, joinOperator, fanOutFanIn |
| High-Performance Infra | 10 | connectionPool, priorityQueue, workStealing, shardedCache, gossipProtocol |
| Streaming & Media | 10 | websocketMultiplexer, adaptiveBitrate, jitterBuffer, FEC, mediaTranscoder |

## Comparison Stats (vs React/Solid)

| Metric | React | Solid | Uploop |
|--------|-------|-------|--------|
| Total LOC (5 scenarios) | 196 | 148 | **69** |
| Hook/Primitive count | 25 | 18 | 22 |
| Manual boilerplate | 20 | 13 | **0** |
| Search re-renders (5 keystrokes) | 15 | 15 updates | **2** changes |
