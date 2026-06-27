/**
 * Flow Registry — 74 pre-tuned execution profiles.
 *
 * Each flow defines:
 *   - executors: which of the 7 archetypes to use
 *   - tuning: debounce, cache, batch, interruptible, frame budget
 *   - lanes: hot/warm/cold data routing
 *   - detection: heuristics for auto-suggestion
 *
 * @module @uploop/flows/registry
 */

export const flows = {

  // ── Standard UI ──────────────────────────────────────────

  form: {
    name: 'form', category: 'ui',
    description: 'Signup, checkout, multi-field input, settings',
    executors: ['reactive-tower'],
    tuning: {
      debounce: 150, batchWindow: 'visual', validateOn: 'blur',
      frameBudget: '4ms', cacheDerived: true, optimisticUI: false
    },
    lanes: { '*.value': 'warm', '*.error': 'warm', '*.submit': 'critical' },
    detection: { patterns: ['multi-field', 'validation'], nodeTypes: { data: { min: 2, max: 20 }, update: { min: 2 } } }
  },

  list: {
    name: 'list', category: 'ui',
    description: 'Product list, feed, inbox, search results',
    executors: ['reconciler', 'reactive-tower'],
    tuning: {
      virtualize: true, keyBy: 'id', lazyLoad: true,
      cache: { strategy: 'lru', ttl: 120_000 }, swr: true, batchWindow: 'visual'
    },
    lanes: { '*.items': 'cold', '*.scroll': 'hot', '*.selection': 'warm' },
    detection: { patterns: ['list', 'items-array', 'scroll'], nodeTypes: { data: { min: 1, max: 5 } } }
  },

  dashboard: {
    name: 'dashboard', category: 'ui',
    description: 'Analytics, monitoring, BI, multi-widget',
    executors: ['table-master', 'scenegraph-booster', 'reactive-tower'],
    tuning: {
      mixedExecutors: true, perWidgetIsolation: true, swr: true,
      frameBudget: '16ms', cache: { strategy: 'lru', ttl: 60_000 }
    },
    lanes: { '*.realtime': 'hot', '*.summary': 'warm', '*.historical': 'cold' },
    detection: { patterns: ['multi-widget', 'chart', 'table'], nodeTypes: { data: { min: 5 }, view: { min: 3 } } }
  },

  chat: {
    name: 'chat', category: 'ui',
    description: 'Messaging, support chat, comments',
    executors: ['ring-buffer', 'reactive-tower'],
    tuning: {
      ringSize: 200, ringMode: 'drop-old', optimisticUI: true,
      debounce: 0, interruptible: false, batchWindow: 'micro'
    },
    lanes: { '*.incoming': 'hot', '*.composer': 'warm', '*.history': 'cold' },
    detection: { patterns: ['message-stream', 'ring'], nodeTypes: { data: { min: 2 } } }
  },

  infiniteScroll: {
    name: 'infiniteScroll', category: 'ui',
    description: 'Social feed, image gallery, endless list',
    executors: ['reconciler', 'etl-guru'],
    tuning: {
      triggerAt: 0.8, prefetch: true, appendMode: true,
      virtualizeBackward: true, cache: { strategy: 'lru', ttl: 300_000 }
    },
    lanes: { '*.visible': 'warm', '*.prefetch': 'cold', '*.scroll': 'hot' },
    detection: { patterns: ['infinite', 'append', 'cursor'], nodeTypes: { data: { min: 1 } } }
  },

  searchTypeahead: {
    name: 'searchTypeahead', category: 'ui',
    description: 'Autocomplete, search-as-you-type, command palette',
    executors: ['reactive-tower', 'ring-buffer'],
    tuning: {
      debounce: 200, interruptible: true, cancelPrevious: true,
      cache: { strategy: 'lru', ttl: 30_000, maxEntries: 50 },
      ringMode: 'latest-only', backpressure: 'drop', frameBudget: '4ms'
    },
    lanes: { '*.query': 'warm', '*.suggestions': 'hot', '*.results': 'cold' },
    detection: { patterns: ['debounce', 'fetch', 'results'], nodeTypes: { data: { min: 2, max: 5 } } }
  },

  // ── Real-Time ────────────────────────────────────────────

  realtimeCollab: {
    name: 'realtimeCollab', category: 'real-time',
    description: 'Google Docs-style, multiplayer whiteboard',
    executors: ['reactive-tower', 'ring-buffer', 'etl-guru'],
    tuning: {
      ringMode: 'lossless', ot: true, presenceHeartbeat: 5000,
      conflict: 'merge', batchWindow: 'micro', frameBudget: '8ms'
    },
    lanes: { '*.local': 'hot', '*.remote': 'hot', '*.presence': 'hot', '*.doc': 'cold' },
    detection: { patterns: ['collab', 'multiplayer', 'ot'], nodeTypes: { update: { min: 3 } } }
  },

  liveLeaderboard: {
    name: 'liveLeaderboard', category: 'real-time',
    description: 'Game scores, auction bids, stock ticker',
    executors: ['ring-buffer', 'table-master'],
    tuning: {
      ringMode: 'latest-only', ringSize: 200, sort: true,
      highlightChanges: true, interpolate: true, frameBudget: '8ms'
    },
    lanes: { '*.scores': 'hot', '*.history': 'cold', '*.ui': 'warm' },
    detection: { patterns: ['leaderboard', 'score', 'ticker'], nodeTypes: { data: { min: 3 } } }
  },

  liveCursor: {
    name: 'liveCursor', category: 'real-time',
    description: 'Multiplayer cursors, presence, collaborative pointers',
    executors: ['scenegraph-booster'],
    tuning: {
      canvasOverlay: true, interpolate: true, frameBudget: '16ms',
      throttleSend: 30, dropLate: true, maxCursors: 50
    },
    lanes: { '*.cursors': 'hot', '*.presence': 'warm' },
    detection: { patterns: ['cursor', 'presence', 'pointer'], nodeTypes: { data: { min: 2 } } }
  },

  // ── Data-Intensive ───────────────────────────────────────

  dataGrid: {
    name: 'dataGrid', category: 'data',
    description: 'Spreadsheet, admin table, data browser',
    executors: ['table-master'],
    tuning: {
      columnar: true, dirtyRange: true, virtualViewport: 40,
      formulaCache: true, incrementalRecompute: true, frameBudget: '12ms'
    },
    lanes: { '*.cells': 'hot', '*.formulas': 'warm', '*.source': 'cold' },
    detection: { patterns: ['table', 'grid', 'rows', 'columns'], nodeTypes: { data: { min: 5 } } }
  },

  dataPipeline: {
    name: 'dataPipeline', category: 'data',
    description: 'ETL, data import/export, batch processing',
    executors: ['etl-guru'],
    tuning: {
      window: 1000, checkpoint: 10000, retry: { max: 3, backoff: 'exponential' },
      dedupe: true, batchWindow: 'idle', memoryBudget: '256MB'
    },
    lanes: { '*.pipeline': 'critical', '*.ui': 'warm', '*.logs': 'cold' },
    detection: { patterns: ['etl', 'pipeline', 'batch'], nodeTypes: { update: { min: 3 } } }
  },

  analyticsRealtime: {
    name: 'analyticsRealtime', category: 'data',
    description: 'Live metrics, time-series dashboards, APM',
    executors: ['ring-buffer', 'table-master', 'scenegraph-booster'],
    tuning: {
      ringMode: 'drop-late', ringSize: 10000, windows: [1000, 10000, 60000],
      chartRaf: true, frameBudget: '6ms'
    },
    lanes: { '*.raw': 'hot', '*.aggregate': 'warm', '*.historical': 'cold' },
    detection: { patterns: ['metrics', 'timeseries', 'dashboard'], nodeTypes: { data: { min: 5 } } }
  },

  // ── Media & Graphics ─────────────────────────────────────

  videoPlayer: {
    name: 'videoPlayer', category: 'media',
    description: 'Custom video player, streaming platform UI',
    executors: ['scenegraph-booster', 'reactive-tower'],
    tuning: {
      canvasOverlay: true, nativeDecode: true,
      controlsRaf: true, frameBudget: '4ms', seekDebounce: 100
    },
    lanes: { '*.playhead': 'hot', '*.volume': 'warm', '*.quality': 'cold' },
    detection: { patterns: ['video', 'playhead', 'controls'], nodeTypes: { data: { min: 3 } } }
  },

  canvas2D: {
    name: 'canvas2D', category: 'media',
    description: 'Drawing app, whiteboard, diagram editor',
    executors: ['scenegraph-booster'],
    tuning: {
      dirtyRect: true, layerComposite: true, hitTest: 'spatial',
      undoSnapshot: true, strokeSmooth: true, frameBudget: '16ms'
    },
    lanes: { '*.strokes': 'hot', '*.tools': 'warm', '*.layers': 'cold' },
    detection: { patterns: ['canvas', 'draw', 'stroke'], nodeTypes: { data: { min: 3 } } }
  },

  webGL3D: {
    name: 'webGL3D', category: 'media',
    description: '3D product viewer, game engine, data viz',
    executors: ['scenegraph-booster'],
    tuning: {
      webgl: true, dirtyTransform: true, dirtyMaterial: true,
      frustumCull: true, instanced: true, lod: true, frameBudget: '16ms'
    },
    lanes: { '*.camera': 'hot', '*.meshes': 'warm', '*.textures': 'cold' },
    detection: { patterns: ['webgl', '3d', 'mesh', 'camera'], nodeTypes: { data: { min: 5 } } }
  },

  animation: {
    name: 'animation', category: 'media',
    description: 'Page transitions, micro-interactions, scroll animations',
    executors: ['reactive-tower'],
    tuning: {
      springPhysics: true, interruptible: true, gpuAccelerated: true,
      frameBudget: '4ms', cancelPrevious: true
    },
    lanes: { '*.animating': 'hot', '*.static': 'warm' },
    detection: { patterns: ['animation', 'spring', 'transition'], nodeTypes: { data: { min: 2 } } }
  },

  imageEditor: {
    name: 'imageEditor', category: 'media',
    description: 'Photo editor, filters, cropping, adjustments',
    executors: ['scenegraph-booster', 'reactive-tower'],
    tuning: {
      filterPipeline: true, webglShaders: true,
      previewLowRes: true, historySnapshots: 20, frameBudget: '16ms'
    },
    lanes: { '*.preview': 'hot', '*.source': 'cold', '*.filters': 'warm' },
    detection: { patterns: ['image', 'filter', 'crop', 'adjust'], nodeTypes: { data: { min: 5 } } }
  },

  // ── Infrastructure ───────────────────────────────────────

  offlineFirst: {
    name: 'offlineFirst', category: 'infra',
    description: 'PWA, mobile app, field worker, note-taking',
    executors: ['etl-guru', 'reactive-tower'],
    tuning: {
      localFirst: true, queueOffline: true, replayOnReconnect: true,
      conflict: 'last-write-wins', syncDebounce: 5000
    },
    lanes: { '*.local': 'warm', '*.sync': 'critical', '*.remote': 'cold' },
    detection: { patterns: ['offline', 'sync', 'queue'], nodeTypes: { data: { min: 3 } } }
  },

  ssrHydration: {
    name: 'ssrHydration', category: 'infra',
    description: 'E-commerce PDP, blog, SEO-critical pages',
    executors: ['reconciler', 'reactive-tower'],
    tuning: {
      serverRender: true, hydrateOnly: true, noFlash: true,
      statePreload: true, switchToReactive: true
    },
    lanes: { '*.server': 'cold', '*.client': 'warm' },
    detection: { patterns: ['ssr', 'hydration', 'seo'], nodeTypes: { data: { min: 2 } } }
  },

  serviceWorker: {
    name: 'serviceWorker', category: 'infra',
    description: 'Background sync, push, offline cache',
    executors: ['etl-guru', 'ring-buffer'],
    tuning: {
      cacheFirst: true, staleWhileRevalidate: true,
      backgroundSync: true, pushNotifications: true
    },
    lanes: { '*.cache': 'cold', '*.pending': 'critical', '*.events': 'hot' },
    detection: { patterns: ['serviceworker', 'cache', 'push'], nodeTypes: {} }
  },

  // ── Games ────────────────────────────────────────────────

  turnBased: {
    name: 'turnBased', category: 'games',
    description: 'Chess, card games, board games, puzzle',
    executors: ['reactive-tower', 'etl-guru'],
    tuning: {
      serializable: true, undoRedo: true, aiAsync: true,
      validateMoves: true, interruptible: true
    },
    lanes: { '*.game': 'warm', '*.animations': 'hot', '*.history': 'cold' },
    detection: { patterns: ['turn', 'board', 'move'], nodeTypes: { data: { min: 3 } } }
  },

  realTime: {
    name: 'realTime', category: 'games',
    description: 'Multiplayer arena, slither.io-style',
    executors: ['scenegraph-booster', 'ring-buffer', 'reactive-tower'],
    tuning: {
      clientPrediction: true, serverReconciliation: true,
      interpolation: 100, extrapolation: 50, tickRate: 20, dropLate: true
    },
    lanes: { '*.entities': 'hot', '*.network': 'hot', '*.ui': 'warm' },
    detection: { patterns: ['multiplayer', 'tick', 'prediction'], nodeTypes: { data: { min: 5 } } }
  },

  physics: {
    name: 'physics', category: 'games',
    description: 'Physics sandbox, Angry Birds, pinball',
    executors: ['scenegraph-booster'],
    tuning: {
      fixedTimestep: 16, broadPhase: 'spatial-hash', narrowPhase: 'sat',
      bodiesAsNodes: true, constraintsAsEdges: true, frameBudget: '16ms'
    },
    lanes: { '*.physics': 'hot', '*.render': 'hot', '*.ui': 'warm' },
    detection: { patterns: ['physics', 'body', 'constraint'], nodeTypes: { data: { min: 5 } } }
  },

  // ── AI-Native ────────────────────────────────────────────

  aiAgent: {
    name: 'aiAgent', category: 'ai',
    description: 'AI chat, copilot, agent dashboard, tool-use',
    executors: ['ring-buffer', 'reactive-tower', 'etl-guru'],
    tuning: {
      streaming: true, tokenByToken: true, interruptible: true,
      cancelPrevious: true, toolCalls: 'pipeline', latestOnly: true
    },
    lanes: { '*.tokens': 'hot', '*.tools': 'warm', '*.context': 'cold' },
    detection: { patterns: ['ai', 'streaming', 'token', 'tool'], nodeTypes: { data: { min: 3 } } }
  },

  // ── Enterprise Messaging & Events ───────────────────────

  eventBus: {
    name: 'eventBus', category: 'enterprise',
    description: 'Decoupled service communication, plugin systems, micro-frontends',
    executors: ['ring-buffer', 'reactive-tower'],
    tuning: { pubsub: true, wildcardTopics: true, backpressure: 'drop-oldest', ringSize: 1000, ringMode: 'lossless', replayHistory: true },
    lanes: { '*.critical': 'critical', '*.telemetry': 'cold', '*.default': 'warm' },
    detection: { patterns: ['pubsub', 'event', 'topic', 'channel'], nodeTypes: { data: { min: 3 } } }
  },

  messageRouter: {
    name: 'messageRouter', category: 'enterprise',
    description: 'Content-based routing, message transformation, protocol bridging',
    executors: ['etl-guru'],
    tuning: { rulesAsNodes: true, hotReload: true, deadLetter: true, conditionalRouting: true, batchWindow: 'micro' },
    lanes: { '*.router': 'warm', '*.deadLetter': 'cold', '*.transform': 'warm' },
    detection: { patterns: ['route', 'transform', 'bridge', 'protocol'], nodeTypes: { update: { min: 3 } } }
  },

  deadLetterQueue: {
    name: 'deadLetterQueue', category: 'enterprise',
    description: 'Failed message handling, retry exhaustion, poison messages',
    executors: ['ring-buffer', 'etl-guru'],
    tuning: { ringMode: 'lossless', ringSize: 5000, ttl: 604800000, alertThreshold: 100, replayEnabled: true, perSource: true },
    lanes: { '*.dlq': 'cold', '*.alert': 'critical', '*.replay': 'warm' },
    detection: { patterns: ['deadletter', 'poison', 'failed', 'retry'], nodeTypes: { data: { min: 1 } } }
  },

  idempotencyGuard: {
    name: 'idempotencyGuard', category: 'enterprise',
    description: 'Payment processing, at-most-once delivery, duplicate prevention',
    executors: ['etl-guru'],
    tuning: { idempotencyKey: true, cache: { strategy: 'lru', ttl: 86400000, maxEntries: 100000 }, responseReplay: true, hashDedup: true },
    lanes: { '*.guard': 'critical', '*.cache': 'cold' },
    detection: { patterns: ['idempotent', 'dedup', 'at-most-once'], nodeTypes: { update: { min: 1 } } }
  },

  sagaOrchestrator: {
    name: 'sagaOrchestrator', category: 'enterprise',
    description: 'Distributed transactions: order-payment-inventory-shipment',
    executors: ['etl-guru'],
    tuning: { compensate: true, sagaLog: true, timeout: 30000, parallelSteps: true, retry: { max: 3, backoff: 'exponential' } },
    lanes: { '*.saga': 'critical', '*.log': 'cold', '*.compensate': 'warm' },
    detection: { patterns: ['saga', 'transaction', 'compensate', 'orchestrate'], nodeTypes: { update: { min: 3 } } }
  },

  eventSourcing: {
    name: 'eventSourcing', category: 'enterprise',
    description: 'Audit trails, financial ledgers, domain event stores',
    executors: ['ring-buffer', 'etl-guru'],
    tuning: { appendOnly: true, immutable: true, snapshotInterval: 1000, projectionsAsViews: true, replayEnabled: true, ringMode: 'lossless' },
    lanes: { '*.events': 'cold', '*.projections': 'warm', '*.snapshot': 'cold' },
    detection: { patterns: ['event-source', 'audit', 'ledger', 'immutable'], nodeTypes: { data: { min: 3 } } }
  },

  cqrsPipeline: {
    name: 'cqrsPipeline', category: 'enterprise',
    description: 'Command/Query separation for complex domains',
    executors: ['etl-guru', 'reactive-tower'],
    tuning: { commandStack: true, readModels: true, validateCommand: true, projectionSync: 'async', cacheReads: { ttl: 60000 } },
    lanes: { '*.command': 'critical', '*.query': 'warm', '*.readModel': 'cold' },
    detection: { patterns: ['command', 'query', 'cqrs', 'readmodel'], nodeTypes: { update: { min: 3 } } }
  },

  changeDataCapture: {
    name: 'changeDataCapture', category: 'enterprise',
    description: 'Tail database WAL, sync to search index, invalidate caches',
    executors: ['etl-guru', 'ring-buffer'],
    tuning: { poll: 1000, batchWindow: 'idle', fanout: true, debounce: 500, dedupe: true, checkpoint: true },
    lanes: { '*.cdc': 'critical', '*.fanout': 'warm', '*.log': 'cold' },
    detection: { patterns: ['cdc', 'wal', 'change', 'sync'], nodeTypes: { data: { min: 2 } } }
  },

  workflowEngine: {
    name: 'workflowEngine', category: 'enterprise',
    description: 'Approval flows, onboarding, multi-step business processes',
    executors: ['etl-guru', 'reactive-tower'],
    tuning: { bpmnLite: true, humanTasks: true, timers: true, signals: true, snapshotResume: true, timeout: 86400000 },
    lanes: { '*.workflow': 'warm', '*.task': 'critical', '*.history': 'cold' },
    detection: { patterns: ['workflow', 'approval', 'process', 'task'], nodeTypes: { data: { min: 3 } } }
  },

  outboxPattern: {
    name: 'outboxPattern', category: 'enterprise',
    description: 'Reliable event publishing after DB transaction commit',
    executors: ['etl-guru'],
    tuning: { poll: 500, batchSize: 100, atLeastOnce: true, dedup: true, retry: { max: 5, backoff: 'linear' }, checkpoint: true },
    lanes: { '*.outbox': 'critical', '*.publish': 'warm', '*.sent': 'cold' },
    detection: { patterns: ['outbox', 'transactional', 'relay'], nodeTypes: { data: { min: 2 } } }
  },

  // ── Resilience & Reliability ────────────────────────────

  circuitBreaker: {
    name: 'circuitBreaker', category: 'resilience',
    description: 'External API calls, DB connections, microservice protection',
    executors: ['etl-guru'],
    tuning: { failureThreshold: 5, resetTimeout: 30000, halfOpenProbe: true, fallbackEnabled: true, metricsEnabled: true, perEndpoint: true },
    lanes: { '*.breaker': 'critical', '*.fallback': 'warm', '*.metrics': 'cold' },
    detection: { patterns: ['circuit', 'breaker', 'fail', 'fallback'], nodeTypes: { update: { min: 1 } } }
  },

  rateLimiter: {
    name: 'rateLimiter', category: 'resilience',
    description: 'API gateway, login protection, cost control',
    executors: ['reactive-tower'],
    tuning: { algorithm: 'token-bucket', rate: 100, window: 1000, burst: 20, perKey: true, queueOverflow: true },
    lanes: { '*.limiter': 'critical', '*.queue': 'warm' },
    detection: { patterns: ['rate', 'limit', 'throttle', 'bucket'], nodeTypes: { data: { min: 1 } } }
  },

  retryWithBackoff: {
    name: 'retryWithBackoff', category: 'resilience',
    description: 'Flaky APIs, network calls, eventual-consistency reads',
    executors: ['etl-guru'],
    tuning: { retry: { max: 3, backoff: 'exponential', jitter: true }, retryable: true, maxElapsed: 60000, onRetry: true },
    lanes: { '*.retry': 'warm', '*.failed': 'cold' },
    detection: { patterns: ['retry', 'backoff', 'transient', 'flaky'], nodeTypes: { update: { min: 1 } } }
  },

  bulkhead: {
    name: 'bulkhead', category: 'resilience',
    description: 'Multi-tenant isolation, resource partitioning',
    executors: ['etl-guru'],
    tuning: { maxConcurrency: 10, maxQueue: 50, perPartition: true, semaphore: true, rejectOnFull: true },
    lanes: { '*.bulkhead': 'critical', '*.queue': 'warm' },
    detection: { patterns: ['tenant', 'isolate', 'partition', 'resource'], nodeTypes: { data: { min: 2 } } }
  },

  gracefulShutdown: {
    name: 'gracefulShutdown', category: 'resilience',
    description: 'Server drain before restart, connection cleanup',
    executors: ['etl-guru'],
    tuning: { drainTimeout: 30000, orderedShutdown: true, healthCheck: true, signals: ['SIGTERM', 'SIGINT'] },
    lanes: { '*.drain': 'critical', '*.shutdown': 'critical' },
    detection: { patterns: ['shutdown', 'drain', 'graceful', 'lifecycle'], nodeTypes: {} }
  },

  healthCheck: {
    name: 'healthCheck', category: 'resilience',
    description: 'Kubernetes liveness/readiness probes, load balancer health',
    executors: ['reactive-tower'],
    tuning: { liveness: true, readiness: true, deepCheck: true, cascading: true, interval: 15000 },
    lanes: { '*.health': 'warm', '*.checks': 'warm' },
    detection: { patterns: ['health', 'liveness', 'readiness', 'probe'], nodeTypes: { data: { min: 1 } } }
  },

  featureFlag: {
    name: 'featureFlag', category: 'resilience',
    description: 'Gradual rollouts, A/B testing, kill switches',
    executors: ['reactive-tower'],
    tuning: { percentage: true, targeting: true, hotReload: true, audit: true, defaultValue: false },
    lanes: { '*.flag': 'warm', '*.audit': 'cold' },
    detection: { patterns: ['feature', 'flag', 'toggle', 'rollout'], nodeTypes: { data: { min: 1 } } }
  },

  distributedLock: {
    name: 'distributedLock', category: 'resilience',
    description: 'Leader election, singleton job execution, resource arbitration',
    executors: ['etl-guru'],
    tuning: { lease: 30000, heartbeat: 10000, fencingToken: true, autoExtend: true, backend: 'memory' },
    lanes: { '*.lock': 'critical', '*.heartbeat': 'warm' },
    detection: { patterns: ['lock', 'leader', 'election', 'singleton'], nodeTypes: { data: { min: 1 } } }
  },

  auditTrail: {
    name: 'auditTrail', category: 'resilience',
    description: 'Compliance, security, change tracking',
    executors: ['ring-buffer', 'etl-guru'],
    tuning: { appendOnly: true, immutable: true, signed: true, asyncWrite: true, compaction: true, retention: 7776000000 },
    lanes: { '*.audit': 'cold', '*.write': 'warm' },
    detection: { patterns: ['audit', 'compliance', 'trail', 'immutable'], nodeTypes: { data: { min: 2 } } }
  },

  reconciliationLoop: {
    name: 'reconciliationLoop', category: 'resilience',
    description: 'Eventual consistency checker, data integrity validation',
    executors: ['etl-guru'],
    tuning: { schedule: 'interval', interval: 300000, chunkSize: 1000, autoRepair: false, alertOnDrift: true },
    lanes: { '*.reconcile': 'cold', '*.drift': 'warm', '*.alert': 'critical' },
    detection: { patterns: ['reconcile', 'consistency', 'drift', 'repair'], nodeTypes: { data: { min: 3 } } }
  },

  // ── Data Processing & Pipelines ─────────────────────────

  mapReduce: {
    name: 'mapReduce', category: 'data',
    description: 'Aggregation, analytics, log processing',
    executors: ['etl-guru'],
    tuning: { parallel: true, workers: 4, combiner: true, partitionKey: true, batchWindow: 'idle' },
    lanes: { '*.map': 'warm', '*.reduce': 'critical', '*.output': 'cold' },
    detection: { patterns: ['map', 'reduce', 'aggregate', 'parallel'], nodeTypes: { data: { min: 3 } } }
  },

  windowedAggregation: {
    name: 'windowedAggregation', category: 'data',
    description: 'Metrics, time-series analytics, sliding statistics',
    executors: ['ring-buffer', 'etl-guru'],
    tuning: { windows: { tumbling: 60000, hopping: { size: 60000, slide: 10000 }, session: { gap: 30000 } }, preAggregate: true, watermark: 5000 },
    lanes: { '*.windows': 'hot', '*.output': 'warm', '*.raw': 'cold' },
    detection: { patterns: ['window', 'aggregate', 'timeseries', 'tumbling'], nodeTypes: { data: { min: 3 } } }
  },

  deduplicationFilter: {
    name: 'deduplicationFilter', category: 'data',
    description: 'Duplicate event elimination, exactly-once processing',
    executors: ['etl-guru'],
    tuning: { bloomFilter: true, falsePositiveRate: 0.01, exactBacking: 'lru', window: 3600000, maxEntries: 1000000 },
    lanes: { '*.dedup': 'warm', '*.passed': 'warm', '*.duplicate': 'cold' },
    detection: { patterns: ['dedup', 'duplicate', 'bloom', 'unique'], nodeTypes: { data: { min: 1 } } }
  },

  enrichmentPipeline: {
    name: 'enrichmentPipeline', category: 'data',
    description: 'Join event streams with reference data, user profiles',
    executors: ['etl-guru'],
    tuning: { parallel: true, cacheRefs: true, timeout: 5000, partialOnFailure: true, refCache: { ttl: 600000 } },
    lanes: { '*.enrich': 'warm', '*.refs': 'cold', '*.output': 'warm' },
    detection: { patterns: ['enrich', 'lookup', 'join', 'reference'], nodeTypes: { update: { min: 2 } } }
  },

  schemaMigration: {
    name: 'schemaMigration', category: 'data',
    description: 'Message evolution, API versioning, backward compatibility',
    executors: ['etl-guru'],
    tuning: { versionChain: true, schemaRegistry: true, deadLetter: true, metrics: true, transformCache: true },
    lanes: { '*.migrate': 'warm', '*.deadLetter': 'cold', '*.metrics': 'cold' },
    detection: { patterns: ['schema', 'version', 'migrate', 'evolve'], nodeTypes: { data: { min: 2 } } }
  },

  dataMasking: {
    name: 'dataMasking', category: 'data',
    description: 'PII redaction, GDPR compliance, log sanitization',
    executors: ['etl-guru'],
    tuning: { fieldRules: true, partialMask: true, tokenization: true, irreversible: false, consistent: true },
    lanes: { '*.mask': 'critical', '*.raw': 'cold' },
    detection: { patterns: ['mask', 'pii', 'redact', 'gdpr'], nodeTypes: { data: { min: 1 } } }
  },

  snapshotManager: {
    name: 'snapshotManager', category: 'data',
    description: 'State serialization, crash recovery, event sourcing snapshots',
    executors: ['etl-guru'],
    tuning: { interval: 1000, incremental: true, compress: true, binary: true, restore: 'snapshot+replay' },
    lanes: { '*.snapshot': 'cold', '*.state': 'warm' },
    detection: { patterns: ['snapshot', 'state', 'serialize', 'restore'], nodeTypes: { data: { min: 2 } } }
  },

  timeSeriesCompaction: {
    name: 'timeSeriesCompaction', category: 'data',
    description: 'Metrics retention, downsampling, storage optimization',
    executors: ['etl-guru'],
    tuning: { levels: 3, schedule: 'interval', interval: 60000, aggregation: ['min', 'max', 'avg', 'p95'], ttl: { raw: 86400000, hourly: 2592000000, daily: 31536000000 } },
    lanes: { '*.raw': 'cold', '*.compacted': 'cold', '*.compact': 'cold' },
    detection: { patterns: ['timeseries', 'compact', 'downsample', 'retention'], nodeTypes: { data: { min: 3 } } }
  },

  joinOperator: {
    name: 'joinOperator', category: 'data',
    description: 'Stream-stream join, stream-table join, event correlation',
    executors: ['etl-guru', 'ring-buffer'],
    tuning: { joinType: 'inner', window: 300000, watermark: 10000, stateStore: true, lateArrival: 'drop' },
    lanes: { '*.stream': 'hot', '*.table': 'warm', '*.output': 'warm' },
    detection: { patterns: ['join', 'correlate', 'combine'], nodeTypes: { data: { min: 3 } } }
  },

  fanOutFanIn: {
    name: 'fanOutFanIn', category: 'data',
    description: 'Scatter-gather, parallel API calls, multi-service queries',
    executors: ['etl-guru'],
    tuning: { concurrency: 10, timeout: 30000, aggregateTimeout: 5000, partialPolicy: 'require-all', collectErrors: true },
    lanes: { '*.fanout': 'warm', '*.result': 'critical' },
    detection: { patterns: ['fanout', 'scatter', 'gather', 'parallel'], nodeTypes: { update: { min: 2 } } }
  },

  // ── High-Performance Infrastructure ─────────────────────

  connectionPool: {
    name: 'connectionPool', category: 'infra',
    description: 'DB connections, HTTP keep-alive, WebSocket reuse',
    executors: ['etl-guru'],
    tuning: { min: 2, max: 20, idleTimeout: 30000, acquireTimeout: 10000, validateOnAcquire: true, fifo: true },
    lanes: { '*.pool': 'warm', '*.idle': 'cold' },
    detection: { patterns: ['pool', 'connection', 'reuse', 'keepalive'], nodeTypes: {} }
  },

  objectPool: {
    name: 'objectPool', category: 'infra',
    description: 'Buffer reuse, object recycling, GC pressure reduction',
    executors: ['etl-guru'],
    tuning: { preallocate: true, initialSize: 100, maxSize: 1000, growFactor: 1.5, shrinkAfterIdle: 60000 },
    lanes: { '*.pool': 'warm', '*.gcPressure': 'cold' },
    detection: { patterns: ['pool', 'buffer', 'recycle', 'reuse'], nodeTypes: {} }
  },

  batchProcessor: {
    name: 'batchProcessor', category: 'infra',
    description: 'DB batch inserts, bulk API calls, log shipping',
    executors: ['etl-guru'],
    tuning: { maxSize: 500, maxLatency: 5000, backpressure: 'block', groupBy: true, concurrent: 3 },
    lanes: { '*.batch': 'critical', '*.accumulate': 'warm' },
    detection: { patterns: ['batch', 'bulk', 'insert', 'accumulate'], nodeTypes: { data: { min: 1 } } }
  },

  priorityQueue: {
    name: 'priorityQueue', category: 'infra',
    description: 'Job scheduling, task prioritization, QoS',
    executors: ['etl-guru'],
    tuning: { levels: ['critical', 'high', 'normal', 'low', 'background'], aging: true, perLevelConcurrency: { critical: 5, high: 10, normal: 20 }, starvationPrevention: true },
    lanes: { '*.critical': 'critical', '*.normal': 'warm', '*.background': 'cold' },
    detection: { patterns: ['priority', 'queue', 'schedule', 'job'], nodeTypes: { data: { min: 2 } } }
  },

  workStealing: {
    name: 'workStealing', category: 'infra',
    description: 'CPU-bound task distribution, worker thread pool',
    executors: ['etl-guru'],
    tuning: { workers: 4, stealHalf: true, lifoOwner: true, fifoThief: true, randomVictim: true },
    lanes: { '*.workers': 'warm', '*.idle': 'cold' },
    detection: { patterns: ['worker', 'steal', 'thread', 'parallel'], nodeTypes: { data: { min: 2 } } }
  },

  shardedCache: {
    name: 'shardedCache', category: 'infra',
    description: 'Distributed cache, CDN edge cache, memory-constrained caching',
    executors: ['etl-guru'],
    tuning: { shards: 64, virtualNodes: 150, replicationFactor: 2, hotKeyDetection: true, cache: { strategy: 'lru', ttl: 300000 } },
    lanes: { '*.hot': 'hot', '*.warm': 'warm', '*.cold': 'cold' },
    detection: { patterns: ['shard', 'cache', 'distribute', 'hash'], nodeTypes: { data: { min: 2 } } }
  },

  writeBehindCache: {
    name: 'writeBehindCache', category: 'infra',
    description: 'High-throughput writes with async persistence',
    executors: ['etl-guru'],
    tuning: { flushInterval: 5000, flushSize: 100, writeCoalesce: true, dirtyTracking: true, writeAheadLog: true },
    lanes: { '*.write': 'critical', '*.flush': 'warm', '*.wal': 'cold' },
    detection: { patterns: ['write-behind', 'async', 'flush', 'cache'], nodeTypes: { data: { min: 2 } } }
  },

  readThroughCache: {
    name: 'readThroughCache', category: 'infra',
    description: 'Cache-aside replacement, auto-populate on miss',
    executors: ['etl-guru'],
    tuning: { loadFunction: true, stampedePrevention: true, negativeCache: true, swr: true, refreshAhead: true, cache: { strategy: 'lru', ttl: 300000 } },
    lanes: { '*.cache': 'warm', '*.load': 'cold', '*.refresh': 'cold' },
    detection: { patterns: ['cache-aside', 'read-through', 'miss', 'populate'], nodeTypes: { data: { min: 1 } } }
  },

  gossipProtocol: {
    name: 'gossipProtocol', category: 'infra',
    description: 'Cluster membership, failure detection, config propagation',
    executors: ['ring-buffer', 'etl-guru'],
    tuning: { interval: 1000, fanout: 3, suspicionTimeout: 5000, epidemicSpread: true, versionVector: true },
    lanes: { '*.gossip': 'warm', '*.members': 'warm', '*.dead': 'cold' },
    detection: { patterns: ['gossip', 'cluster', 'membership', 'epidemic'], nodeTypes: { data: { min: 3 } } }
  },

  consistentHashing: {
    name: 'consistentHashing', category: 'infra',
    description: 'Shard routing, partition assignment, load distribution',
    executors: ['etl-guru'],
    tuning: { virtualNodes: 150, weightAware: true, rebalanceOnChange: true, minimalMigration: true },
    lanes: { '*.routing': 'critical', '*.ring': 'warm' },
    detection: { patterns: ['hash', 'ring', 'shard', 'partition'], nodeTypes: { data: { min: 2 } } }
  },

  // ── Real-Time Streaming & Media ─────────────────────────

  websocketMultiplexer: {
    name: 'websocketMultiplexer', category: 'streaming',
    description: 'Many logical channels over one WebSocket connection',
    executors: ['ring-buffer', 'stream-relay'],
    tuning: { channels: true, creditBased: true, perChannelBackpressure: true, idleChannelGC: 300000, maxChannels: 256 },
    lanes: { '*.control': 'critical', '*.data': 'hot', '*.idle': 'cold' },
    detection: { patterns: ['mux', 'channel', 'multiplex'], nodeTypes: { data: { min: 3 } } }
  },

  serverSentEvents: {
    name: 'serverSentEvents', category: 'streaming',
    description: 'One-way server-to-client streaming, notifications, feeds',
    executors: ['ring-buffer'],
    tuning: { autoReconnect: true, lastEventId: true, heartbeat: 30000, batchFlush: 100, retry: { max: 5, backoff: 'exponential' } },
    lanes: { '*.events': 'hot', '*.heartbeat': 'cold' },
    detection: { patterns: ['sse', 'eventsource', 'notify', 'feed'], nodeTypes: { data: { min: 1 } } }
  },

  adaptiveBitrate: {
    name: 'adaptiveBitrate', category: 'streaming',
    description: 'Video streaming, real-time media, variable network',
    executors: ['scenegraph-booster', 'ring-buffer'],
    tuning: { algorithm: 'buffer-based', tiers: [240, 360, 720, 1080, 4000], upswitchSmooth: true, downswitchAggressive: true, prefetch: 3 },
    lanes: { '*.buffer': 'hot', '*.quality': 'warm', '*.segments': 'cold' },
    detection: { patterns: ['abr', 'bitrate', 'quality', 'video'], nodeTypes: { data: { min: 3 } } }
  },

  jitterBuffer: {
    name: 'jitterBuffer', category: 'streaming',
    description: 'VoIP, WebRTC, real-time audio/video',
    executors: ['ring-buffer'],
    tuning: { adaptive: true, targetMs: 50, maxMs: 200, packetLossConcealment: true, dropOnLate: true },
    lanes: { '*.packets': 'hot', '*.playout': 'hot' },
    detection: { patterns: ['jitter', 'voip', 'webrtc', 'packet'], nodeTypes: { data: { min: 2 } } }
  },

  forwardErrorCorrection: {
    name: 'forwardErrorCorrection', category: 'streaming',
    description: 'Lossy networks, satellite, mobile, real-time media',
    executors: ['etl-guru'],
    tuning: { algorithm: 'xor', overhead: 0.2, adaptive: true, blockSize: 10, recoveryThreshold: 0.5 },
    lanes: { '*.encode': 'warm', '*.recover': 'hot' },
    detection: { patterns: ['fec', 'error-correction', 'loss', 'packet'], nodeTypes: { data: { min: 2 } } }
  },

  mediaTranscoder: {
    name: 'mediaTranscoder', category: 'streaming',
    description: 'User uploads, format conversion, thumbnail generation',
    executors: ['etl-guru'],
    tuning: { segmentGOP: true, parallel: true, preset: 'medium', progress: true, hardwareAccel: true },
    lanes: { '*.transcode': 'critical', '*.progress': 'warm', '*.output': 'cold' },
    detection: { patterns: ['transcode', 'convert', 'media', 'format'], nodeTypes: { data: { min: 2 } } }
  },

  videoSegmenter: {
    name: 'videoSegmenter', category: 'streaming',
    description: 'HLS/DASH preparation, VOD packaging',
    executors: ['etl-guru'],
    tuning: { segmentDuration: 6, multiBitrate: true, keyframeAlign: true, drmHook: true, manifestGenerate: true },
    lanes: { '*.segment': 'critical', '*.manifest': 'warm', '*.upload': 'cold' },
    detection: { patterns: ['segment', 'hls', 'dash', 'vod'], nodeTypes: { data: { min: 3 } } }
  },

  liveTranscription: {
    name: 'liveTranscription', category: 'streaming',
    description: 'Speech-to-text streaming, meeting notes, captioning',
    executors: ['ring-buffer', 'etl-guru'],
    tuning: { interimResults: true, interval: 200, speakerDiarization: true, languageDetection: true, partialAsHot: true },
    lanes: { '*.partial': 'hot', '*.final': 'warm', '*.speakers': 'cold' },
    detection: { patterns: ['transcribe', 'speech', 'voice', 'caption'], nodeTypes: { data: { min: 2 } } }
  },

  thumbnailGenerator: {
    name: 'thumbnailGenerator', category: 'streaming',
    description: 'Image/video preview, gallery, CMS',
    executors: ['etl-guru'],
    tuning: { responsiveSizes: [320, 640, 1280], format: 'webp', quality: 80, blurhash: true, cacheFirst: true },
    lanes: { '*.generate': 'warm', '*.cache': 'cold', '*.serve': 'hot' },
    detection: { patterns: ['thumbnail', 'preview', 'resize', 'image'], nodeTypes: { data: { min: 2 } } }
  },

  streamReplay: {
    name: 'streamReplay', category: 'streaming',
    description: 'Debugging, audit, event sourcing, time-travel',
    executors: ['ring-buffer'],
    tuning: { timestampIndex: true, speedControl: [1, 2, 5, 10], filterByType: true, maxRetention: 86400000, seekToTimestamp: true },
    lanes: { '*.record': 'warm', '*.replay': 'hot', '*.storage': 'cold' },
    detection: { patterns: ['replay', 'time-travel', 'record', 'debug'], nodeTypes: { data: { min: 2 } } }
  }
}

/** List all flow names */
export function listFlows(filter = {}) {
  let names = Object.keys(flows)
  if (filter.category) names = names.filter(n => flows[n].category === filter.category)
  return names.map(n => ({ name: n, ...flows[n] }))
}

/** Suggest the best flow for a graph based on its described structure */
export function suggestFlow(graph) {
  const desc = typeof graph.describe === 'function' ? graph.describe() : null
  if (!desc) return { recommended: 'form', alternatives: [], reasoning: ['could not inspect graph'] }

  const nodes = desc.nodes || {}
  const nodeCount = Object.keys(nodes).length
  const dataCount = Object.values(nodes).filter(n => n.type === 'data').length
  const updateCount = Object.values(nodes).filter(n => n.type === 'update').length
  const viewCount = Object.values(nodes).filter(n => n.type === 'view').length

  let best = 'form'
  let bestScore = 0
  const scores = []

  for (const [name, flow] of Object.entries(flows)) {
    const d = flow.detection || {}
    const nTypes = d.nodeTypes || {}
    let score = 0

    if (nTypes.data) {
      if (dataCount >= (nTypes.data.min || 0) && dataCount <= (nTypes.data.max || Infinity)) score += 2
    }
    if (nTypes.update) {
      if (updateCount >= (nTypes.update.min || 0)) score += 1
    }
    if (nTypes.view) {
      if (viewCount >= (nTypes.view.min || 0)) score += 1
    }

    if (score > bestScore) { bestScore = score; best = name }
    scores.push({ name, score })
  }

  const alternatives = scores.filter(s => s.name !== best && s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3)

  return {
    recommended: best,
    alternatives: alternatives.map(a => a.name),
    reasoning: [
      `graph has ${dataCount} data, ${updateCount} update, ${viewCount} view nodes`,
      `best match: "${best}" with score ${bestScore}`
    ]
  }
}
