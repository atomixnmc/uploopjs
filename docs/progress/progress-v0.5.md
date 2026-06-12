# v0.5.0 — Server-Side Toolset

> **Status:** Initial implementation ✅  
> **Date:** 2026-06-11  

## What Was Built

v0.5.0 introduces the `@uploop/sst` package — Uploop's server-side toolset.
Three layers shipped together:

### Layer 1: SSR & Hydration

Server-side rendering with automatic client-side hydration:

| Export | Lines | Description |
|---|---|---|
| `renderToString()` | ~30 | Render component to HTML string on server |
| `renderToHtml()` | ~15 | Full SSR pipeline: create → render → HTML |
| `hydrate()` | ~20 | Reattach events to server-rendered HTML on client |
| `createHydrationRoot()` | ~40 | Multi-component hydration from server state payload |

**How it works:**

```
Server: renderToString(Counter) → '<div>Count: 0</div>'
Client: hydrate(Counter, target, {}, { count: 0 }) → live component
```

SSR is just swapping the execution target. `createStringExecution()` from
`@uploop/core` provides a DOM-free target that accumulates output on a
plain `{ _html: '' }` object. Components are defined once — same API on
server and client.

### Layer 2: Service Layer

FeathersJS-inspired CRUD + real-time events wrapping Uploop loops:

| Export | Lines | Description |
|---|---|---|
| `createService(loop, config)` | ~70 | CRUD methods + event emitters |
| `createServiceApp()` | ~40 | Multi-service registry |

**Service events:** `created`, `updated`, `patched`, `removed`

```js
const service = createService(cartLoop, {
  methods: {
    find: () => cartLoop.get().items,
    create: (item) => { cartLoop.send('add', item); return item }
  }
})

service.on('created', (item) => { ... })
await service.create({ id: 1, name: 'Widget' })
```

### Layer 3: Documentation & Examples

| File | Description |
|---|---|
| `docs/design/design-server-side.md` | Full architecture doc with diagrams, API reference, examples |
| `examples/ssr/server.js` | Runnable Node.js HTTP server rendering SSR Counter |
| `examples/ssr/README.md` | How to run and what it demonstrates |

## Architecture

```
@uploop/sst
├── SSR Layer        → renderToString, renderToHtml
├── Hydration Layer  → hydrate, createHydrationRoot
└── Service Layer    → createService, createServiceApp

Depends on:
├── @uploop/core     → component, createLoop, createStringExecution
└── @uploop/html     → html`` template tag (for bindings/markers)
```

## Files Changed

```
packages/sst/package.json            ─ package metadata, workspace entry
packages/sst/src/index.js            ─ public API surface
packages/sst/src/ssr.js              ─ renderToString, renderToHtml
packages/sst/src/hydrate.js          ─ hydrate, createHydrationRoot
packages/sst/src/service.js          ─ createService, createServiceApp
packages/sst/test/ssr.test.js        ─ 8 tests (SSR, hydration, services)
docs/design/design-server-side.md    ─ architecture + API reference
examples/ssr/server.js               ─ runnable Node.js SSR server
examples/ssr/README.md               ─ example documentation
docs/progress/progress-v0.5.md       ─ this file
```

## Competitive Position

| Feature | React/Next.js | Uploop SST |
|---|---|---|
| SSR entry | `renderToString()` / RSC | `renderToString()` — one function |
| Hydration | `hydrateRoot()` + event replay | `hydrate()` — one function |
| State model | useState, useReducer, external libs | Built-in loop: state + update handlers |
| Real-time | Separate WebSocket lib + state mgmt | Same `send()` API for local + remote |
| Service layer | tRPC, REST endpoints | `createService()` — loop → CRUD |
| Execution targets | DOM only (React DOM) | Pluggable: DOM, string, canvas, WebGL |
| Server components | RSC (separate paradigm) | Same component works on server + client |

### Key Differentiators

1. **No dual model** — same component on server and client, only execution target changes
2. **State is built-in** — no external state management needed
3. **Events are first-class** — `send()` works for UI, network, and services
4. **Small surface area** — ~150 lines for the entire SSR + hydration + service layer

## What v0.5.0 Does NOT Do (Yet)

- **Remote loop transport** (WebSocket/SSE adapters): Planned for v0.5.1. The service
  layer provides the API surface; transport adapters will serialize event envelopes
  between client and server loops.
- **GraphQL codegen from services**: Optional future layer.
- **SSE transport**: Server-push optimization, planned post-WebSocket.
- **Live queries**: `graph.liveQuery()` — subscribe to query results pushed on change.

## Ship Order for Remainder

1. v0.5.1 — Remote loop transport (WebSocket + HTTP adapters) — ~140 lines
2. v0.5.2 — Graph live queries (`graph.liveQuery()`) — ~60 lines
3. v0.5.3 — SSE transport adapter — ~40 lines
