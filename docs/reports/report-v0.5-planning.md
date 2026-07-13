# v0.5.x — Server-Side Toolset

> Not just SSR. A full client-server communication layer built on
> Uploop's native concepts: events, graphs, and data flow.

---

## 1. Communication Protocols — What Fits Uploop's DataFlow?

Uploop's core primitive is `send(event, payload)` → handler → merge → notify.
Every loop has an event envelope: `{ id, type, payload, source, cause, depth, timestamp, transaction }`.

The question: how do two Uploop loops communicate across a network?

### Protocol Comparison

| Protocol | Direction | Real-time | Uploop Fit | Best For |
|---|---|---|---|---|
| **HTTP** | Client→Server | No | `send()` → `fetch()` → handler | Page loads, form submits, REST APIs |
| **WebSocket** | Bidirectional | Yes | `send()` ↔ `message` ↔ `send()` | Live collaboration, games, chat |
| **SSE** | Server→Client | Yes | Server `notify()` → stream → client `merge()` | Live feeds, notifications, dashboards |
| **Custom (event envelope)** | Bidirectional | Yes | Native — the event IS the message | Everything |

### Architecture: The Event Envelope as Wire Protocol

Uploop's event envelope already has everything a message protocol needs:

```json
{
  "id": "ev_42",
  "type": "addToCart",
  "payload": [{ "productId": "p1", "qty": 2 }],
  "source": "client",
  "cause": "ev_41",
  "depth": 2,
  "timestamp": 1718123456789,
  "transaction": "tx_abc123"
}
```

This means: **client and server loops become peers exchanging events.**
The same `send()` / `subscribe()` API works on both sides — the transport
is just a pipe that serializes and deserializes event envelopes.

### Implementation: Transport Adapters

```js
// ── Client-side: create a remote loop proxy ──

import { createRemoteLoop } from '@uploop/transport'

const serverLoop = createRemoteLoop({
  transport: 'websocket',  // or 'http', 'sse'
  url: 'wss://api.example.com',
  events: ['addToCart', 'removeFromCart', 'loadProducts']
})

// Same API as a local loop
serverLoop.send('addToCart', { productId: 'p1', qty: 2 })
serverLoop.subscribe(state => {
  // state updates streamed from server
})
serverLoop.onDataChange('cart', (newVal) => {
  // granular subscription, server-pushed
})

// ── Server-side: expose local loops over transport ──

import { createTransportServer } from '@uploop/transport'

const transport = createTransportServer({
  port: 3001,
  loops: {
    cart: cartLoop,        // local createLoop/graph instance
    products: productLoop,
    users: userLoop
  }
})

// Client events are forwarded to the local loop
// Local loop notifications are forwarded to connected clients
// Event envelope carries causality (cause, depth, transaction) across network
```

### Protocol Decision Matrix

| Use Case | Protocol | Why |
|---|---|---|
| Page load, SSR hydration | HTTP + JSON | Initial state serialized in `<script>`, subsequent updates via WS |
| Form submit, API call | HTTP | Simple request/response, no persistent connection needed |
| Real-time dashboard | SSE | Server pushes data, client only reads |
| Chat, collaborative editing | WebSocket | Bidirectional, low latency, persistent |
| Multi-player game state | WebSocket + binary | High frequency, small payloads |
| IoT sensor data | WebSocket or MQTT | Lightweight, push-based |
| Microservice communication | Custom (event envelope over HTTP/WS) | Same event model across services |

### The Key Insight

React needs Redux/Zustand for state, React Query for server cache, and a separate
WebSocket library for real-time. Uploop unifies all three:

```
                    ┌──────────────────────┐
                    │     Uploop Loop       │
                    │                       │
  User click ───►  │  send('addToCart')    │
                    │    │                  │
                    │    ├─► local handler  │  ← same API
                    │    │   (optimistic)   │
                    │    │                  │
                    │    └─► remote handler │  ← transparent
                    │        (server sync)  │
                    │           │           │
                    │           ▼           │
                    │  merge response       │
                    │  notify subscribers   │
                    └──────────────────────┘
```

---

## 2. Query-Friendly Graph Protocol

Uploop's graph engine already has: dependency indexes, `plan()`, `whatReads()`,
`transitiveDeps()`, `onDataChange()`. These ARE query capabilities — they tell
you what depends on what, what changed, and what to update.

The question: how do you query this from outside (client, another service, devtools)?

### Option A: GraphQL-Style — Schema from Graph Nodes

```graphql
# Auto-generated schema from Uploop graph node types
type Product {
  id: ID!
  name: String!
  price: Float!
}

type Cart {
  items: [CartItem!]!
  total: Float!
}

type Query {
  products(filter: ProductFilter): [Product!]!
  product(id: ID!): Product
  cart: Cart!
}

type Mutation {
  addToCart(productId: ID!, qty: Int!): Cart!
  removeFromCart(productId: ID!): Cart!
}

type Subscription {
  cartUpdated: Cart!
  productChanged(id: ID!): Product!
}
```

**Pros:** Industry standard, Apollo tooling, typed, self-documenting.
**Cons:** Schema definition overhead. Uploop graphs have types but no resolver mapping.

**Uploop fit: 7/10** — Good for external API consumers. Overkill for internal use.

### Option B: FeathersJS-Style — Services from Data Nodes

Each data node (or group of nodes) becomes a "service" with standard methods:

```js
// Server: define services backed by Uploop loops/graphs
const app = uploop()

app.use('products', {
  // Maps to graph.getNode('products'), graph.whatReads('products')
  async find(params) {
    const state = productGraph.get()
    return state.products.filter(p => !params.query?.category || p.category === params.query.category)
  },

  async get(id) {
    return productGraph.get().products.find(p => p.id === id)
  },

  async create(data) {
    return productGraph.send('createProduct', data)
  },

  async update(id, data) {
    return productGraph.send('updateProduct', id, data)
  },

  async remove(id) {
    return productGraph.send('removeProduct', id)
  }
})

// Client: service proxy (same API, different transport)
const products = client.service('products')

// CRUD
await products.find({ query: { category: 'books' } })
await products.get('p1')
await products.create({ name: 'New Product', price: 9.99 })

// Real-time (service events = graph data change subscriptions)
products.on('created', product => { /* ... */ })
products.on('updated', product => { /* ... */ })
products.on('removed', product => { /* ... */ })

// Uploop-native queries (exposed as service methods)
await products.plan()        // → what depends on products?
await products.subscribers() // → who's listening?
await products.dependencies() // → what does products read?
```

**Pros:** Simple CRUD mental model, real-time built in, transport-agnostic.
FeathersJS proven pattern (10 years, 15k stars).
**Cons:** Less expressive for deeply nested queries than GraphQL.

**Uploop fit: 9/10** — Natural mapping. Data nodes = services. Events = service methods.

### Option C: MongoDB-Style — Query the Graph Directly

Inspired by MongoDB's query language and FeathersJS's query syntax:

```js
// Query the graph's data directly
const result = await graph.query({
  // Select which data nodes to read
  select: ['products', 'cart'],

  // Filter (MongoDB-style operators)
  where: {
    'products.price': { $gt: 100, $lt: 500 },
    'products.category': { $in: ['books', 'electronics'] },
    'products.name': { $regex: /uploop/i }
  },

  // Sort, paginate
  sort: { 'products.price': -1 },
  skip: 0,
  limit: 20,

  // Include dependency info
  includeDeps: true  // → also returns whatReads, whatWrites, transitiveDeps
})

// Subscribe to query results (live query)
const unsub = graph.liveQuery({
  select: ['products'],
  where: { 'products.price': { $lt: 10 } }
}, (results) => {
  // Called whenever a product with price < 10 changes
})
```

**Pros:** Familiar to JS developers, no schema needed, flexible.
**Cons:** String-based field paths, limited join/relation support.

**Uploop fit: 7/10** — Good for ad-hoc queries. GraphQL-style better for typed APIs.

### Option D: Uploop-Native — Graph Protocol

Don't adapt an existing protocol. Define one that maps 1:1 to Uploop's concepts:

```js
// ── Query Language ──
// Built on the graph's own dependency indexes

// What data exists?
graph.describe().nodes
// → { products: { type: 'data', temperature: 'cold' }, ... }

// What changed?
graph.plan(['products'])
// → { views: ['productList', 'cartBadge'], updates: [], effects: [] }

// What depends on what?
graph.whatReads('products')
// → ['productList', 'cartBadge', 'searchProducts']

// Full dependency chain
graph.transitiveDeps('products.price')
// → ['validatePrice', 'cartTotal', 'productList', 'cartBadge', 'checkoutEnabled']

// ── Wire Protocol ──
// Send any of these queries over WebSocket/HTTP:

// Client → Server: query
{
  "id": "q_1",
  "type": "query",
  "method": "plan",
  "args": [["products"]]
}

// Server → Client: response
{
  "id": "q_1",
  "type": "response",
  "result": {
    "views": ["productList", "cartBadge"],
    "updates": [],
    "effects": [],
    "frame": "micro",
    "changed": ["products"]
  }
}

// Client → Server: subscribe to data changes
{
  "id": "s_1",
  "type": "subscribe",
  "dataNodes": ["products", "cart"],
  "options": { "includeDeps": true }
}

// Server → Client: push on change
{
  "id": "s_1",
  "type": "dataChange",
  "node": "products",
  "newValue": [...],
  "oldValue": [...],
  "affectedViews": ["productList", "cartBadge"]
}
```

**Pros:** Zero impedance mismatch — queries ARE graph operations.
**Cons:** New protocol to learn. No existing tooling.

**Uploop fit: 8/10** — Purest expression of Uploop's capabilities. Best for internal use.

### Recommendation: Layered Approach

```
┌─────────────────────────────────────────┐
│         GraphQL / REST API              │  ← External consumers
│    (generated from service definitions) │
├─────────────────────────────────────────┤
│         FeathersJS-style Services       │  ← Application code
│    (data nodes → service methods)       │
├─────────────────────────────────────────┤
│         Uploop Graph Protocol           │  ← Internal/devtools
│    (plan, whatReads, subscribe, ...)    │
├─────────────────────────────────────────┤
│         Transport Layer                 │
│    (HTTP, WebSocket, SSE, in-process)   │
└─────────────────────────────────────────┘
```

**Bottom layer:** Transport — agnostic. Same API over any protocol.

**Middle layer:** Uploop Graph Protocol — native queries. For devtools, internal
services, and anything that wants full access to the graph engine.

**Application layer:** FeathersJS-style services — familiar CRUD + real-time.
For application code. Each service wraps one or more graph data nodes.

**Top layer:** GraphQL/REST — for external API consumers. Auto-generated from
service definitions. Optional.

### What FeathersJS Got Right (That Uploop Should Adopt)

1. **Service interface:** `find/get/create/update/remove` + `on('created')` for real-time
2. **Transport agnostic:** Same service works over HTTP, WebSocket, or in-process
3. **Hooks:** `before`/`after` hooks on service methods — maps to Uploop's `effect` handlers
4. **Query syntax:** `{ $gt, $lt, $in, $regex, $sort }` — MongoDB-inspired, well-understood
5. **No schema required:** Services work with plain objects. Add validation via hooks.

FeathersJS's architecture is essentially: services + hooks + transport adapters.
Uploop's architecture is: loops/graphs + update handlers/effects + execution targets.
The mapping is remarkably clean:

| FeathersJS | Uploop |
|---|---|
| Service | Loop or Graph with named data nodes |
| Service method (find, create) | Update handler (send event) |
| Hook (before, after) | Effect handler |
| Service event (created, updated) | Subscriber notification |
| Transport (REST, Socket.io) | Execution target / transport adapter |

---

## Implementation Estimate — v0.5.x

| Component | Lines | Description |
|---|---|---|
| `createRemoteLoop()` | ~80 | Client-side proxy: send() over transport, subscribe() from push |
| `createTransportServer()` | ~100 | Server: expose local loops over WS/HTTP |
| WebSocket transport adapter | ~60 | Serialize event envelopes over WS |
| SSE transport adapter | ~40 | Server push as SSE stream |
| HTTP transport adapter | ~50 | REST endpoints from service definitions |
| FeathersJS-style service layer | ~120 | Service interface wrapping graph nodes |
| Uploop Graph Protocol (query) | ~80 | plan/whatReads/onDataChange over wire |
| `graph.liveQuery()` | ~60 | Subscribe to query results, push on change |
| **Total** | **~590 lines** | |

### Ship Order

```
1. Transport layer (WS + HTTP)              → client-server event bridge
2. createRemoteLoop / createTransportServer → transparent remote loops
3. FeathersJS-style services                → application code pattern
4. graph.liveQuery()                        → reactive queries
5. GraphQL codegen from services            → external API (optional)
6. SSE transport                            → server-push optimization
```
