# uploop-flows — v0.7.x Design & Plan

> **Pre-tuned execution profiles for 24 popular use cases. Not generic "average" performance — specific algorithms and heuristics per scenario that make Uploop outperform other frameworks where it matters.**
>
> The graph decides the executor. The flow tunes the executor.

---

## 1. Why This Exists

### The Problem

Most frameworks ship one execution strategy for everything:

```
React:  reconciler always
Solid:  reactive graph always
Excel:  spreadsheet engine always
Kafka:  pipeline always
```

This works *on average* but fails at extremes:
- React reconciler chokes on 60fps game loops
- Solid reactive graph wastes memory on ETL batch pipelines
- Excel engine is wrong for freeform DOM UI
- Kafka pipeline is wrong for instant form feedback

Uploop already has 7 executor archetypes. But choosing the right one, tuning its parameters, and combining them for mixed workloads requires deep knowledge of both Uploop internals and the domain.

**uploop-flows** ships that knowledge as pre-built, named, documented profiles.

### The Opportunity

Uploop's HyperGraph already exports the information needed to auto-select an executor:

```js
graph.describe()
// → { nodes: { mouseX: { temperature: 'hot', ... }, products: { temperature: 'cold', cache: {...} } }, edges: [...] }
```

`uploop-flows` takes this manifest and applies:
1. **Executor selection** — which of the 7 archetypes per subgraph
2. **Parameter tuning** — debounce windows, batch sizes, cache TTLs, frame budgets
3. **Lane assignment** — hot/warm/cold/critical lane routing
4. **Handoff strategy** — how executor islands communicate across edges
5. **Backpressure policy** — drop, block, compact per lane

---

## 2. The 7 Executor Archetypes (Recap)

These are built into `@uploop/core`. `uploop-flows` selects and tunes them.

| Executor | Best for | Weakness |
|----------|----------|----------|
| **Naive** | Small components, MVP, debug | High-frequency events, large graphs |
| **Reactive Tower** | Forms, fine-grained UI, derived state | Large batch ETL, stream backpressure |
| **Reconciler** | Component trees, conditional UI, lists | High-frequency motion, canvas scenes |
| **SceneGraph Booster** | Games, canvas, WebGL, 3D, animations | Forms, text editing, accessibility |
| **Ring Buffer** | Streaming chat, AI tokens, video frames, logs, telemetry | Random access, relational joins |
| **Table Master** | Data grids, dashboards, financial models, computed tables | Freeform UI, graphics scenes |
| **ETL Guru** | Server sync, REST/GraphQL, DB access, background jobs | Instant UI interaction, small rendering |

---

## 3. The 24 Use Cases

### Category A: Standard Web UI

#### Flow 1: `form`
```
Scenario:      Signup, checkout, settings, multi-field input
Executor:      Reactive Tower
Tuning:        Debounce: 150ms per field. Batch: 1 visual frame.
               Validate on blur, not keystroke. Cache derived valid state.
Lanes:         Field values → warm. Validation errors → warm. Submit → critical.
Beats:         React Hook Form (no extra lib needed), Formik (simpler model)
Why:           Fine-grained signal graph updates only changed fields. No whole-form rerender.
```

#### Flow 2: `list`
```
Scenario:      Product list, search results, feed, inbox
Executor:      Reconciler + Reactive Tower (hybrid)
Tuning:        Virtualize viewport (render only visible rows). 
               Key-by-id for stable DOM. Lazy load below fold.
               Cache items as cold data. SWR for server list.
Lanes:         Items → cold (cached). Scroll position → hot. Selection → warm.
Beats:         React Virtualized (built-in), TanStack Virtual (simpler API)
Why:           HyperGraph knows which items changed. Reconciler patches only those rows.
               Reactive tower handles selection state without list rerender.
```

#### Flow 3: `dashboard`
```
Scenario:      Analytics, monitoring, BI, multi-widget overview
Executor:      Mixed — Table Master (grids) + SceneGraph (charts) + Reactive Tower (filters)
Tuning:        Each widget is an executor island. Handoff via data nodes.
               Stale-while-revalidate for cold data. Budget: 16ms per frame total.
Lanes:         Real-time widgets → hot. Summary widgets → warm. Historical → cold.
Beats:         Grafana (lighter weight), Retool (more flexible)
Why:           Mixed executors. Chart redraws don't block table updates. 
               Filters propagate efficiently through data node edges.
```

#### Flow 4: `chat`
```
Scenario:      Messaging, support chat, comments
Executor:      Ring Buffer (messages) + Reactive Tower (composer)
Tuning:        Ring buffer: 200 messages, drop-old mode. 
               Composer: instant feedback, no debounce.
               Optimistic send → server ack → confirm.
Lanes:         Incoming → hot (ring buffer). Composer → warm. History → cold (paginated fetch).
Beats:         Socket.io + React (simpler, one model), Supabase Realtime (more flexible)
Why:           Ring buffer handles backpressure naturally. 
               Optimistic updates through the same send() pipeline as real events.
```

#### Flow 5: `infiniteScroll`
```
Scenario:      Social feed, image gallery, endless list
Executor:      Reconciler + ETL Guru (fetch pages)
Tuning:        Trigger fetch at 80% scroll. Prefetch next page.
               Append items, don't replace. Key by cursor/offset.
               Drop off-screen DOM (virtualize backward).
Lanes:         Visible items → warm. Prefetched → cold (idle fetch). Scroll → hot.
Beats:         react-infinite-scroll (built-in virtualization)
```

#### Flow 6: `searchTypeahead`
```
Scenario:      Autocomplete, search-as-you-type, command palette
Executor:      Reactive Tower + Ring Buffer (suggestions stream)
Tuning:        Debounce: 200ms. Interruptible: cancel previous fetch.
               Ring buffer: latest-only mode. Drop stale results.
               Cache recent queries (LRU, TTL: 30s).
Lanes:         Query → warm (debounced). Suggestions → hot (stream). Results → cold (cache).
Beats:         Algolia Autocomplete (self-hosted), Command Palette (simpler)
Why:           Interruptible + debounce + ring buffer = zero stale results.
               Built into handler metadata, not manual AbortController wiring.
```

### Category B: Real-Time & Collaboration

#### Flow 7: `realtimeCollab`
```
Scenario:      Google Docs-style editing, multiplayer whiteboard, Figma-like
Executor:      Reactive Tower (local) + Ring Buffer (remote ops) + ETL Guru (sync)
Tuning:        OT/CRDT: send ops, not state. Ring buffer: lossless mode.
               Conflict resolution as update handler. 
               Presence as hot data (heartbeat: 5s).
Lanes:         Local ops → hot (instant). Remote ops → hot (ring buffer). 
               Presence → hot. Document → cold (persisted).
Beats:         Yjs + React (built-in), Liveblocks (simpler)
Why:           HyperGraph edges represent OT/CRDT dependencies explicitly.
               Ring buffer handles op ordering. ETL guru handles persistence sync.
```

#### Flow 8: `liveLeaderboard`
```
Scenario:      Game scores, auction bids, stock ticker, sports
Executor:      Ring Buffer + Table Master
Tuning:        Ring buffer: latest-only per entry. Table: sort + highlight changed rows.
               Frame budget: 8ms. Drop if over budget.
               Interpolate between updates (smooth transitions).
Lanes:         Scores → hot (RAF). History → cold. UI → warm.
Beats:         Custom WebSocket + React (simpler, better perf)
Why:           Ring buffer handles 100+ updates/sec. Table master sorts efficiently.
               Frame budget prevents jank.
```

#### Flow 9: `liveCursor`
```
Scenario:      Multiplayer cursors, presence indicators, collaborative pointers
Executor:      SceneGraph Booster (canvas overlay)
Tuning:        Render cursors on canvas layer (not DOM). RAF: 60fps.
               Interpolate between position updates. Drop if >16ms budget.
               Throttle local cursor: send at 30fps.
Lanes:         Cursor positions → hot (RAF). Presence meta → warm.
Beats:         Liveblocks presence (lighter, canvas-native)
Why:           SceneGraph avoids DOM thrashing from N cursors. 
               Canvas overlay is GPU-friendly.
```

### Category C: Data-Intensive

#### Flow 10: `dataGrid`
```
Scenario:      Spreadsheet, admin table, data browser, Airtable-like
Executor:      Table Master
Tuning:        Columnar storage. Formula dependency graph → topological sort.
               Dirty range invalidation. Virtual viewport: render 40 rows.
               Sort/filter as derived data nodes.
Lanes:         Visible cells → hot. Formulas → warm. Source data → cold (cached).
Beats:         ag-Grid (lighter), Handsontable (more flexible), Google Sheets (for formulas)
Why:           Formula cells ARE HyperGraph edges. Dependency tracking is built-in.
               Range invalidation uses the same plan() as all other graphs.
```

#### Flow 11: `dataPipeline`
```
Scenario:      ETL, data import/export, batch processing, migrations
Executor:      ETL Guru
Tuning:        Source → Transform → Validate → Cache → Sink pipeline.
               Window: 1000 records. Checkpoint every 10K.
               Retry: exponential backoff. Dedupe by id.
Lanes:         Pipeline → critical (durable). UI feedback → warm. Logs → cold.
Beats:         Apache Spark (JS-native, lighter), custom Node streams (more reliable)
Why:           Same HyperGraph for pipeline and UI. 
               Data temperature tells Runner what to checkpoint vs discard.
```

#### Flow 12: `analyticsRealtime`
```
Scenario:      Live metrics, time-series dashboards, APM, server monitoring
Executor:      Ring Buffer (ingest) + Table Master (aggregate) + SceneGraph (chart)
Tuning:        Ingest: drop-late mode, 10K events/sec buffer.
               Aggregate: tumbling windows (1s, 10s, 60s). 
               Chart: RAF redraw, budget 6ms.
Lanes:         Raw events → hot (ring). Aggregates → warm. Historical → cold.
Beats:         Grafana Live (lighter), Datadog (self-hostable)
Why:           Ring buffer handles ingest spikes. Table master aggregates in windows.
               SceneGraph renders time-series efficiently.
```

### Category D: Media & Graphics

#### Flow 13: `videoPlayer`
```
Scenario:      Custom video player, streaming platform UI, video editor
Executor:      SceneGraph Booster (overlay) + Reactive Tower (controls)
Tuning:        Video element: native decode. Canvas overlay: subtitles, progress.
               Controls: RAF, budget 4ms per frame. Seek: debounce 100ms.
Lanes:         Playhead → hot (RAF). Volume → warm. Quality → cold (setting).
Beats:         Video.js (lighter, more flexible), Plyr (simpler API)
Why:           SceneGraph for overlay rendering. Reactive tower for controls.
               Both share the same HyperGraph — playhead node syncs both.
```

#### Flow 14: `canvas2D`
```
Scenario:      Drawing app, whiteboard, diagram editor, signature pad
Executor:      SceneGraph Booster
Tuning:        Dirty rect tracking. Layer compositing. 
               Hit-test spatial index. Undo: snapshot data nodes.
               Stroke smoothing: Catmull-Rom interpolation.
Lanes:         Strokes → hot (RAF). Tools → warm. Layers → cold (serializable).
Beats:         Excalidraw (simpler model), Fabric.js (HyperGraph-native)
Why:           Each shape is a data node. Edges are z-order/compositing.
               Undo/redo is data node history. SceneGraph renders efficiently.
```

#### Flow 15: `webGL3D`
```
Scenario:      3D product viewer, architectural viz, game engine, data viz
Executor:      SceneGraph Booster (WebGL/WebGPU backend)
Tuning:        Transform dirty set. Material dirty set. Frustum culling.
               Instanced rendering for repeated meshes. 
               Budget: 16ms. LOD by distance.
Lanes:         Camera transform → hot. Meshes → warm. Textures → cold (async load).
Beats:         Three.js (HyperGraph-native scene graph), Babylon.js (more integrated)
Why:           HyperGraph IS the scene graph. Transform nodes. Material nodes. Render pass edges.
               Dirty propagation replaces manual flag management.
```

#### Flow 16: `animation`
```
Scenario:      Page transitions, micro-interactions, scroll animations, Lottie-like
Executor:      Reactive Tower + RAF scheduler
Tuning:        Spring physics: stiffness/damping per animation node.
               Interruptible: new animation cancels previous. 
               GPU-accelerated: transform + opacity only. Budget: 4ms.
Lanes:         Animating values → hot (RAF). Static values → warm.
Beats:         Framer Motion (simpler model), react-spring (HyperGraph-native springs)
Why:           Animation values are data nodes. Springs are update handlers.
               Frame scheduling is built into the graph, not bolted on.
```

#### Flow 17: `imageEditor`
```
Scenario:      Photo editor, filters, cropping, adjustments
Executor:      SceneGraph Booster (canvas) + Reactive Tower (controls)
Tuning:        Filter pipeline: ordered nodes in graph. GPU: WebGL shaders.
               Preview: low-res first, full-res on commit.
               History: snapshot data nodes, 20 levels.
Lanes:         Preview → hot. Source image → cold. Filters → warm. History → cold.
Beats:         Doka (lighter), Pintura (more flexible filter graph)
Why:           Filter graph IS HyperGraph edges. Each filter reads/writes pixel data.
               Dependency tracking handles filter reordering naturally.
```

### Category E: Infrastructure & Offline

#### Flow 18: `offlineFirst`
```
Scenario:      PWA, mobile app, field worker, note-taking
Executor:      ETL Guru (sync) + Reactive Tower (local UI)
Tuning:        Local-first: IndexedDB as source of truth. Server as sync target.
               Queue offline mutations. Replay on reconnect.
               Conflict: last-write-wins or CRDT merge handler.
Lanes:         Local data → warm (IDB). Sync queue → critical (durable). Remote → cold.
Beats:         RxDB (simpler), PouchDB (more flexible), Dexie (lighter)
Why:           Same entity schema for local and remote. 
               ETL guru handles sync pipeline. Reactive tower handles instant UI.
```

#### Flow 19: `ssrHydration`
```
Scenario:      E-commerce PDP, blog, marketing site, SEO-critical pages
Executor:      Reconciler (server: replace strategy) → Reactive Tower (client: hydrate)
Tuning:        Server: render to string. Send HTML + state snapshot.
               Client: hydrate DOM without re-render. Then switch to reactive tower.
               No flash of unstyled/unhydrated content.
Lanes:         Server data → cold (preloaded). Client state → warm (hydrated).
Beats:         Next.js SSR (lighter, no JSX), Remix (more flexible)
Why:           describe() manifest sent to client. Client rebuilds graph structure.
               State snapshot hydrates data nodes. No double-render.
```

#### Flow 20: `serviceWorker`
```
Scenario:      Background sync, push notifications, offline cache, proxy
Executor:      ETL Guru (background) + Ring Buffer (events)
Tuning:        Cache-first: serve from Cache API, update in background.
               Background sync: queue mutations, process when online.
               Push: event → show notification → update UI on click.
Lanes:         Cache → cold (persistent). Pending mutations → critical.
Beats:         Workbox (simpler API), custom SW (more control)
Why:           Same entity definitions in main thread and SW. 
               ETL guru handles the cache/stale-while-revalidate pipeline.
```

### Category F: Games

#### Flow 21: `turnBased`
```
Scenario:      Chess, card games, board games, puzzle
Executor:      Reactive Tower + ETL Guru (sync)
Tuning:        Game state as single data node (serializable). 
               Moves as events → validate → update state → notify.
               AI move: async handler with interruptible.
Lanes:         Game state → warm. Animations → hot. History → cold.
Beats:         boardgame.io (simpler model), custom logic (more flexible)
Why:           Game logic is pure update handlers. 
               Undo/redo is state history. AI is an async update in the same pipeline.
```

#### Flow 22: `realTime`
```
Scenario:      Slither.io, agar.io, real-time multiplayer arena
Executor:      SceneGraph Booster (render) + Ring Buffer (network) + Reactive Tower (UI)
Tuning:        Client prediction + server reconciliation. 
               Interpolation: 100ms behind server. Extrapolation: 50ms ahead.
               Network: 20hz tick rate. Drop late packets.
Lanes:         Player entities → hot (RAF). Network → hot (ring). UI → warm.
Beats:         Colyseus (lighter, simpler), custom WebSocket loop (more integrated)
Why:           Scene graph handles entity rendering. Ring buffer handles network jitter.
               Client prediction is just a local update handler. Server reconciliation merges.
```

#### Flow 23: `physics`
```
Scenario:      Physics sandbox, Angry Birds, pinball, ragdoll
Executor:      SceneGraph Booster + dedicated physics lane
Tuning:        Physics step: fixed timestep (16ms or 8ms). 
               Broad phase: spatial hash grid. Narrow phase: SAT/GJK.
               Bodies as data nodes. Constraints as edges.
Lanes:         Physics → hot (fixed step). Render → hot (RAF interpolation). UI → warm.
Beats:         Matter.js (HyperGraph-native bodies), Planck.js (more accurate)
Why:           Physics bodies ARE HyperGraph nodes. Constraints ARE edges.
               The graph already tracks what depends on what for collision response.
```

### Category G: AI-Native

#### Flow 24: `aiAgent`
```
Scenario:      AI chat, copilot, agent dashboard, tool-use interface
Executor:      Ring Buffer (streaming tokens) + Reactive Tower (UI) + ETL Guru (tool calls)
Tuning:        Streaming: token-by-token into ring buffer. Latest-only UI update.
               Interruptible: cancel generation on new prompt.
               Tool calls: ETL guru pipeline (source → validate → execute → sink).
               Tool results: append to ring buffer as structured events.
Lanes:         Streaming tokens → hot (ring). Tool results → warm. Context → cold (cache).
Beats:         Vercel AI SDK (lighter, no React dependency), LangChain UI (simpler)
Why:           Streaming is a ring buffer use case. Tool calls are ETL guru pipelines.
               Interruptible cancel is built into handler metadata.
               The entire agent loop is inspectable via graph.describe().
```

---

## 3B. 50 Enterprise & High-Performance Flows (Planned)

These expand beyond the initial 24 UI-centric profiles into enterprise patterns,
data processing, distributed systems, and high-performance streaming — all
leveraging HyperGraph's native pipeline, queue, and eventStream primitives.

### Category H: Enterprise Messaging & Events (10)

#### Flow 25: `eventBus`
```
Scenario:      Decoupled service communication, plugin systems, micro-frontends
Pattern:        Pub/sub with topic routing on HyperGraph edges
Tuning:         Topic → lane mapping (critical topics on RAF, telemetry on idle).
               Backpressure: drop oldest or block per topic.
               Wildcard subscriptions via graph edge matching.
Beats:         EventEmitter3, mitt, RxJS Subject — HyperGraph edges ARE the bus topology.
```

#### Flow 26: `messageRouter`
```
Scenario:      Content-based routing, message transformation, protocol bridging
Pattern:        pipeline().match(condition).map(transform).sink(target)
Tuning:         Router table as HyperGraph data node. Rules = edges.
               Hot reload rules without restart. Dead letter sink for unmatched.
Beats:         Apache Camel patterns — graph-native, no XML DSL.
```

#### Flow 27: `deadLetterQueue`
```
Scenario:      Failed message handling, retry exhaustion, poison messages
Pattern:        DLQ as ring buffer with TTL + alert edge
Tuning:         Per-source DLQ. Replay from DLQ with admin trigger.
               Auto-expire after 7d. Alert after threshold.
Beats:         RabbitMQ DLQ, SQS DLQ — built into pipeline error handling.
```

#### Flow 28: `idempotencyGuard`
```
Scenario:      Payment processing, order submission, any at-most-once operation
Pattern:        pipeline().dedupe(keyFn).validate().sink()
Tuning:         Idempotency key cache (LRU, 24h TTL). Hash-based dedup.
               Response replay for duplicate keys.
Beats:         Stripe idempotency — reusable pattern, not vendor-locked.
```

#### Flow 29: `sagaOrchestrator`
```
Scenario:      Distributed transactions: order → payment → inventory → shipment
Pattern:        pipeline with compensating actions per step
Tuning:         Each step = HyperGraph update node with compensate handler.
               Saga log as append-only data node. Timeout + auto-compensate.
Beats:         Temporal.io, Camunda — lighter, graph-native, no workflow server.
```

#### Flow 30: `eventSourcing`
```
Scenario:      Audit trails, financial ledgers, domain event stores
Pattern:        Append-only event ring buffer → projection views
Tuning:         Events immutable (cold lane, persistent). Projections cached (warm).
               Snapshot every N events for fast rebuild. Event replay for debug.
Beats:         EventStoreDB, Marten — HyperGraph edges ARE the event→projection links.
```

#### Flow 31: `cqrsPipeline`
```
Scenario:      Command/Query Responsibility Segregation for complex domains
Pattern:        Command pipeline (validate → authorize → execute → event) +
               Query pipeline (read model → cache → respond)
Tuning:         Command side hot lane. Query side warm+cold lanes.
               Read models as derived HyperGraph nodes.
Beats:         NestJS CQRS, Axon — no decorator ceremony, graph edges = projections.
```

#### Flow 32: `changeDataCapture`
```
Scenario:      Tail database WAL, sync to search index, invalidate caches
Pattern:        pipeline().from(database).detect({ inserts, updates, deletes }).fanout()
Tuning:         Polling interval or native listen/notify. Batch window for throughput.
               Fanout to search index, cache invalidator, analytics sink.
Beats:         Debezium, Maxwell — in-process, no Kafka dependency for smaller datasets.
```

#### Flow 33: `workflowEngine`
```
Scenario:      Approval flows, onboarding, multi-step business processes
Pattern:        State machine with HyperGraph edges as transitions
Tuning:         BPMN-lite: tasks, gateways, timers, signals.
               Human tasks: wait for external event. Auto-escalation on timeout.
               Process instance = subgraph. Snapshot + resume.
Beats:         Camunda, Temporal — graph-native, no BPMN XML, inspectable live.
```

#### Flow 34: `outboxPattern`
```
Scenario:      Reliable event publishing after DB transaction commit
Pattern:        Outbox table → pipeline().poll().publish().markSent()
Tuning:         At-least-once delivery. Dedup on consumer side.
               Batch poll with configurable interval.
Beats:         Transactional outbox — integrated with uploop-storage (v0.9).
```

### Category I: Resilience & Reliability (10)

#### Flow 35: `circuitBreaker`
```
Scenario:      External API calls, DB connections, microservice communication
Pattern:        pipeline().guard(circuitBreaker).map(call).catch(fallback)
Tuning:         Closed → Open after N failures in window. Half-open probe.
               Per-endpoint or global. Fallback response from cache or default.
Beats:         opossum, resilience4j — graph-aware, failure state = HyperGraph node.
```

#### Flow 36: `rateLimiter`
```
Scenario:      API gateway, login protection, cost control
Pattern:        Token bucket / sliding window / fixed window strategies
Tuning:         Per-user, per-IP, per-endpoint. Burst allowance.
               Exceeded → queue or reject. Distributed via shared cache.
Beats:         bottleneck, express-rate-limit — works client + server side.
```

#### Flow 37: `retryWithBackoff`
```
Scenario:      Flaky APIs, network calls, eventual-consistency reads
Pattern:        pipeline().retry({ max, backoff, jitter, onRetry })
Tuning:         Exponential/linear/fixed backoff. Jitter for thundering herd.
               Retryable error predicate. Max elapsed time budget.
Beats:         async-retry, polly — built into pipeline, no separate wrapper.
```

#### Flow 38: `bulkhead`
```
Scenario:      Multi-tenant isolation, resource partitioning
Pattern:        Per-tenant queue with independent capacity limits
Tuning:         Max concurrency per bulkhead. Reject or queue overflow.
               Semaphore-based (thread/connection pool isolation).
Beats:         resilience4j bulkhead — graph edges define partition boundaries.
```

#### Flow 39: `gracefulShutdown`
```
Scenario:      Server drain before restart, connection cleanup
Pattern:        Lifecycle signal → drain queues → close connections → exit
Tuning:         Drain timeout per component. Ordered shutdown by dependency.
               In-flight request completion. SIGTERM/SIGINT handler.
Beats:         http-shutdown, stoppable — integrated with HyperGraph lifecycle nodes.
```

#### Flow 40: `healthCheck`
```
Scenario:      Kubernetes liveness/readiness probes, load balancer health
Pattern:        Health aggregator: check DB, cache, upstream, disk, memory
Tuning:         Liveness: simple ok/fail. Readiness: deep checks.
               Cascading: if DB down, mark all DB-dependent services degraded.
Beats:         terminus, lightship — graph edges show failure propagation path.
```

#### Flow 41: `featureFlag`
```
Scenario:      Gradual rollouts, A/B testing, kill switches
Pattern:        Flag evaluation → route to variant A or B pipeline
Tuning:         Percentage rollout, user targeting, rule-based.
               Flag state as HyperGraph data node (hot-reloadable).
               Audit: log which user saw which variant.
Beats:         LaunchDarkly, Unleash — lighter, graph-native, no external service.
```

#### Flow 42: `distributedLock`
```
Scenario:      Leader election, singleton job execution, resource arbitration
Pattern:        Acquire lock → do work → heartbeat → release
Tuning:         TTL-based lease with auto-renewal. Fencing token.
               Backend: Redis (Lua), PostgreSQL (advisory), in-memory.
Beats:         redlock, async-mutex — unified API across backends.
```

#### Flow 43: `auditTrail`
```
Scenario:      Compliance, security, change tracking
Pattern:        Interceptor on every state mutation → append to immutable log
Tuning:         Who, what, when, before, after. Signed hashes for tamper detection.
               Async write to not block hot path. Compaction/archival.
Beats:         pg-audit, audit-log — works cross-storage, entity-driven.
```

#### Flow 44: `reconciliationLoop`
```
Scenario:      Eventual consistency checker, data integrity validation
Pattern:        Periodically compare source-of-truth vs derived views
Tuning:         Schedule: cron or interval. Drift detection → auto-repair or alert.
               Chunked comparison for large datasets.
Beats:         Custom reconciliation jobs — pipeline makes it composable.
```

### Category J: Data Processing & Pipelines (10)

#### Flow 45: `mapReduce`
```
Scenario:      Aggregation, analytics, log processing
Pattern:        pipeline().map(extract).reduce(aggregate).sink()
Tuning:         Parallel map across workers (web workers or cluster).
               Combiner for local pre-aggregation. Partitioned reduce.
Beats:         Hadoop/Spark patterns — in-process for datasets < 1GB.
```

#### Flow 46: `windowedAggregation`
```
Scenario:      Metrics, time-series analytics, sliding statistics
Pattern:        pipeline().window({ type, size, slide }).aggregate()
Tuning:         Tumbling, hopping, session windows. Count-based windows.
               Pre-aggregation buckets for memory efficiency.
Beats:         Flink windows, Kafka Streams — lighter, same semantics.
```

#### Flow 47: `deduplicationFilter`
```
Scenario:      Duplicate event elimination, exactly-once processing
Pattern:        Bloom filter (fast, probabilistic) → exact hash set (slow, certain)
Tuning:         Configurable false-positive rate. LRU eviction for hash set.
               Time-bounded dedup windows.
Beats:         Guava BloomFilter + manual dedup — single pipeline stage.
```

#### Flow 48: `enrichmentPipeline`
```
Scenario:      Join event streams with reference data, user profiles, geolocation
Pattern:        pipeline().enrich({ user: userLookup, geo: ipToGeo, device: uaParser })
Tuning:         Parallel enrichment lookups. Cache reference data (cold lane).
               Timeout per enrichment. Partial enrichment on failure.
Beats:         Logstash enrich, StreamSets — code-only, no YAML pipeline config.
```

#### Flow 49: `schemaMigration`
```
Scenario:      Message evolution, API versioning, backward compatibility
Pattern:        Version detect → transform v1→v2 → transform v2→v3 → validate
Tuning:         Chain of version transforms. Schema registry lookup.
               Dead letter for unmigratable messages. Metrics per version.
Beats:         Confluent Schema Registry — entity.describe() IS the registry.
```

#### Flow 50: `dataMasking`
```
Scenario:      PII redaction, GDPR compliance, log sanitization
Pattern:        pipeline().mask({ email: partialMask, ssn: fullMask, phone: partialMask })
Tuning:         Field-level rules declared on entity metadata.
               Reversible masking (tokenization) vs irreversible (hash).
Beats:         Manual regex + middleware — entity-driven, consistent client+server.
```

#### Flow 51: `snapshotManager`
```
Scenario:      State serialization, crash recovery, event sourcing snapshots
Pattern:        Periodic snapshot of HyperGraph data nodes → binary or JSON
Tuning:         Snapshot interval by event count or time. Incremental vs full.
               Compress with uploop-stream codec. Restore: snapshot + replay since.
Beats:         EventStore snapshots, Redux persist — graph-native, binary efficient.
```

#### Flow 52: `timeSeriesCompaction`
```
Scenario:      Metrics retention, downsampling, storage optimization
Pattern:        pipeline().compact({ raw→1m: avg, 1m→1h: [min,max,avg], 1h→1d: [min,max,avg,p95] })
Tuning:         Multi-level compaction with configurable aggregations.
               Expire raw data after retention period.
Beats:         InfluxDB retention policies, Prometheus compaction — in-app, no TSDB.
```

#### Flow 53: `joinOperator`
```
Scenario:      Stream-stream join, stream-table join, event correlation
Pattern:        pipeline().join(rightStream, { on: 'key', type: 'inner', window: '5m' })
Tuning:         Inner/left/outer join. Time-windowed or unbounded.
               State store for late-arriving events. Watermark for completeness.
Beats:         Kafka Streams join, Flink join — pipeline-native, no stream processor.
```

#### Flow 54: `fanOutFanIn`
```
Scenario:      Scatter-gather, parallel API calls, multi-service queries
Pattern:        pipeline().fanOut(N workers).fanIn(aggregator)
Tuning:         Concurrency limit. Timeout per branch + overall.
               Partial results policy (require all / require majority / best effort).
Beats:         Promise.allSettled + manual aggregation — structured, observable.
```

### Category K: High-Performance Infrastructure (10)

#### Flow 55: `connectionPool`
```
Scenario:      DB connections, HTTP keep-alive, WebSocket reuse
Pattern:        pool.acquire() → use → pool.release() with health check
Tuning:         Min/max size. Idle timeout. Connection validation on acquire.
               LIFO or FIFO. Prepare statements on create.
Beats:         generic-pool, pg-pool — entity-aware, auto-size from temperature.
```

#### Flow 56: `objectPool`
```
Scenario:      Buffer reuse, object recycling, GC pressure reduction
Pattern:        pool.alloc() / pool.free() with pre-allocated ring
Tuning:         Pre-allocation on cold start. Grow/shrink based on demand.
               Type-specific pools (ArrayBuffer, TypedArray, plain objects).
Beats:         object-pool implementations — integrated with stream codec.
```

#### Flow 57: `batchProcessor`
```
Scenario:      DB batch inserts, bulk API calls, log shipping
Pattern:        queue.accumulate({ maxSize, maxLatency }).process(batch)
Tuning:         Max batch size + max wait time. Backpressure on overflow.
               Batching key for grouping (by table, by partition).
Beats:         Batching in Kafka producers, bulk INSERT — pipeline stage, not ad-hoc.
```

#### Flow 58: `priorityQueue`
```
Scenario:      Job scheduling, task prioritization, QoS
Pattern:        queue.enqueue(item, priority).dequeue() with starvation prevention
Tuning:         Multi-level priority (critical, high, normal, low, background).
               Aging: low-priority items gain priority over time.
               Per-priority concurrency limits.
Beats:         bull, bee-queue — lighter, no Redis dependency unless distributed.
```

#### Flow 59: `workStealing`
```
Scenario:      CPU-bound task distribution, worker thread pool
Pattern:        N workers with local queues. Idle workers steal from busy queues.
Tuning:         Steal half (not one) for throughput. Random victim selection.
               LIFO for owner, FIFO for thief (work-stealing deque).
Beats:         Go goroutine scheduler pattern, Java ForkJoinPool — in JS workers.
```

#### Flow 60: `shardedCache`
```
Scenario:      Distributed cache, CDN edge cache, memory-constrained caching
Pattern:        Consistent hashing ring → shard selection → local LRU
Tuning:         Virtual nodes for even distribution. Replication factor.
               Hot key detection + duplication. Cache coherence via TTL.
Beats:         Redis cluster client, Hazelcast — in-memory with optional Redis backend.
```

#### Flow 61: `writeBehindCache`
```
Scenario:      High-throughput writes with async persistence
Pattern:        Write to cache (hot) → acknowledge → async flush to store (cold)
Tuning:         Flush interval or buffer size trigger. Write coalescing.
               Dirty tracking per key. Crash recovery from write-ahead log.
Beats:         Redis write-behind, Caffeine async — integrated with store adapter.
```

#### Flow 62: `readThroughCache`
```
Scenario:      Cache-aside replacement, auto-populate on miss
Pattern:        Cache.get(key) → on miss: store.load(key) → cache.set(key, value) → return
Tuning:         Stampede prevention (single-flight). Negative caching for not-found.
               SWR (stale-while-revalidate). Refresh-ahead for hot keys.
Beats:         Cache-aside pattern — one `loadFunction` config, not manual wiring.
```

#### Flow 63: `gossipProtocol`
```
Scenario:      Cluster membership, failure detection, config propagation
Pattern:        Periodic random peer selection → state exchange → merge
Tuning:         Gossip interval, fanout, suspicion timeout before marking dead.
               Epidemic spread for config. Version vector for conflict resolution.
Beats:         SWIM, Serf — in-process cluster management for Uploop nodes.
```

#### Flow 64: `consistentHashing`
```
Scenario:      Shard routing, partition assignment, load distribution
Pattern:        Hash(key) → ring position → clockwise walk → target node
Tuning:         Virtual nodes (150-200 per physical node). Weighted nodes.
               Rebalancing on node add/remove with minimal key migration.
Beats:         hashring, consistent-hash — integrated with shardedCache + priorityQueue.
```

### Category L: Real-Time Streaming & Media (10)

#### Flow 65: `websocketMultiplexer`
```
Scenario:      Many logical channels over one WebSocket connection
Pattern:        Channel open/close/error lifecycle. Per-channel backpressure.
Tuning:         Channel ID in binary frame header. Priority per channel.
               Flow control: per-channel credit-based. Idle channel GC.
Beats:         centrifuge, socket.io rooms — graph edges define channel topology.
```

#### Flow 66: `serverSentEvents`
```
Scenario:      One-way server→client streaming, notifications, feeds
Pattern:        SSE with auto-reconnect + last-event-id for resume
Tuning:         Event type filtering on client. Batch multiple events per flush.
               Connection heartbeat (30s comment). Max retry with exponential backoff.
Beats:         Better-sse, EventSource polyfill — works with uploop-stream binary framing.
```

#### Flow 67: `adaptiveBitrate`
```
Scenario:      Video streaming, real-time media, variable network conditions
Pattern:        Monitor buffer health + bandwidth → select quality tier
Tuning:         Buffer-based ABR (BBA). Throughput-based. Hybrid.
               Smooth upswitch, aggressive downswitch. Segment prefetch.
Beats:         Shaka Player ABR, HLS.js ABR — hypergraph nodes hold quality state.
```

#### Flow 68: `jitterBuffer`
```
Scenario:      VoIP, WebRTC, real-time audio/video
Pattern:        Incoming packets → buffer reorder → playout at steady rate
Tuning:         Adaptive buffer size based on jitter measurement.
               Packet loss concealment (last good frame, interpolation).
               Max delay budget before dropping.
Beats:         WebRTC jitter buffer — tunable per-flow, not hardcoded.
```

#### Flow 69: `forwardErrorCorrection`
```
Scenario:      Lossy networks, satellite, mobile, real-time media
Pattern:        XOR FEC or Reed-Solomon encoding → packet recovery
Tuning:         FEC overhead % vs packet loss %. Adaptive based on measured loss.
               Per-stream FEC. Combine with retransmission for critical packets.
Beats:         ULP FEC, FlexFEC — integrated with uploop-stream binary protocol.
```

#### Flow 70: `mediaTranscoder`
```
Scenario:      User uploads, format conversion, thumbnail generation
Pattern:        pipeline().from(source).transcode({ format, bitrate, resolution }).sink()
Tuning:         Segment into GOPs for parallel transcoding. Hardware acceleration.
               Preset: ultrafast→veryslow (speed vs quality). Progress events.
Beats:         ffmpeg CLI wrappers — integrated pipeline, progress as eventStream.
```

#### Flow 71: `videoSegmenter`
```
Scenario:      HLS/DASH preparation, VOD packaging
Pattern:        Transcode → segment → generate playlist → upload to CDN
Tuning:         Segment duration (2-10s). Multi-bitrate ladder.
               Keyframe alignment for seamless switching. DRM packaging hook.
Beats:         Shaka Packager, ffmpeg HLS — pipeline stages, observable progress.
```

#### Flow 72: `liveTranscription`
```
Scenario:      Speech-to-text streaming, meeting notes, captioning
Pattern:        Audio chunks → ring buffer → STT API → partial/final results
Tuning:         Interim results at ~200ms intervals. Final results on utterance end.
               Speaker diarization. Language detection.
Beats:         Deepgram streaming, Whisper real-time — graph edges = speaker→utterance.
```

#### Flow 73: `thumbnailGenerator`
```
Scenario:      Image/video preview, gallery, CMS
Pattern:        pipeline().thumbnail({ width, height, format, quality, crop })
Tuning:         On-the-fly or pre-generate. Cache thumbnails (cold lane, persistent).
               Responsive sizes for srcset. Blurhash placeholder while loading.
Beats:         sharp, jimp thumbnails — integrated into upload pipeline, not separate.
```

#### Flow 74: `streamReplay`
```
Scenario:      Debugging, audit, event sourcing, time-travel
Pattern:        Record events to ring buffer → replay from timestamp N
Tuning:         Time-indexed seek. Speed control (1x, 2x, 10x).
               Filter by event type during replay. Max ring size limits retention.
Beats:         Redux DevTools time travel, Kafka replay — graph-native, binary compact.
```

### Quick Reference — All 74 Flow Profiles

| # | Flow | Category | Executor | Key Pattern |
|---|------|----------|----------|------------|
| 1-6 | form, list, dashboard, chat, infiniteScroll, searchTypeahead | Web UI | Reactive/Reconciler | Metadata-driven async |
| 7-9 | realtimeCollab, liveLeaderboard, liveCursor | Real-Time | Stream Relay | Ring buffer + CRDT |
| 10-12 | dataGrid, dataPipeline, analyticsRealtime | Data | Batch/Table | Columnar + dirty invalidation |
| 13-17 | videoPlayer, canvas2D, webGL3D, animation, imageEditor | Media | SceneGraph | GPU lane + frame budget |
| 18-20 | offlineFirst, ssrHydration, serviceWorker | Infra | Persisted Cascade | Cache-first + sync |
| 21-23 | turnBased, realTime, physics | Games | Fixed Timestep | Tick-based + interpolation |
| 24 | aiAgent | AI | Stream+ETL | Ring buffer + tool pipelines |
| 25-34 | eventBus→outboxPattern | Enterprise Msg | Pipeline | Pub/sub, DLQ, saga, CQRS, CDC |
| 35-44 | circuitBreaker→reconciliationLoop | Resilience | Pipeline+Queue | Circuit breaker, retry, rate limit, bulkhead |
| 45-54 | mapReduce→fanOutFanIn | Data Proc | Batch Pipeline | Window, dedup, enrich, join, compact |
| 55-64 | connectionPool→consistentHashing | Infra | Pipeline+Cache | Pool, batch, priority, shard, gossip |
| 65-74 | websocketMultiplexer→streamReplay | Streaming | Stream Relay | Mux, ABR, jitter, FEC, transcode |

---

## 4. Package Architecture

```
@uploop/flows/
├── src/
│   ├── index.js            # Public API — createFlow(), listFlows(), suggestFlow()
│   ├── registry.js         # Flow registry: name → config
│   ├── flow-builder.js     # createFlow(graph, profile) → tuned executor
│   ├── profiles/
│   │   ├── form.js         # Flow 1
│   │   ├── list.js         # Flow 2
│   │   ├── dashboard.js    # Flow 3
│   │   ├── chat.js         # Flow 4
│   │   ├── infinite-scroll.js
│   │   ├── search-typeahead.js
│   │   ├── realtime-collab.js
│   │   ├── live-leaderboard.js
│   │   ├── live-cursor.js
│   │   ├── data-grid.js
│   │   ├── data-pipeline.js
│   │   ├── analytics-realtime.js
│   │   ├── video-player.js
│   │   ├── canvas-2d.js
│   │   ├── webgl-3d.js
│   │   ├── animation.js
│   │   ├── image-editor.js
│   │   ├── offline-first.js
│   │   ├── ssr-hydration.js
│   │   ├── service-worker.js
│   │   ├── turn-based.js
│   │   ├── realtime-game.js
│   │   ├── physics.js
│   │   └── ai-agent.js
│   ├── executors/
│   │   ├── naive.js
│   │   ├── reactive-tower.js
│   │   ├── reconciler.js
│   │   ├── scenegraph-booster.js
│   │   ├── ring-buffer.js
│   │   ├── table-master.js
│   │   └── etl-guru.js
│   ├── tuner.js            # Parameter optimization per flow
│   ├── lane-router.js      # Hot/warm/cold/critical lane assignment
│   ├── handoff.js          # Inter-executor communication
│   └── backpressure.js     # Drop/block/compact policies
├── test/
│   ├── registry.test.js
│   ├── profiles/
│   │   ├── form.test.js
│   │   ├── chat.test.js
│   │   ├── data-grid.test.js
│   │   └── ... (one per flow)
│   └── integration.test.js
└── package.json
```

---

## 5. API Design

### 5.1 `createFlow()` — Apply a Flow to a Graph

```js
import { createGraph } from '@uploop/core'
import { createFlow, flows } from '@uploop/flows'

// 1. Build your HyperGraph as usual
const appGraph = createGraph({
  name: 'search-page',
  nodes: {
    query: { type: 'data', default: '' },
    results: { type: 'data', default: [] },
    search: { type: 'update', reads: ['query'], writes: ['results'], 
              run: async (d, q) => fetchResults(q) }
  },
  edges: [['input', 'search']]
})

// 2. Apply a flow profile — this tunes the executor automatically
const tuned = createFlow(appGraph, flows.searchTypeahead)
// → Applies: Reactive Tower + Ring Buffer
//   Sets: debounce=200ms, interruptible=true, cache LRU 30s
//   Routes: query→warm, suggestions→hot, results→cold

// 3. Use it — same API, better performance
tuned.send('input', 'hello')
```

### 5.2 `listFlows()` — Discover Available Flows

```js
import { listFlows } from '@uploop/flows'

listFlows()
// → [
//     { name: 'form', category: 'ui', description: 'Signup, checkout, settings, ...' },
//     { name: 'list', category: 'ui', description: 'Product list, feed, inbox, ...' },
//     ...
//   ]

// Filter by category
listFlows({ category: 'real-time' })
// → ['realtimeCollab', 'liveLeaderboard', 'liveCursor']
```

### 5.3 `suggestFlow()` — AI/Heuristic Flow Recommendation

```js
import { suggestFlow } from '@uploop/flows'

// Auto-detect best flow from graph structure
const suggestion = suggestFlow(appGraph)
// → {
//     recommended: 'searchTypeahead',
//     alternatives: ['list', 'chat'],
//     reasoning: [
//       'graph has debounced input→fetch→results pattern',
//       'single data node dominates view updates',
//       'async handler with cache metadata detected'
//     ],
//     score: 0.92
//   }
```

### 5.4 Mixed Flows — Per-Subgraph Tuning

```js
import { createFlow, flows } from '@uploop/flows'

// Large app with multiple subgraphs
const dashboardFlow = createFlow(appGraph, {
  // Per-subgraph overrides
  subgraphs: {
    'sidebar': flows.form,
    'main-layout': flows.dashboard,
    'activity-log': flows.liveLeaderboard,
    'analytics-table': flows.dataGrid,
    'chart-canvas': flows.canvas2D,
    'api-sync': flows.dataPipeline
  }
})
```

### 5.5 Custom Flow — Extend or Create

```js
import { defineFlow, flows } from '@uploop/flows'

const myCustomFlow = defineFlow('mySaaS', {
  // Inherit defaults from an existing flow
  extends: flows.dashboard,
  
  // Override specific tuning
  tuning: {
    debounce: 300,
    batchWindow: 'visual',
    cacheTTL: 120_000,
    frameBudget: '12ms',
    backpressure: 'drop-old',
    maxRingSize: 500
  },
  
  // Custom lane routing
  lanes: {
    'critical.*': 'critical',
    'ui.*': 'warm',
    'cache.*': 'cold'
  },
  
  // Custom executor selection rule
  selectExecutor(subgraph) {
    if (subgraph.nodes.some(n => n.temperature === 'hot' && n.type === 'data')) {
      return 'ring-buffer'
    }
    return 'reactive-tower'
  }
})
```

---

## 6. Flow Profile Schema

Each flow definition is a plain object — AI-readable, serializable:

```js
// flows.searchTypeahead
{
  name: 'searchTypeahead',
  category: 'ui',
  version: '0.7.0',
  
  description: 'Autocomplete, search-as-you-type, command palette',
  tags: ['search', 'autocomplete', 'typeahead', 'command-palette'],
  aiRole: 'ux.searchTypeahead',
  
  // Which executor(s) this flow uses
  executors: ['reactive-tower', 'ring-buffer'],
  
  // Tuning parameters
  tuning: {
    debounce: { ms: 200, perField: false },
    batchWindow: 'micro',              // micro | visual | idle
    cache: { strategy: 'lru', ttl: 30000, maxEntries: 50 },
    interruptible: true,
    cancelPrevious: true,
    frameBudget: '4ms',
    maxRingSize: 20,
    ringMode: 'latest-only',           // latest-only | lossless | drop-old
    backpressure: 'drop',              // drop | block | compact
    optimisticUI: false,
    retry: { max: 2, backoff: 'exponential' }
  },
  
  // Lane assignment rules (glob patterns match data node names)
  lanes: {
    'query': 'warm',
    'suggestions': 'hot',
    'results': 'cold',
    'error': 'warm',
    'loading': 'transient'
  },
  
  // Executor handoff config
  handoff: {
    from: 'reactive-tower',
    to: 'ring-buffer',
    via: 'data-node',                 // data-node | event | message-port
    buffered: true,
    maxBuffer: 5
  },
  
  // When to use this flow (for suggestFlow heuristics)
  detection: {
    patterns: ['input→debounce→fetch→results'],
    nodeTypes: { data: { min: 1, max: 5 }, update: { min: 1, max: 3 } },
    metadata: { hasInterruptible: true, hasCache: true, hasDebounce: true },
    eventRate: 'moderate'
  },
  
  // Performance targets
  targets: {
    p50Latency: '< 16ms',
    p99Latency: '< 50ms',
    memoryBudget: '< 2MB per instance',
    frameDropRate: '< 1%'
  }
}
```

---

## 7. How Flows Beat Other Frameworks

### Concrete Example: Search Typeahead

```
React + useEffect:
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      const res = await fetch(`/api?q=${query}`)
      setResults(await res.json())
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])
  // Problems:
  // - 3 state variables = 3 re-renders minimum
  // - No abort controller (stale responses overwrite fresh)
  // - Loading flag is manual
  // - Error handling is missing
  // - No caching

Uploop + flows.searchTypeahead:
  const search = createGraph({ ... })
  const tuned = createFlow(search, flows.searchTypeahead)
  
  // tuned handles:
  // - Debounce: auto 200ms
  // - AbortController: auto, cancelPrevious
  // - Loading: implicit via isPending()
  // - Error: implicit via getError()
  // - Cache: LRU 30s auto
  // - Backpressure: drop stale ring buffer entries
  // - Lane routing: query→warm, suggestions→hot, results→cold
  // All from the flow profile. Zero boilerplate.
```

---

## 8. Integration with HyperGraph

`createFlow()` does not replace `createGraph()`. It wraps it:

```js
const graph = createGraph({ nodes: {...}, edges: [...] })
const tuned = createFlow(graph, flows.chat)

// Same API, tuned execution
tuned.get()            // same
tuned.send('msg', ...)  // same — but now ring-buffered, backpressure-managed
tuned.describe()        // same — but now includes flow metadata
// → { kind: 'uploop.graph', flow: 'chat', tuning: {...}, ... }

// The flow is inspectable
tuned.describe().flow
// → { name: 'chat', executors: ['ring-buffer', 'reactive-tower'], tuning: {...} }
```

---

## 9. Implementation Plan

### Phase 1: Core Flow Engine (v0.7.0)

- [ ] `@uploop/flows/src/registry.js` — Flow registry with 24 profiles as plain objects
- [ ] `@uploop/flows/src/flow-builder.js` — `createFlow(graph, profile)` wraps graph with tuned executor
- [ ] `@uploop/flows/src/tuner.js` — Applies debounce, cache, interruptible, frameBudget from profile
- [ ] `@uploop/flows/src/lane-router.js` — Hot/warm/cold lane assignment from profile patterns
- [ ] `@uploop/flows/src/index.js` — Public API

### Phase 2: First 8 Flows (v0.7.1)

- [ ] `form`, `list`, `dashboard`, `chat`, `infiniteScroll`, `searchTypeahead`

### Phase 3: Real-Time & Data Flows (v0.7.2)

- [ ] `realtimeCollab`, `liveLeaderboard`, `liveCursor`, `dataGrid`, `dataPipeline`, `analyticsRealtime`

### Phase 4: Media & Games (v0.7.3)

- [ ] `videoPlayer`, `canvas2D`, `webGL3D`, `animation`, `imageEditor`
- [ ] `turnBased`, `realTime`, `physics`

### Phase 5: Infrastructure & AI (v0.7.4)

- [ ] `offlineFirst`, `ssrHydration`, `serviceWorker`, `aiAgent`
- [ ] `suggestFlow()` — heuristic flow detection from graph.describe()
- [ ] `listFlows()`, `defineFlow()`
- [ ] Full test suite per flow profile

---

## 10. Risk Analysis

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Flow explosion** — 24 flows, each needs maintenance | Medium | Each flow is ~50 lines of config. Profiles are data, not code. AI can suggest new profiles. |
| **Wrong auto-selection** — `suggestFlow()` picks wrong flow | Medium | Always overridable. `suggestFlow()` returns alternatives with scores. Developer has final say. |
| **Executor composability** — mixing N executors adds overhead | Medium | Handoff cost is measured. Flow profile declares handoff budget. Warn if subgraphs > 5. |
| **Benchmark arms race** — hard to prove "beats React" claims | Low | Each flow has `targets` field. CI runs perf benchmarks per flow. Numbers are public. |
| **Complexity for simple apps** — not every app needs flows | Low | Flows are opt-in. Default is "naive" executor. `createFlow()` is only needed when optimizing. |

---

## 11. Success Criteria

```js
// Before: manual tuning
const search = createGraph({
  nodes: { query: { type: 'data', default: '' }, results: { type: 'data', default: [] } },
  // ... no debounce, no cache, no interruptible, no backpressure
})

// After: one-line flow application
const tuned = createFlow(search, flows.searchTypeahead)
// → 200ms debounce, cancelPrevious, LRU 30s cache, ring buffer backpressure
// → 70% less boilerplate, 3x fewer re-renders, zero stale results
```

---

*Uploop flows: the graph decides the executor. The flow tunes the executor. The developer ships the experience.*
