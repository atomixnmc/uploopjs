# Uploop Architecture — v0.5.6

> Uploop is a universal update-loop architecture where UI, data, style, route, animation, and side effects are designed as an executable **HyperGraph**.

---

## Core Thesis

React asks: *"How do I describe UI as state changes?"*

Uploop asks: *"What depends on what?"*

The graph is not documentation. It is the runtime optimization model. Every component, store, router, and state machine exports its graph. The runner reads the graph to decide: what to update, when to schedule it, what to cache, what to invalidate, what to abort.

```
Developer declares WHAT (graph structure + metadata).
Runner decides HOW (when to render, what to cache, which frame lane).
```

---

## Package Architecture

```
@uploop/core          Pure update protocol (no DOM, no browser)
  ├── loop           Event pipeline, async metadata (debounce/suspend/error/interruptible)
  ├── graph          Typed node/edge DAG with dependency indexes
  ├── signal         Reactive value primitive
  ├── frame          Scheduler (micro/visual/idle/manual)
  ├── execution      Multi-target protocol (replace/patch/redraw)
  ├── component      Config-object component model
  └── utils          uuid, path, clone, equals, serialize

@uploop/html          DOM/WebComponent adapter
  ├── html           Tagged template with CSP-safe bindings
  ├── component      DOM-wired component wrapper
  ├── element        WebComponent registration
  ├── dom-execution  DOM execution target (innerHTML + post-processing)
  └── hydrate        SSR hydration

@uploop/store         External state bus
@uploop/router        Route updater (store-based)
@uploop/css           Utility CSS engine (runtime, themable)
@uploop/state-machine Finite state machine
@uploop/sst           SSR, hydration, remote loops, services
@uploop/devutils       HyperGraph Inspector, formatters

Planned:
@uploop/motion        Frame/spring animation
```

### Dependency Graph

```
core
  ├── html       ← DOM rendering
  ├── store      ← external state
  ├── router     ← navigation
  ├── css        ← styling (optional)
  ├── state-machine ← UI workflows
  ├── sst        ← SSR, hydration, remote loops (depends on core + html)
  ├── devutils   ← developer tooling
```

**Rule: Core knows nothing about HTML.** No `HTMLElement`, no `customElements`, no `innerHTML`, no CSS.

---

## Core Concepts

### 1. Everything Is a Loop

A loop is the universal primitive. `send(event, ...payload)` → update handler → state merge → notify subscribers.

```js
const loop = createLoop({
  state: { count: 0 },
  update: {
    inc: (state) => ({ count: state.count + 1 })
  }
})
loop.send('inc')
loop.get() // { count: 1 }
```

Components, stores, routers, and state machines all wrap the same loop primitive. The same `send()`/`get()` API works everywhere.

### 2. The Graph Is the Engine

Every loop builds a graph — nodes (data, update, view, effect) connected by edges (reads/writes). For simple usage, the graph is implicit. For architecture-first usage, `createGraph()` makes it explicit:

```js
const graph = createGraph({
  nodes: {
    query:   { type: 'data',    default: '' },
    results: { type: 'data',    default: [] },
    search:  { type: 'update',  reads: ['query'], writes: ['results'], run: fn },
    list:    { type: 'view',    reads: ['results'], run: renderFn }
  },
  edges: [['search-input', 'search']]
})
```

The graph enables:
- **Dependency tracking:** Only views whose `reads` changed are re-rendered
- **Introspection:** `graph.describe()` exports the full structure
- **Optimization:** The runner can skip work, batch updates, and choose execution strategies based on graph topology
- **AI-readiness:** A component config is a machine-readable data structure

### 3. Async Metadata — Declarative, Not Imperative

Uploop replaces React's five hooks with five declarative metadata fields consumed by one runner:

| React Hook | Uploop Metadata | What It Does |
|---|---|---|
| `useEffect` with cleanup | `effect: { key: (ctx) => {...} }` | Data-driven side effects |
| `useMemo` / `useCallback` | Graph `reads`/`writes` topology | Only re-compute when dependencies change |
| `Suspense` | `suspend: { fallback }` | Auto loading states |
| `ErrorBoundary` | `error: { fallback, retry }` | Auto error handling + retry |
| Manual debounce/throttle | `debounce: 300` on update handlers | Auto-delayed execution |

```js
const loop = createLoop({
  state: { users: [], query: '' },
  update: {
    search: {
      debounce: 300,
      interruptible: true,
      run: async (state, query, { signal }) => ({
        users: await fetch(`/api?q=${query}`, { signal }).then(r => r.json())
      })
    }
  },
  suspend: { search: { fallback: 'Loading...' } },
  error:   { search: { fallback: 'Failed to load', retry: 3 } }
})
```

### 4. Execution Protocol — One Interface, Many Targets

Every render target (DOM, Canvas, SSR, WebGL) implements the same interface:

```
{ strategy, render, replace, mount, unmount, hooks }
```

Three strategies:
- **replace** — full rebuild (innerHTML, current default for DOM)
- **patch** — surgical update (template-level diff, v0.4.0)
- **redraw** — full-frame render (canvas/WebGL)

The execution is graph-driven: the runner receives an execution plan from the graph engine and only touches the DOM nodes that changed.

---

## Component Model

Uploop components are **configuration objects**, not functions with hooks. This is deliberate — configs are serializable, introspectable, and machine-generatable.

```js
const Counter = component('Counter', {
  state: { count: 0 },

  update: {
    inc: (state) => ({ count: state.count + 1 }),
    dec: (state) => ({ count: state.count - 1 })
  },

  view: (state, { send }) => html`
    <div>
      <h2>${state.count}</h2>
      <button @click=${() => send('inc')}>+</button>
      <button @click=${() => send('dec')}>-</button>
    </div>
  `
})

Counter.mount(document.getElementById('root'))
```

### Key properties

| Property | Purpose |
|---|---|
| `state` | Initial state object |
| `update` | Named event handlers `(state, ...payload) => partialState` |
| `view` | Pure function `(state, ctx) => HtmlTemplate` |
| `effect` | Side-effect handlers keyed by state field |
| `compose` | Declarative child composition |
| `computeParts` | Derive child props from parent state |
| `frame` | Scheduling mode (`micro`/`visual`/`idle`/`manual`) |
| `mount` / `unmount` | Lifecycle hooks |

### No hooks. Stricter than hooks.

- Update handlers must be pure — receive state, return partial state. No side effects.
- Views must be pure — receive state, return template. No DOM manipulation.
- State is always passed fresh — no stale closures, no `useCallback` needed.
- Effects are data-driven — "run when `state.count` changes", not "run when these arbitrary deps change".

---

## Template System

### Bindings (CSP-safe, no inline handlers)

| Binding | Syntax | What It Does |
|---|---|---|
| Event | `@click=${fn}` | `addEventListener` with direct closure |
| Property | `.value=${state.text}` | Sets DOM property |
| Boolean attr | `?checked=${bool}` | Toggles attribute |
| Two-way | `:model="text"` | Expands to `.value` + `@input` |
| String event | `@click="inc"` | Auto-wraps as `() => send('inc')` |

### Component Props

Components accept props through multiple paths:

```js
// Template syntax — simple props:
h`<Wheel x=${100} radius=${14}/>`

// :props binding — complex objects:
h`<Wheel :props=${{ x: 100, config: { color: 'red' }, onSpin: callback }}/>`

// JS API — always works:
Wheel({ x: 100, config: { color: 'red' }, onSpin: callback })

// PascalCase tags in view() — registered components:
html`<div><Wheel x="100"/></div>`
```

Props merge into child state: `{ ...initialState, ...props }`.

---

## Event Pipeline

```
send('eventName', ...payload)
    │
    ▼
Create Event Envelope { id, type, payload, source, cause, depth, timestamp, transaction }
    │
    ▼
Guard: maxEventDepth → reject if too deep (infinite loop protection)
    │
    ▼
Guard: maxEventsPerTransaction → reject if too frequent (cycle protection)
    │
    ▼
Debounce check → delay if handler has debounce metadata
    │
    ▼
Interruptible check → abort previous handler, create AbortController
    │
    ▼
Execute handler: (state, ...payload, { signal }) → partialState
    │
    ├── Sync: merge state, notify subscribers, run effects
    └── Async: mark pending, merge on resolve
    │
    ▼
Error check → if handler throws and error config exists:
    ├── Apply fallback state
    ├── Schedule retry with exponential backoff
    └── Store error state (loop.getError())
```

---

## Data Classification

Not all data is equal. The graph node metadata declares how data should be treated:

| Temperature | Lifetime | Behavior |
|---|---|---|
| **hot** | transient | Updated 30-120/sec, `visual` frame, no cache |
| **warm** | session | Updated occasionally, `micro` frame |
| **cold** | stable | Loaded on demand, cached with TTL, `idle` frame |
| **frozen** | persistent | Never changes after load, stored in localStorage |
| **remote** | network | Fetched from server, cache with SWR |
| **derived** | computed | Computed from other data nodes, memoized |

The runner uses these classifications to decide scheduling, caching, and serialization automatically. The developer declares the data's nature; the runner optimizes.

---

## Protocols

Uploop defines standard protocols for interoperability:

### 1. HyperGraph Manifest
Every component, store, and graph exports `.describe()`:
```json
{
  "kind": "uploop.loop",
  "name": "Counter",
  "nodes": {
    "count": { "type": "data" },
    "inc": { "type": "update", "reads": ["count"], "writes": ["count"] }
  },
  "edges": [["click", "inc"]],
  "events": { "total": 42, "rejected": 0 }
}
```

### 2. Execution Protocol
```js
{ strategy, render, replace, mount, unmount, hooks }
```
Any rendering surface implements this interface and gets the full component lifecycle.

### 3. Event Envelope
```js
{ id, type, payload, source, cause, depth, timestamp, transaction }
```
Every event is traceable through the system.

### 4. Frame Scheduling
```js
{ micro, visual, idle, manual }
```
Every update is assigned to a frame lane based on its data temperature.

---

## Execution Model Evolution

```
v0.3.0: General Loop       — send() → handler → merge → notify (current)
v0.3.0: Async Metadata     — debounce, suspend, error, interruptible, cache
v0.3.0: Graph Engine       — dependency indexes, execution plans
v0.3.0: Core Utils         — uuid, path, clone, equals, serialize
v0.4.0: Template-Patch     — O(changed) DOM updates, event listener preservation
v0.4.0: Rapid Executor     — pre-compiled linear paths for hot components
v0.4.0: Ring Buffer        — lock-free streaming for high-frequency data
v0.5.0: WASM Graph BLAS    — matrix ops for 1000+ node graphs
v0.6.0: WASM Execution     — graph.plan() in WASM, sub-ms for large graphs
v2.0.0: TypeScript + SSR   — type inference, server rendering
```

Each layer is additive and degrades gracefully. The general loop always works. Optimizations activate transparently for eligible subgraphs.

---

## Why This Architecture

| Principle | How Uploop Achieves It |
|---|---|
| **No build step** | Standard ESM, tagged template literals, no JSX, no compiler |
| **CSP-safe** | `addEventListener`, no inline `onclick` attributes |
| **One protocol everywhere** | `send()`/`get()` works identically in components, stores, routers, state machines |
| **Declarative over imperative** | Graph metadata drives scheduling, caching, error handling — the developer doesn't write control flow |
| **Introspectable** | Every component exports its graph. AI tools, devtools, and visual editors can read it. |
| **Multi-target** | Same component model renders to DOM, Canvas, SSR, WebGL — just swap the execution target |
- **Small bundle** — ~26-42 KB gzip for full stack vs ~54-65 KB for React equivalent
- **JS first, TS later** — JSDoc typedefs for IDE hints. Full TypeScript inference planned for v2.0.0

---

## v0.5.6 — Ecosystem Comparison: SST + WYSIWYG

### Uploop SST vs React/Next.js vs Solid/SolidStart

An honest assessment of where Uploop SST stands against the dominant server-side
frameworks as of v0.5.6 (2026-06).

| Dimension | Uploop SST | Next.js (React) | SolidStart |
|---|---|---|---|
| **SSR** | `renderToString()` — one function, works | Built-in, mature, RSC | Built-in, mature |
| **Hydration** | `hydrate()` — basic, attaches listeners | `hydrateRoot()` — battle-tested | Fine-grained, no VDOM |
| **Data fetching** | `createService()` wraps loop → CRUD | Server Components, `fetch()` | `createAsync` / `cache` |
| **Database** | `better-sqlite3` (sync, fast) | Any ORM (Prisma, Drizzle) | Any ORM |
| **Real-time** | Native `send()`/`subscribe()` on loop | Needs Socket.io / WebSocket lib | Needs separate lib |
| **State management** | Built-in (loop = state + update) | Redux/Zustand/Jotai | Signals (built-in) |
| **Routing** | Manual path matching in `routes.mjs` | File-system routing | File-system routing |
| **Middleware** | None — manual in route handler | Middleware chain | Middleware |
| **Streaming** | Not supported | React Suspense streaming | Solid streaming |
| **WYSIWYG editing** | `contenteditable` + `execCommand` (legacy) | Slate.js / TipTap / Lexical | Same (platform-level) |
| **Content as graph** | Native — loop `state.posts` IS a graph | Needs external CMS/layer | Needs external layer |
| **Hot reload** | `node --watch` + `/ws-hotreload` | Turbopack / Fast Refresh | Vite HMR |
| **Ecosystem** | 8 packages, 45 source files | 1000+ packages, massive | Growing ecosystem |
| **Learning curve** | Low (3 concepts: loop, send, view) | High (hooks, RSC, routing) | Medium (signals, effects) |
| **Production readiness** | Demo-quality. No auth, no CSRF, no rate limiting | Production-hardened | Production-capable |

### Where Uploop Wins

1. **Unified event model** — The same `createLoop` powers SSR pages, WebSocket chat,
   game servers, and CRUD services. No separate state library, no separate
   WebSocket library, no ORM. One primitive everywhere.

2. **Content as graph** — Blog posts in Uploop are graph nodes with typed edges.
   `blogLoop.get().posts` is a live data graph. React stores content as opaque
   JSX or HTML strings — you need a separate CMS to get structure.

3. **Bundle size** — ~26 KB gzip for the full framework. Next.js starts at ~80 KB.
   SolidStart is smaller (~15 KB) but Uploop includes its own router, store,
   CSS engine, and state machine.

4. **No build step** — Pure ESM. Import from CDN or local file. No webpack, no
   turbopack, no JSX transform. This matters for simplicity, not just bundle size.

5. **Multiplayer games are native** — A game loop IS a `createLoop`. Chess and
   Slither run at tick rate, broadcast via WebSocket, with zero extra infrastructure.
   React/Solid were never designed for this.

### Where Uploop Falls Short (Honest Assessment)

1. **No streaming SSR** — `renderToString` produces a complete HTML string.
   React Suspense and Solid can stream HTML chunks as data resolves. For
   content-heavy pages, this is a real performance gap.

2. **No file-system routing** — Routes are manual `if (path === '/blog')` chains.
   Next.js and SolidStart auto-generate routes from the file tree. This is
   fine for 10 pages; painful for 100.

3. **No middleware** — Auth, CSRF, rate limiting, caching headers — all must be
   written by hand in each route handler or the `createApp` wrapper.

4. **WYSIWYG is legacy tech** — `contenteditable` + `document.execCommand` is
   deprecated. Modern editors (TipTap, Lexical, Slate) use a transaction-based
   document model with proper undo/redo, collaborative editing, and schema
   validation. Uploop's WYSIWYG is a demo, not a production editor.

5. **No TypeScript** — JSDoc provides some IDE hints, but the developer experience
   is far behind React/Solid's full TypeScript inference. Planned for v2.0.0.

6. **Tiny ecosystem** — 45 source files vs React's 1000+ packages. No component
   library, no form library, no auth library. Everything must be built.

7. **No serverless/edge** — `better-sqlite3` requires a persistent filesystem.
   Can't deploy to Vercel Edge or Cloudflare Workers without architectural changes.

8. **InnerHTML re-render** — The default execution strategy replaces `innerHTML`
   on every state change. This destroys `contenteditable` state, event listeners,
   and scroll position. The `patch` strategy exists but is less battle-tested.

### WYSIWYG: Current vs Uploop-Native

| Aspect | Current (`contenteditable`) | Uploop-Native (planned) |
|---|---|---|
| **Content model** | Flat HTML string | Typed graph nodes (paragraph, heading, image, list) |
| **Formatting** | `execCommand` (deprecated) | Node properties (`{ bold: true }`) |
| **Selection** | Browser `Selection` API | Graph edges connecting user → selected nodes |
| **Undo/redo** | Browser history (fragile) | Graph state snapshots via `loop.get()` |
| **Media blocks** | HTML placeholders in contenteditable | Sub-graphs mounted as child components |
| **Collaboration** | Impossible with current model | Graph edges track authorship + OT/CRDT on nodes |
| **Query/Search** | `innerHTML.includes('word')` | `posts.find(n => n.body.some(t => t.value.includes('word')))` |
| **Serialization** | Raw HTML ~500 bytes/paragraph | Graph JSON ~300 bytes/paragraph (~40% smaller) |

The current WYSIWYG is a pragmatic demo. A Uploop-native WYSIWYG would parse
HTML into graph nodes on load, edit node properties directly, and serialize
back to HTML for storage. This is architecturally cleaner but requires ~500
lines of parser/serializer/renderer code.

### Recommendation

Uploop SST is **ready for demos, prototypes, and learning**. It demonstrates
a genuinely novel architecture (everything-is-a-loop) with concrete advantages
in real-time features, game servers, and code simplicity. It is **not ready
for production** without significant investment in auth, streaming, middleware,
TypeScript, and a modern WYSIWYG stack.

The gap to React/Solid is real but addressable. Each gap has a clear path
forward — none are architectural dead ends. The question is not *can* Uploop
close the gap, but *will* it.

---

## Package Reference

| Package | Source | Lines | Purpose |
|---|---|---|---|
| `@uploop/core` | 12 files | 1,783 | Update protocol, graph engine, signals, frames, execution, async metadata, utilities |
| `@uploop/html` | 8 files | 1,008 | DOM adapter, template system, WebComponents, component props |
| `@uploop/css` | 11 files | 1,528 | Utility CSS engine, theming, chainable API, animations |
| `@uploop/store` | 5 files | 212 | External store, selectors, derived state, persistence |
| `@uploop/router` | 1 file | 209 | Store-based route updater |
| `@uploop/state-machine` | 1 file | 153 | Finite state machine |
| `@uploop/sst` | 5 files | ~250 | SSR, hydration, remote loops, FeathersJS-style services |
| `@uploop/devutils` | 2 files | ~250 | HyperGraph Inspector, console formatters, tree/JSON output |
| **Total** | **45 files** | **~5,400** | |

---

## Design Documents

- [Core Utilities](./design-core-utils.md) — uuid, path, clone, equals, serialize
- [Component Props](./design-component-props.md) — props system with `:props`, PascalCase, dev-mode warnings
- [Server-Side Toolset](./design/design-server-side.md) — SSR, hydration, remote loops, services
- [Architecture Breakthrough](./progress/report-v0.3-breakthrough.md) — graph engine, html system upgrade, execution breakthrough
- [Current Progress](./progress/phase-v0.3-current-progress.md) — metrics, gaps, priorities, roadmap
- [Getting Started](../docs/HOWTO.md) — syntax reference, comparison with React
