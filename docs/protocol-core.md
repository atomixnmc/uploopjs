# @uploop/core Protocol

## Overview

`@uploop/core` is a pure update-loop runtime. It knows nothing about HTML, DOM, or browsers. It provides the fundamental execution model — signals, loops, frames, effects, batching, and event processing.

```
event → EventEnvelope → guards → update handler → state patch → subscribers notified (via frame scheduler)
```

## Event Processing Pipeline

Every call to `send()` creates an **EventEnvelope** and runs it through a pipeline before the handler executes:

```
send('inc', 5)
    │
    ▼
┌─────────────────────────────────────────┐
│  1. Create EventEnvelope               │
│     id: 'ev_42'                        │
│     type: 'inc'                        │
│     payload: [5]                       │
│     source: 'user'                     │
│     cause: 'ev_41' (parent event)      │
│     depth: parentDepth + 1             │
│     transaction: 'tx_abc'              │
│     timestamp: 1234567                 │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  2. Guard: maxEventDepth               │
│     depth > limit → REJECT with warning│
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  3. Guard: maxEventsPerTransaction     │
│     same event > limit → REJECT        │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  4. Execute Handler                    │
│     handler(state, ...payload)         │
│     If handler calls send() → recurse  │
│     (depth+1, cause=current id)        │
└─────────────────────────────────────────┘
    │
    ▼
batch complete → notify subscribers (async, via frame scheduler)
```

### EventEnvelope

Every event carries metadata that enables cycle detection, debugging, and event lineage:

| Field        | Description                                      |
|-------------|--------------------------------------------------|
| `id`        | Unique identifier (`ev_1`, `ev_2`, ...)          |
| `type`      | Event name (matches an update handler)           |
| `payload`   | Arguments passed to `send()`                     |
| `source`    | Origin: `'user'` \| `'system'` \| `'effect'` \| `'external'` |
| `cause`     | ID of the event that triggered this one (`null` for top-level) |
| `depth`     | How deep in the call chain (1 = top-level)       |
| `timestamp` | When the event was created                       |
| `transaction`| Groups causally related events together         |

### Guards Against Infinite Loops

#### 1. maxEventDepth (default: 100)

Prevents **recursive send() chains** (handler calls send() which calls handler which calls send()...).

When `depth > maxEventDepth`, the event is rejected with a console warning:
```
[Uploop] Event "spin" rejected at depth 101 (max: 100). Possible infinite loop.
chain: ev_42 → ev_43
```

#### 2. maxEventsPerTransaction (default: 0 = off)

Prevents **oscillating event cycles** (event A → B → A → B → ...). Tracks how many times the same event fires within one transaction.

When enabled, the second occurrence of the same event in a transaction is rejected:
```
[Uploop] Event "toggle" fired 3x in transaction tx_abc123 (limit: 2). Possible cycle.
```

To enable:
```js
createLoop({ maxEventsPerTransaction: 2 })  // allow at most 2 'inc' per txn
```

### Event Introspection

The loop exposes an `events` object for runtime inspection:

```js
loop.events.total     // total events processed
loop.events.rejected  // total events rejected by guards
loop.events.depth     // current event depth
```

## createGraph(config) — HyperGraph Primitive

The `createGraph()` function is the architecture-first primitive. It replaces `createLoop()` with an explicit **node + edge** model where each node declares its type, reads, writes, and scheduling metadata. The Runner compiles this into dependency indexes at startup.

### Config Schema

```js
{
  name: 'counter',                     // Graph name
  nodes: {
    count: {                           // Data node
      type: 'data',
      default: 0,
      lifetime: 'transient'            // metadata
    },
    inc: {                             // Update node
      type: 'update',
      reads: ['count'],                // declares data dependencies
      writes: ['count'],               // declares which data it mutates
      run: (inputs) => ({ count: inputs.count + 1 }),
      pure: true                       // pure function hint
    },
    display: {                         // View node
      type: 'view',
      reads: ['count']
    }
  },
  on: {
    click: 'inc'                       // event → update node
  },
  frame: 'micro',                      // default scheduler mode
  maxEventDepth: 100,
  maxEventsPerTransaction: 0
}
```

### Node Types

| Type | Description | Fields |
|------|-------------|--------|
| `data` | State/signal value | `default`, `lifetime` |
| `update` | Pure transformation | `reads`, `writes`, `run`, `pure` |
| `view` | Render output | `reads`, `run` |
| `effect` | Side effect | `run` |
| `event` | External trigger | — |
| `resource` | Fetch/cache/db | `reads`, `writes`, `cache` |

### Node Metadata Fields

| Field | Values | Purpose |
|-------|--------|---------|
| `lifetime` | `transient`, `hot`, `cold`, `stable`, `persistent` | Data retention policy |
| `frame` | `micro`, `visual`, `idle`, `network` | Suggested scheduler frame |
| `debounce` | ms | Debounce before executing |
| `cancelPrevious` | boolean | Cancel previous pending run |
| `cache` | `{ key, ttl }` | Cache policy |
| `pure` | boolean | Hint that function has no side effects |

### Return Value (Graph API)

```js
{
  get()                  // → { count: 0, ... }  — all data as object
  getNode(name)          // → value of single data node
  set(name, value)       // → set a data node directly
  setMany([[n,v],...])   // → set multiple data nodes atomically
  send(event, ...args)   // → dispatch event through graph
  subscribe(fn)          // → unsubscribe
  frame                  // frame scheduler
  batch(fn)              // batch updates
  use(plugin)
  registerNode(name, def)
  registerEdge(from, to)
  describe()             // → HyperGraph manifest with metadata
  dispose()
  events: { total, rejected, depth }
  nodes: { names, types, get(name), data(name) }
  edges: { list, get(from) }
}
```

### Dependency Flow

```
send('click')
  → graph finds update node 'inc' (via on: { click: 'inc' })
  → reads 'count' data node
  → runs updateFn(inputs) → { count: 1 }
  → writes result to 'count' data node
  → finds views that read 'count' → 'display'
  → schedules view notification on frame
  → only affected views are notified (not all subscribers)
```

## createLoop(config)

Creates a self-contained update loop — a simplified wrapper around the graph model. Internally it creates a flatten graph with implicit edges.

### Config Schema

```js
{
  name: string,                        // optional
  state: object,                       // initial state
  update: {                            // named update handlers
    [handlerName]: (state, ...payload) => partialState
  },
  effect: {                            // named side effects
    [effectName]: (ctx, ...payload) => void
  },
  frame: 'micro'|'visual'|'idle'|'manual',
  maxEventDepth: 100,
  maxEventsPerTransaction: 0,
  onUnknownEvent: (event, ...args) => void,
  onEventRejected: (envelope) => void
}
```

### Return Value (Loop API)

```js
{
  get()                     // → current state
  set(patch)
  send(event, ...args)
  subscribe(fn) → unsubscribe
  on(event, handler)        // register at runtime
  effect(name, handler)
  frame
  batch(fn)
  use(plugin)
  registerNode(name, def)
  registerEdge(from, to)
  describe()                // → HyperGraph manifest
  dispose()
  events: { total, rejected, depth }
  nodes: { names, get(name) }
  edges: { list }
}
```

### Update Handler Contract

```js
// Pure: receives state, returns partial state to merge
(state, ...args) => ({ key: newValue })

// Returning undefined or the same state reference skips the update
```

Rules:
- Handlers should be **pure** by convention (effects go in `effect`)
- Return a **partial state object** — it's merged via `{ ...old, ...result }`
- Return `undefined` or the same reference to skip the update
- Multiple `send()` calls are **automatically batched**

### Send Flow

```
send('inc')
  → handler(currentState) returns { count: currentState.count + 1 }
  → batch() wraps the update
  → stateSignal.set(nextState)
  → frame.schedule(notify subscribers)
  → effects run after notify
```

## createSignal(initialValue)

A reactive atomic value with subscribers.

```js
{
  get()                     // → current value
  set(newValue)             // set value (or function updater)
  subscribe(fn)             // subscribe → unsubscribe()
  dispose()                 // clean up
}
```

Signals only notify on **value inequality** (`next !== value`). Function updaters are supported: `signal.set(v => v + 1)`.

## createFrame(mode)

A scheduler that defers work to the right execution context.

### Modes

| Mode      | Mechanism              | Use Case                     |
|-----------|------------------------|------------------------------|
| `micro`   | `queueMicrotask`       | Immediate UI patch (default) |
| `visual`  | `requestAnimationFrame`| Animation, visual sync       |
| `idle`    | `requestIdleCallback`  | Background work              |
| `manual`  | explicit `flush()`     | Testing, custom control      |

```js
{
  schedule(fn)     // enqueue work
  flush()          // execute all pending immediately
  dispose()        // clean up
}
```

## createEffectSystem(effects, getState, send)

Declarative side-effect runner.

```js
{
  run(name, ...args)     // execute named effect
  register(name, fn)     // add an effect at runtime
  dispose(name)          // remove and clean up an effect
  disposeAll()           // clean up all effects
}
```

Effect handler receives:

```js
(ctx, ...args) => {
  ctx.get()       // current state
  ctx.send()      // send events back into the loop
  ctx.onDispose() // register cleanup function
}
```

## batch(fn, { notify })

Wraps multiple state mutations into a single notification. Nested `batch()` calls are flattened — only the outermost triggers the final notify.

```js
batch(() => {
  send('inc')
  send('inc')
  send('inc')
  // subscribers only see the final state
})
```

## createScope()

Groups cleanup operations. Cleanups run in reverse order (stack-like).

```js
{
  onDispose(fn)    // register cleanup
  dispose()        // run all cleanups
}
```

## Plugin Protocol

```js
use(loop, plugin)       // install a plugin
```

A plugin can be:
- A **function** `(loop) => extension`
- An **object** with `.install(loop)` method

## Describe Protocol (HyperGraph Manifest)

Every loop exports its design graph via `loop.describe()`:

```json
{
  "kind": "uploop.loop",
  "name": "Counter",
  "nodes": {
    "state": { "type": "data", "access": "readwrite" },
    "inc": { "type": "update", "reads": ["state"], "writes": ["state"] },
    "view": { "type": "view", "dependsOn": ["state"] }
  },
  "edges": [
    ["state", "view"],
    ["inc", "state"],
    ["inc", "view"]
  ]
}
```

### Node Types

| Type     | Description                    |
|----------|--------------------------------|
| `data`   | State/signal node              |
| `update` | Event handler / transformation |
| `view`   | Render output                  |
| `effect` | Side-effect handler            |
| `event`  | External trigger               |
| `resource` | Data from external source    |
| `style`  | Styling declaration            |

### Node Metadata

| Field      | Description                        |
|------------|------------------------------------|
| `type`     | Node type (see above)              |
| `access`   | `read`, `write`, `readwrite`       |
| `reads`    | Array of node names this reads from |
| `writes`   | Array of node names this writes to  |
| `dependsOn`| Array of node names this depends on |
| `lifetime` | `transient`, `hot`, `cold`, `stable`|
| `cache`    | Cache config `{ key, ttl }`        |
| `debounce` | Debounce ms                        |
| `frame`    | Frame mode for scheduling          |
| `interruptible` | Whether the operation can be cancelled |

---

# Data Types Reference

## Hot Data
Frequently updated, always fresh. Example: mouse position, WebSocket feed.

## Cold Data
Cached, loaded on demand. Example: user profile fetched from API.

## Transient Data
Temporary frame-local state. Example: form input before submit.

## Stable Data
Persisted across sessions. Example: user preferences.

## Remote Data
Backed by network. Example: search results from server.

## Derived Data
Computed from other data. Example: filtered list, sum of values.
