/**
 * Profile implementations — heavy-lifting algorithms for enterprise patterns.
 *
 * Each profile is a standalone, production-quality implementation that
 * can be used independently or composed with pipelines, queues, and streams.
 *
 * @module @uploop/flows/profiles
 */
export { createCircuitBreaker, CircuitOpenError } from './circuitBreaker.js'
export { createRateLimiter } from './rateLimiter.js'
export { createRetryWithBackoff, MaxRetriesExceededError } from './retryWithBackoff.js'
export { createBatchProcessor } from './batchProcessor.js'
export { createPriorityQueue } from './priorityQueue.js'
export { createDeduplicationFilter } from './deduplicationFilter.js'
export { createEventBus } from './eventBus.js'
export { createIdempotencyGuard } from './idempotencyGuard.js'
export { createDeadLetterQueue } from './deadLetterQueue.js'
export { createBulkhead, BulkheadFullError } from './bulkhead.js'
export { createSagaOrchestrator, SagaFailedError } from './sagaOrchestrator.js'
export { createFanOutFanIn, FanOutTimeoutError } from './fanOutFanIn.js'
