/**
 * Build-time rule engine for Uploop lint.
 *
 * Catches schema, Vite, SST, graph, and component issues at build time
 * that would otherwise surface as cryptic runtime errors.
 *
 * @module @uploop/lint/rules
 */

// ── Schema / Entity Rules ───────────────────────────────────

export function checkSchemaRules(source, errors, warnings) {
  // 11. entity() defined but never used with validate() / storeFromEntity()
  const entityDefs = source.match(/\bentity\s*\(\s*['"](\w+)['"]/g) || []
  for (const def of entityDefs) {
    const name = (def.match(/['"](\w+)['"]/) || [])[1]
    if (name && !source.includes(name + '.validate') && !source.includes('storeFromEntity(' + name)) {
      warnings.push({
        code: 'entity_no_validate',
        message: `Entity "${name}" is defined but never validated or stored. Consider adding ${name}.validate(data) or storeFromEntity(${name}).`,
        line: findLine(source, def)
      })
    }
  }

  // 12. Raw string type instead of string() builder
  if (/type\s*:\s*['"]string['"]/.test(source) && source.includes('entity(')) {
    warnings.push({
      code: 'raw_string_type',
      message: '"type: \'string\'" found in entity definition. Use string() from @uploop/schema instead (provides validation, describe(), and wire format).',
      line: findLine(source, "type: 'string'") || findLine(source, 'type: "string"')
    })
  }

  // 13. ref() to unregistered entity
  const refMatches = source.matchAll(/\bref\s*\(\s*['"](\w+)['"]\s*\)/g)
  const definedEntities = [...source.matchAll(/\bentity\s*\(\s*['"](\w+)['"]/g)].map(m => m[1])
  const importedEntities = [...source.matchAll(/fromJSON\s*\(\s*['"](\w+)['"]/g)].map(m => m[1])
  const known = new Set([...definedEntities, ...importedEntities])
  for (const m of refMatches) {
    const refName = m[1]
    if (!known.has(refName) && !source.includes(`entity('${refName}'`) && !source.includes(`entity("${refName}"`)) {
      warnings.push({
        code: 'ref_unknown_entity',
        message: `ref('${refName}') references entity "${refName}" which is not defined or imported in this file.`,
        line: findLine(source, `ref('${refName}')`)
      })
    }
  }
}

// ── Vite / Build / SST Rules ────────────────────────────────

export function checkBuildRules(source, errors, warnings) {
  // 14. html` used without import
  if (source.includes('html`') && !source.includes('import') && source.includes('html')) {
    // double-check: is it really an html tagged template?
    if (/html\s*`/.test(source) && !source.includes("import {") && !source.includes("import{")) {
      warnings.push({
        code: 'html_no_import',
        message: 'html template literal used but no import statement found. Import: import { html } from \'@uploop/html\'',
        line: findLine(source, 'html`')
      })
    }
  }

  // 15. window/document used without SSR guard
  if (source.includes('renderToString') &&
      (/\bwindow\b/.test(source) || /\bdocument\b/.test(source)) &&
      !source.includes('typeof window') && !source.includes('isBrowser')) {
    warnings.push({
      code: 'ssr_window_access',
      message: 'window or document accessed in SSR code without browser guard. Use: if (typeof window !== \'undefined\') { ... } or check import.meta.env.SSR.',
      line: findLine(source, 'window') || findLine(source, 'document')
    })
  }

  // 16. fetch() without error handling in event/update handler
  const fetchLines = source.split('\n')
  for (let i = 0; i < fetchLines.length; i++) {
    const line = fetchLines[i]
    if (line.includes('fetch(') && !line.includes('.catch') && !line.includes('try {')) {
      // check if there's a .catch on next few lines
      let hasCatch = false
      for (let j = i; j < Math.min(i + 5, fetchLines.length); j++) {
        if (fetchLines[j].includes('.catch') || fetchLines[j].includes('try {')) {
          hasCatch = true; break
        }
      }
      if (!hasCatch) {
        warnings.push({
          code: 'fetch_no_error_handling',
          message: 'fetch() without .catch() or try/catch. Network errors will crash the update pipeline.',
          line: i + 1
        })
        break // one warning per file is enough
      }
    }
  }

  // 17. WebSocket created without cleanup in client code
  if (/\bnew\s+WebSocket\b/.test(source) && !source.includes('.close()') && !source.includes('onClose')) {
    warnings.push({
      code: 'websocket_no_cleanup',
      message: 'WebSocket created without .close() or onClose handler. Connections will leak on component disposal.',
      line: findLine(source, 'new WebSocket')
    })
  }

  // 18. setInterval without clearInterval
  const intervals = source.match(/\bsetInterval\b/g) || []
  const clearIntervals = source.match(/\bclearInterval\b/g) || []
  if (intervals.length > clearIntervals.length) {
    warnings.push({
      code: 'setInterval_no_cleanup',
      message: 'setInterval() found without matching clearInterval(). Consider using the cleanup return from createEffect() instead.',
      line: findLine(source, 'setInterval')
    })
  }
}

// ── Graph / Flow Rules ──────────────────────────────────────

export function checkGraphRules(source, errors, warnings) {
  // 19. send('event') without matching update:{ event } or on:{ event }
  const sendMatches = source.matchAll(/send\s*\(\s*['"](\w+)['"]/g)
  for (const m of sendMatches) {
    const eventName = m[1]
    const hasHandler = source.includes(eventName + ':') || source.includes(`'${eventName}'`) || source.includes(`"${eventName}"`)
    if (!hasHandler && eventName !== 'inc' && eventName !== 'dec') {
      warnings.push({
        code: 'send_without_handler',
        message: `send('${eventName}') called but no "${eventName}" handler found in update:{} or on:{}. The event will be silently ignored.`,
        line: findLine(source, `send('${eventName}')`)
      })
    }
  }

  // 20. createFlow() with unknown profile name
  const flowMatches = source.matchAll(/createFlow\s*\(\s*\w+\s*,\s*['"](\w+)['"]/g)
  const knownFlows = ['form','list','dashboard','chat','infiniteScroll','searchTypeahead',
    'realtimeCollab','liveLeaderboard','liveCursor','dataGrid','dataPipeline','analyticsRealtime',
    'videoPlayer','canvas2D','webGL3D','animation','imageEditor','offlineFirst','ssrHydration',
    'serviceWorker','turnBased','realTime','physics','aiAgent',
    'eventBus','messageRouter','deadLetterQueue','idempotencyGuard','sagaOrchestrator',
    'eventSourcing','cqrsPipeline','changeDataCapture','workflowEngine','outboxPattern',
    'circuitBreaker','rateLimiter','retryWithBackoff','bulkhead','gracefulShutdown',
    'healthCheck','featureFlag','distributedLock','auditTrail','reconciliationLoop',
    'mapReduce','windowedAggregation','deduplicationFilter','enrichmentPipeline',
    'schemaMigration','dataMasking','snapshotManager','timeSeriesCompaction',
    'joinOperator','fanOutFanIn','connectionPool','objectPool','batchProcessor',
    'priorityQueue','workStealing','shardedCache','writeBehindCache','readThroughCache',
    'gossipProtocol','consistentHashing','websocketMultiplexer','serverSentEvents',
    'adaptiveBitrate','jitterBuffer','forwardErrorCorrection','mediaTranscoder',
    'videoSegmenter','liveTranscription','thumbnailGenerator','streamReplay']
  for (const m of flowMatches) {
    if (!knownFlows.includes(m[1])) {
      errors.push({
        code: 'flow_unknown_profile',
        message: `createFlow() references unknown profile "${m[1]}". Available profiles: form, list, dashboard, circuitBreaker, eventBus, ... (74 total in @uploop/flows).`,
        line: findLine(source, `'${m[1]}'`)
      })
    }
  }

  // 21. data node without default value
  const dataNodeRe = /\{\s*type\s*:\s*['"]data['"](?![\s\S]*?\bdefault\b)/g
  let dn
  while ((dn = dataNodeRe.exec(source)) !== null) {
    warnings.push({
      code: 'data_no_default',
      message: 'Data node defined without a "default" value. Undefined reads will cause runtime errors.',
      line: findLine(source, dn[0])
    })
  }
}

// ── Component / HTML Rules ──────────────────────────────────

export function checkComponentRules(source, errors, warnings) {
  // 22. component() defined but never .mount() called
  const compDefs = source.match(/component\s*\(\s*['"](\w+)['"]/g) || []
  const compNames = compDefs.map(d => (d.match(/['"](\w+)['"]/) || [])[1]).filter(Boolean)
  for (const name of compNames) {
    if (!source.includes(name + '.mount') && !source.includes('mount(' + name) && !source.includes('defineElement')) {
      warnings.push({
        code: 'component_not_mounted',
        message: `Component "${name}" is defined but never .mount() called. It will not render.`,
        line: findLine(source, `component('${name}'`)
      })
    }
  }

  // 23. Using @event and :attr are preferred. .prop=${} is supported but verbose.
  if (source.includes('.prop=') && source.includes('html`')) {
    warnings.push({
      code: 'dot_prop_prefer_at',
      message: '.prop=${} syntax found. Consider using @event for event handlers or :attr for attribute bindings instead. .prop is supported but less idiomatic.',
      line: findLine(source, '.prop=')
    })
  }

  // 24. async view function (views must be sync)
  if (/view\s*:\s*(?:async\s*(?:function\s*)?\(|\([^)]*\)\s*=>\s*async)/.test(source)) {
    errors.push({
      code: 'async_view',
      message: 'View function is async. Views must be synchronous — use data nodes + update handlers for async data loading.',
      line: findLine(source, 'async')
    })
  }

  // 25. empty view returning null/undefined/empty string
  const viewReturns = source.match(/view\s*:\s*[^}]*return\s+(null|undefined|''|"")\s*[;}]/g)
  if (viewReturns) {
    warnings.push({
      code: 'empty_view_return',
      message: 'View function returns null/undefined/empty string. The component will render as blank. Did you forget to return html`...`?',
      line: findLine(source, viewReturns[0])
    })
  }
}

// ── Import / Module Rules ───────────────────────────────────

export function checkImportRules(source, errors, warnings, filePath) {
  // 26. import from @uploop/* but not in package.json dependencies
  const uploopImports = [...source.matchAll(/from\s+['"]@uploop\/(\w+)['"]/g)]
  for (const m of uploopImports) {
    const pkg = m[1]
    // Check known @uploop packages
    const knownPackages = ['core','html','schema','store','flows','stream','router','css','sst','devutils','auth','lint','state-machine']
    if (!knownPackages.includes(pkg)) {
      warnings.push({
        code: 'unknown_uploop_package',
        message: `Import from @uploop/${pkg} — package not recognized. Valid packages: ${knownPackages.join(', ')}.`,
        line: findLine(source, '@uploop/' + pkg)
      })
    }
  }

  // 27. Relative import with too many ../ levels (fragile)
  const deepRelatives = source.match(/from\s+['"](\.\.\/){4,}/g)
  if (deepRelatives) {
    warnings.push({
      code: 'deep_relative_import',
      message: 'Deep relative import (4+ ../ levels). Consider using package exports or path aliases for stability.',
      line: findLine(source, deepRelatives[0])
    })
  }

  // 28. import of a file that doesn't exist (simple heuristic)
  const importPaths = [...source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)]
  for (const m of importPaths) {
    const path = m[1]
    if (path.includes('//') || path.includes('..\\..\\')) {
      warnings.push({
        code: 'malformed_import_path',
        message: `Import path "${path}" looks malformed (double slashes or mixed separators).`,
        line: findLine(source, path)
      })
    }
  }
}

// ── Utility ──────────────────────────────────────────────────

function findLine(source, pattern) {
  if (!pattern) return 0
  const idx = source.indexOf(pattern)
  if (idx === -1) return 0
  return source.substring(0, idx).split('\n').length
}
