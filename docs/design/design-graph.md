# Uploop HyperGraph — Node & Edge Structure

> The graph is the hub. Everything flows through typed nodes connected by directed edges.  
> This is the source of truth for Uploop's graph model.

---

## 1. Node Types

Every node in a HyperGraph has a `type` that determines its role, behavior, and runtime characteristics.

### 1.1 `data` — State Node

Holds application state. The atomic unit of reactive data.

```
{
  type: 'data',
  default: 0,              // initial value
  temperature: 'hot',      // hot | warm | cold — affects lane scheduling
  lifetime: 'transient',   // transient | session | persistent — affects GC
  cache: { ttl: 30000 },   // optional cache behavior
  owner: 'user',           // who owns this data (for auth)
  consistency: 'strong',   // strong | eventual
  meta: {                  // AI-readable metadata
    description: 'User name',
    tags: ['pii'],
    aiRole: 'identity'
  }
}
```

- **temperature**: Routes writes to execution lanes — hot→RAF, warm→microtask, cold→idle
- **lifetime**: Transient data is GC'd after loop disposal. Persistent data survives.
- **cache**: Optional TTL + stale-while-revalidate for read-through caching

### 1.2 `update` — Computation Node

Reads from data nodes, applies a computation, writes results to data nodes.

```
{
  type: 'update',
  reads: ['query'],        // input data nodes
  writes: ['results'],     // output data nodes
  run: async (data, ...params) => newState,  // computation function
  debounce: 300,           // auto-debounce (ms)
  interruptible: true,     // auto-AbortController
  cancelPrevious: true,    // cancel in-flight if re-invoked
  retry: { max: 3, backoff: 'exponential' },
  cache: { ttl: 10000 }
}
```

- **reads**: Declared dependencies — HyperGraph uses these for invalidation
- **writes**: Declared outputs — only these nodes can be modified
- **debounce**: Framework auto-debounces. No `setTimeout` needed.
- **interruptible**: Framework creates `AbortController`, passes `signal` to `run`

### 1.3 `view` — Rendering Node

Derives DOM or visual output from data nodes. Pure function of state.

```
{
  type: 'view',
  reads: ['count', 'name'],  // data nodes this view depends on
  run: renderFn              // (data) => DOM / canvas / output
}
```

- Re-renders only when declared `reads` change
- Can target DOM, Canvas 2D, WebGL, or custom render targets

### 1.4 `effect` — Side Effect Node

Reacts to data changes with external side effects (network, storage, logging).

```
{
  type: 'effect',
  reads: ['user', 'theme'],
  run: (data) => { localStorage.set('theme', data.theme) },
  kind: 'sync'              // sync | async | fire-and-forget
}
```

- `sync`: Run immediately after state commit
- `async`: Run in next microtask
- `fire-and-forget`: Run without blocking the update pipeline

### 1.5 `route` — Navigation Node

Defines URL patterns and their associated state/view mappings.

```
{
  type: 'route',
  pattern: '/users/:id',
  guard: (params) => auth.isLoggedIn(),
  reads: ['currentUser'],
  action: (params, data) => loadUser(params.id)
}
```

### 1.6 `service` — External Integration Node

Connects to external APIs, databases, WebSockets. Bridges HyperGraph to the outside world.

```
{
  type: 'service',
  protocol: 'http',         // http | ws | db | file
  endpoint: '/api/users',
  method: 'GET',
  reads: ['query'],
  writes: ['results'],
  schema: User              // @uploop/schema entity for validation
}
```

---

## 2. Edges

Directed connections between nodes. Data flows along edges.

```
{
  from: 'query',            // source node name
  to: 'search',             // target node name
  type: 'data-flow',        // data-flow | event | depend | invalidate
  weight: 1.0,              // for executor selection (0-1)
  metadata: {
    description: 'Search triggers when query changes',
    aiRole: 'trigger'
  }
}
```

### Edge Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `data-flow` | data → update, update → data | Data flows along computation chain |
| `event` | update → update | Explicit event triggering (like send()) |
| `depend` | data → view, data → effect | View/effect re-renders when source changes |
| `invalidate` | update → data | Marks data as stale, triggers cache refresh |
| `relate` | entity → entity | Entity relationship (User → Posts) |

### Edge Semantics

- **Update propagates forward**: When node A changes, all nodes on outgoing edges from A are notified
- **Invalidation flows backward**: When node B is invalidated, nodes that read B are also invalidated
- **Cycles are broken**: HyperGraph detects cycles via topological sort. Cyclic edges are flagged.
- **Temperature routes execution**: Hot-source edges trigger RAF. Cold-source edges trigger idle.

---

## 3. Temperature System

Every data node has a temperature that determines execution priority.

| Temperature | Lane | Mechanism | Budget | Example |
|-------------|------|-----------|--------|---------|
| `hot` | RAF | requestAnimationFrame | 4ms | Mouse position, scroll, game state |
| `warm` | Microtask | Promise / postTask | 8ms | Form fields, derived values, cache |
| `cold` | Idle | requestIdleCallback | 50ms | Prefetch, analytics, sync |
| `critical` | Sync | Direct call | ∞ | State commits, lock acquisition |

### Lane Routing Algorithm

1. When a data node changes, HyperGraph walks outgoing edges
2. Each edge's target is scheduled on the lane corresponding to the data node's temperature
3. Mixed-temperature reads: the HOTTEST source wins
4. Frame budget enforcer ensures total work per frame ≤ 16ms

---

## 4. Execution Protocol

### Update Cycle

```
1. Event arrives (send, user input, timer, network)
2. HyperGraph finds the update node matching the event name
3. Checks declared reads — loads current values from data nodes
4. Calls update.run(data, ...params) → returns partial state
5. Validates writes against declared writes (only declared writes allowed)
6. Commits new state to data nodes
7. Walks outgoing edges from changed data nodes
8. Schedules views/effects/computes on appropriate lanes
9. Frame budget enforcement: yields if over 16ms
```

### Batch Protocol

Multiple events within the same microtask are batched:

```
send('inc')
send('dec')
send('inc')
// → Single commit: count += 1
// → Single view render at end of microtask
```

Batch coalescing: multiple writes to the same data node within a batch are merged. Only the final value is committed.

---

## 5. Graph Lifecycle

### Creation

```js
const graph = createGraph({
  name: 'app',
  nodes: { ... },
  edges: [ ... ],
  on: { click: 'inc' }
})
```

### Disposal

```js
graph.dispose()
// → Stops all listeners
// → GC's transient data nodes
// → Calls cleanup hooks
// → Removes from registry
```

### Inspection

```js
graph.describe()
// → { nodes, edges, temperatures, lanes, metadata }
// → Fully JSON-safe — no functions leaked
// → AI can read the entire graph structure
```

---

## 6. Entity-to-Graph Mapping

`@uploop/schema` entities map to HyperGraph nodes automatically:

```js
const User = entity('User', {
  name: string(),        // → data node: User.name
  email: string(),       // → data node: User.email
  posts: ref('Post')     // → relate edge: User → Post
})

const graph = createGraph(toGraph([User, Post]))
// Auto-generates:
// - Data nodes for each field
// - Update nodes for CRUD operations
// - Relate edges for entity references
// - Service nodes for API endpoints
```

---

## 7. Graph Description Format

Every graph exports `describe()` → JSON-safe manifest:

```json
{
  "kind": "uploop.graph",
  "name": "app",
  "nodes": {
    "count": { "type": "data", "temperature": "hot", "default": 0 },
    "inc": { "type": "update", "reads": ["count"], "writes": ["count"] },
    "counterView": { "type": "view", "reads": ["count"] }
  },
  "edges": [
    { "from": "count", "to": "inc", "type": "data-flow" },
    { "from": "inc", "to": "count", "type": "data-flow" },
    { "from": "count", "to": "counterView", "type": "depend" }
  ],
  "metadata": {
    "nodeCount": 3,
    "edgeCount": 3,
    "temperatureDistribution": { "hot": 1, "warm": 2 },
    "laneRouting": { "count": "hot", "counterView": "warm" }
  }
}
```

---

## 8. Integration Points

| Package | How it uses HyperGraph |
|---------|----------------------|
| `@uploop/schema` | `toGraph()` converts entities to graph nodes + edges |
| `@uploop/flows` | `createFlow(graph, profile)` tunes executor + lanes from graph metadata |
| `@uploop/store` | `storeFromEntity()` creates data nodes with persistence |
| `@uploop/html` | Component state → data nodes. Views → view nodes. Events → edges. |
| `@uploop/stream` | Entity → codec. Data nodes → binary frames. |
| `@uploop/sst` | SSR renders graph state. Remote loops sync client/server graphs. |
| `@uploop/gql` (v0.9) | Gremlin/Cypher queries traverse graph edges natively. |

---

*The graph is not an add-on. It's the substrate that every package reads from and writes to.*
