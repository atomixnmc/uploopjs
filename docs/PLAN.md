# Uploop Rework Plan

## Strategy: Quick Win / Best ROI

### Phase 0 — Docs & Structure ✅

| Task | ROI |
|------|-----|
| Create ARCHITECTURE.md | High — team alignment |
| Create PLAN.md | High — track progress |
| Create TODO.md | High — actionable tasks |
| Restructure to npm workspaces | High — foundation |
| Archive old `lib/` flat structure | Medium — clean slate |

### Phase 1 — `@uploop/core` ✅

| Task | ROI |
|------|-----|
| `createLoop()` — core update loop | **Critical** |
| `subscribe()` / `notify()` — pub/sub | **Critical** |
| `createSignal()` — signal primitive | High |
| `createFrame()` — micro/visual/idle scheduler | High |
| `createEffect()` — effect system | High |
| `batch()` — update batching | High |
| `plugin()` — plugin protocol | Medium |
| `createGraph()` — typed nodes + dependency indexes | High |
| `createDOMExecution()` — execution protocol | High |
| `component()` — HyperGraph component factory | **Critical** |
| JSDoc types | Medium |

### Phase 1.5 — v0.3.0 Async Metadata ✅

| Task | ROI |
|------|-----|
| `debounce` — per-handler debounce with auto timers | **Critical** |
| `error` — retry + exponential backoff + fallback state | **Critical** |
| `suspend` — `isPending()` / `getError()` / `clearError()` API | **Critical** |
| `interruptible` — auto AbortController per event | High |
| `cache` — TTL + SWR cache layer with `getCached()` API | High |
| `dev: true` — dev-mode validation (unused keys, unknown events) | Medium |

### Phase 2 — `@uploop/html` ✅

| Task | ROI |
|------|-----|
| `html` template tag | **Critical** |
| `component(name, config)` — HyperGraph component | **Critical** |
| `defineElement()` — WebComponent registration | **Critical** |
| CSP-safe event binding (`@click`) | **Critical** |
| `patchDOM()` — minimal DOM patching | High |
| Subscribe to core → auto-render | High |
| Attribute/property sync | High |
| `hydrate()` — SSR hydration | Medium |
| `suspend()` — async data loading/error/success helper | High |

### Phase 3 — `@uploop/store` ✅

| Task | ROI |
|------|-----|
| `store()` — external store | High |
| `selector()` — derived selectors | High |
| `derived()` — computed values | High |
| `persist()` — localStorage persistence | Medium |
| Connect store to core loop | High |

### Phase 4 — `@uploop/router` 🟡

| Task | ROI |
|------|-----|
| Simple route matching + navigation ✅ | High |
| Route params | High |
| Route guards | Medium |
| Nested layouts | Medium |
| Lazy component loading | Medium |

### Phase 5 — `@uploop/css` 🟡

| Task | ROI |
|------|-----|
| Utility class generation ✅ | High |
| Theme tokens ✅ | High |
| Dark mode ✅ | Medium |
| Responsive variants ✅ | Medium |
| CSS injection ✅ | High |
| Dynamic CSS ✅ | Medium |
| Animation constants ✅ | Low |
| CSS optimizer ✅ | Medium |

### Phase 6 — Demo & Examples 🟡

| Task | ROI |
|------|-----|
| Counter demo ✅ | **Critical** |
| TODO demo ✅ | High |
| Todos demo ✅ | High |
| Vite dev server ✅ | **Critical** |
| Form example ✅ | High |
| HyperGraph debug panel ✅ | High |
| 14 examples in demo gallery ✅ | High |
| Async data example (debounce/suspend/cache) | High |
| Routing example | High |

### Phase 7 — Polish 🟡

| Task | ROI |
|------|-----|
| README rewrite ✅ | High |
| Vite config for library build | High |
| Test suite for html package | Medium |
| Package publishing | Medium |
| CDN bundle | Medium |

---

## v0.3.1 — Sugar Syntax & Cleanup (Next)

### Priority B: Sugar Syntax (~105 lines)

| # | Feature | Effort | Impact |
|---|---|---|---|
| B4 | `:model=` two-way binding | ~25 lines | ~60 chars saved per input |
| B1 | `@click="inc"` string shorthand | ~30 lines | ~40 chars saved per handler |
| B2+B3 | Auto-extract for form inputs | ~25 lines | ~30 chars saved per input |
| B5 | Simple setter shorthand | ~25 lines | ~20 chars saved per setter |

### Priority C: Internal Cleanup (~240 lines)

| # | Task | Lines |
|---|---|---|
| C1 | Extract `component()` internals (378 → ~150) | ~150 |
| C2 | Remove `_pendingVC` DOM side-channel | ~40 |
| C3-L1 | Runtime HTML validation in html tag | ~50 |

---

## v0.4.0 — Architecture Breakthroughs (Future)

| # | Feature | Impact |
|---|---|---|
| G1-G4 | Graph engine upgrade | O(changed) not O(full-tree) |
| H1-H5 | HTML system upgrade | Stable binding IDs, unified parser |
| E1-E4 | Execution breakthrough | Template diffing, DOM patch strategy |
| - | `temperature` + `lifetime` data tiers | Heuristic-driven scheduling |


## v0.10.0 — HTML Graph Renderer (Planned)

| # | Feature | Impact |
|---|---|---|
| HG1 | `loop(items, keyFn?, viewFn)` list primitive | Unified Uploop naming, keyed list metadata |
| HG2 | Graph template IR beside current string descriptor | Non-breaking path toward precise DOM patching |
| HG3 | Direct DOM anchors for text/attr/event/component/list nodes | O(changed-nodes) render work |
| HG4 | HyperGraph state-read edges to render nodes | Schedule only affected DOM surgery |

> See [Plan_uploop-html-graph-renderer-v0.10.md](./plan/Plan_uploop-html-graph-renderer-v0.10.md).
---

## Key Design Decisions

1. **Core is pure** — no DOM, no browser APIs, no CSS
2. **HTML adapter subscribes to core** — not the other way around
3. **Events are CSP-safe** — `@click` syntax uses `addEventListener`
4. **Frames are first-class** — micro/visual/idle scheduling
5. **Components are HyperGraphs** — nodes + edges, inspectable
6. **Store is a bus** — external state connects via subscription
7. **No build required** — ESM CDN import works out of the box
8. **Async is declarative** — `debounce`, `error`, `suspend`, `interruptible`, `cache` metadata
9. **Dev-mode catches bugs** — `dev: true` validates unused keys and unknown events
