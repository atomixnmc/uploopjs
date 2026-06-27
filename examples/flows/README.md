# Uploop Flows — Live Demos

15 interactive examples showcasing Uploop's breakthrough execution patterns.
All demos use real algorithm implementations from `@uploop/flows`.

## Run

```bash
cd examples/flows
npx vite --open
```

Or open `index.html` directly in a browser (ESM modules, no build step).

## Demos

| # | Demo | Flow Pattern | Key Algorithm |
|---|------|-------------|---------------|
| 1 | Search Typeahead | Debounce + abort + cache | Ring buffer, AbortController |
| 2 | Circuit Breaker | 3-state fail-fast | CLOSED→OPEN→HALF_OPEN state machine |
| 3 | Rate Limiter | Token bucket throttle | Per-key isolation, burst |
| 4 | Priority Queue | Aging + starvation prevention | Binary min-heap per level |
| 5 | Event Bus | Wildcard pub/sub | `*` segment, `>` recursive matching |
| 6 | Saga Checkout | Compensating transaction | Reverse-order rollback |
| 7 | Batch Processor | Size+time accumulation | Flush at threshold, backpressure |
| 8 | Dedup Filter | Bloom + LRU | Configurable FP rate <1% |
| 9 | Fan-Out/Fan-In | Scatter-gather | Partial policies, concurrent workers |
| 10 | Actor Model | Isolated state + mailbox | Sequential message processing |
| 11 | Reactive Form | Signals + computed + effects | Auto-subscribe dependency tracking |
| 12 | Worker Offload | CPU-bound tasks | Simulated worker pool |
| 13 | Idempotency | At-most-once semantics | Key-based response replay |
| 14 | Retry Backoff | Exponential + jitter | Transient error detection |
| 15 | Dead Letter Queue | Poison message isolation | Per-source ring buffer, alerts |

## Architecture

All demos use the same Uploop primitives:
- `html` — tagged template literals for rendering
- `createSignal/createComputed/createEffect` — reactive state
- `createCircuitBreaker/createRateLimiter/...` — algorithm profiles
- `createActor` — actor model
- `pipeline/queue/eventStream` — composable data flow

No external dependencies beyond Uploop. Each demo is ~20-40 lines of
application code — the heavy lifting is in `@uploop/flows`.

## Integration

Any existing Uploop component can be wrapped with flows:

```js
import { MyComponent } from './my-component.js'
import { createFlow, flows } from '@uploop/flows'

// Wrap existing component with search typeahead flow
const FastSearch = createFlow(MyComponent.toGraph(), flows.searchTypeahead)
// → Automatic: 200ms debounce, AbortController, LRU cache, ring buffer
```

No component changes needed. The flow tunes the executor.
