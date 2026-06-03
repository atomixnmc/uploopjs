# v0.0.3 — Breakthrough Architecture Changes

> **Purpose:** Three core systems are underpowered. This document diagnoses the root causes and proposes concrete changes to make Uploop architecturally competitive — not chasing execution milliseconds, but winning on declarative power.

---

## Current State Assessment (Honest)

### The Graph: Lightweight Data Structure, Not an Engine

`createGraph()` (376 lines) does four things:

1. Stores typed nodes (data, update, view, effect, event, resource) in Maps
2. Builds two dependency indexes: `dataToViews` and `dataToUpdates`
3. On `send()`, finds the update node → runs it → notifies affected views
4. Exports `describe()` for introspection

That's it. The graph is a **lookup table with edges.** It is not used for scheduling decisions. It is not used for cache invalidation. It is not used for SSR serialization. It is not traversable. It cannot be queried. It cannot be transformed. It cannot be diffed.

The `createLoop()` path — which every component, store, router, and state machine actually uses — builds an even simpler graph: a flat object with `{ state: { type: 'data' } }` and one node per update/effect handler. The edges are implicit. There is no `reads`/`writes` metadata. Every state change notifies every subscriber, regardless of what changed.

**The graph is documentation, not infrastructure.**

### html.js: Regex Strings, No Architecture

`html()` (158 lines) is a tagged template literal that converts HTML strings into a `{ template, bindings }` descriptor. The processing is:

1. Iterate string parts sequentially
2. For each interpolation, try regexes in order: `@event=`, `.prop=`, `?bool=`
3. Replace the matched attribute with a `data-up-*` marker
4. For nested templates, remap binding indices via MORE regex replacement
5. Return a template string + bindings array

The problems:

- **No validation.** Misspelled event names are silent. Typos in `.prop` names are silent. Mismatched HTML tags are silent.
- **Index routing.** `data-up-event="click:0"` markers are fragile. Nested templates require index remapping via regex find-and-replace on HTML strings. This is the fundamental cause of the event binding fragility documented in the metrics.
- **No graph awareness.** The html tag has zero knowledge of which component it's rendering. It doesn't know valid event names or state keys. It couldn't validate even if it wanted to.
- **Duplicated parsing.** `componentTag()` (L455–508) has its OWN regex-based attribute parser that partially duplicates the html() logic. Two HTML parsers in one 508-line file.
- **`_pendingVC` DOM side-channel.** State is stored on DOM elements because there's no context object to pass between processing passes.

### dom-execution.js: innerHTML or Nothing

`createDOMExecutionFull()` (75 lines) wraps the base DOM execution with html-specific post-processing. The execution strategy is hardcoded to `'replace'` — innerHTML teardown and rebuild. The post-processing runs 4 sequential passes on the ENTIRE root element after every render:

```
innerHTML → focus restore → applyBindings → processUploopAttributes → processVirtualContainers
```

Every render is O(n) on the full DOM tree. There is no incremental update. There is no awareness of which part of the state changed. The runner receives a `delta = null` (the only TODO in the codebase) — it has no information about what actually changed.

**This will never compete with React's reconciliation or Solid's signal-level updates.** It is fundamentally O(full-tree) on every render.

---

## The Three Breakthrough Changes

### Breakthrough 1: The Graph Must Become a Runtime Engine

The graph is currently a passive data structure. It must become **the active coordinator** of all runtime decisions.

#### What the graph should do

```
                    ┌─────────────────────────────┐
                    │      Uploop Graph Engine     │
                    │                              │
  state change ────►│ 1. Trace: what data changed? │
                    │ 2. Index: what updates        │
                    │    depend on this data?       │
                    │ 3. Index: what views           │
                    │    depend on this data?       │
                    │ 4. Index: what effects         │
                    │    depend on this data?        │
                    │ 5. Index: what caches          │
                    │    are invalidated?            │
                    │ 6. Schedule: what frame        │
                    │    lane for each?              │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   Execution Plan             │
                    │                              │
                    │  updates: [search, validate] │
                    │  views:   [productList, nav] │
                    │  effects: [logSearch, sync]  │
                    │  invalidate: [productsCache] │
                    │  frame:    'visual'          │
                    └──────────────────────────────┘
```

#### New graph capabilities (concrete)

**1. Tree operations** — the graph is a DAG. Add standard graph algorithms as methods:

```
graph.traverse('results')        → depth-first traversal from node
graph.topologicalSort()          → valid execution order
graph.detectCycles()             → find circular dependencies
graph.subgraph(['a','b','c'])    → extract independent sub-graph
graph.transitiveDeps('count')    → everything that transitively depends on 'count'
graph.transitiveReads('view1')   → everything 'view1' transitively reads
graph.criticalPath()             → longest dependency chain (latency predictor)
graph.diff(otherGraph)           → what changed between two graph versions
```

**2. Graph queries** — ask questions about data flow:

```
graph.whatReads('products')      → ['productList', 'productCount', 'cartTotal']
graph.whatWrites('products')     → ['search', 'addToCart', 'removeFromCart']
graph.whatInvalidates('products')→ ['productCache', 'recommendations']
graph.isIndependent('a', 'b')    → true if no path between a and b
graph.splitPoints()              → nodes where the DAG splits into independent branches
```

**3. Graph serialization** — reconstruct from JSON:

```
const json = graph.serialize()   → full graph as portable JSON
const g2 = createGraph.fromJSON(json)  → reconstruct
```

This enables: saving/loading app state, server-side precomputation, devtools import/export, AI generation of graphs.

**4. Execution plan generation** — the graph emits what to do:

```
// Instead of: notify all subscribers on every state change
// The graph returns:
const plan = graph.plan(stateChange)
// { updates: ['search'], views: ['productList'], effects: ['logSearch'],
//   invalidate: ['productCache'], frame: 'micro' }
```

This replaces the current blind-notify-all approach in `createLoop().notify()`.

#### Implementation path

```
Phase 1 (this change):  Add tree ops + queries to createGraph()    (~200 lines)
Phase 2 (next):         Migrate createLoop() to use graph engine   (~100 lines)
Phase 3 (next):         Add execution plan generation               (~100 lines)
Phase 4 (later):        Serialization + diff                        (~150 lines)
```

The graph engine changes nothing about the user-facing API. Components still use `component()`. Stores still use `store()`. The graph engine works underneath, making the runtime smarter.

---

### Breakthrough 2: The HTML System Must Know About the Graph

The html.js is a blind string processor. It must become **graph-aware**.

#### Current flow (blind)

```
component config                   html() tag
  state: { count: 0 }              html`<button @click=${() => send('inc')}>`
  update: { inc: fn }
       │                                │
       │                                ▼
       │                           regex match @click=
       │                           → data-up-event="click:0"
       │                                │
       ▼                                ▼
  createLoop()                  applyBindings(root, bindings)
       │                           querySelectorAll('[data-up-event="click:0"]')
       │                           addEventListener('click', handler)
       ▼
  send('inc') → handler
```

Notice: the html processor has NO idea that `'inc'` is a valid event name. It has NO idea that `count` is a valid state key. The component config and the html tag are completely disconnected.

#### Target flow (graph-aware)

```
component config                   html tag (with graph context)
  state: { count: 0 }              html`<button @click=${() => send('inc')}>`
  update: { inc: fn }                   │
       │                                │
       ├────────────────────────────────┤
       │                                ▼
       │                     DEV MODE: validate against graph
       │                     - '@click=inc' → 'inc' is registered? ✓
       │                     - '.value=${s.count}' → 'count' exists? ✓
       │                     - '@click=incr' → 'incr' not found! ⚠ warn
       │                                │
       ▼                                ▼
  createLoop()                  TemplateDescriptor { template, bindings, graph }
                                     │
                                     ▼
                               applyBindings(root, bindings, graph)
                                     │
                                     ▼
                               DOM nodes with live event listeners
```

#### Concrete changes to html.js

**1. Pass graph context to html() — dev mode only**

```js
// Current:
export function html(strings, ...values) { ... }

// New:
export function html(strings, ...values) {
  // Dev mode: if graph context is available, validate
  if (DEV && html._graphContext) {
    validateBindings(strings, values, html._graphContext)
  }
  // ... rest of processing
}
```

`html._graphContext` is set by the component wrapper before calling `view()`. In production, the validation code is tree-shaken.

**2. Replace index routing with node references**

Current: `data-up-event="click:0"` → index-based, requires regex remapping for nested templates.

Target: Each binding gets a stable ID based on its position in the template AST:

```js
// Instead of index:
{ type: 'event', name: 'click', handler: fn, id: 'btn-inc-1' }

// Template marker uses stable ID:
'data-up-event="click:btn-inc-1"'

// applyBindings queries by stable ID:
root.querySelectorAll('[data-up-event="click:btn-inc-1"]')
```

No remapping needed for nested templates because IDs are globally unique per render, not position-dependent.

**3. Merge html() and componentTag() parsing**

Both functions parse HTML attributes. `componentTag()` (L455–508, 54 lines) duplicates the regex logic from `html()` (L15–158). Extract a shared `parseHtmlAttributes(attrString)` function:

```js
// Shared parser used by both html() and componentTag()
export function parseHtmlAttributes(attrString) {
  const attrs = {}
  // Single regex, single implementation
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\x00(\d+)\x00)/g
  // ...
  return attrs
}
```

**4. Auto-detect sugar bindings**

Add the shorthand expansions directly in html():

```js
// Detect string shorthand: @click="inc" → wrap as () => send('inc')
if (eventMatch && typeof value === 'string') {
  bindings.push({
    type: 'event',
    name: eventName,
    handler: `send:${value}`,  // marker for applyBindings to auto-wrap
    id: `ev-${eventName}-${bindings.length}`
  })
}

// Detect :model shorthand
const modelMatch = prevStr.match(/:model\s*=$/)
if (modelMatch) {
  // Expand to .value + @input bindings
}
```

#### What this enables

- **Dev-mode validation:** Misspelled events and state keys produce warnings, not silent failures.
- **Self-documenting templates:** The graph tells you what events are available. IDE can autocomplete.
- **No index remapping:** Stable IDs eliminate the most fragile code in html.js.
- **One parser:** Shared attribute parsing between html() and componentTag().
- **Sugar in the processor:** `@click="inc"`, `:model="text"` expand at template processing time.

---

### Breakthrough 3: Execution Must Be Graph-Driven and Incremental

The current execution is `innerHTML` replacement of the entire root on every render. This is O(full-tree) and cannot compete with React or Solid.

#### The breakthrough: Template-Patch with Graph Knowledge

The execution runner should NOT blindly replace innerHTML. It should:

1. Receive the execution plan from the graph engine (what changed?)
2. Compare old template output with new template output
3. Only update the DOM nodes that actually changed

```
Current (replace):
  state.count changes → innerHTML = entire new template
  Cost: O(full DOM tree) every render

Target (patch):
  state.count changes → graph engine returns { views: ['counterView'] }
  → compare old template parts with new template parts
  → only the <span>${state.count}</span> text node is updated
  Cost: O(changed nodes) per render
```

#### How template-patch works

The `html()` tag currently produces a flat string. It should also produce a **template tree** — a lightweight AST that maps template positions to DOM nodes:

```js
// Current output:
{ template: '<div><h2>5</h2><button>+</button></div>', bindings: [...] }

// Target output:
{
  template: '<div><h2>5</h2><button>+</button></div>',
  bindings: [...],
  tree: [
    { type: 'element', tag: 'div', children: [
      { type: 'element', tag: 'h2', children: [
        { type: 'text', value: 5, path: 'count' }  // ← maps to state.count
      ]},
      { type: 'element', tag: 'button', attrs: { '@click': 'inc' } }
    ]}
  ]
}
```

When state changes, the runner:
1. Gets the execution plan from the graph: `{ views: ['counterView'] }`
2. Re-renders only the affected view → gets new template tree
3. Diffs old tree vs new tree: only text node `5` → `6` changed
4. Patches ONLY that text node in the DOM: `textNode.textContent = '6'`

This is template-level diffing — simpler than VDOM (no createElement reconciliation), more granular than innerHTML replacement.

#### Execution phases (graph-driven)

```
state change
    │
    ▼
graph.plan(change)
    │
    ├── updates: [...]     → execute update handlers
    ├── views: [...]        → re-render affected views
    ├── effects: [...]      → run affected effects
    └── invalidate: [...]   → clear affected caches
    │
    ▼
for each view in plan.views:
    oldTree = view._lastTree
    newTree = view.render(state)
    patch = diffTrees(oldTree, newTree)
    applyPatch(root, patch)
    view._lastTree = newTree
```

#### What this enables

- **O(changed) not O(full-tree):** Only the parts of the DOM that depend on changed data are updated.
- **Event listeners survive renders:** DOM nodes that didn't change keep their event listeners. No re-binding needed.
- **Focus survives renders:** Elements that weren't replaced don't lose focus.
- **Canvas survives renders:** Canvas elements in the tree that didn't change keep their context and draw state.
- **Animations aren't interrupted:** CSS transitions and animations on unchanged elements continue uninterrupted.

#### Implementation plan

```
Step 1: Add template tree generation to html()           (~80 lines)
Step 2: Add tree diffing function (templateTreeDiff)     (~100 lines)
Step 3: Add DOM patch application (applyTemplatePatch)   (~80 lines)
Step 4: Wire graph.plan() into the runner pipeline       (~50 lines)
Step 5: Add 'patch' strategy to dom-execution.js         (~50 lines)
                                                        ─────────
                                                        ~360 lines total
```

---

## Concrete Changes — Prioritized

### Phase 1: Graph Engine (v0.3.0 — alongside async metadata)

| # | Change | Location | Lines | Impact |
|---|---|---|---|---|
| G1 | Add tree operations to `createGraph()` | `core/src/graph.js` | ~200 | Graph becomes queryable |
| G2 | Add `graph.plan(stateChange)` — execution plan | `core/src/graph.js` | ~80 | Replaces blind-notify-all |
| G3 | Migrate `createLoop()` to use graph engine internally | `core/src/loop.js` | ~80 | All components benefit automatically |
| G4 | Add `graph.serialize()` / `createGraph.fromJSON()` | `core/src/graph.js` | ~60 | Graph portability |

### Phase 2: HTML System Upgrade (v0.3.0)

| # | Change | Location | Lines | Impact |
|---|---|---|---|---|
| H1 | Pass graph context to html(); dev-mode validation | `html/src/html.js` | ~40 | Catches event/state typos |
| H2 | Replace index routing with stable binding IDs | `html/src/html.js` | ~60 | Eliminates index remapping |
| H3 | Merge html() and componentTag() attribute parsing | `html/src/html.js` | ~30 | Single parser |
| H4 | Add sugar expansions (string events, :model, auto-extract) | `html/src/html.js` | ~50 | ~280 chars saved per component |
| H5 | Add template tree generation to html() output | `html/src/html.js` | ~80 | Foundation for patch strategy |

### Phase 3: Execution Breakthrough (v0.4.0)

| # | Change | Location | Lines | Impact |
|---|---|---|---|---|
| E1 | Add template tree diffing | `core/src/execution.js` | ~100 | O(changed) not O(full-tree) |
| E2 | Add DOM patch application | `html/src/dom-execution.js` | ~80 | Event listeners survive renders |
| E3 | Wire graph.plan() into runner pipeline | `core/src/execution.js` | ~50 | Graph-driven rendering |
| E4 | Add 'patch' strategy to dom-execution | `html/src/dom-execution.js` | ~50 | Replace strategy becomes opt-in |

---

## Expected Impact

### Before (current)

```
state.count changes
  → notify() all subscribers (blind)
  → view() re-renders entire template
  → innerHTML = full string (destroys all DOM)
  → postReplace: restore focus (querySelector)
  → postReplace: rebind ALL events (querySelectorAll × N bindings)
  → postReplace: rescan ALL attributes (querySelectorAll × 5 selectors)
  → postReplace: reprocess ALL virtual containers

Cost: O(full DOM tree) on every state change, regardless of what changed.
```

### After (v0.4.0 with all breakthroughs)

```
state.count changes
  → graph.plan({ count: 6 }) → { views: ['counterView'], effects: [] }
  → counterView re-renders: html`<h2>6</h2>...`
  → templateTreeDiff(oldTree, newTree) → [{ op: 'text', node: spanEl, value: '6' }]
  → applyPatch(root, [{ op: 'text', node: spanEl, value: '6' }])
  → spanEl.textContent = '6'

Cost: O(changed nodes) — 1 text node update.
```

### Competitive positioning

| | React (VDOM) | Solid (Signals) | Uploop (Graph + Template-Patch) |
|---|---|---|---|
| What changes detected? | VDOM diff post-render | Signal dependency tracking | Graph dependency indexes (pre-render) |
| Update granularity | Component subtree | Individual DOM node | Template tree node |
| Event listeners survive? | Yes (VDOM reconciliation) | Yes (DOM preservation) | Yes (patch only changes text/attrs) |
| Focus survives? | Yes | Yes | Yes |
| No build step? | No (JSX) | No (JSX + compiler) | **Yes** |
| CSP-safe? | No | No | **Yes** |
| Graph introspection? | No (component tree only) | No | **Yes** |

Uploop after these changes doesn't need to be faster than React or Solid at raw DOM operations. It needs to be **architecturally smarter** — the graph tells the runner exactly what to update, so it never does unnecessary work.

---

## Anti-Goals (What We're NOT Doing)

- **NOT building a full VDOM.** Template-patch is simpler — it diffs template trees produced by the same `html()` function, not generic createElement trees. No reconciliation algorithm. No key-based matching. No sibling reordering. Just: same structure, different values → update text/attrs.

- **NOT chasing microsecond benchmarks.** The goal is eliminating O(full-tree) work, not optimizing O(changed) work. If a state change affects 3 DOM nodes, we update 3 DOM nodes. Whether that takes 0.1ms or 0.05ms is not the concern.

- **NOT requiring a compiler.** The graph analysis and template diffing happen at runtime. No build step. No JSX transform. No ahead-of-time compilation.

- **NOT breaking the existing API.** Components still use `component()`. Stores still use `store()`. `html\`...\`` still produces templates. The graph engine and template-patch work underneath the existing surface.

---

## Future Execution Models: Breaking the Performance Barrier

The breakthroughs above make Uploop architecturally smarter (O(changed) not O(full-tree)). The next frontier is raw throughput — handling thousands of graph nodes per frame without jank. These are v0.4.0+ targets.

### v0.4.0: Graph Rapid Executor — JIT-Compiled Dataflow Paths

The general-purpose loop (createLoop) handles all node types uniformly: check guards, create envelope, execute handler, merge state, notify. This is flexible but has per-event overhead (envelope creation, Map lookups, guard checks).

For hot paths — components that update 30-120 times per second (animations, real-time data, game loops) — this overhead dominates.

The Rapid Executor pre-compiles the graph into a linear instruction sequence:

```
// Source graph (declarative):
nodes: {
  count:    { type: 'data', default: 0 },
  inc:      { type: 'update', reads: ['count'], writes: ['count'] },
  counterView: { type: 'view', reads: ['count'] }
}
edges: [['click', 'inc'], ['count', 'counterView']]

// Compiled rapid path (linear bytecode-like sequence):
RAPID_PATH_counter = [
  { op: 'read',   node: 'count',    reg: 0 },
  { op: 'call',   node: 'inc',      args: [0], out: 0 },
  { op: 'write',  node: 'count',    reg: 0 },
  { op: 'notify', node: 'counterView' }
]

// Execution on click:
rapidExec.run('RAPID_PATH_counter')
// reads count, calls inc, writes count, notifies view
// Zero Map lookups. Zero envelope creation. Zero guard checks (pre-validated at compile time).
```

When the rapid path applies:
- The graph topology is static (no dynamic node addition during execution)
- All reads/writes are known at compile time
- Update handlers are pure (no side effects, no nested send())
- Frame mode is 'visual' (requestAnimationFrame pacing)

When it falls back to the general loop:
- Dynamic edges (compose/computeParts changing the graph at runtime)
- Effects with side effects that need the full event envelope
- Nested send() chains (event A triggers event B)
- Guards that depend on runtime state

The rapid executor is a transparent optimization — the developer doesn't opt in. The graph engine detects rapid-path-eligible subgraphs at compile time and routes execution automatically.

Expected performance: For eligible components, ~3-5x reduction in per-event overhead. A counter that updates at 120fps currently spends ~0.3ms per event in loop overhead; the rapid path brings this to ~0.06ms.

---

### v0.4.0: Ring Buffer Executor — Lock-Free Streaming Data

For high-frequency data streams (WebSocket ticks, mouse/touch events, sensor data, animation frames), individual send() calls create FIFO queuing pressure. Each event waits for the previous to complete. At 1000 events/second, the queue backs up.

The Ring Buffer Executor uses a lock-free circular buffer for producer-consumer patterns:

```
Producer (event source)          Ring Buffer (fixed size)        Consumer (executor)
+------------------+           +---+---+---+---+---+           +------------------+
| WebSocket tick    |--write-->| e1| e2| e3|   |   |--drain-->| batch process     |
| mousemove handler |           |   |   |   |   |   |           | all 3 events in   |
| rAF callback      |           +---+---+---+---+---+           | one frame slice   |
+------------------+                                           +------------------+
```

How it works:
1. The ring buffer is a fixed-size SharedArrayBuffer-backed circular queue
2. Producers (event sources) write events to the buffer via atomic store — lock-free, wait-free
3. The executor drains the buffer in batches on each animation frame
4. Batched events are processed together: one state merge, one view update, one DOM patch

When it applies:
- Data nodes marked stream: true or temperature: 'hot'
- Frame mode is 'visual' (drain-on-rAF)
- Events are idempotent (only the latest value matters, e.g., mouse position)
- Or events are accumulative (all values matter, e.g., WebSocket ticks)

Configuration:
```js
state: {
  mouseX: { default: 0, stream: true, mode: 'latest' },   // only latest value
  ticks:  { default: [], stream: true, mode: 'accumulate' } // all values, batched
}
```

Expected performance: For streaming data at 1000+ events/second, eliminates per-event loop overhead entirely. Events are processed in batches of N per frame, where N is however many accumulated since the last drain.

---

### v0.5.0+: Graph BLAS in WASM — Heavy Compute Offload

BLAS (Basic Linear Algebra Subprograms) is the standard API for matrix/vector operations in scientific computing. Applied to graphs: every graph algorithm is a matrix operation.

Graph operations as linear algebra:

| Graph Operation | Matrix Equivalent | Complexity |
|---|---|---|
| Adjacency (what depends on X?) | Row lookup in adjacency matrix | O(1) |
| Transitive closure (everything X transitively depends on) | Matrix powers: A + A^2 + A^3 + ... | O(n^3) naive, O(n^2) optimized |
| Topological sort | Triangular matrix decomposition | O(n + e) |
| Critical path (longest dependency chain) | Longest path in DAG via DP on topo order | O(n + e) |
| Subgraph extraction | Submatrix selection + connected components | O(n + e) |
| Graph isomorphism / diff | Matrix similarity + spectral methods | O(n^3) worst |

For small graphs (10-50 nodes, typical component), these run fine in JS. For large graphs (1000+ nodes, full application graph), matrix operations hit JS performance limits.

The WASM Graph BLAS approach:

```
Application Graph (1000+ nodes)
        |
        v
  serialize to adjacency matrix (Float64Array)
        |
        v
  +---------------------------------+
  |  WASM Module (graph-blas.wasm)  |
  |                                  |
  |  - adjacency_multiply(A, B)     |
  |  - transitive_closure(A)        |
  |  - topological_sort(A)          |
  |  - critical_path(A, weights)    |
  |  - connected_components(A)      |
  |  - subgraph_extract(A, nodes)   |
  |  - graph_diff(A1, A2)           |
  |  - plan_execution(A, changed)   |
  |                                  |
  |  Runs in Web Worker (off main)  |
  +--------------+------------------+
                 |
                 v
  deserialize result -> execution plan
```

What this enables:

1. Full-app graph analysis in real time. Today, describe() exports a component's graph. With WASM BLAS, the entire application graph (all components + stores + routers + their interconnections) can be analyzed in a web worker without blocking the UI.

2. Architecture linting at runtime. "Component A reads data X but component B writes it — there's no explicit edge. This is an implicit dependency." WASM makes this check O(n^2) matrix operation instead of O(n^3) JS traversal.

3. Automatic bundle splitting. The graph's connected components and cut points identify independent subgraphs that can be lazy-loaded. WASM computes this in the build tool or at runtime.

4. Predictive prefetching. Transitive closure of the current route's graph tells you every data node the user might need next. Prefetch them.

5. AI model input. Feed the full application graph matrix into an AI model for architecture suggestions, optimization recommendations, or code generation.

Implementation strategy:

```
Phase 1 (v0.5.0): Port graph algorithms to WASM via Rust/C++ -> wasm-bindgen
  - Adjacency matrix construction from graph.describe()
  - Transitive closure
  - Topological sort
  - Critical path
  Target: ~50 KB .wasm file, runs in Web Worker

Phase 2 (v0.5.1): Add execution plan generation in WASM
  - graph.plan(stateChange) runs in WASM
  - Returns optimized execution order to main thread
  - Target: sub-millisecond for 1000-node graphs

Phase 3 (v0.6.0): Graph diff in WASM
  - graph.diff(oldGraph, newGraph) -> changed nodes + affected views
  - Enables hot module replacement at the graph level
  - Enables architecture-aware CI checks
```

Why BLAS specifically: The term is borrowed from numerical computing deliberately. Uploop's graph is not just nodes + edges — it's a matrix of data dependencies. Treating it as linear algebra unlocks decades of optimized algorithms from scientific computing. A 1000x1000 adjacency matrix multiplies in microseconds in WASM with SIMD. In JS, the same operation takes milliseconds and blocks the main thread.

---

## Execution Model Evolution

```
v0.3.0: General Loop         — send() -> handler -> merge -> notify all (current)
v0.3.0: Graph Engine         — graph.plan() -> selective notify (Breakthrough 1)
v0.4.0: Rapid Executor       — pre-compiled linear paths for hot components
v0.4.0: Ring Buffer          — lock-free streaming for high-frequency data
v0.4.0: Template-Patch       — O(changed) DOM updates (Breakthrough 3)
v0.5.0: WASM Graph BLAS      — matrix ops for 1000+ node graphs
v0.6.0: WASM Execution Plan  — graph.plan() in WASM, sub-ms for large graphs
```

Each layer is additive. The general loop always works. The rapid executor kicks in for eligible subgraphs. The ring buffer activates for streaming nodes. WASM BLAS handles the heavy graph analysis. The system degrades gracefully — if WASM isn't available, JS fallbacks run on the main thread.
