/**
 * @uploop/flows — Pre-tuned execution profiles with breakthrough strategies.
 *
 * @module @uploop/flows
 */
export { flows, listFlows, suggestFlow } from './registry.js'
export { createFlow, createMixedFlow } from './builder.js'
export {
  temperatureLaneRouter,
  dependencyBatchOptimizer,
  criticalPathScheduler,
  eventRateClassifier,
  orphanDetector,
  mergeImpactAnalyzer,
  frameBudgetEnforcer,
  backpressureController,
  cacheAwareSkipper,
  predictivePrefetcher,
  compareReport
} from './strategies.js'
export { generateReport, generateAllFlowsComparison } from './report.js'
export { pipeline, queue, eventStream } from './pipeline.js'
export {
  createCircuitBreaker, CircuitOpenError,
  createRateLimiter,
  createRetryWithBackoff, MaxRetriesExceededError,
  createBatchProcessor,
  createPriorityQueue,
  createDeduplicationFilter,
  createEventBus,
  createIdempotencyGuard,
  createDeadLetterQueue,
  createBulkhead, BulkheadFullError,
  createSagaOrchestrator, SagaFailedError,
  createFanOutFanIn, FanOutTimeoutError
} from './profiles/index.js'
