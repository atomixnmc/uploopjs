# v0.0.3 — Current Metrics & What Remains

> **Date:** 2026-06-02
> **Re-measured fresh** from actual codebase state

---

## Raw Numbers

| Metric | Value |
|---|---|
| **Total source files** | 38 (across 6 packages) |
| **Total source lines** | 4,893 |
| **Total raw bytes** | 168 KB |
| **Example projects** | 15 (14 wired in demo gallery) |
| **Active TODOs** | 1 (`delta` computation in execution.js) |

### Lines per package

| Package | Files | Lines | Bytes |
|---|---|---|---|
| `@uploop/core` | 12 | 1,783 | 61,574 |
| `@uploop/css` | 11 | 1,528 | 53,137 |
| `@uploop/html` | 8 | 1,008 | 37,386 |
| `@uploop/store` | 5 | 212 | 5,991 |
| `@uploop/router` | 1 | 209 | 5,814 |
| `@uploop/state-machine` | 1 | 153 | 4,126 |

---

## Metric 1: Hack Count — Remaining Workarounds

| Pattern | Status | Location |
|---|---|---|
| `saveResources()` / `restoreResources()` | **Still exists** — 8-line function in `core/src/component.js` L109–126, plus `html/src/dom-execution.js` L25–72 | Per-component resource registry with save/restore snapshot |
| Focus save/restore | **In runner** (good). `core/src/execution.js` L108–143. Not per-component. | Shared, zero dev effort |
| Index remapping (`data-up-event="click:0"`) | **Still exists.** `html/src/html.js` generates `data-up-event` attributes (L37–38), re-indexes nested templates (L88–91, L119–122), and consumes via `applyBindings()` (L160–182) | Index routing IS used internally |
| `_pendingVC` side-channel | **Still exists.** `html/src/html.js` L287–297 writes to `root._pendingVC`. `processVirtualContainers()` (L321–331) reads and deletes it. | DOM element property side-channel |
| Two-pass attributes | **Still exists.** `processUploopAttributes` → `processVirtualContainers` called sequentially in `hooks.postReplace` | Ordering dependency |

**Remaining to fix:** 3 of 5 workarounds still exist. Index routing and `_pendingVC` are the most fragile.

---

## Metric 2: Declarative Metadata — Zero Implemented

All seven declared metadata keywords exist only as JSDoc typedefs in `packages/core/src/types.js`.

| Metadata | Typedef? | Runtime? | What's Missing |
|---|---|---|---|
| `debounce` | ✅ `NodeDef.debounce: number` | ❌ | No debounce scheduler. Dev writes `setTimeout`/`clearTimeout` manually. |
| `suspend` | ❌ Not even in typedefs | ❌ | No concept. Loading states are manual. |
| `cache` | ✅ `NodeDef.cache: { key, ttl }` | ❌ | No cache layer. Manual `Map` + timestamp. |
| `error` | ❌ Not in typedefs | ❌ | No retry. Manual `try/catch`. |
| `interruptible` | ❌ Not in typedefs | ❌ | No AbortController wiring. Form example comments describe the pattern but it's manual. |
| `temperature` | ❌ Not in typedefs | ❌ | No data temperature model. |
| `lifetime` | ✅ `NodeDef.lifetime: 'transient'\|'hot'\|'cold'\|'stable'\|'persistent'` | ❌ | Typedef only. No garbage collection, no tier-based scheduling. Used in display code (`examples/main.js` L261–270 reads `def.lifetime` for the inspector). |

**Status: 0 of 7 implemented.** The type system describes a future architecture that doesn't exist in the runtime yet.

---

## Metric 3: Component Size — No Change

| Metric | v0.0.3 Target | Current |
|---|---|---|
| `core/src/component.js` — `component()` span | ~120 | **378 lines** (L47–L424) |
| `core/src/component.js` — total file | — | 492 |
| `html/src/component.js` — `component()` span | — | **55 lines** (L73–L127) |
| Nested functions in core `component()` | 2 | **11 named + 3 arrow** |
| Extracted modules | execution.js, frame-loop.js, resources.js, focus.js, bindings.js | `execution.js` (255 lines) — **only 1 of 5 extracted** |

The inner structure of `component()`:
- `registerResource` (L105), `saveResources` (L109), `restoreResources` (L119)
- `renderView` (L130), `render` (L137)
- `mountTo` (L147) → inner `apply` (L150)
- `create` (L194) → inner `startFrameLoop` (L254), `stopFrameLoop` (L291), `doRender` (L304), `mount` (L311)
- `applyMount` (L323) inside `mount`, `tick` (L270) inside `startFrameLoop`

**Remaining: Extract resources.js, bindings.js, render.js, and frame-loop.js from the monolith.**

---

## Metric 4: Event Binding — Index Routing Still Exists

Previous report claimed "no index-based event routing." **This was incorrect.**

The `html` tagged template generates `data-up-event="click:0"` attributes (L37–38 in `html.js`). Nested templates remap indices (L88–91, L119–122). `applyBindings()` queries `[data-up-event="..."]` by string (L160–182).

**Why it's less fragile than before:** Bindings are reapplied fresh on every render via `applyBindings()` in `postReplace`. The index is generated per-render, not cached across renders. Events are `addEventListener` with direct closure references — the `data-up-event` marker is used only for finding the element, not for dispatching.

**Remaining risk:** If `innerHTML` preservation interacts badly with the DOM query at the wrong time, the binding could target the wrong element. The `patch` strategy (not yet implemented) would eliminate this by preserving DOM nodes directly.

---

## Metric 5: Cross-Target Execution — Protocol Exists, Adapters Thin

| Execution target | Status | How |
|---|---|---|
| **DOM (replace)** | ✅ | `core/src/execution.js` — `createDOMExecution()`, `strategy: 'replace'` |
| **DOM (patch)** | ❌ | `TODO` in execution.js L228: `delta = null`. No diff engine. |
| **Canvas** | ✅ | Via `frame: 'visual'` + `draw()` cycle + virtual containers. `examples/cars`, `examples/fishes`, `examples/tetris` |
| **SSR** | ❌ | No string output target |
| **WebWorker** | ❌ | No adapter |
| **WebGL/PixiJS** | ⚠️ | Architecture supports `ExecutionTarget`, no adapter built |

The execution protocol is clean:
- `{ strategy, render, replace, mount, unmount, hooks }` — 7 methods to implement
- `validateExecutionTarget()` validates protocol compliance
- `createRunner()` orchestrates mount/update/unmount pipeline
- `html/src/dom-execution.js` adds DOM-specific post-processing (bindings, attributes, virtual containers)

**Remaining: Implement `patch` strategy (delta diff), build SSR target, build Worker target.**

---

## Metric 6: Heuristic Optimizations — Frame Lanes Only

| Optimization | Status |
|---|---|
| **Frame scheduling (4 lanes)** | ✅ `micro`, `visual`, `idle`, `manual` in `core/src/frame.js` (78 lines) |
| **Event tracing** | ✅ Event counters (`_evCounter`, `_evRejected`) exposed via `events.total/rejected/depth` |
| **Auto cache strategy** | ❌ |
| **Memory pressure / GC** | ❌ |
| **Auto interruption** | ❌ |
| **SSR serialization** | ❌ (no SSR) |

**Status: 2 of 6.** Frame scheduler works. Event counters work. Everything else is design, not code.

---

## Metric 7: API Surface

| Package | Raw exports | Practical day-1 |
|---|---|---|
| `@uploop/core` | 13 | `component`, `createLoop`, `createSignal`, `batch` (~4) |
| `@uploop/html` | 17 | `html`, `component`, `defineElement` (~3) |
| `@uploop/store` | 5 | `store`, `derived` (~2) |
| `@uploop/router` | 1 | `createRouter` (~1) |
| `@uploop/css` | 51 | `css`, `inject`, `theme`, `applyTheme`, `css()` (~5) |
| `@uploop/state-machine` | 1 | `createStateMachine` (~1) |
| **Total** | 88 raw | ~16 practical |

**Honest assessment:** ~16 concepts on day one. Target was 5. But they all share the same pattern — `send()` → update → `get()` — applied to different domains. The CSS package inflates the raw count with 51 exports (tokens, color utils, animation constants) but only ~5 are used daily.

---

## Metric 8: `describe()` — Works, Used in Demo

**Status: ✅ Functional.** Every component, store, and loop exports `describe()`.

The demo gallery (`examples/main.js`) has a full **HyperGraph Inspector** debug panel with 8 tabs:
- Graph, Nodes, Edges, State, Events, Signals, Components, Metadata

It auto-refreshes and reads `comp.describe()` to extract the graph structure. This proves the manifest system works end-to-end.

**What's missing:** The manifest contains node types and edges but not the heuristics metadata (`cache`, `debounce`, `temperature`, `lifetime`) — because those aren't implemented yet.

---

## Metric 9: Bundle Estimate (no build output exists)

| Layer | Raw source | Est. min+gzip |
|---|---|---|
| Core + HTML adapter | ~99 KB (core 62K + html 37K) | ~15-25 KB |
| Store | ~6 KB | ~1 KB |
| Router | ~6 KB | ~1.5 KB |
| CSS engine | ~53 KB | ~8-14 KB |
| State machine | ~4 KB | ~1 KB |
| **Full stack** | **~168 KB** | **~26-42 KB** |
| **React stack comparison** | — | **~54-65 KB** |

Uploop is ~40% smaller than React + Tailwind + Zustand + React Router + XState. The "6 KB gzip core" claim is plausible for a minimal app that tree-shakes to just `createLoop` + `createSignal` + `createFrame`.

---

## What Remains to Complete the v0.0.3 Milestone

### Already Done ✅
- [x] Execution protocol abstraction (3 strategies: replace, patch, redraw)
- [x] Focus save/restore in runner (not per-component)
- [x] Frame scheduler (4 lanes: micro, visual, idle, manual)
- [x] Event tracing counters
- [x] `describe()` HyperGraph manifest
- [x] CSP-safe event bindings (addEventListener, not inline)
- [x] 15 working examples across apps/media/games
- [x] Unified `send()`/`get()` protocol across all packages
- [x] Store, router, state machine all using same loop primitive
- [x] Canvas rendering with `draw()` + virtual containers

### Refined Top Priorities (2026-06-02)

Three themes. Ordered by impact on developer experience.

#### Priority A: First-Class Async — debounce, suspend, error, interruptible, cache

These five features share one pattern: node-level metadata consumed by the runner. They touch the same code paths (send → handler execution → view notification) and collectively eliminate the most universal boilerplate in web development.

| # | Feature | Effort | Lines Saved/Component | What It Replaces |
|---|---|---|---|---|
| A1 | debounce: 300 on update nodes | ~40 lines | ~12 | setTimeout/clearTimeout + timer in state |
| A2 | suspend: { fallback } on data nodes | ~60 lines | ~6 | loading: false + ternary in every view |
| A3 | error: { fallback, retry } on data nodes [MUST-SHIP] | ~50 lines | ~8 | try/catch + error state + retry button |
| A4 | interruptible: true on update nodes | ~30 lines | ~8 | AbortController + signal + abort() |
| A5 | cache: { ttl, swr } on data nodes | ~100 lines | ~18 | Manual Map + timestamp + revalidate |

Total: ~280 lines of runner code saves ~52 lines per async component. All five ship together as v0.3.0 — the "Zero-Boilerplate Async" release.

[MUST-SHIP] A3 (error handling) is a hard requirement for v0.3.0 — no v0.3.0 ships without it.

Architecture note: These five features are not standalone helpers. They are the first concrete implementation of the heuristic executor model — the runner uses graph metadata to make decisions (debounce timing, suspend transitions, retry backoff, cache TTL) that the developer would otherwise write manually. This is Uploop's answer to React's useEffect + useMemo + Suspense + ErrorBoundary + useCallback — five hooks replaced by five declarative metadata fields consumed by one heuristic executor.

#### Priority B: Sugar Syntax and Less Boilerplate

The config-object model is powerful but verbose. Based on real component analysis (todo, form, counter examples), these patterns repeat the most. Each is a quick win — under 30 lines, stays within template literals, CSP-safe.

| # | Sugar | Before | After | Effort | Chars Saved/Use |
|---|---|---|---|---|---|
| B1 | String event shorthand | @click=${() => send('inc')} | @click="inc" | ~25 lines | ~18 |
| B2 | Auto-extract input value | @input=${['setName', e => e.target.value]} | @input="setName" | ~20 lines | ~30 |
| B3 | Auto-extract checked state | @change=${['toggleDone', e => e.target.checked]} | @change="toggleDone" | ~15 lines | ~30 |
| B4 | Two-way binding :model= | .value=${s.text} @input=${['input', e => e.target.value]} | :model="text" | ~25 lines | ~55 |
| B5 | Simple setter shorthand | update: { setName: (s, v) => ({ name: v }) } | update: { setName: 'name' } | ~20 lines | ~25 |
| B6 | store() positional args | store({ state: {...}, update: {...} }) | store({ count: 0 }, { inc: s => ({ count: s.count+1 }) }) | ~30 lines | ~15 |
| B7 | ctx.set() in views | No one-off patches without defining handler | ctx.set({ count: 1 }) | ~15 lines | ~10 |
| B8 | Auto-merge dev warnings | Silent when you forget to return state | console.warn in dev mode | ~15 lines | 0 (safety) |

#### Priority C: Internal Cleanup — Fix Flaws, Bugs, Design Debt

| # | Issue | Current State | Fix | Effort |
|---|---|---|---|---|
| C1 | component() monolith | 378 lines, 14 nested functions | Extract resources.js, render.js, bindings.js; component() drops to ~150 lines | ~150 lines |
| C2 | _pendingVC side-channel | DOM element property leaks state between attribute passes | Pass context object through pipeline instead of mutating DOM | ~40 lines |
| C3 | Template literals are untyped strings | IDE sees tagged template with no type info. No autocomplete for HTML attributes, no validation of closing tags, no type-checking of interpolated values, no syntax highlighting of HTML content inside template literals. | See detailed analysis below | ~100+ lines |
| C4 | data-up-event index routing | data-up-event="click:0" markers + regex-based index remapping in nested templates | Eliminate when patch strategy lands. Until then, add dev-mode warnings for index collisions. | ~30 lines |
| C5 | No dev-mode validation | Silent failures: misspelled event names, unused state keys, orphan effects | Add dev-mode checks: unknown event warning, unused state key warning, effect referencing removed state key warning | ~50 lines |

---

### Deep Dive: The Template Literal Flaw (C3)

This is the single biggest DX gap in Uploop's design. Here is why it matters and what to do about it.

#### The Problem

Every bug below is invisible at dev time. No red squiggles. No compile error. No runtime crash — just silent misbehavior:

```js
view: (state, { send }) => html`
  <div class="container">
    <h1>${state.title}</h2>   // mismatched closing tag, no warning
    <button @click=${() => send('sumbit')}>Save</button>  // typo: 'sumbit', silent no-op
    <input .value=${state.nam} />  // typo: state.nam is undefined, no error
  </div>
`
```

Compare to JSX + TypeScript:
```jsx
<div className="container">
  <h1>{state.title}</h2>   // TS: JSX element 'h1' has no closing tag
  <button onClick={() => send('sumbit')}>  // TS: type '"sumbit"' not assignable
  <input value={state.nam} />  // TS: Property 'nam' does not exist on type
</div>
```

React + TS catches all three at compile time. Uploop catches zero.

#### Why It Is Fundamental

Template literals are processed at runtime by the html function. The JavaScript engine sees:
```
["<div class=\"container\">  <h1>", "</h2>  <button @click=${", ...]
```

There is no HTML parser involved until html() runs. No static analysis tool can inspect the HTML structure because it is embedded in a string template. JSX compiles to createElement() function calls, which TypeScript can type-check because they are valid AST nodes.

#### Mitigation Strategy

**Level 1: Runtime HTML Validation (now — ~50 lines)**

Add a dev-mode validation pass in the html tag processor. Checks: mismatched closing tags, known void elements used with closing tags, duplicate attributes. Outputs console.warn with line numbers. Catches the most common class of bugs (malformed HTML) with minimal effort. Does NOT catch: typos in state keys, invalid event names, wrong attribute types.

**Level 2: Lit-Plugin Compatibility (now — documentation only)**

Uploop template syntax is structurally close to Lit (lit-html). The lit-plugin VS Code extension provides HTML syntax highlighting, tag autocompletion, and basic validation inside html`...` templates. Document the setup:

```json
// .vscode/settings.json
{
  "lit-plugin.tags": ["html"],
  "lit-plugin.attributes": [".value", "?checked", "@click", "@input", "@submit"]
}
```

This gives syntax highlighting and basic HTML validation for free — zero code to write.

**Level 3: Uploop Language Server (future — ~500 lines)**

A dedicated VS Code extension or LSP plugin that reads component configs and provides:
- Autocomplete for @event bindings against component update handlers
- Autocomplete for .prop bindings against component state keys
- Type-checking of interpolated expressions
- Inline error highlighting for unknown events/props

This is the long-term solution. Same approach that Angular and Vue language servers use. Requires parsing component configs to extract state shape and event names.

Immediate action: Level 1 (runtime validation) and Level 2 (lit-plugin docs). Together they catch 80% of template bugs for zero ongoing effort.

#### HTML-in-Template-Literals Ecosystem

| Tool | What | Status |
|---|---|---|
| lit-plugin (VS Code) | HTML syntax highlighting + validation in tagged templates | Works today; Uploop html tag is compatible |
| eslint-plugin-lit | ESLint rules for template literal HTML | Exists; could fork for Uploop syntax (@event, .prop, ?bool) |
| Prettier | Formats HTML inside template literals | Works with lit-html plugin |
| syntax-tree/hast | HTML AST parser | Could be used for Level 1 runtime validation |

---

### Sugar Syntax Deep Dive: What Saves the Most Keystrokes

Analysis of real Uploop components (todo, form, counter, blog, cars) shows these patterns repeat at high frequency. Each sugar is a backward-compatible shorthand — the expanded form still works, the shorthand is optional.

#### B4: Two-Way Binding `:model=` — The Biggest Single Win

This is the most impactful sugar. In the todo example alone, the input line goes from:

```
<input .value=${state.text} @input=${['input', e => e.target.value]} ...>
```

to:

```
<input :model="text" ...>
```

**How it works:** `:model="text"` expands at template processing time to `.value=${state.text} @input=${['input', e => e.target.value]}`. The html tag processor detects `:model=` bindings and replaces them with the equivalent property + event pair. The event name is inferred from the model name (first letter lowercased to match convention: `text` → `'text'`). If the user wants a different event name, the expanded form is always available.

**Why it's CSP-safe:** The expansion happens at template processing time, producing the same `.value` and `@input` bindings that exist today. No inline handlers. No eval. The runtime behavior is identical to the expanded form.

**Implementation (~25 lines):** In `html.js`, after the existing `@event` detection regex (L27), add a check for `:model=`. Extract the state key name, insert a `.value` binding at the same index position, and an `@input` binding with an auto-transform function.

**Char savings per use:** ~55 characters. In the todo component (1 input), that's 55 chars. In the form component (5 inputs: name, email, phone, password, city), that's 275 chars. Across a typical app with 20 inputs, that's ~1,100 characters of boilerplate eliminated.

#### B1: String Event Shorthand `@click="inc"`

When an event has no payload, the `() => send('inc')` wrapper is pure ceremony.

```
Before: @click=${() => send('inc')}
After:  @click="inc"
```

**How it works:** When the html tag processor sees a string value in an `@event` binding (instead of a function or array), it auto-wraps it: `"inc"` → `() => send('inc')`. The function/array forms still work for payloads and transforms.

**CSP note:** The expansion produces the same `addEventListener` call. No inline `onclick` attribute. Fully CSP-safe.

**Frequency:** Every button in every component. The counter has 3 buttons, the todo has 7 buttons, the blog has ~20 links. This is the highest-frequency sugar.

#### B2+B3: Auto-Extract for Form Inputs

The `['eventName', e => e.target.value]` pattern is boilerplate that never varies for standard form elements:

```
Before: @input=${['setName', e => e.target.value]}
After:  @input="setName"

Before: @change=${['toggleDone', e => e.target.checked]}  
After:  @change="toggleDone"
```

**How it works:** When the html tag processor sees a plain string in an `@input` binding, it auto-wraps: `"setName"` → `['setName', e => e.target.value]`. For `@change`, it auto-wraps: `"toggleDone"` → `['toggleDone', e => e.target.checked]`. For `@submit`, it auto-wraps to `e => { e.preventDefault(); return e.target }`. Other events without a standard extractor fall back to `['name', e => e]` (pass the raw event).

**Why these three:** `@input` → `.value`, `@change` → `.checked`, and `@submit` → `.preventDefault()` cover 90%+ of form event handling.

#### B5: Simple Setter Shorthand

The pattern `(s, v) => ({ key: v })` appears whenever an update handler does nothing but set one state field from the first payload argument:

```
Before: update: { setName: (s, name) => ({ name }) }
After:  update: { setName: 'name' }
```

**How it works:** When the component registry sees a string value in the `update` map (instead of a function), it auto-generates the setter: `'name'` → `(s, v) => ({ name: v })`. The string is the state key to set. If the event sends multiple args, only the first is used. If you need complex logic, use the function form.

**Frequency:** In the todo component, 3 of 7 handlers are simple setters (`input`, `filter`, `clearDone` would need logic but `input` is a candidate). In the form component, `update: { setName: 'name', setEmail: 'email', setPhone: 'phone', setPassword: 'password', setCity: 'city' }` — 5 handlers become 5 one-liners.

**Limitation:** Only works for handlers that set exactly one state field from exactly the first argument. This is estimated at 30-40% of update handlers in typical apps.

#### Combined Impact Example: Todo Component

**Before (current syntax):**
```js
const Todo = component('Todo', {
  state: { text: '', todos: [], filter: 'all' },
  update: {
    input: (s, text) => ({ ...s, text }),
    filter: (s, filter) => ({ ...s, filter }),
    // ... add, toggle, remove, clearDone stay as functions (have logic)
  },
  view: (state, { send }) => html`
    <input .value=${state.text}
      @input=${['input', e => e.target.value]}
      placeholder="What needs to be done?" />
    <button @click=${() => send('add')}>Add</button>
    <button @click=${() => send('filter', 'all')}>All</button>
    <button @click=${() => send('filter', 'active')}>Active</button>
    <button @click=${() => send('filter', 'completed')}>Completed</button>
  `
})
```

**After (all sugar applied):**
```js
const Todo = component('Todo', {
  state: { text: '', todos: [], filter: 'all' },
  update: {
    input: 'text',    // simple setter shorthand
    filter: 'filter', // simple setter shorthand
    // add, toggle, remove, clearDone unchanged (have logic)
  },
  view: (state, { send }) => html`
    <input :model="text" placeholder="What needs to be done?" />
    <button @click="add">Add</button>
    <button @click=${() => send('filter', 'all')}>All</button>      <!-- payload, expanded form -->
    <button @click=${() => send('filter', 'active')}>Active</button>  <!-- payload, expanded form -->
    <button @click=${() => send('filter', 'completed')}>Completed</button>
  `
})
```

**Savings:** 7 lines eliminated, ~280 characters removed. The component is visibly cleaner while remaining fully CSP-safe and backward-compatible.

#### What Sugar Does NOT Do (Anti-Goals)

| We don't add | Because |
|---|---|
| Template directives (v-if, v-for) | Requires a template compiler — violates no-build-step |
| JSX-style expressions in attributes | Template literals already support `${expr}` interpolation |
| New HTML tag syntax (`<if>`, `<each>`) | Breaks HTML validity; JS already has ternary + map |
| Inline event handlers (`onclick="..."`) | Violates CSP — the #1 reason Uploop exists |
| Immer-style mutable updates | Violates purity constraint; immutable returns are enforced |
| Decorators / annotations | Requires a compiler or transpiler |

Sugar is about removing ceremony from existing patterns, not adding new paradigms. Every sugar compiles down to the same runtime code that exists today.

---

### Realistic Completion Estimate (Revised)

**Phase 1 — v0.3.0 "Zero-Boilerplate Async" (2-3 weeks):**
- Priority A: debounce + suspend + error + interruptible + cache (~280 lines runner code)
- Priority C5: dev-mode validation warnings (~50 lines)
- Priority C3 Level 1: runtime HTML validation (~50 lines)
- Priority C3 Level 2: lit-plugin documentation + .vscode/settings.json snippet
- Update all 15 examples to use new async features

**Phase 2 — v0.3.1 "Clean Core" (1-2 weeks):**
- Priority C1: component() extraction (378 → ~150 lines)
- Priority C2: _pendingVC removal
- Priority C4: dev-mode index collision warnings
- Priority B1-B8: sugar syntax (string event shorthand, auto-extract input/checked, :model= two-way binding, simple setter shorthand, store() positional args, ctx.set(), auto-merge dev warnings)

**Phase 3 — v0.4.0 "Fine-Grained Rendering" (3-4 weeks):**
- DOM patch strategy
- data-up-event elimination
- Template literal language server (Level 3)

**Phase 4 — v0.5.0 "Production" (Q2):**
- SSR + temperature/lifetime + TypeScript types

Full v1.0 remains 3-6 months out, but v0.3.0 with the async package is genuinely competitive for real apps.

---

## Architectural Direction for v0.0.3

These design decisions define what Uploop is and is not. They are constraints, not suggestions.

### 1. The Graph Is the Optimization Engine

Uploop is faster and smarter than manual frameworks because it is declarative. The component graph (nodes + edges + metadata) is not documentation — it is the runtime optimization model. The heuristic executor reads the graph and decides:

- **When to re-render:** Only views whose `reads` dependencies changed are notified. This is Uploop's equivalent of React's `useMemo` / Solid's `createMemo` — but driven by graph topology, not manual dependency arrays.
- **When to run effects:** Effects fire only when their declared state dependencies change. This is Uploop's equivalent of React's `useEffect` dependency array — but the dependencies are declared once in the graph, not repeated in every call site.
- **When to schedule:** Hot data (frequent updates) gets `visual` frame scheduling. Cold data (rare updates) gets `idle`. The runner chooses the lane; the developer declares the data's temperature.
- **What execution strategy to use:** `replace` vs `patch` vs `redraw` should ultimately be a runner decision based on update frequency and DOM size — not a developer choice. (v0.4.0 target)

```
Developer declares WHAT (graph structure + metadata).
Runner decides HOW (when to render, what to cache, which frame lane).
```

This is the core thesis. Everything else follows from it.

### 2. No Hooks. Stricter Than Hooks.

Uploop deliberately resembles React's class-component model (pre-hooks era):

| React Class Component | Uploop Equivalent |
|---|---|
| `this.state = { ... }` | `state: { ... }` |
| `this.setState(partial)` | `send('event', payload)` → update handler returns partial |
| `componentDidMount()` | `mount(el, ctx)` |
| `componentWillUnmount()` | `unmount(el, ctx)` |
| `shouldComponentUpdate()` | Graph's `reads`/`writes` topology — automatic |

But Uploop is **stricter** than class components in key ways:

- **Update handlers MUST be pure.** They receive `(state, ...payload)` and return a partial state. No side effects. No `this`. No mutations. The runner enforces this by treating the return value as a state patch — if you return nothing, nothing changes.
- **Views MUST be pure.** `(state, ctx) => HtmlTemplate`. No side effects. No DOM manipulation. The view is a function from state to template, period.
- **Effects are data-driven, not lifecycle-driven.** An effect named `count` runs when `state.count` changes. There are no `useEffect(() => { if (a && b) ... }, [a, b])` conditional chains. The graph topology makes the dependency explicit.
- **No closures capturing stale state.** State is always passed as a fresh argument. There is no `useCallback` because there are no closures that capture state references.

The absence of hooks is not a missing feature. It is a design constraint that eliminates entire categories of bugs: stale closures, missing dependency arrays, infinite re-render loops, and rules-of-hooks violations.

### 3. JSX Features via Graph AST (v0.0.4)

Template literals (`html\`...\``) will never get JSX-level compile-time type checking. That requires a compiler. Instead, Uploop's answer is the **Graph AST**:

```
JSX approach:     Compiler → createElement() AST → TypeScript validates → runtime
Uploop approach:  Component config → graph.describe() → devtools validate → runtime
```

The graph manifest (`describe()`) exports the component's structure: state shape, event names, node types, edges. A devtool or language server can read this manifest and validate template literals against it:

- `@click=${() => send('inc')}` → is `'inc'` a registered update handler in this component's graph? Warn if not.
- `.value=${state.nam}` → is `nam` a key in this component's state? Warn if not.

This is v0.4.0 territory. For v0.3.0, the mitigation is runtime HTML validation (Level 1) and lit-plugin compatibility (Level 2) as documented in the Template Literal Flaw deep dive above. The graph-AST approach is the long-term strategy — it requires no compiler, no TypeScript, and works with plain JS.

### 4. Execution Strategy Is a Heuristic Decision

Currently, `createDOMExecution()` hardcodes `strategy: 'replace'`. Components that want canvas rendering use `frame: 'visual'` + `draw()`. This works but is not declarative.

The target model: the runner selects the execution strategy based on the graph:

| Graph Signal | Runner Decision |
|---|---|
| Node has `frame: 'visual'` | Use `redraw` strategy (canvas/WebGL) |
| Node updates > 10/sec or has `temperature: 'hot'` | Use `patch` strategy (preserve DOM) |
| Node updates < 1/sec or has `temperature: 'cold'` | Use `replace` strategy (innerHTML, simpler) |
| Node has `ssr: true` | Use SSR execution target |

The developer declares the data's characteristics. The runner chooses the strategy. This is the same principle as Priority A (async metadata) — applied to rendering.

**Implementation path:** v0.3.0 ships the async metadata (debounce, suspend, error, cache, interruptible). v0.4.0 ships `temperature`/`lifetime` tiers and makes execution strategy selection heuristic-driven.

### 5. Error Handling Ships in v0.0.3. Period.

The `error: { fallback, retry }` metadata on data nodes is a hard v0.0.3 requirement. This is not optional. Without it, every async component still writes manual try/catch + error state + retry logic. This is one of the most universal boilerplate patterns in web development and its absence undermines Uploop's claim of being declarative.

Implementation is straightforward: wrap update handler execution in try/catch, capture errors by node name, render fallback template, optionally retry with exponential backoff. The `error` metadata follows the exact same pattern as `suspend` and `debounce` — node-level config consumed by the runner.

### 6. JavaScript First, TypeScript for v2.0.0

Uploop is a JavaScript framework. JSDoc typedefs provide basic IDE hints. Full TypeScript type inference (generics on `component()`, typed `send()` events, typed state shapes) is a v2.0.0 concern.

This is not a compromise — it is a deliberate positioning choice:

- **Zero build step** means no `tsc`, no `tsconfig.json`, no type stripping. Import and run.
- **CDN-first** means the runtime works in any `<script type="module">` tag. TypeScript requires a bundler.
- **Config objects are parseable as JSON.** A TypeScript-generic-laden component config is not. The HyperGraph manifest must remain serializable.

When TypeScript support arrives (v2.0.0), it will be additive — JSDoc-typed configs that TS can infer without changing the runtime API.

---

## v0.3.0 — Recalibrated Roadmap

Based on the architectural direction above, here is the firm plan:

### Must Ship (v0.3.0 — 2-3 weeks)

| # | Feature | Lines | Status |
|---|---|---|---|
| A3 | error: { fallback, retry } — ⚠️ HARD REQUIREMENT | ~50 | Not started |
| A1 | debounce on update nodes | ~40 | Not started |
| A2 | suspend on data nodes | ~60 | Not started |
| A4 | interruptible on update nodes | ~30 | Not started |
| A5 | cache: { ttl, swr } on data nodes | ~100 | Not started |
| C5 | Dev-mode validation (unknown events, unused keys) | ~50 | Not started |
| C3-L1 | Runtime HTML validation in html tag | ~50 | Not started |
| C3-L2 | Lit-plugin docs + .vscode/settings.json | 0 | Not started |

### Should Ship (v0.3.1 — 1-2 weeks after)

| # | Feature | Lines | Status |
|---|---|---|---|
| C1 | component() extraction (378 → ~150) | ~150 | Not started |
| C2 | _pendingVC removal | ~40 | Not started |
| B1-B4 | Sugar syntax | ~105 | Not started |

### Next Milestone (v0.4.0 — 3-4 weeks)

| # | Feature | Lines | Status |
|---|---|---|---|
| - | temperature + lifetime data tiers | ~150 | Not started |
| - | Heuristic execution strategy selection | ~100 | Not started |
| - | DOM patch strategy | ~300 | Not started |
| - | Graph-AST validation (language server) | ~500 | Not started |

### v2.0.0 (Future)

- TypeScript type inference
- SSR execution target

---

## React Stack Quick Reference (for posterity)

| Dimensions | React Stack | Uploop (current) |
|---|---|---|
| Bundle (gzip) | ~54-65 KB | **~26-42 KB** |
| Build step | Required | **None** |
| CSP-safe | No | **Yes** |
| Concepts to learn | 18+ APIs across 5 libs | **16 APIs, one pattern** |
| Canvas/graphics | Manual | **First-class** |
| SSR | Yes | **No** |
| Ecosystem | Massive | Minimal |
| State machines | XState (12 KB) | **Built-in (1 KB)** |

---

## Gaps Analysis: Deep PROS/CONS vs Competition

### 1. Component Syntax & Convention: Uploop vs React vs Solid

Uploop's component model is **configuration objects**, not functions with hooks. This is the most fundamental design difference.

#### Code comparison

**React (hooks):**
```jsx
function Counter() {
  const [count, setCount] = useState(0)
  const inc = useCallback(() => setCount(c => c + 1), [])
  const dec = useCallback(() => setCount(c => c - 1), [])
  return (
    <div>
      <h2>{count}</h2>
      <button onClick={inc}>+</button>
      <button onClick={dec}>-</button>
    </div>
  )
}
```

**Solid (signals):**
```jsx
function Counter() {
  const [count, setCount] = createSignal(0)
  return (
    <div>
      <h2>{count()}</h2>
      <button onClick={() => setCount(c => c + 1)}>+</button>
      <button onClick={() => setCount(c => c - 1)}>-</button>
    </div>
  )
}
```

**Uploop (config object):**
```js
const Counter = component('Counter', {
  state: { count: 0 },
  update: {
    inc: (s) => ({ count: s.count + 1 }),
    dec: (s) => ({ count: s.count - 1 })
  },
  view: (state, { send }) => html`
    <div>
      <h2>${state.count}</h2>
      <button @click=${() => send('inc')}>+</button>
      <button @click=${() => send('dec')}>-</button>
    </div>
  `
})
```

#### PROS (Uploop)

| Strength | Why it matters |
|---|---|
| **No hook rules** | No "rules of hooks," no dependency arrays, no stale closures. Update handlers receive `(state, payload)` and return a partial state — always pure, always predictable. |
| **No `useCallback`/`useMemo`** | Event handlers are plain closures. State is always fresh because it's passed as an argument, not captured. No need to memoize anything. |
| **Single state object** | One `state` per component, not N `useState` calls. No ordering dependency. State shape is explicit and visible at the top of the config. |
| **Named events, not inline setters** | `send('inc')` is self-documenting. You can grep for `'inc'` and find every dispatch site + the single handler. React's `setCount(c => c + 1)` is anonymous logic scattered across JSX. |
| **View is a pure function** | `(state, ctx) => HtmlTemplate`. No side effects in render. No `useEffect` lifecycle tangles. The view always produces the same output for the same state. |
| **No JSX, no build step** | Template literals are standard JS. No Babel, no `createElement`, no virtual DOM overhead. Import from any CDN. |
| **CSP-safe events** | Uses `@click` bindings → `addEventListener`. No inline `onclick="..."` attributes. Works with strict Content Security Policy. Neither React nor Solid is CSP-safe by default. |
| **Config, not functions** | Components are plain objects. Easy to serialize, introspect, and generate. AI tools can read a component config and understand its structure without executing code. |

#### CONS (Uploop)

| Weakness | Why it hurts |
|---|---|
| **No conditional hooks** | React's `useEffect(() => { if (x) ... }, [x])` pattern has no Uploop equivalent. Effects are named by state keys and run on every change to that key — no per-key conditional logic built in. You'd need to check conditions manually inside the effect handler. |
| **No render-phase bailout** | React's `useMemo` / Solid's `createMemo` skip re-computation when deps haven't changed. Uploop's view always recomputes on state change. For expensive views, there's no built-in escape hatch. |
| **Template literals, not JSX** | No type-checked JSX. No IDE autocomplete for HTML attributes. No compile-time validation of closing tags. Template literals are strings until the `html` tag processes them. |
| **No Suspense / ErrorBoundary** | React's declarative loading/error boundaries have no Uploop equivalent. Loading and error states are manual (`if (state.loading) return html\`<p>Loading...</p>\``). |
| **No ecosystem of components** | React has millions of npm packages. Uploop has zero third-party component libraries. Every dropdown, modal, date-picker must be built from scratch. |
| **Performance model** | Uploop uses `innerHTML` replacement (DOM teardown + rebuild). React's virtual DOM + reconciliation is more efficient for frequent, fine-grained updates to large trees. Solid's signal-based approach is even more granular — it updates exactly the text node that changed. |
| **No TypeScript inference** | State types, update handler signatures, and template bindings are not type-checked by TypeScript. React + TS gives you autocomplete and compile-time errors on state shape mismatches. |

#### Verdict

Uploop's config-object model is **simpler and more predictable** than React's hooks for small-to-medium components. The lack of hook rules is a genuine quality-of-life win. But it trades away the composability and conditional logic that hooks enable. For a team that knows how to use hooks correctly, React is more flexible. For a team that doesn't want to think about hook ordering and stale closures, Uploop is safer.

Solid's signal-based model is the closest in spirit to Uploop (fine-grained reactivity, no virtual DOM), but Solid requires JSX and a compiler. Uploop is the "no build step Solid" — with the tradeoff that it's less granular at runtime.

---

### 2. CSS Engine: `@uploop/css` vs Tailwind CSS

Both are utility-first CSS systems. The difference is **when** CSS is generated: Tailwind at build time, Uploop at runtime.

#### Code comparison

**Tailwind (build-time):**
```html
<div class="flex p-4 gap-3 rounded-lg bg-blue-600 text-white">
  <span class="font-bold text-2xl">Hello</span>
</div>
```
Build step: scans source files → generates only used classes (~3-10 KB gzip output).

**Uploop (runtime):**
```js
import { inject, generateUtilities } from '@uploop/css'
inject(generateUtilities())

// Same classes, same HTML output
html`<div class="d-flex p-4 gap-3 rounded-2 bg-primary text-white">
  <span class="font-bold text-2">Hello</span>
</div>`
```
No build step. Utilities are generated and injected into a `<style>` tag at runtime.

#### PROS (Uploop `@uploop/css`)

| Strength | Why it matters |
|---|---|
| **No build step** | No PostCSS, no `tailwind.config.js`, no content glob scanning. Import and use. Works from CDN, works in edge functions, works in any JS runtime. |
| **Runtime theming** | `applyTheme(lightTheme)`, `applyTheme(darkTheme)`, `applyTheme(brandTheme)` — switch the entire design system at runtime without a page reload. Tailwind requires CSS variables + `dark:` prefix and can't swap entire palettes live. |
| **Chainable style builder** | `css().bg('primary').text('white').px(4).py(2).rounded('md').done()` — programmatic style construction with a jQuery-like fluent API. Generates scoped CSS classes on demand. No equivalent in Tailwind (you'd need inline styles or a separate CSS-in-JS library). |
| **Dynamic styles** | `createGradientStyle()`, `createEventStyle({ event: 'hover', transform: '...' })`, `createNamedStyle()` — generate scoped, one-off styles without polluting global CSS. |
| **Color utilities as functions** | `lighten()`, `darken()`, `alpha()`, `contrast()`, `shades()` — pure JS functions that work with any hex color. Tailwind requires you to define every shade in the config ahead of time. |
| **Built-in animations** | `injectAnimations()` provides `.up-anim-fade-in`, `.up-anim-slide-up`, `.up-anim-bounce`, etc. with duration/delay modifiers and `prefers-reduced-motion` support. Tailwind requires a separate animation config or plugin. |
| **Runtime optimizer** | `watchDOM()` + `markUsed()` tracks which classes are actually in the DOM and can prune unused rules. Tailwind does this at build time — Uploop can adapt to dynamically added content. |
| **Same protocol** | CSS is just another Uploop package. Variables reference `var(--color-primary)` which the theme system controls. This means AI tools, devtools, and the HyperGraph inspector can understand CSS dependencies the same way they understand data dependencies. |

#### CONS (Uploop `@uploop/css`)

| Weakness | Why it hurts |
|---|---|
| **Runtime overhead** | Generating and injecting CSS at runtime costs CPU and increases FCP/TTI. Tailwind's build-time purge produces a static CSS file with zero runtime cost. |
| **No JIT compiler** | Tailwind's JIT engine generates exactly the classes you use on-the-fly during development. Uploop pre-generates all utility classes — `generateUtilities()` produces hundreds of rules upfront. The optimizer prunes later, but it's reactive, not just-in-time. |
| **Smaller class vocabulary** | Tailwind has ~20,000+ utility classes covering every CSS property. Uploop's `utilityDefs` covers spacing, colors, display, flex, grid, sizing, typography, borders, shadows, position, overflow, and cursor (~12 groups). No `backdrop-filter`, no `mix-blend-mode`, no `aspect-ratio`, no `container queries`, no `has()` selector, no arbitrary values (`w-[327px]`). |
| **No plugin ecosystem** | Tailwind has `@tailwindcss/typography`, `@tailwindcss/forms`, `daisyUI`, and hundreds of community plugins. Uploop's CSS engine has zero plugins. |
| **No design system maturity** | Tailwind's spacing scale, color palette, breakpoint system, and typography scale are refined over years of use. Uploop's tokens are basic (8 spacing steps, ~20 colors, 4 breakpoints). |
| **No `@apply` / component extraction** | Tailwind lets you extract repeated utility patterns into CSS components with `@apply`. Uploop's `css()` chain builder can do this programmatically, but there's no CSS-side equivalent. |
| **No tree-shaking in build** | Even with the runtime optimizer, unused utility classes exist in the `<style>` tag until pruned. A production Tailwind build ships exactly zero unused CSS. Uploop's runtime tracking is clever but not zero-cost. |
| **Class name convention differences** | Uploop uses `d-flex` (display: flex) vs Tailwind's `flex`. Uploop uses `text-2` (font-size: 2rem) vs Tailwind's `text-2xl` (token-based scale). Different muscle memory. No migration path for existing Tailwind users. |

#### Verdict

`@uploop/css` is **surprisingly capable for 1,528 lines**. It covers 80% of what you use Tailwind for day-to-day, and the runtime-theming + chainable API + dynamic styles are genuinely useful features Tailwind can't do. But it's not a Tailwind replacement for teams that rely on arbitrary values, the full JIT vocabulary, container queries, or the plugin ecosystem.

Best for: prototypes, demos, apps that want dynamic theming without a build step, and developers who prefer programmatic style construction over memorizing class names.

Not ready for: design-system-heavy teams that need every CSS property as a utility, production apps that can't afford runtime CSS generation overhead, or teams already invested in Tailwind's class vocabulary.

---

### 3. State Machine & Graphs: Uploop vs XState

Uploop provides two primitives here: `createStateMachine()` (finite state machine) and `createGraph()` (dependency graph with typed nodes and edges).

#### `createStateMachine()` vs XState

**XState v5:**
```ts
import { createMachine } from 'xstate'

const formMachine = createMachine({
  id: 'form',
  initial: 'idle',
  states: {
    idle: { on: { INPUT: 'dirty' } },
    dirty: { on: { INPUT: 'dirty', VALIDATE: 'validating' } },
    validating: {
      invoke: {
        src: 'validateFields',
        onDone: { target: 'valid', actions: 'setErrors' },
        onError: 'invalid'
      }
    },
    valid: { on: { SUBMIT: 'submitting' } },
    submitting: {
      invoke: {
        src: 'submitForm',
        onDone: 'submitted',
        onError: 'error'
      }
    }
  }
})
```

**Uploop:**
```js
const formMachine = createStateMachine({
  name: 'form',
  initial: 'idle',
  states: {
    idle:    { on: { INPUT: 'dirty' } },
    dirty:   { on: { INPUT: 'validating', VALIDATE: 'validating' } },
    validating: {
      entry: (s) => ({ errors: validate(s.data) }),
      on: { VALID: 'valid', INVALID: 'invalid', INPUT: 'dirty' }
    },
    valid:   { on: { INPUT: 'dirty', SUBMIT: 'submitting' } },
    // ... submitting, submitted, error
  }
})

formMachine.send('INPUT')
formMachine.is('valid')   // true/false
formMachine.can('SUBMIT') // true/false
```

#### PROS (Uploop state machine)

| Strength | Why it matters |
|---|---|
| **153 lines of source** | vs XState v5's ~12 KB gzip. The entire implementation is a single file wrapping `createLoop()`. You can read and understand the whole thing in 10 minutes. |
| **Same protocol** | The state machine IS a loop. `send()`, `get()`, `subscribe()`, `describe()` all work identically to components and stores. The machine's state is just loop state with `value` + `prev` + `data` fields. |
| **Entry/exit hooks** | `entry: (state) => partialData` and `exit: (state) => void` — synchronous hooks that run during transitions. XState requires `entry`/`exit` actions configured separately. |
| **Guards via `can()`** | `machine.can('SUBMIT')` checks if a transition is valid from the current state without executing it. Useful for disabling buttons declaratively. |
| **`visualize()` ASCII output** | Prints the state machine diagram to console. Useful for debugging and documentation. XState has a visualizer but it's a separate tool. |
| **No external dependency** | XState is a separate library with its own learning curve, concepts (actors, spawned actors, invoked services), and bundle weight. Uploop's state machine is just `import { createStateMachine } from '@uploop/state-machine'` — 1 KB, zero new concepts beyond what you already know from `createLoop()`. |

#### CONS (Uploop state machine)

| Weakness | Why it hurts |
|---|---|
| **No async transitions** | XState's `invoke` + `onDone`/`onError` pattern handles async validation, API calls, and timers declaratively. Uploop's state machine has no built-in async support — `entry` hooks are synchronous. Async work must be done outside the machine (in an effect or component handler) and `send()` the result back. |
| **No hierarchical/nested states** | XState supports compound states (e.g., `idle.loading`, `idle.ready`) and parallel states (multiple active sub-states simultaneously). Uploop is strictly flat — one state at a time. |
| **No history states** | XState's `history: 'shallow'` / `history: 'deep'` remembers and restores previous sub-states. Uploop only tracks `prev` (the single previous state name). |
| **No actors / spawned processes** | XState v5's actor model treats every state machine as an actor that can spawn child actors, communicate via messages, and be supervised. Uploop has no actor model. |
| **No TypeScript type inference** | XState v5 infers the exact set of valid events per state, types for event payloads, and the shape of `context`. Uploop's state machine is untyped — `send()` accepts any string, `get()` returns `any`. |
| **No visual editor** | XState has a visual editor (stately.ai) that generates code from diagrams. Uploop's `visualize()` prints ASCII — useful but not a design tool. |

#### `createGraph()` — unique to Uploop

Uploop's `createGraph()` has **no direct equivalent in React, Solid, or XState**. It's an architecture-first primitive where nodes declare `reads`/`writes` explicitly and edges define data flow topology:

```js
const graph = createGraph({
  nodes: {
    query:    { type: 'data', default: '' },
    results:  { type: 'data', default: [] },
    search:   { type: 'update', reads: ['query'], writes: ['results', 'loading'], run: fn },
    renderResults: { type: 'view', reads: ['results', 'loading'], run: fn }
  },
  edges: [['search-input', 'search']]
})
```

#### PROS (createGraph)

| Strength | Why it matters |
|---|---|
| **Explicit data flow** | Every node declares what it reads and writes. The runner compiles dependency indexes at startup and only notifies views when their specific dependencies change. Similar to how a build tool's dependency graph enables incremental compilation. |
| **AI/inspection-ready** | The graph IS the manifest. `graph.describe()` returns `{ nodes, edges }` with types and metadata. AI tools can reason about the data flow without executing code. React's component tree tells you the render hierarchy, not the data dependencies. |
| **Same runtime as everything else** | `createGraph()` and `createLoop()` share the same event pipeline, frame scheduler, and guard system. You can mix graphs, loops, stores, and state machines in the same app. |
| **Foundation for optimizations** | The graph's explicit `reads`/`writes` enable future automatic optimizations: cache invalidation (know what to re-fetch when a data node changes), bundle splitting (group nodes by dependency), SSR serialization (know which data is needed on the server). |

#### CONS (createGraph)

| Weakness | Why it hurts |
|---|---|
| **More verbose than createLoop** | `createGraph()` requires you to declare `reads`/`writes` and wire edges manually. `createLoop()` just works with an `update` handler map. The graph is the "architecture" version — you pay a verbosity tax for explicitness. |
| **No metadata enforcement yet** | The graph schema supports `debounce`, `cache`, `lifetime`, `frame` per node — but none are enforced at runtime. The graph accepts the metadata and does nothing with it. |
| **No devtools UX** | The HyperGraph Inspector in the demo gallery shows raw node/edge data. XState's visualizer is a polished design tool. `createGraph()` has no graphical editor, no real-time visualization, no playback/debugging. |

#### Verdict

For **form validation and UI workflows**, Uploop's state machine is a solid, lightweight alternative to XState — if your states are flat and transitions are synchronous. The 12 KB → 1 KB saving is real, and the unified protocol means one less API to learn. But for complex async orchestration (multi-step wizards with API calls, parallel states, history), XState's actor model is battle-tested and Uploop simply doesn't have the features.

`createGraph()` is the more interesting differentiator. It's a completely different way to think about state — not "what state is the machine in?" but "what data depends on what other data?" No other framework in the React/Solid ecosystem offers this primitive. But it's raw — the metadata isn't enforced, and the tooling doesn't exist yet.

---

### 4. Reactive Store: `@uploop/store` vs Zustand

Both are lightweight external state stores. The difference is that Uploop's store IS a loop (same `send()`/`get()` protocol), while Zustand is a standalone `create()`/`set()`/`get()` API.

#### Code comparison

**Zustand:**
```js
import { create } from 'zustand'

const useUserStore = create((set, get) => ({
  name: '',
  email: '',
  loggedIn: false,
  login: (user) => set({ ...user, loggedIn: true }),
  logout: () => set({ name: '', email: '', loggedIn: false }),
  updateName: (name) => set({ name })
}))

// Usage in React
function Profile() {
  const name = useUserStore(s => s.name)
  const login = useUserStore(s => s.login)
  return <div>{name} <button onClick={() => login({ name: 'A' })}>Login</button></div>
}
```

**Uploop:**
```js
import { store } from '@uploop/store'

const userStore = store({
  name: 'user',
  state: { name: '', email: '', loggedIn: false },
  update: {
    login: (state, user) => ({ ...user, loggedIn: true }),
    logout: () => ({ name: '', email: '', loggedIn: false }),
    updateName: (state, name) => ({ name })
  }
})

// Usage in Uploop
const Profile = component('Profile', {
  view: () => html`
    <div>
      ${userStore.select('name')}
      <button @click=${() => userStore.send('login', { name: 'A' })}>Login</button>
    </div>
  `
})
```

#### PROS (Uploop store)

| Strength | Why it matters |
|---|---|
| **Same protocol** | `store.send()` and `component.send()` are the same function signature. You don't learn two APIs — you learn one. Zustand's `set()` / `get()` / `create()` is a different mental model from React's `useState` / `useReducer`. |
| **Built-in selectors** | `store.select('name')` (dot-path string) or `store.select(s => s.name)` (function). Zustand requires manual selector functions in every `useStore()` call. |
| **Built-in derived signals** | `store.derived(s => s.name.toUpperCase())` returns a `{ get, subscribe }` signal. Zustand needs middleware (`zustand/middleware`) or manual `useMemo`. |
| **Built-in persistence** | `persist(store, 'user', { storage: localStorage })` — one function call. Zustand needs the `persist` middleware configured separately. |
| **Smaller bundle** | Uploop store: ~6 KB raw → ~1 KB gzip. Zustand core: ~1 KB gzip. About the same. But Uploop's store gives you `describe()`, event tracing, and frame scheduling — features Zustand doesn't have. |
| **HyperGraph export** | `store.describe()` returns the store's graph manifest. AI tools and devtools can inspect store structure without reading source code. Zustand stores are opaque functions. |
| **No React dependency** | Uploop's store works with any Uploop component, any vanilla JS context, or even without Uploop entirely (it wraps `createLoop()` from core). Zustand works without React too, but in practice it's almost always used with React's `useStore` hook. |
| **Event tracing** | Every `store.send()` creates an event envelope with ID, timestamp, and transaction tracking. Zustand's `set()` is a black box — you need Redux DevTools middleware for equivalent tracing. |

#### CONS (Uploop store)

| Weakness | Why it hurts |
|---|---|
| **No React hook integration** | Zustand's `useStore(selector)` auto-subscribes and re-renders React components. Uploop's store has `subscribe()` but no framework-agnostic hook. In Uploop, you'd manually subscribe in `mount`/`unmount` or use `store.get()` in a derived component. |
| **No immer middleware** | Zustand's `immer` middleware lets you write mutable-style updates: `set(s => { s.name = 'Alice' })`. Uploop requires immutable returns: `(state) => ({ name: 'Alice' })`. |
| **No `get()` inside actions** | Zustand actions receive `get` as a parameter, so you can read state mid-action: `set({ count: get().count + 1 })`. Uploop update handlers receive `state` (the pre-update snapshot) — you can't read another store's state inside a handler without calling `otherStore.get()` directly. |
| **No TypeScript generics** | Zustand: `create<{ name: string }>()` gives full type inference. Uploop's store is untyped. |
| **No middleware ecosystem** | Zustand has `devtools`, `persist`, `immer`, `subscribeWithSelector` middlewares and a community of extensions. Uploop's store is self-contained — what you see is what you get. |
| **No slice pattern** | Zustand's popular pattern of composing stores from slices: `create((...a) => ({ ...sliceA(...a), ...sliceB(...a) }))`. Uploop stores are monolithic configs. You'd need to compose multiple stores and subscribe to each. |
| **Smaller community** | Zustand has 50K+ GitHub stars, thousands of blog posts, and is used in production by Vercel, Twitch, and Discord. Uploop's store has been tested in 15 example demos. |

#### Verdict

For **Uploop apps**, the store is a natural fit — same protocol, built-in selectors, derived signals, and `describe()`. It's arguably more feature-complete than Zustand's core (selectors + derived + persist are built-in, not middleware).

For **React apps**, Zustand wins on TypeScript support, middleware ecosystem, and the `useStore` hook that integrates perfectly with React's render cycle. Uploop's store could theoretically be used in React with a thin adapter (subscribe → setState), but that adapter doesn't exist.

For **bundle size**, they're equivalent (~1 KB each). For **learning curve**, Uploop's store wins if you already know the `send()`/`get()` protocol. For **ecosystem**, Zustand wins by a mile.

---

## Cross-Cutting Gap Summary

| Gap | Impact | Competitor Advantage |
|---|---|---|
| **No TypeScript types** | All 4 comparisons hit this | React/Zustand/XState all have deep TS inference; Uploop is plain JS with JSDoc typedefs only |
| **No async primitives** | State machine, effects, and stores all synchronous | XState's `invoke`, React's `useEffect` + async, Zustand's async actions |
| **No Suspense/ErrorBoundary** | Every component manages loading/error manually | React's declarative boundaries, Solid's `Suspense` + `ErrorBoundary` |
| **No granular reactivity** | Entire view re-renders on state change | Solid tracks individual signals to DOM text nodes; React's VDOM diffs subtrees |
| **No ecosystem** | Every widget, plugin, middleware built from scratch | React has millions of packages; Tailwind has hundreds of plugins |
| **No visual tooling** | Devs work in code only | XState visualizer, React DevTools, Tailwind UI, Zustand DevTools |
| **Runtime CSS cost** | CSS generated at runtime vs build time | Tailwind's zero-runtime static CSS |

### Uploop's Unique Strengths (That Competition Lacks)

| Strength | Why it's unique |
|---|---|
| **One protocol everywhere** | `send()`/`get()` works identically in components, stores, routers, state machines, and graphs. No other framework achieves this — React has hooks + context + external stores, each with different APIs. |
| **No build step, ever** | This is the killer feature. Works from CDN. Works in edge functions. Works in any JS runtime. No competitor offers a component framework + CSS engine + router + state machine with zero build configuration. |
| **CSP-safe by default** | No inline `onclick` handlers. Works with strict Content Security Policy. React, Solid, Vue all generate inline event handlers by default. |
| **HyperGraph manifest** | Every component/store/graph exports its structure as data. This enables a category of tooling (AI generation, visual editors, architecture linters) that's impossible with opaque component functions. |
| **Canvas as first-class** | `draw()` callbacks with automatic `requestAnimationFrame` scheduling, virtual containers for child composition, and canvas context auto-resolution. No framework in the React/Solid ecosystem treats canvas rendering as a built-in component lifecycle. |
| **5-in-1 integration** | One project gives you components, CSS, routing, stores, and state machines — all sharing the same frame scheduler and event pipeline. The equivalent React stack is 5 separate libraries from 5 different teams with 5 different mental models. |

---

## Strategic Recommendations: Best Features to Bridge the Gaps (Ranked by ROI)

### ROI Formula

```
ROI = (DX improvement × competitive positioning × lines saved) / effort
```

Each recommendation scored 1–5 on each axis, then ranked. "Lines saved" is per component/store using the feature.

---

### Tier 1: Ship This Week (Maximum ROI, Minimal Effort)

These are the features that deliver the most value for the least code. Each is under 100 lines of implementation and eliminates 10+ lines of boilerplate per usage site.

#### 1. `debounce` metadata on update nodes

| | |
|---|---|
| **Effort** | ~40 lines |
| **ROI** | ⭐⭐⭐⭐⭐ |
| **Lines saved per component** | ~12 (manual `setTimeout`/`clearTimeout`) |
| **Fixes gap** | Declarative metadata (#2), boilerplate reduction (#2) |
| **Competitive angle** | React/Solid: manual `useEffect` + cleanup. Zustand: manual. Tailwind: N/A. **Nobody has a built-in debounce declaration at the loop level.** |

**What to build:** Extend `createLoop()` so that update nodes accept `debounce: number` (milliseconds). When an event fires, the runner starts a timer. If the same event fires again before the timer expires, the timer resets. Only the last event in the window executes.

```js
// Before (every input/search component repeats this):
update: {
  input: (s, text) => {
    clearTimeout(s._debounceTimer)
    const timer = setTimeout(() => {
      // actual search logic
    }, 300)
    return { text, _debounceTimer: timer }
  }
}

// After:
update: {
  search: { debounce: 300, run: (s, query) => fetchResults(query) }
}
```

**Implementation plan:** Add a `_debounceTimers` map to `createLoop()`. In `send()`, before executing the handler, check `updateMeta[event]?.debounce`. If set, clear existing timer, start new one with `setTimeout`. On expiry, execute handler normally. Edge case: component unmount must clear all debounce timers (already handled by `dispose()`).

**Why #1:** This single feature eliminates the most common boilerplate pattern in every search box, autocomplete, typeahead, and live-filter component. It makes Uploop the only framework where "add a debounced search" is a one-word config change.

---

#### 2. `suspend` metadata on data nodes — loading states

| | |
|---|---|
| **Effort** | ~60 lines |
| **ROI** | ⭐⭐⭐⭐⭐ |
| **Lines saved per component** | ~6 (manual `loading: false` + conditional in view) |
| **Fixes gap** | Declarative metadata (#2), Suspense/ErrorBoundary (#cross-cutting) |
| **Competitive angle** | React has `<Suspense fallback={...}>`. Solid has `<Suspense>`. **Uploop would have per-node suspend — more granular than either.** |

**What to build:** Data nodes (in `createGraph`) or state keys (in `createLoop`) accept `suspend: { fallback: string | HtmlTemplate }`. When a node enters "loading" state (explicitly set by an update handler), the view system substitutes the fallback instead of the node's value. When loading completes, the real value renders.

```js
// Before:
state: { results: [], loading: false, error: null }
view: (s) => s.loading ? html`<p>Loading...</p>`
  : s.error ? html`<p>Error: ${s.error}</p>`
  : html`<ul>${s.results.map(...)}</ul>`

// After (loop-level):
state: {
  results: { default: [], suspend: { fallback: 'Loading...' } },
  error: null
}
view: (s) => html`<ul>${s.results.map(...)}</ul>`
// Loading state handled automatically by the runner
```

**Implementation plan:** In `createLoop()`, track per-key `_loading` flags. When `send()` returns a partial state with `{ results: LOADING_SENTINEL }`, mark `results` as loading and queue a view update with the fallback. When the real value arrives, unmark and re-render. The sentinel pattern avoids polluting state with `loading: true`.

**Why #2:** Loading spinners are the most universal UI pattern. Every async component writes the same 6 lines. `suspend` makes it zero lines and puts Uploop on par with React/Solid's Suspense — but at per-node granularity instead of per-boundary.

---

#### 3. `error` metadata on data nodes — error handling + retry

| | |
|---|---|
| **Effort** | ~50 lines |
| **ROI** | ⭐⭐⭐⭐ |
| **Lines saved per component** | ~8 (manual `try/catch` + error state + retry button) |
| **Fixes gap** | Declarative metadata (#2), ErrorBoundary (#cross-cutting) |
| **Competitive angle** | React: ErrorBoundary class components (clunky). Solid: ErrorBoundary. TanStack Query: per-query retry. **Uploop would have per-node error + retry built into the loop.** |

**What to build:** Data nodes accept `error: { fallback: string | HtmlTemplate, retry: number | false }`. When an update handler throws or returns an error sentinel, the runner captures it, renders the fallback, and optionally retries N times with exponential backoff.

```js
// Before:
update: {
  fetch: async (s) => {
    try {
      const data = await api.get('/users')
      return { users: data, loading: false }
    } catch (e) {
      return { error: e.message, loading: false }
    }
  }
}

// After:
state: {
  users: { default: [], error: { fallback: 'Failed to load users', retry: 3 } }
}
update: {
  fetch: async (s) => ({ users: await api.get('/users') })
  // Throws get caught by runner, fallback rendered, retried up to 3 times
}
```

**Why #3:** Combined with `suspend`, this eliminates the `loading`/`error`/`data` ternary that plagues every async component. Together, `suspend` + `error` are Uploop's answer to React's `<Suspense>` + `<ErrorBoundary>` — but without wrapper components.

---

### Tier 1 Summary: The "Zero-Boilerplate Async" Package

Implementing just these three features (#1–#3) together eliminates the most painful boilerplate in modern web development: debounced input, loading spinners, and error handling. **~150 lines of runner code saves ~26 lines per async component, forever.**

This is the highest-density DX improvement available. It directly addresses the "declarative metadata" gap and gives Uploop a compelling answer to React's Suspense/ErrorBoundary story.

---

### Tier 2: Ship This Month (Strong ROI, Moderate Effort)

#### 4. `cache` metadata with TTL + SWR

| | |
|---|---|
| **Effort** | ~100 lines |
| **ROI** | ⭐⭐⭐⭐ |
| **Lines saved per fetch** | ~18 (manual `Map` + timestamp + stale-while-revalidate logic) |
| **Fixes gap** | Declarative metadata (#2), heuristic optimizations (#6) |
| **Competitive angle** | TanStack Query / SWR do this, but as a separate library (12+ KB). **Uploop would have it built into the loop at 1 KB.** |

**What to build:** Data nodes accept `cache: { ttl: string | number, swr: boolean }`. The runner maintains an in-memory cache keyed by node name + arguments hash. On fetch, checks cache first. If fresh, returns cached. If stale but `swr: true`, returns stale + revalidates in background. `ttl` supports human-readable strings: `'5m'`, `'30s'`, `'1h'`.

```js
state: {
  products: {
    default: [],
    cache: { ttl: '5m', swr: true },
    suspend: { fallback: 'Loading products...' }
  }
}
```

**Why #4:** This is the feature that makes Uploop competitive with TanStack Query for data fetching. Combined with `suspend` + `error`, it gives you the full async data lifecycle (loading → data → error → retry → cache → revalidate) with zero imperative code.

---

#### 5. `interruptible` metadata (auto AbortController)

| | |
|---|---|
| **Effort** | ~30 lines |
| **ROI** | ⭐⭐⭐⭐ |
| **Lines saved per async handler** | ~8 (manual `AbortController` + `signal` + `abort()` in cleanup) |
| **Fixes gap** | Declarative metadata (#2) |
| **Competitive angle** | TanStack Query does this per-query. React: manual. Solid: manual. **Uploop: one word.** |

**What to build:** Update nodes accept `interruptible: true`. The runner creates an `AbortController` before executing the handler, passes `signal` to the handler, and aborts if the same event fires again before the handler completes.

```js
update: {
  search: {
    debounce: 300,
    interruptible: true,
    run: async (s, query, { signal }) => {
      const results = await fetch(`/api/search?q=${query}`, { signal })
      return { results: await results.json() }
    }
  }
}
// Previous fetch auto-aborted when new search fires
```

**Why #5:** Low effort, high safety. Manual AbortController wiring is error-prone (devs forget to create it, forget to call `abort()`, forget to check `signal.aborted`). Making it automatic prevents a whole class of race-condition bugs.

---

### Tier 3: Ship This Quarter (Moderate ROI, Higher Effort)

#### 6. DOM `patch` strategy — fine-grained updates

| | |
|---|---|
| **Effort** | ~300 lines |
| **ROI** | ⭐⭐⭐ |
| **Fixes gap** | Event binding fragility (#4), performance model (#cross-cutting) |
| **Competitive angle** | React: VDOM diff. Solid: signal-level DOM updates. **Uploop would have template-level patch — simpler than VDOM, more granular than innerHTML.** |

**What to build:** When `strategy: 'patch'`, instead of `innerHTML` replacement, compare the previous and next template output. Only update changed text nodes and attribute values. Preserve DOM nodes that haven't changed (keeping event listeners, focus, scroll position, canvas state intact).

**Why #6:** This is the feature that closes the performance gap with React/Solid for frequent updates. But it's high-effort and the current `replace` strategy is good enough for 90% of use cases. Only worth it when you have components that update >10 times/second (animations, real-time data, drawing tools).

---

#### 7. Extract `component()` internals into modules

| | |
|---|---|
| **Effort** | ~150 lines (move, don't rewrite) |
| **ROI** | ⭐⭐⭐ |
| **Fixes gap** | Component size (#3), hack count (#1) |
| **Competitive angle** | Cleaner architecture enables contributors. Currently the monolith is a barrier to open-source participation. |

**What to build:** Create `packages/core/src/resources.js` (save/restore), `packages/html/src/bindings.js` (event + prop binding logic from html.js), `packages/core/src/render.js` (renderView + render + mountTo). `component()` becomes a thin orchestrator that composes these modules. Target: 378 → ~150 lines.

**Why #7:** This is architectural hygiene, not a user-facing feature. It won't directly save any lines of user code. But it makes every subsequent feature easier to implement, reduces bug surface, and signals to potential contributors that the codebase is maintainable.

---

### Tier 4: Future (Important, Not Urgent)

These are strategically important but require significant investment or have dependencies on Tier 1–3 work.

| # | Feature | Effort | Why Later |
|---|---|---|---|
| 8 | SSR execution target | ~200 lines | Depends on `patch` strategy for hydration. Without hydration, SSR is just a string dump. Useful but incomplete. |
| 9 | `temperature` + `lifetime` data tiers | ~150 lines | Depends on `cache` metadata being implemented first. Needs real-world usage data to tune GC heuristics. |
| 10 | Eliminate `data-up-event` index routing | ~100 lines | Depends on `patch` strategy. The index routing is a symptom of innerHTML replacement. Fix the cause, not the symptom. |
| 11 | Eliminate `_pendingVC` side-channel | ~40 lines | Depends on component extraction (#7). The side-channel exists because `processUploopAttributes` and `processVirtualContainers` share state through the DOM. Extract to a proper context object. |
| 12 | WebWorker execution target | ~80 lines | Niche use case. Only worth it if a real app needs off-main-thread rendering. |
| 13 | TypeScript type definitions | ~300 lines | High effort, zero runtime benefit. JSDoc typedefs are sufficient for now. Worth it when Uploop has users who demand it. |

---

### What NOT to Build (Anti-Recommendations)

These would consume effort but produce low or negative ROI given Uploop's positioning:

| Anti-pattern | Why Not |
|---|---|
| **React compatibility layer** | Uploop's config-object model is its identity. A JSX-to-config adapter or hook-to-update bridge would be a massive effort that dilutes the value proposition. Uploop isn't "React but smaller" — it's a different paradigm. |
| **Virtual DOM** | React already won the VDOM war. Uploop's `patch` strategy should be template-level, not VDOM-level. Building a full reconciler would add 5+ KB and years of edge-case fixes. |
| **NPM package ecosystem** | You can't build an ecosystem intentionally. It grows organically. Don't spend effort on component libraries until the core has users asking for them. |
| **Visual editor / GUI builder** | The HyperGraph manifest enables this, but building a visual editor is a separate product, not a framework feature. Seed the manifest format, let the community build tools. |
| **React Native / mobile target** | Different runtime, different rendering, different platform concerns. Uploop's value prop is the web (canvas + DOM + CSP). Mobile is a distraction. |
| **Plugin system for `@uploop/css`** | Tailwind's plugin ecosystem is mature. Uploop's CSS engine should focus on its unique strengths (runtime theming, chainable API) rather than trying to match Tailwind's plugin surface area. |

---

### Recommended Roadmap

```
Week 1–2:  debounce (#1) + suspend (#2) + error (#3)
           ─── "Zero-Boilerplate Async" release ───
           This is v0.3.0. Ship it. Blog about it.
           Headline: "Loading spinners, error handling, and debounced search
           in zero lines of code."

Week 3–4:  cache (#4) + interruptible (#5)
           ─── "Data Layer" release (v0.3.1) ───
           Uploop now competes with TanStack Query at 1/12th the size.

Week 5–6:  component extraction (#7) + _pendingVC cleanup (#11)
           ─── "Clean Architecture" release (v0.3.2) ───
           component() drops from 378 → ~150 lines.
           Ready for contributors.

Week 7–10: patch strategy (#6) + data-up-event removal (#10)
           ─── "Fine-Grained Rendering" release (v0.4.0) ───
           Performance parity with React, event binding robustness.

Quarter 2: SSR (#8) + temperature/lifetime (#9) + TS types (#13)
           ─── "Production Ready" release (v0.5.0) ───
           Full-stack capable, type-safe, optimized.
```

### If You Only Do One Thing

**Implement `suspend` + `error` + `debounce` as a single "async behaviors" pass.** These three features share the same architectural pattern (node-level metadata consumed by the runner), touch the same code paths (send → handler execution → view notification), and collectively eliminate the most universal boilerplate in web development.

~150 lines of runner code. ~26 lines saved per async component. **The ROI doesn't get better than this.**
