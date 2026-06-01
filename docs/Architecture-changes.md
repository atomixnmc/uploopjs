# Architecture Changes — v0.0.1 → v0.0.2

> **Date:** 2026-06-01
> **Based on:** [v0.0.1 Report](./phase-v0.0.1-report.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [Uploop Architecture Overview](../../docs/Uploop%20Architecture%20Overview.md)
> **Status:** Design proposal

---

## Summary of Changes

Three fundamental shifts from the v0.0.1 architecture:

| v0.0.1 | v0.0.2 |
|---|---|
| Thin `@uploop/core` — pure data, no opinions about components | **Thick core** — owns component, execution, instance/class/replacement |
| Core/HTML split as the primary architectural boundary | **Data-Event Flow** as the primary architectural boundary |
| `innerHTML` destruction as a render bug to fix | **Instance replacement** as a first-class execution concept |

---

## Change 1: Thick, Opinionated Core

### Problem

v0.0.1 followed the React instinct — keep core minimal (`createLoop`, `createSignal`, `createFrame`), push everything else to adapters (`@uploop/html`, `@uploop/store`). This caused:

- Each adapter re-solves the same problems (lifecycle, disposal, scoping)
- The `component()` function lives in `@uploop/html` but feels like it belongs in core
- `createComponentType()` (archetypes) also lives in html, though it's purely about component composition
- The scope/context system is html-only (`registerScope`, `consumeContext`) but is a general need

### Decision

**The core should own `component`, `execution`, and instance/class semantics.** It should define the *protocol* for rendering, mounting, patching, and replacing — without knowing about DOM specifically.

### What moves to core

```
@uploop/core
  graph/         # node types, edge rules, describe() manifest (already there)
  component/     # component(), createComponentType(), instance lifecycle  ← NEW
  execution/     # execution protocol: render, patch, mount, unmount       ← NEW
  data/          # signals, selectors, derived (already there)
  event/         # event pipeline, guards, transactions (already there)
  behavior/      # typed node behaviors: cache, suspend, error, stream, effect  ← NEW
  frame/         # micro, visual, idle, manual scheduling (already there)
  scope/         # context, injection, resolution                         ← NEW
```

### What stays in html

```
@uploop/html
  dom/           # DOM execution target: createDOM, patchDOM
  template/      # html`` template tag, bindings
  events/        # addEventListener wiring (DOM-specific)
  element/       # defineElement() WebComponent bridge
  hydrate/       # SSR hydration (DOM-specific)
```

### Implication

`component()` moves from `@uploop/html` to `@uploop/core`. It takes an `execution` target instead of hardcoding DOM:

```js
// v0.0.1 — component in html, DOM is assumed
component('Counter', { state, update, view, mount })

// v0.0.2 — component in core, execution is declared
import { component } from '@uploop/core'
import { domExecution } from '@uploop/html'

component('Counter', {
  state: { count: 0 },
  update: { inc: s => ({ count: s.count + 1 }) },
  view: (s, { send }) => `Count: ${s.count}`,
  execution: domExecution   // DOM is one target among many
})
```

Other execution targets become possible without architectural contortions:

```js
import { canvasExecution } from '@uploop/canvas'
import { ssrExecution } from '@uploop/server'
import { webglExecution } from '@uploop/webgl'
```

---

## Change 2: Data-Event Flow as the Universal Foundation

### Problem

v0.0.1 has multiple overlapping concepts:

- `createLoop` — state + update + effect
- `createGraph` — typed nodes + explicit edges
- `component` — loop + view + mount lifecycle
- `store` — external state + selectors + persistence
- `createEffectSystem` — side-effect handlers
- `batch` — update batching

These are siblings in the API but don't share a unified mental model. A developer asks: "Is this a loop, a graph, a component, or a store?" The answer depends on which package they imported.

### Decision

**Everything is a node in a declarative Data-Event Flow graph.** All other concepts (component, store, cache, suspend, error boundary, effect, stream, router) are *behaviors* — typed flavors layered on the same graph primitive.

### The Unified Model

```
Data-Event Flow Graph
  │
  ├── Node types:
  │     data      — state/signal (hot, cold, transient, persistent, remote, derived)
  │     update    — pure transformation (reads data, writes data)
  │     view      — render output (reads data, produces execution)
  │     event     — external trigger
  │     effect    — side-effect with cleanup
  │     resource  — fetch/cache/db
  │     stream    — WebSocket, SSE, polling
  │
  ├── Behaviors (flavors on nodes):
  │     cache     — stale-while-revalidate, TTL, dedup
  │     suspend   — pending/loading boundary
  │     error     — error boundary, retry, fallback
  │     debounce  — delay/throttle
  │     retry     — exponential backoff
  │
  └── Edges:
        event → update
        update → data
        data → view
        data → effect
        view → execution target
```

### How React/Solid Concepts Map

Every React/Solid concept can be interpreted as a Data-Event Flow behavior:

| React/Solid Concept | Uploop Data-Event Flow |
|---|---|
| `useState` / `createSignal` | `data` node, `hot` temperature |
| `useEffect` / `createEffect` | `effect` node with reads edges |
| `useMemo` / `createMemo` | `data` node, `derived` type |
| `useContext` / Context | `scope` resolution on data nodes |
| `<Suspense>` | `suspend` behavior on a `resource` node |
| `<ErrorBoundary>` | `error` behavior on a node subtree |
| `useTransition` | `debounce` + `suspend` on an update |
| React Query / TanStack | `resource` node with `cache` + `stale` behavior |
| Zustand / Redux | `data` nodes in a `store` scope |
| React Router | `data` node reading `route` + `view` node |
| Framer Motion | `effect` node on `visual` frame |
| `innerHTML` / VDOM | `execution` target's `patch` strategy |

**The key insight:** React needs 15+ distinct APIs because it has no unifying model. Uploop needs 1 model (Data-Event Flow) + N behaviors.

### Example: Search with Debounce + Cache + Suspend

```js
// v0.0.1 — each concern is a separate API or manual wiring
const SearchApp = component('Search', {
  state: { query: '', results: [], loading: false, error: null },
  update: {
    input: (s, q) => {
      // manual debounce with setTimeout
      // manual fetch with try/catch
      // manual loading state
      // manual cache check
    }
  },
  view: (s) => {
    if (s.loading) return html`<div>Loading...</div>`
    if (s.error) return html`<div>Error: ${s.error}</div>`
    return html`<ul>${s.results.map(...)}</ul>`
  }
})

// v0.0.2 — behaviors are declared on the graph
const SearchApp = component('Search', {
  nodes: {
    query:    { type: 'data', temperature: 'hot', lifetime: 'transient' },
    search:   { type: 'update', reads: ['query'], writes: ['results'],
                debounce: 300, cache: { ttl: '5m' }, interruptible: true },
    results:  { type: 'data', temperature: 'cold', owner: 'remote',
                suspend: { fallback: 'LoadingSpinner' },
                error: { fallback: 'ErrorView' } },
    list:     { type: 'view', reads: ['results'] }
  },
  edges: [
    ['input', 'query'],
    ['query', 'search'],
    ['search', 'results'],
    ['results', 'list']
  ]
})
```

The runner now knows:
- `query` is hot/transient → keep in memory, don't persist
- `search` is debounced + interruptible → cancel previous on new input
- `results` is cold/remote → cache with TTL, show spinner while loading
- `list` depends on `results` → only re-render when results actually change

No manual debounce timers, no manual loading flags, no manual try/catch.

---

## Change 3: Instance Replacement as a First-Class Execution Concept

### Problem

v0.0.1's `innerHTML` destruction was framed as a "bad render strategy" to fix. The report identified it as the root cause of resource save/restore, focus preservation hacks, index remapping, and two-pass processing.

But "fix innerHTML" is the wrong framing. It assumes there's one right way to render (VDOM diffing, signal patching, template cloning). In reality:

- DOM views want surgical patching
- Canvas views want full redraw every frame
- SSR views want string output with no DOM at all
- WebGL views want GPU buffer updates

### Decision

**Instance replacement is a first-class execution strategy, not a bug.** Different execution targets choose different replacement strategies. The architecture should model this, not hide it.

### Execution Protocol

```js
// Each execution target implements:
const execution = {
  // Create output from template + state
  render(template, state) → Output,

  // Apply delta to live target (DOM patch, canvas redraw, GPU buffer update)
  patch(target, prevOutput, nextOutput, delta) → void,

  // Full replacement (innerHTML, clear + redraw, new SSR string)
  replace(target, nextOutput) → void,

  // Attach to context (DOM element, canvas, worker, GPU context)
  mount(target, output) → unmount(),

  // Cleanup
  unmount(target) → void,

  // Strategy hints for the runner
  strategy: 'patch' | 'replace' | 'redraw'
}
```

### Execution Targets

| Target | `strategy` | `render` | `patch` | `replace` |
|---|---|---|---|---|
| DOM | `patch` | template → fragment | morph DOM nodes | `innerHTML` |
| Canvas 2D | `redraw` | no-op (draw later) | no-op | clear + redraw all |
| SSR | `replace` | template → HTML string | no-op | return new string |
| WebGPU | `redraw` | no-op | update buffers | new render pass |
| PixiJS | `patch` | no-op | update sprites | recreate stage |

### Instance Lifecycle

```
create(props) → instance { loop, render, mount, unmount, children }
     │
     ▼
mount(target)  → execution.mount(target, instance.render())
     │
     ▼
loop.send(event)  → state change
     │
     ▼
runner decides: patch or replace?
     │
     ├── patch:  execution.patch(target, prev, next, delta)
     │           → only changed nodes updated
     │           → preserves focus, scroll, canvas state
     │
     └── replace: execution.replace(target, next)
                  → full teardown + rebuild
                  → runner handles: save resources, preserve focus, rebind events
                  → these are generic runner concerns, not html-specific hacks
```

### What This Means for the v0.0.1 Problems

| v0.0.1 Workaround | v0.0.2 Solution |
|---|---|
| `saveResources()` / `restoreResources()` | Runner's `replace` hook — generic resource preservation |
| `saveFocus()` / `restoreFocus()` | Runner's `replace` hook — generic focus preservation |
| `data-up-event` index remapping | Only needed for `replace` strategy; patch strategy binds directly |
| `_pendingVC` side-channel | Runner state, not DOM property |
| Two-pass processing | Runner pipeline with explicit phases |

The DOM execution target starts with `strategy: 'replace'` and `innerHTML` — same as v0.0.1. But now it's a **declared strategy**, not an architectural assumption. We can improve DOM execution to `strategy: 'patch'` separately, without changing the component model or the runner.

---

## What Doesn't Change

These v0.0.1 decisions remain correct:

1. **HyperGraph model and `describe()`** — still the differentiator
2. **`@click` / `.prop` / `?bool` template syntax** — good DX
3. **Event pipeline with depth/transaction guards** — robust
4. **Frame scheduler (micro/visual/idle/manual)** — first-class
5. **`computeParts` + `compose` reactive children** — elegant pattern
6. **`createComponentType` factory** — right composability
7. **No JSX, no build step, ESM imports** — core identity
8. **CSP-safe by default** — `addEventListener` over inline handlers

---

## Package Structure After Changes

```
@uploop/core          # thick core — owns component, execution, behaviors
  graph/              # node types, edges, describe(), runner
  component/          # component(), createComponentType()
  execution/          # execution protocol (interface, not implementation)
  data/               # signal, selector, derived
  event/              # event pipeline, guards, envelope
  behavior/           # cache, suspend, error, stream, debounce, retry
  frame/              # scheduler
  scope/              # context, injection, resolution
  plugin/             # plugin protocol

@uploop/html          # DOM execution target — much thinner
  template/           # html`` tag, bindings (syntax stays)
  dom-execution/      # implements execution protocol for DOM
  element/            # defineElement() WebComponent
  hydrate/            # SSR hydration

@uploop/store         # external store — now a behavior on data nodes
@uploop/router        # route as data node + view
@uploop/css           # utility CSS (unchanged)
@uploop/motion        # motion as effect on visual frame
@uploop/devtools      # HyperGraph inspector
```

---

## Migration Path

### Step 1: Extract execution protocol (non-breaking)

Define the execution interface in `@uploop/core`. Keep `@uploop/html`'s current `innerHTML` approach as the `replace` strategy implementation. Nothing breaks.

### Step 2: Move `component()` to core (breaking for html consumers)

`component()` moves to `@uploop/core`. `@uploop/html` re-exports it for compatibility. The `execution` parameter is added with `domExecution` as default.

### Step 3: Implement behavior nodes (additive)

Add `cache`, `suspend`, `error`, `debounce` behaviors to core. Existing components don't use them, no breakage.

### Step 4: Improve DOM execution (additive)

Implement `strategy: 'patch'` for DOM using template cloning + signal-driven updates. Components opt in. `replace` remains the default.

### Step 5: Unify `createLoop` and `createGraph` (breaking for core consumers)

Merge into a single `createGraph` that the runner compiles. `component()` becomes a convenience wrapper.

---

## Change 4: Lifecycle Aliasing — Keep `mount`/`unmount`, Allow Custom Names

### Problem

`mount`/`unmount` are DOM-tainted terms. In a node-based reactive graph:

- You don't "mount" a WebSocket
- You don't "mount" a signal subscription
- You don't "mount" a canvas frame loop

Alternative names (`connect`/`disconnect`, `spawn`/`despawn`, `activate`/`deactivate`) carry different mental models. No single pair fits all execution targets equally well.

### Decision

**Keep `mount`/`unmount` as the canonical names.** They are familiar (React, Vue, Lit, WebComponents all use them) and developers already understand "attach to target + start reacting" and "detach from target + stop reacting."

**But allow aliasing via `renameLifeCycleMethods`.** When an execution target or component archetype wants different terminology, it declares a mapping. The runner wires them transparently.

### How It Works

```js
// Core — canonical names
component('Counter', {
  state: { count: 0 },
  mount(el, ctx) { /* canonical: attach + subscribe */ },
  unmount(el, ctx) { /* canonical: detach + unsubscribe */ }
})

// Execution target declares its preferred names
const canvasExecution = {
  strategy: 'redraw',
  renameLifeCycleMethods: {
    mount: 'plug',       // "plug into canvas"
    unmount: 'unplug',
    render: 'draw'        // "draw to canvas"
  },
  plug(canvas, output) { /* ... */ },
  unplug(canvas) { /* ... */ },
  draw(ctx, state) { /* ... */ }
}

// Component using canvas execution — uses canvas's names
const Scene = component('Scene', {
  execution: canvasExecution,
  // Scene author writes plug/unplug/draw — not mount/unmount/render
  plug(canvas, ctx) { /* ... */ },
  draw(ctx, state) { /* ... */ }
})

// The runner resolves all aliases internally.
// describe() always exports canonical names for interop.
Scene.describe()
// → { lifecycle: { mount: 'plug', unmount: 'unplug', render: 'draw' } }
```

### Built-in Alias Presets

| Target | `mount` | `unmount` | `render` | `update` |
|---|---|---|---|---|
| DOM (default) | `mount` | `unmount` | `view` | `update` |
| Canvas / Game | `plug` | `unplug` | `draw` | `tick` |
| Stream / Observable | `subscribe` | `unsubscribe` | `emit` | `pipe` |
| SSR / Server | `render` | `dispose` | `renderToString` | — |
| WebGPU | `attach` | `detach` | `renderPass` | `updateBuffers` |
| Worker | `spawn` | `terminate` | `postMessage` | `onMessage` |

### Naming Comparison

| Term | Mental Model | Best For |
|---|---|---|
| `mount` / `unmount` | Attach to host, detach from host | DOM, WebComponents, general UI |
| `connect` / `disconnect` | Wire into graph, unwire from graph | Data nodes, effects, stores |
| `spawn` / `despawn` | Create instance, destroy instance | Workers, game entities, long-lived processes |
| `plug` / `unplug` | Insert into target, remove from target | Canvas, WebGL, PixiJS |
| `activate` / `deactivate` | Start reacting, stop reacting | Signals, subscriptions, effects |
| `subscribe` / `unsubscribe` | Listen to source, stop listening | Streams, WebSockets, observables |
| `open` / `close` | Begin session, end session | Connections, databases, files |

### The Key Insight

These are all the same lifecycle pattern viewed through different lenses:

```
CANONICAL:  mount → react → unmount
CANVAS:     plug  → draw  → unplug
STREAM:     subscribe → emit → unsubscribe
WORKER:     spawn → postMessage → terminate
```

Uploop doesn't force one lens. It provides the canonical default and lets each execution target rename them to match its domain language. The runner, DevTools, and `describe()` always use canonical names — so tooling works regardless of aliasing.

---

## Change 5: Data State Heuristic as the Core Optimizer

### Why This Is Uploop's Real Advantage

React, Solid, Vue treat all state identically. A mouse position, a user profile, and a product catalog go through the same scheduler, same memory strategy, same cache policy. The developer manually optimizes each one:

```js
// React — developer wires every optimization by hand
const [mouse, setMouse] = useState({ x: 0, y: 0 })     // rAF? Manual.
const [query, setQuery] = useState('')                   // debounce? Manual.
const [results, setResults] = useState([])               // cache? React Query.
const [loading, setLoading] = useState(false)             // suspend? Manual.
const [error, setError] = useState(null)                  // boundary? Manual.
```

The Data State Heuristic lets the runner **choose different strategies per node automatically** because it knows what kind of data each node holds.

### The Classification System

| Heuristic | Memory | Scheduling | Cache | Persistence | Interruption | Example |
|:---|:---|:---|:---|:---|:---|:---|
| `hot` | Keep in memory | rAF / microtask | None | No | Don't interrupt | Mouse position, animation frame |
| `warm` | Keep in memory | microtask | Short TTL | Session | OK to interrupt | Form input, UI toggle |
| `cold` | GC if idle | idle callback | Long TTL, SWR | LocalStorage | Expected | Product list, user profile |
| `frozen` | Serialize only | On-demand | Permanent | IndexedDB | N/A | App config, i18n strings |
| `transient` | GC after frame | rAF only | None | No | Can drop | Drag ghost, hover tooltip |
| `remote` | Cache in memory | Network frame | TTL + revalidate | Server | Cancel fetch | API results, images |
| `derived` | Compute on read | Same as source | None | No | Same as source | fullName = first + last |
| `critical` | Durable immediately | Sync / immediate | None | Durably | Never | Payment, save, auth |
| `disruptable` | Keep in memory | rAF | None | No | Always OK | Scroll position, video frame |

### What Each Heuristic Controls

The runner makes different decisions based on the heuristic:

```
Node: query
  temperature: warm
  lifetime: transient
  → Runner decisions:
    • Schedule on HOT LANE (rAF) — keystroke latency matters
    • Don't persist — dies with component
    • Don't cache — always read from memory
    • Don't deduplicate — every keystroke is unique
    • GC after disconnect — no cleanup needed

Node: results
  temperature: cold
  owner: remote
  cache: { ttl: 300000, swr: true }
  → Runner decisions:
    • Schedule on COLD LANE (network frame) — don't block rAF
    • Cache in memory with 5min TTL
    • SWR: serve stale, revalidate in background
    • Deduplicate: same query → one fetch
    • Prefetch: if query is "likely" (AI hint), preload
    • GC from memory after idle → keep in persistent cache
    • Serialize for SSR — include in initial HTML
    • Retry with backoff on failure

Node: mousePosition
  temperature: hot
  lifetime: transient
  → Runner decisions:
    • Schedule on HOT LANE (rAF) — 60fps
    • Never debounce — real-time
    • Never cache — always fresh
    • Never persist — meaningless after frame
    • Drop frames under pressure — latest wins
    • Don't trace in event log — too noisy
```

### The Algorithmic Win

This is where Uploop can genuinely beat Solid/React on scheduling:

```
Runner sees state change on `query` (warm)
  → traces edges: query → search, search → results
  → sees search.debounce = 300ms
  → starts 300ms timer, doesn't fire search yet

New `query` change arrives at 150ms
  → sees search.interruptible = true
  → cancels 300ms timer, starts new one
  → previous fetch (if in-flight) is aborted

Timer fires at 450ms
  → executes search update
  → sees results is cold/remote
  → schedules on NETWORK LANE (not blocking rAF)
  → shows suspend fallback on list view

Fetch completes
  → writes results to data node
  → sees results.cache.ttl = 300000
  → stores in cache layer with TTL
  → notifies list view
  → list view renders on microtask (not urgent)

5 minutes later, list view re-reads results
  → cache has it, still valid
  → serves from cache instantly
  → optionally SWR in background if TTL near expiry

Component disconnects
  → warm nodes (query): GC immediately
  → cold nodes (results): keep in persistent cache, GC from memory
  → hot nodes (mousePosition): GC immediately
  → critical nodes (savedDraft): flush to disk before GC
```

No framework today does this automatically. React Query handles cache/refetch. Solid handles signal scheduling. But none have the unified heuristic model to make cross-cutting decisions about **memory, scheduling, cache, persistence, and interruption** from a single declaration.

### Heuristic Inference — Don't Declare Everything

The runner infers heuristics from context. The developer only declares overrides.

| If node... | Infer... |
|---|---|
| Is read by a `visual` frame view | `temperature = 'hot'` |
| Comes from `fetch()` / `async` update | `owner = 'remote'`, `temperature = 'cold'` |
| Is `derived` from a hot node | `temperature = 'hot'` |
| Is `derived` from a cold node | `temperature = 'cold'` |
| Is written by an update with `interruptible: true` | `temperature = 'warm'` |
| Has `persist: true` | `lifetime = 'persistent'` |
| Is render-only, never in an update | `temperature = 'warm'` |
| Is a DOM event stream (mousemove, scroll) | `temperature = 'hot'`, `lifetime = 'transient'` |
| Has no cache declaration | `cache = undefined` (no caching) |

### Example: Zero-Declaration Counter vs Full-Declaration Search

```js
// Simple counter — ZERO heuristics declared. Everything inferred.
component('Counter', {
  state: { count: 0 },
  update: { inc: s => ({ count: s.count + 1 }) },
  view: (s) => `Count: ${s.count}`
})
// Runner infers:
//   count: { temperature: 'hot', lifetime: 'transient' }
//   (read by view on micro frame, written by update, no persist)

// Search box — only overrides declared. Rest inferred.
component('Search', {
  nodes: {
    query:   { type: 'data' },
    // Runner infers: temperature=warm, lifetime=transient (form input)

    search:  { type: 'update', reads: ['query'], writes: ['results'],
               debounce: 300, interruptible: true },
    // Only debounce + interrupt declared — the "search behavior"

    results: { type: 'data', owner: 'remote',
               cache: { ttl: '5m' },
               suspend: { fallback: 'Loading' },
               error: { fallback: 'Error' } }
    // Runner infers: temperature=cold (remote owner)
    // Cache policy, suspend, error are behavior overrides

    list:    { type: 'view', reads: ['results'] }
    // Runner infers: schedule=micro, only re-render when results change
  }
})
```

### Integration with the Runner Pipeline

```
                ┌─────────────────────────────────┐
                │        DATA HEURISTIC ENGINE     │
                │                                 │
  State change  │  Read node metadata:             │
  ─────────────→│    temperature, lifetime, owner,  │
                │    cache, interruptible          │
                │                                 │
                │  Decide:                         │
                │    • Which lane? (hot/warm/cold) │
                │    • Debounce or immediate?      │
                │    • Cache hit or fetch?         │
                │    • Persist or GC?              │
                │    • Interrupt previous?         │
                │    • Suspend or render?          │
                │    • Trace or skip logging?      │
                │                                 │
                └────────────┬────────────────────┘
                             │
                ┌────────────▼────────────────────┐
                │        FRAME SCHEDULER           │
                │                                 │
                │  HOT LANE  (rAF, 16ms budget)   │
                │  WARM LANE (microtask)          │
                │  COLD LANE (idle, network)      │
                │  CRITICAL  (sync, durable)      │
                │                                 │
                └────────────┬────────────────────┘
                             │
                ┌────────────▼────────────────────┐
                │        EXECUTION TARGET          │
                │                                 │
                │  patch or replace?              │
                │  preserve resources?            │
                │  rebind events?                 │
                │                                 │
                └─────────────────────────────────┘
```

### Heuristic vs Behavior

Heuristics and behaviors are different layers:

| Layer | What | Declared By | Controls |
|---|---|---|---|
| **Heuristic** | What kind of data is this? | Node type + temperature + lifetime + owner | Memory, scheduling lane, GC strategy, persistence |
| **Behavior** | How should this node act? | Node config + edge rules | Debounce, cache policy, suspend fallback, error boundary, retry |

A node can have both:

```js
results: {
  // Heuristic — what kind of data
  type: 'data',
  temperature: 'cold',
  lifetime: 'session',
  owner: 'remote',

  // Behavior — how it acts
  cache: { ttl: '5m', swr: true },
  suspend: { fallback: 'LoadingSpinner' },
  error: { fallback: 'ErrorView', retry: 3 },
  debounce: 300
}
```

The heuristic tells the runner *where to put it*. The behavior tells the runner *what to do with it*.

---

## Change 6: API Naming — Replace Awkward Legacy Names

Several v0.0.1 names are holdovers from early prototyping and don't read naturally. v0.0.2 should rename them.

### renameLifeCycleMethods

**Before:** `link_methods_names`
**After:** `renameLifeCycleMethods`

Follows JS camelCase convention. Self-documenting: it renames lifecycle methods.

### computeParts → project

**Before:** `computeParts(s)`
**After:** `project(s)`

`computeParts` is awkward — it sounds like "compute the parts of something" which is vague. `project` is the standard functional term for transforming state into a derived shape (like a database projection or a map projection). It's short, precise, and borrows from established vocabulary (Relay's `project`, ReScript's `project`).

```js
// Before
computeParts: (s) => ({
  wheels: s.wheelOffsets.map(wo => ({ x: s.x + wo.ox }))
})

// After
project: (s) => ({
  wheels: s.wheelOffsets.map(wo => ({ x: s.x + wo.ox }))
})
```

### compose → assemble

**Before:** `compose({ wheels, doors, html: h })`
**After:** `assemble({ wheels, doors, html: h })`

`compose` is overloaded (function composition, React composition, Docker compose). `assemble` is more literal — you're assembling child components from projected parts. It also pairs nicely with `project`: project state into parts, assemble parts into children.

```js
// Before
compose: ({ wheels, doors, html: h }) => [
  ...wheels.map(w => h`<Wheel .../>`),
  ...doors.map(d => h`<Door .../>`)
]

// After
assemble: ({ wheels, doors, html: h }) => [
  ...wheels.map(w => h`<Wheel .../>`),
  ...doors.map(d => h`<Door .../>`)
]
```

**Pipeline: project → assemble**

```
state  ──project()──→  { wheels, doors }  ──assemble()──→  [ <Wheel/>, <Door/> ]
                        (pure projection)                   (creates children)
```

### componentTag → jsx (or h)

**Before:** `componentTag(classes)`
**After:** `jsx(classes)` or `h(classes)`

`componentTag` doesn't convey what it does. It's a mini-JSX parser — it takes `<Component prop={val}/>` strings and returns rendered output. `jsx` is the recognized term for this pattern (Solid's `jsx`, Preact's `jsx`). `h` is the hyperscript convention (React's `createElement` alias).

For Uploop's no-JSX identity, `jsx` might send the wrong signal despite being technically accurate. **Recommend `h`** — it's the established convention for "create element from descriptor" and doesn't imply a JSX dependency.

```js
// Before
const tag = componentTag({ Wheel, Door })
tag`<Wheel x=${10}/>`

// After
const h = createElements({ Wheel, Door })
h`<Wheel x=${10}/>`
```

### applyBindings → wire

**Before:** `applyBindings(root, bindings, send, state)`
**After:** `wire(root, bindings, send, state)`

`applyBindings` is verbose and generic. `wire` is short, descriptive (you're wiring events and props to DOM elements), and pairs well with the graph/connection metaphor.

### processUploopAttributes → scan

**Before:** `processUploopAttributes(root, ctx)`
**After:** `scan(root, ctx)`

Verbose + redundant (everything in Uploop is an "Uploop attribute"). `scan` says what it does: scan the DOM for scopes, contexts, resources, containers.

### processVirtualContainers → hydrateContainers

**Before:** `processVirtualContainers(root, ctx)`
**After:** `hydrateContainers(root, ctx)`

More specific. It's hydrating component instances from placeholder DOM elements inside virtual containers. `process` is too vague.

### Summary of Renames

| v0.0.1 | v0.0.2 | Why |
|---|---|---|
| `link_methods_names` | `renameLifeCycleMethods` | JS camelCase, self-documenting |
| `computeParts` | `project` | Standard FP term, short, precise |
| `compose` | `assemble` | Avoids overloading, pairs with `project` |
| `componentTag` | `h` (or `jsx`) | Convention for element factories |
| `applyBindings` | `wire` | Short, graph metaphor |
| `processUploopAttributes` | `scan` | Short, says what it does |
| `processVirtualContainers` | `hydrateContainers` | Specific about hydration intent |
| `createEffectSystem` | `effects` | Shorter, follows `signals`/`stores` pattern |
| `registerResource` | `keepAlive` | Intent: keep this DOM element alive across renders |
| `saveResources` / `restoreResources` | Runner internal (pre-replace / post-replace hooks) | Not user-facing after execution protocol |

### Names Worth Keeping

These v0.0.1 names are already good:

| Name | Why It Works |
|---|---|
| `createSignal` | Signals are the standard term now (Solid, Preact, Angular) |
| `createFrame` | Frame scheduling is Uploop's term, good |
| `createLoop` | Loop is the core concept, accurate |
| `createGraph` | Graph is the architecture, accurate |
| `component` | Universal, expected |
| `defineElement` | Matches `customElements.define` |
| `html` | Lit/Solid convention, good |
| `createComponentType` | A bit long but clear; `defineType` could work too |
| `send` | Event dispatch, good (Erlang/Elm convention) |
| `batch` | Standard term |
| `describe` | Exports manifest, good |
| `hydrate` | SSR term, standard |

### The Rule of Thumb

- **Verbs**: short, one word, says what it does (`scan`, `wire`, `send`, `project`, `assemble`)
- **Nouns**: standard convention, no invention (`signal`, `frame`, `graph`, `component`, `jsx`)
- **Factories**: `create*` or bare noun (`createSignal`, `createFrame`, `component`)
- **No Uploop prefix in function names** — the import path is the namespace

```js
// Good: import path is the namespace
import { scan } from '@uploop/html'

// Bad: function name repeats the namespace
processUploopAttributes()  // Uploop is implied by the import
```

---

## Risk: Over-Abstraction

The v0.0.1 report warned about the `component()` function being 570 lines. The v0.0.2 design adds *more* concepts (execution protocol, behaviors, runner phases). The risk is making the architecture harder to understand, not easier.

### Mitigation

1. **Behaviors are opt-in.** A simple counter still works with just `state` + `update` + `view`. No one has to declare `temperature: 'hot'` for a counter.
2. **Sensible defaults.** If `temperature` is omitted, the runner infers it from context. `hot` for component state, `cold` for fetch results.
3. **The `describe()` manifest hides complexity.** A complex search component with cache/suspend/debounce still exports a clean JSON graph. DevTools displays it; developers don't write it manually.
4. **AI generation is the target.** The metadata that feels like over-abstraction to a human is exactly what an AI code generator needs to produce correct, performant code. As the Architecture Overview notes: "too much metadata will not be an issue with next-gen AI-first framework."
