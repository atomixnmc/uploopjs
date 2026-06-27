/**
 * Flow Registry — 24 pre-tuned execution profiles.
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
