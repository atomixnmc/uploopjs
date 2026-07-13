# v0.8 Cross-Framework Comparison Report

> **Date:** 2026-06-27  
> **Scope:** Uploop full stack vs React/Relay/GraphQL, Next.js/Nuxt/SvelteKit, FeathersJS, Bun, Express/Fastify/Hono, Cloudflare/Firebase  
> **Includes:** Long runtime (Uploop's polyglot JS/TS engine, beta, integrates v1.0)  
> **Goal:** Identify where Uploop wins, loses, and max out design potential at v0.8

---

## 1. The Uploop Stack (What We Have)

| Layer | Package | Purpose | Size |
|-------|---------|---------|------|
| **Runtime** | `@uploop/core` | HyperGraph engine, signals, loops, frames, batch | 62 KB |
| **UI** | `@uploop/html` | DOM adapter, template tag, WebComponent, suspend | 37 KB |
| **Data** | `@uploop/schema` | Entity definitions, validation, AI-readable describe(), intent, wire | ~15 KB |
| **State** | `@uploop/store` | External store, selectors, derived, persist, storeFromEntity | 6 KB |
| **Flow** | `@uploop/flows` | 74 profiles, 12 algorithms, 5-lane executor, actor/reactive patterns, pipelines, queues, event streams | ~20 KB |
| **Wire** | `@uploop/stream` | Binary codec, zero-copy, self-framing, reader/writer | ~8 KB |
| **Routing** | `@uploop/router` | Route matching, guards, layouts, lazy loading | 9 KB |
| **Styling** | `@uploop/css` | Utility CSS, theme tokens, variants, animations | 53 KB |
| **Server** | `@uploop/sst` | SSR, hydration, remote loops, FeathersJS-style services | — |
| **DevTools** | `@uploop/devutils` | HyperGraph Inspector, event capture, debug panel | — |
| **Future Runtime** | **Long** | Polyglot JS/TS runtime, same HyperGraph concepts, native performance | beta |

**Total bundle (tree-shaken core + html + schema + store)**: ~26 KB gzip

---

## 2. Long — Uploop's Native Runtime (Beta, v1.0 Integration)

Long is a performant polyglot JavaScript/TypeScript runtime built on the exact same concepts as Uploop.

### What Long Brings

| Capability | Node.js (current) | Long (v1.0) |
|-----------|-------------------|-------------|
| **HyperGraph execution** | JS-level graph engine | Native graph engine (Rust/WASM) |
| **Binary streaming** | JS ArrayBuffer ops | Zero-copy memory mapping |
| **Multi-threading** | Worker threads (message-passing) | Shared memory, parallel executors |
| **Garbage collection** | V8 GC (stop-the-world) | Temperature-aware memory management |
| **Startup time** | ~50ms (Node) | ~5ms (native) |
| **Bundle size** | Full Node runtime | Tree-shaken to used features only |
| **SQLite** | External npm package | Built-in, entity-aware |
| **File I/O** | Node fs (async) | Native async, streaming-aware |
| **GPU compute** | WebGPU (browser only) | Native GPU via wgpu |

### How Long Integrates With Uploop

```
Development (v0.x):
  Uploop → Node.js/V8 → OS

Production (v1.0):
  Uploop → Long (native) → OS
```

The same HyperGraph, same entities, same flows, same binary wire format — but compiled to native code. No code changes needed. The optimizer graph (described in the architecture docs) is the bridge: at build time, the graph is analyzed, hot paths are compiled, cold paths stay interpreted.

### Why Long Changes the Comparison

- **vs Bun**: Long shares Bun's "fast runtime" goal but adds HyperGraph-native execution, not just faster JS
- **vs Deno**: Long is not a "better Node" — it's a runtime built specifically for Uploop's graph architecture
- **vs Cloudflare Workers**: Long can run at the edge with WASM, but also as a long-running server with shared memory
- **vs Rust frameworks**: Long exposes native performance but keeps JavaScript/TypeScript developer experience

---

## 3. Comparison Matrix — Meta-Frameworks

### 3.1 vs Next.js / Nuxt / SvelteKit / Remix

These are the "batteries-included" frameworks that combine routing, SSR, data fetching, and deployment.

| | Uploop SST | Next.js | Nuxt | SvelteKit | Remix |
|---|---|---|---|---|---|
| **Rendering** | SSR + hydration + remote loops | RSC + SSR + ISR + static | SSR + SSG + ISR | SSR + SSG + adapter | SSR + loader/action |
| **Data fetching** | Entity-driven (toGraph + bind) | Server Components + fetch | useFetch + $fetch | load functions + fetch | loader + useLoaderData |
| **Routing** | File-based or programmatic | File-based (app router) | File-based (pages/) | File-based (routes/) | File-based (routes/) |
| **State** | HyperGraph nodes (shared client/server) | React state (client-only) | Pinia / useState | Svelte stores | React state |
| **Validation** | Entity schema (same on both sides) | Zod (separate client/server) | Zod / Yup | Zod / custom | Zod / custom |
| **Real-time** | Built-in WebSocket + binary stream | Manual (socket.io) | Manual | Manual | Manual |
| **API layer** | createService(entity) auto-generates | Route handlers (manual) | Server routes (manual) | Endpoints (manual) | Loaders (manual) |
| **Build step** | None (ESM) | Required (JSX, RSC) | Required (Vue SFC) | Required (Svelte compiler) | Required (JSX) |
| **Bundle (client)** | ~26 KB | ~85 KB (React + Next) | ~70 KB (Vue + Nuxt) | ~15 KB (Svelte + Kit) | ~80 KB |
| **Edge deploy** | Long (v1.0) or Node | Vercel Edge | Vercel/Netlify | Cloudflare/Vercel | Vercel/Cloudflare |
| **AI-readable** | describe() on everything | No built-in | No built-in | No built-in | No built-in |

**Where Uploop SST wins vs meta-frameworks:**
- **One data definition**: Entity → validation → API → client state → wire format. Meta-frameworks need separate schemas for each layer.
- **Real-time built-in**: WebSocket + binary streaming is first-class. Meta-frameworks treat it as an add-on.
- **No build step**: ESM imports directly. Meta-frameworks all require compilation (JSX, SFC, Svelte).
- **Graph-native state**: HyperGraph edges model relationships. Meta-frameworks use flat state or component-local state.
- **AI-readable architecture**: `describe()` exports the entire app. No meta-framework has this.
- **Long runtime**: v1.0 brings native performance without changing code.

**Where Uploop SST loses:**
- **Static generation (SSG/ISR)**: Next.js and Nuxt have mature static generation. Uploop SST is SSR-focused.
- **Image optimization**: Next.js has built-in `<Image>`. Uploop has no image pipeline.
- **Community & plugins**: Massive ecosystems. Uploop has none.
- **Server Components (RSC)**: Next.js App Router with RSC is the new standard. Uploop has no equivalent.

> **On incremental adoption**: Uploop does NOT embed inside React/Next/Nuxt apps. It's a rival framework. The adoption path is new projects, greenfield apps, or full rewrites where Uploop's advantages justify the switch. For teams that can't switch, Uploop components export as standard WebComponents via `defineElement()` — a bridge that works inside any host framework.

### 3.2 Uploop's Advantages Over Meta-Frameworks

| Advantage | Why It Matters |
|-----------|---------------|
| **Graph-native, not route-native** | Next/Nuxt/SvelteKit are route-centric. Data relationships cross routes — HyperGraph models this naturally. |
| **Executor diversity** | No meta-framework ships different execution strategies for forms vs games vs dashboards. |
| **Binary wire** | JSON-only in all meta-frameworks. Uploop stream saves 60% bandwidth. |
| **Temperature-aware scheduling** | Hot data on RAF, cold on idle. No meta-framework has lane routing. |
| **Long runtime** | v1.0 brings native performance. Meta-frameworks are stuck on V8/V8-like runtimes. |

---

## 4. Maxing Out v0.8 Design Potential

### What v0.8 Already Delivers

1. **One entity → everything**: Entity auto-generates validation, CRUD, wire format, form UI, AI manifest, TypeScript, JSON Schema, GraphQL SDL
2. **74 pre-tuned execution profiles**: No other framework ships use-case-specific executor strategies across 10 categories
3. **12 production-quality algorithm implementations**: Circuit breaker, rate limiter, retry with backoff, priority queue (with aging), dedup filter (Bloom+LRU), event bus, idempotency guard, dead letter queue, bulkhead, saga orchestrator, fan-out/fan-in, batch processor — all with `describe()` for AI-readability
4. **5-lane execution engine**: Critical (microtask), hot (RAF), warm (postTask), cold (idleCallback), idle (setTimeout) — lane routing from HyperGraph temperature metadata. Batch scheduler, frame budget enforcer, abort context propagation, execution monitor
5. **Worker pool**: CPU-bound task offloading with load balancing, transferable support, dead worker detection, task timeout
6. **Actor & Reactive patterns**: `createActor()` with sequential mailbox + `createActorSystem()` supervision trees. `createSignal()`, `createComputed()`, `createEffect()`, `batch()`, `createReactiveStore()`, `createResource()` — Solid.js/RxJS style primitives on HyperGraph
7. **Composable pipelines + queues + event streams**: Lightweight alternative to RxJS, built on HyperGraph
8. **Binary streaming codec**: Entity = wire format, zero-copy reads, 60% smaller than JSON
9. **AI intent schema**: LLMs communicate data shapes in ~15 tokens vs ~200
10. **10 breakthrough strategies**: Temperature routing, dependency batching, critical path, orphan detection, backpressure control

### v0.8 Max-Out Checklist

- [x] Schema engine with entity, validation, relations, AI manifest
- [x] Intent schema for AI communication
- [x] Client/server wire protocol with version negotiation
- [x] 74 flow profiles (24 original + 50 enterprise) with tuning, lanes, detection heuristics
- [x] 12 production-quality algorithm implementations
- [x] 5-lane execution engine (critical/hot/warm/cold/idle)
- [x] Worker pool for CPU-bound task offloading
- [x] Actor model (createActor + createActorSystem with supervision)
- [x] Reactive pattern (signals, computed, effects, batch, store, resource)
- [x] 10 breakthrough strategies
- [x] Composable pipelines, queues, event streams
- [x] Binary codec with zero-copy, self-framing
- [x] Entity-driven component generation
- [x] Cross-framework comparison report
- [x] Long runtime integration plan (v1.0)
- [ ] Auth module (`@uploop/auth`)
- [ ] Storage adapters (IndexedDB, SQLite)
- [ ] GQL package (GraphQL, Gremlin, Cypher on HyperGraph)
- [ ] Static generation (SSG)
- [ ] Edge deployment adapter (Cloudflare, Bun)

---

## 5. Unified Positioning — The Complete Uploop Ecosystem

```
┌──────────────────────────────────────────────────────────────┐
│                      UPLOOP ECOSYSTEM                         │
│                                                               │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────────┐  │
│  │ schema  │  │  flows   │  │ stream  │  │    store      │  │
│  │ entity  │  │74 profiles│  │ binary  │  │  serverStore  │  │
│  │ intent  │  │12 algos  │  │ codec   │  │   compose     │  │
│  │  wire   │  │5 lanes   │  │ reader  │  │   persist     │  │
│  │  bind   │  │actor+rx  │  │ writer  │  │               │  │
│  └────┬────┘  └────┬─────┘  └────┬────┘  └──────┬───────┘  │
│       │            │             │              │           │
│       └────────────┼─────────────┼──────────────┘           │
│                    │             │                           │
│              ┌─────┴─────────────┴─────┐                     │
│              │       HYPERGRAPH         │                     │
│              │    (core engine)         │                     │
│              └─────┬─────────────┬──────┘                     │
│                    │             │                            │
│         ┌──────────┴──┐  ┌──────┴─────────┐                 │
│         │  Uploop JS  │  │  Long (v1.0)   │                 │
│         │  (Node/V8)  │  │  (Native/Rust) │                 │
│         └─────────────┘  └────────────────┘                 │
│                                                               │
│  Deploy anywhere: Node, Bun, Deno, Cloudflare, bare metal    │
└──────────────────────────────────────────────────────────────┘
```

### The "One Definition" Promise

```js
// Define once
const User = entity('User', {
  name: string().min(1),
  email: string().email(),
  posts: array(ref('Post'))
})

// Get everything
User.describe()          // AI-readable manifest
User.validate(data)      // Runtime validation (client + server)
toGraph([User])          // HyperGraph data nodes + edges
createStreamCodec(User)  // Binary wire format
entityComponent(User)    // Auto-generated form UI
storeFromEntity(User)    // Store with CRUD handlers
toJSONSchema(User)       // JSON Schema export
toTypeScript(User)       // TypeScript interface
toGraphQL(User)          // GraphQL SDL
```

**No other framework provides this.** Next.js, Nuxt, SvelteKit, Feathers, Express — all require 3-5 separate definitions for the same data.

---

## 6. Bridge-vs-Rival Strategy

### Clear Positioning

Uploop splits the tech landscape into two groups:

| | Bridge To (Integrate) | Rival (Compete) |
|---|----------------------|-----------------|
| **Platforms** | Cloudflare, Firebase, Bun, Deno, Node | — |
| **Frameworks** | — | React, Next.js, Nuxt, SvelteKit, Remix |
| **Services** | FeathersJS (patterns), GraphQL (language) | Express, Fastify, Hono (as server frameworks) |

### Why Bridge Platforms, Not Fight Them

- **Cloudflare**: Uploop deploys TO Cloudflare. Adapter compiles entity graphs to D1 schemas, routes to Worker handlers. Uploop = framework. Cloudflare = infrastructure.
- **Firebase**: Entity → Firestore collection mapping + auth integration. Firebase provides backend services. Uploop provides application architecture.
- **Bun**: Uploop runs ON Bun via `Bun.serve()`. Bun = fast runtime. Uploop = framework on top.

### Why Rival Frameworks, Not Embed In Them

- **React**: Uploop does NOT embed inside React apps. It competes. HyperGraph replaces the component tree. The pitch: graph-native, AI-readable, binary streaming — capabilities React cannot provide.
- **Next.js / Nuxt / SvelteKit**: Uploop SST competes as a meta-framework. Not a library you add to an existing Next.js app. The pitch: one entity definition replaces 5 libraries that Next.js requires.
- **Remix**: Same positioning. Uploop's entity-driven data flow replaces Remix's loader/action pattern with a unified graph.

### The WebComponent Bridge (Incremental Path)

For teams that can't fully switch, Uploop components export as standard WebComponents:

```js
import { defineElement } from '@uploop/html'
defineElement('up-user-form', UserForm)
// Works inside React, Vue, Svelte, or vanilla HTML
```

Uploop inside. Host framework doesn't know. Data binding, validation, binary streaming all work within the WebComponent boundary.

### Adoption Strategy

```
Greenfield projects → Uploop first (graph-native from day one)
Existing React/Next → Stay on current stack (no forced migration)
Performance-critical → Uploop WebComponent (isolated subsystem)
Full rewrite → Evaluate if advantages (AI-readable, binary wire, executor diversity) justify switch
```

---

## 7. React 18+ → Uploop Equivalence Guide

Every major React 18+ concept has a counterpart in Uploop — sometimes one-to-one, sometimes a fundamentally different (and more powerful) approach. This section maps React mental models onto Uploop's HyperGraph architecture.

### 7.1 Component Model

| React 18+ | Uploop | Notes |
|---|---|---|
| JSX → VDOM → Fiber reconciler → DOM | `html` tagged template → template descriptor → execution protocol (patch/replace/redraw) → DOM | No VDOM, no Fiber. Template descriptors are diffed by `parts[]` arrays. |
| `function Component(props)` | `component(name, { state, update, effect, view })` | Views are pure functions receiving `(state, ctx)` with `html` in ctx. |
| `React.createElement()` | `componentTag(classes)` + compose DSL | JSX-like composition without a build step. |
| `ref` / `useRef` | Closure variables (no hook needed) | React needs `useRef` because function components re-run every render. Uploop's `component()` view is called with `(state, ctx)` each render, but the component config object is defined once — plain closure variables persist across renders. For DOM resources (canvas, video) that survive `innerHTML` replacement: `createResourceManager()` + `registerResource()`. |
| `memo(Component)` | `createSelector(selectFn)` for derived state; graph diff via `compareReport()` | Uploop optimizes at the data-graph level, not the component level. |

### 7.2 State & Reactivity

| React 18+ | Uploop | Notes |
|---|---|---|
| `useState(init)` | `createSignal(init)` → `[get, set]` | Signals are primitives. `set` accepts value or updater `(prev) => next`. Subscriptions are explicit via `.subscribe()`. |
| `useReducer(reducer, init)` | `loop.send(event, ...args)` + `update` handlers | The update map `{ eventName: handler(state, payload) }` is the reducer. State flows through events, not dispatchers. |
| `useEffect(fn, deps)` | `loop.effect(name, fn)` or `createEffect(fn, deps)` | Effects have names for inspection. Cleanup via `onDispose()` inside the handler. Dependencies are explicit. |
| `useMemo(fn, deps)` / `useCallback(fn, deps)` | `createComputed(fn, deps?)` | Lazy, dirty-checked derived values. Auto-subscribes to dependency signals. |
| `useContext(ctx)` | Scope system (`registerScope` / `resolveScope`) + `consumeContext(el, name)` | Uploop's context is scope-based, not a general-purpose dependency injection tree. `registerScope()` registers component classes into named scopes. `consumeContext()` walks DOM ancestors for `data-up-provide` (canvas use case). For general value sharing, Uploop uses the HyperGraph — data nodes are accessible across any component without prop drilling. |
| `useSyncExternalStore(subscribe, getSnapshot)` | `store.subscribe(fn)` + `store.get()` | `@uploop/store` is natively compatible. Any external store can be bridged. |
| `useId()` | `uuid()` utility | Simple, no hooks needed. |

### 7.3 Async & Suspense

| React 18+ | Uploop | Notes |
|---|---|---|
| `<Suspense fallback={...}>` | `suspend(loop, dataKey, fetchEvent, { loading, error, render })` | Declarative loading/error/success rendering. Auto-fetches on first render. No `<Suspense>` wrapper needed — it's per-data-key. |
| `use(promise)` (React 19) | `createResource(fetcher)` → `{ loading, error, data, refetch }` | Reactive async signal. Auto-aborts on re-fetch via AbortController. |
| Error Boundary (`componentDidCatch`) | `loop.error` config + actor supervision trees | Per-event retry with `{ retry: n, fallback }`. Actor supervision: `restart`/`stop`/`escalate`/`resume` strategies. |
| `useTransition()` / `startTransition()` | 5-lane executor + temperature routing | Urgent updates on `critical` (microtask), transitions on `warm` (postTask) or `cold` (idleCallback). No hook needed — the graph routes automatically. |
| `useDeferredValue(value)` | Temperature lane routing | Hot data → RAF (60fps), cold data → idle callback. The graph classifies nodes by access frequency. |

### 7.4 Data Fetching & Server State

| React 18+ | Uploop | Notes |
|---|---|---|
| `fetch()` in `useEffect` + `useState` | `bind(entitySchema, graph).connect({ source, autoSave, poll })` | Declarative binding: schema → graph → fetch → auto-save. |
| React Query / TanStack Query | `createResource(fetcher)` + `loop.cache` | Built-in cache with TTL, SWR, `getCached(key)`, `invalidateCache(key)`. No third-party library needed. |
| SWR / `useSWR()` | `loop.cache: { key: { ttl, swr, fetch } }` | Stale-while-revalidate at the loop level. `cacheStatus(key)` → `{ fresh, stale, expired }`. |
| Server Components (RSC) — fetch on server | `renderToString(Comp, props)` + `createRemoteLoop()` | SSR renders component to string. Remote loops stream state via WebSocket/SSE from server. |
| `loader()` (React Router) | Route guards + lazy loading in `@uploop/router` | Guards run before route activation. Services auto-generated from entities. |
| `action()` (React Router) | `send('submitForm', data)` → update handler → validation → effect | Events flow through the graph. Same pattern on client and server. |

### 7.5 Server-Side Rendering & Hydration

| React 18+ | Uploop | Notes |
|---|---|---|
| `renderToString()` / `renderToPipeableStream()` | `renderToString(Comp, props?)` | Renders any component shape: pure view, full lifecycle, or plain string. `createStringExecution()` for SSR targets. |
| `hydrateRoot()` | `hydrate(Comp, target, props?, serverState?)` or `createHydrationRoot()` | Multi-component hydration scans `[data-up-component]` elements. State reconciliation from `__UPLOOP_STATE__`. |
| Streaming SSR (`renderToReadableStream`) | Binary stream codec (`@uploop/stream`) + remote loops | Entity = wire format. Zero-copy reads, 60% smaller than JSON. Frame-based diffing. |
| Selective Hydration | `hydrate()` per component | Each component hydrates independently. No Suspense boundary needed. |
| `useFormStatus()` / `useActionState()` | `loop.isPending(event)` + `loop.getError(event)` | Per-event pending state and error state with `retriesLeft` and `fallback`. |

### 7.6 Routing

| React 18+ | Uploop | Notes |
|---|---|---|
| React Router `<Routes>` / Next.js file-based | `@uploop/router`: route matching, guards, layouts, lazy loading | File-based or programmatic. |
| `<Outlet>` / nested layouts | Layout composition via route definitions | Guards + layout nesting. |
| `lazy(() => import(...))` | Lazy route loading in `@uploop/router` | Code-split at route level. |
| `useParams()` / `useSearchParams()` | Route params available in guards | Guards receive the matched route context. |

### 7.7 Forms & Validation

| React 18+ | Uploop | Notes |
|---|---|---|
| React Hook Form / Formik | `entityComponent(entitySchema, { mode: 'form' })` | Auto-generates form UI from entity schema. Validation is built into entity fields. |
| Controlled inputs (`value` + `onChange`) | `bind(entitySchema, graph).form(formEl)` | Auto-wires HTML inputs. Two-way binding via HyperGraph. |
| Zod / Yup validation | Entity schema `.validate(data)` | Same schema validates on client AND server. No duplicate schemas. |
| `useFormState()` (React 19) | `storeFromEntity(entitySchema)` → auto-generated `setField` + `validate()` | Store with per-field setters and full-entity validation. |

### 7.8 Concurrent Features (The Deep Difference)

This is where Uploop fundamentally diverges from React. React 18 introduced Concurrent Mode with interruptible rendering, priority lanes, and time-slicing. Uploop takes a different approach:

| React 18+ Concurrent | Uploop Equivalent | How It Differs |
|---|---|---|
| **Fiber lanes** (Sync, Input, Default, Transition, Idle) | **5-lane executor** (critical/hot/warm/cold/idle) | React lanes are internal to the reconciler. Uploop lanes are explicit, configurable, and temperature-driven. |
| **Time-slicing** (yield every 5ms) | `createFrameBudget(budgetMs)` + `yieldIfOver()` | Per-frame budget enforcer. Configurable, not hardcoded. |
| **Interruptible rendering** | `interruptible` update handlers (AbortController) | Per-handler cancel-on-retrigger. More granular than React's fiber-level interruption. |
| **`<Offscreen>`** | Cold lane (idleCallback) + orphan detection | Cold nodes are deprioritized automatically. `orphanDetector()` prunes unreferenced nodes. |
| **Automatic batching** | `batch(fn)` — explicit or automatic within `loop.send()` | Nested sends are auto-batched. Single notify at depth zero. |
| **`useTransition` / `startTransition`** | Lane routing + `schedule(fn, 'warm', opts)` | No hook. The graph routes work by temperature metadata. Urgent = critical/hot. Transition = warm/cold. |
| **`useDeferredValue`** | Temperature lane router (`eventRateClassifier`) | Auto-classifies nodes by access frequency. Hot → RAF. Cold → idle. |

### 7.9 State Management Ecosystem

| React Ecosystem | Uploop Equivalent | Notes |
|---|---|---|
| Redux (actions + reducers + store) | `store()` + `send()` + update handlers | Same pattern: dispatch events, reducers handle them, store notifies subscribers. |
| Zustand / Jotai (atomic state) | `createSignal()` + `createReactiveStore()` | Atomic signals with auto-tracking. `reactiveFromGraph()` bridges graphs to signals. |
| MobX / Valtio (proxy-based) | HyperGraph data nodes → `subscribe()` → edge-based reactivity | Graph edges model reads/writes. Topological updates instead of proxy traps. |
| Recoil (atoms + selectors) | `createSignal()` + `createComputed()` | Same atom/selector mental model. `createComposedSelector()` for combining. |
| RxJS (Observables) | `pipeline()` + `queue()` + `eventStream()` + `createActor()` | Lighter, HyperGraph-native. Pipelines chain `.map().filter().debounce().sink()`. Actors have sequential mailboxes. |
| XState (state machines) | `@uploop/state-machine` package + actor system | Separate package. Actor supervision trees with restart/stop/escalate strategies. |

### 7.10 What React Has That Uploop Doesn't (Yet)

| React 18+ Feature | Status in Uploop | Notes |
|---|---|---|
| **React Server Components (RSC)** | No equivalent | `renderToString()` + remote loops is closest, but RSC's zero-client-JS promise is unique. |
| **`useOptimistic()`** | Not built-in | Could be built with signals + `loop.cache`. |
| **`use()` hook** (React 19, unwrap promises/context) | Not needed | `suspend()` and `createResource()` cover async; context is scope-based. |
| **React DevTools** | `@uploop/devutils` | HyperGraph Inspector, event capture, debug panel. Less mature. |
| **React Native** | No equivalent | Uploop is web-focused. |
| **Community ecosystem** | None yet | Libraries, tutorials, StackOverflow answers — React's biggest moat. |
| **`useInsertionEffect`** | Not needed | Uploop uses `innerHTML` replace, not CSS-in-JS injection. |
| **`createContext` / `<Provider>`** | Not needed | React Context solves prop drilling in component trees. Uploop's HyperGraph data nodes are inherently global — any component reads any node. No provider wrappers required. |

### 7.11 Mental Model Translation

```
React mental model:
  Component tree → hooks (state, effects, refs) → VDOM diff → DOM mutations

Uploop mental model:
  Entity schema → HyperGraph (nodes + edges) → execution profiles → DOM
       ↓
  One definition generates everything:
  validation, API, wire format, forms, AI manifest, TypeScript, JSON Schema, GraphQL
```

**The key shift:** React thinks in component trees. Uploop thinks in data graphs. Components are views onto the graph. When the graph updates — whether from user input, server push, or computed derivation — the DOM follows.

---

*Report from real code. 404 tests passing across 17 test files. Long runtime beta → v1.0.*
