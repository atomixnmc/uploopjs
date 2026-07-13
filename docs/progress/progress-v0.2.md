# v0.0.2 → v0.0.3 — Improvement Metrics

> **Date:** 2026-06-01
> **Based on:** [phase-v0.0.1-report.md](./phase-v0.0.1-report.md), [Architecture-changes.md](./Architecture-changes.md)

---

## Metric 1: Hack Count — Workarounds Eliminated

The v0.0.1 report identified 5 hacky/ugly patterns caused by the render strategy. Each becomes unnecessary or moves to the runner:

| Hack (v0.0.2) | v0.0.3 Disposition | Lines Saved |
|---|---|---|
| `saveResources()` / `restoreResources()` | Runner `replace` hook — generic, not per-component | ~30 lines per component |
| `saveFocus()` / `restoreFocus()` | Runner `replace` hook — generic | ~40 lines (removed from component.js) |
| Index remapping in nested templates | Eliminated with `strategy: 'patch'` (direct binding) | ~25 lines in html.js |
| `_pendingVC` side-channel on DOM element | Runner state object | ~15 lines |
| Two-pass `processUploopAttributes` → `processVirtualContainers` | Runner pipeline with explicit phases | ~20 lines ordering fragility removed |

**Target:** ~130 lines of hack code removed from `component.js` and `html.js`. Zero new workarounds introduced.

---

## Metric 2: Boilerplate Reduction — Declarative Behaviors

v0.0.2 requires manual wiring for common patterns. v0.0.3 declares them.

| Pattern | v0.0.2 (manual) | v0.0.3 (declared) | Reduction |
|---|---|---|---|
| Debounced search | `setTimeout` + `clearTimeout` + manual state (~12 lines) | `debounce: 300` on update node | ~10 lines |
| Loading state | `loading: false` in state + manual set in every handler (~6 lines) | `suspend: { fallback: 'Loading' }` on data node | ~6 lines |
| Error handling | `try/catch` in every async handler (~8 lines) | `error: { fallback: 'Error', retry: 3 }` on data node | ~6 lines |
| Cache with SWR | Manual `Map` + timestamp check + refetch logic (~20 lines) | `cache: { ttl: '5m', swr: true }` on data node | ~18 lines |
| Focus preservation | `saveFocus()` + `restoreFocus()` in every mount (~10 lines) | Runner handles automatically | ~10 lines |
| Resource persistence | `registerResource()` + `save/restore` hooks (~15 lines) | `registerResource('persistent')` — mode handles it | ~5 lines |

**Target:** ~55 lines of boilerplate eliminated per non-trivial component.

---

## Metric 3: component.js Size

| Metric | v0.0.2 | v0.0.3 Target |
|---|---|---|
| `component()` total lines | 571 | ~120 |
| Nested function count | 7 (`create`, `mountTo`, `apply`, `renderView`, etc.) | 2 (`component`, `createInstance`) |
| Concerns per function | 11 (state, update, effect, view, mount, focus, resources, frame loop, virtual containers, scope, compose) | 3 (configure graph, wire execution, return descriptor) |
| Cyclomatic complexity (approx) | ~45 | ~12 |

Decomposed into separate modules: `execution.js`, `frame-loop.js`, `resources.js`, `focus.js`, `bindings.js`.

---

## Metric 4: Event Binding Correctness

v0.0.2 uses string index routing (`data-up-event="click:0"`) with regex remapping.

| Scenario | v0.0.2 Risk | v0.0.3 |
|---|---|---|
| Nested child component events | Index off-by-one → wrong handler | Direct reference → always correct |
| Conditional children (list changes length) | Stale indices → events fire on wrong elements | Direct reference → always correct |
| Re-render while event in flight | Event bound to destroyed DOM → silently lost | Patch preserves DOM → handler stays |

**Target:** Zero event binding bugs from index routing. Eliminated as a bug category.

---

## Metric 5: Cross-Target Capability

v0.0.2 has one render target: DOM via `innerHTML`. Canvas support requires the entire virtual container system + scope registry as a parallel implementation.

| Capability | v0.0.2 | v0.0.3 |
|---|---|---|
| DOM rendering | ✅ Built-in | ✅ `domExecution` target |
| Canvas rendering | ⚠️ Via virtual containers + scope registry | ✅ `canvasExecution` target — reuses same component model |
| SSR string output | ❌ Not implemented | ✅ `ssrExecution` target — `strategy: 'replace'` |
| WebWorker output | ❌ Not possible | ✅ `workerExecution` target |
| PixiJS / WebGL | ❌ Requires total custom code | ✅ Implements execution protocol |

**Target:** 3 execution targets implemented (DOM, Canvas, SSR). Architecture supports unlimited targets without changing component model.

---

## Metric 6: Heuristic-Driven Optimization

Without heuristics, the runner treats all state uniformly. v0.0.3 enables automatic differentiation.

| Optimization | Without Heuristic | With Heuristic |
|---|---|---|
| Frame scheduling | All updates on same lane | 4 lanes: hot (rAF), warm (microtask), cold (idle), critical (sync) |
| Cache strategy | None or manual | Auto: TTL, SWR, dedup, prefetch based on temperature + resourceScope |
| Memory pressure | All state kept until disconnect | Cold data GC'd from memory, kept in persistent cache |
| Interruption | Manual AbortController wiring | `interruptible: true` auto-cancels previous |
| SSR serialization | Developer decides per component | Cold/remote data auto-serialized; hot/transient auto-skipped |
| Event tracing | All or nothing | Hot nodes skip tracing (too noisy); cold nodes include lineage |

**Target:** Runner makes 6 optimization decisions automatically that v0.0.2 requires manual developer wiring.

---

## Metric 7: DX — Concepts to Learn

The number of distinct APIs a developer must understand to build a production app.

| Framework | APIs to Learn |
|---|---|
| React (with ecosystem) | useState, useEffect, useContext, useReducer, useMemo, useCallback, useRef, useTransition, Suspense, ErrorBoundary, React Query (useQuery, useMutation), Zustand (create, selector), React Router (BrowserRouter, Route, Link) — **~18 concepts** |
| SolidJS | createSignal, createEffect, createMemo, createResource, Suspense, ErrorBoundary, For, Show, Switch, useRoutes — **~10 concepts** |
| **Uploop v0.0.2** | createLoop, createSignal, component, html, createFrame, createEffectSystem, batch, store, createSelector, derived, computeParts, compose, createComponentType, defineElement, registerScope, registerResource — **~16 concepts** |
| **Uploop v0.0.3 target** | component (covers all), nodes (data/update/view/effect/resource), edges, behaviors (cache/suspend/error/debounce), execution target — **~5 concepts** |

Key: everything reduces to nodes + edges + behaviors. The `describe()` manifest tells DevTools what's configured; the developer only writes the overrides.

**Target:** ~5 core concepts to learn. 70% reduction in API surface.

---

## Metric 8: AI Code Generation Quality

HyperGraph metadata makes AI-generated code more correct.

| Generation Task | Without Metadata | With Metadata |
|---|---|---|
| "Add debounced search" | AI must infer debounce from context, often adds manual setTimeout | `{ debounce: 300 }` — explicit, no inference needed |
| "Add loading spinner while fetching" | AI adds manual loading state + conditional rendering | `{ suspend: { fallback: 'Spinner' } }` — one declaration |
| "Cache API results for 5 minutes" | AI adds manual cache Map + timestamp logic | `{ cache: { ttl: '5m' } }` — one declaration |
| "Cancel previous request on new input" | AI adds AbortController manually, often forgets cleanup | `{ interruptible: true }` — automatic |
| "Optimize this component" | AI guesses at memo/useCallback placement | Runner uses heuristic to schedule correctly; AI doesn't need to guess |

**Target:** AI-generated Uploop code is correct on first pass more often because metadata replaces inference.

---

## Summary: Before/After

| Metric | v0.0.2 | v0.0.3 Target |
|---|---|---|
| Hack workarounds in component.js | 5 hack patterns | 0 |
| Boilerplate per component | ~55 lines of manual wiring | 0 (declared) |
| `component()` lines | 571 | ~120 |
| Event routing bug surface | Index-based, fragile | Direct reference, zero bugs |
| Render targets supported | 1 (DOM) | 3+ (DOM, Canvas, SSR) |
| Auto optimizations by runner | 0 | 6 (scheduling, cache, memory, interrupt, SSR, tracing) |
| APIs to learn | ~16 | ~5 |
| AI generation correctness | Inference-based, error-prone | Metadata-based, explicit |
| `describe()` manifest fidelity | Basic graph | Graph + heuristics + behaviors + resourceScope |
