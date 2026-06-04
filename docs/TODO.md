# Uploop TODO

## Phase 0 — Docs & Structure ✅

- [x] ARCHITECTURE.md
- [x] PLAN.md
- [x] TODO.md
- [x] Archive old `lib/` structure
- [x] Create `packages/` directories
- [x] Root `package.json` with workspaces
- [x] npm install working

## Phase 1 — `@uploop/core` ✅

- [x] `createLoop()` — core update loop with state + update + subscribe
- [x] `createSignal()` — signal primitive
- [x] `createFrame()` — scheduler (micro/visual/idle/manual)
- [x] `createEffect()` — effect system
- [x] `batch()` — coalesced updates
- [x] `createScope()` — dispose/scope management
- [x] `plugin()` — plugin protocol
- [x] `createGraph()` — typed nodes + dependency indexes
- [x] `createDOMExecution()` — execution protocol (patch/replace/redraw)
- [x] `createRunner()` — runner pipeline
- [x] `component()` — HyperGraph component factory (mount/create/render)
- [x] `createComponentType()` — custom component type factory
- [x] JSDoc types
- [x] 23 unit tests (14 core + 9 async metadata)

## Phase 1.5 — v0.3.0 Async Metadata ✅

- [x] `debounce` — per-handler debounce with auto timer management
- [x] `error` — per-event error config with retry + exponential backoff + fallback
- [x] `suspend` — `isPending()` / `getError()` / `clearError()` API
- [x] `interruptible` — auto AbortController per event
- [x] `cache` — TTL + SWR cache layer (`getCached` / `invalidateCache` / `clearCache`)
- [x] `dev: true` — dev-mode validation (unused keys, unknown events, `validate()`)
- [x] `suspend()` helper in @uploop/html (loading/error/render states)
- [x] 9 async metadata unit tests (debounce, error, interruptible, pending, cache, dev)

## Phase 2 — `@uploop/html` ✅

- [x] `html` template tag with `@click`/`.prop`/`?bool` bindings
- [x] `component()` — HyperGraph component
- [x] `defineElement()` — WebComponent registration
- [x] CSP-safe event binding (`addEventListener`)
- [x] `patchDOM()` — DOM utilities
- [x] `hydrate()` — SSR hydration placeholder
- [x] `suspend()` — async data loading helper
- [x] 24 integration tests

## Phase 3 — `@uploop/store` ✅

- [x] `store()` — external store with select/derived
- [x] `createSelector()` / `createComposedSelector()` — memoized selectors
- [x] `derived()` — derived values
- [x] `persist()` — localStorage persistence

## Phase 4 — `@uploop/router` ✅

- [x] `createRouter()` — route matching + navigation
- [x] Parametric routes (`/users/:id`)
- [x] Route guards (per-route + global `onNavigate`)
- [x] Nested layouts (`layout` on route defs)
- [x] Lazy loading (`lazy` on route defs — dynamic import)
- [x] `addRoute()` — runtime route registration
- [x] `canNavigate()` — guard check without navigating
- [x] Wildcard route (`*`)
- [x] 10 router unit tests

## Phase 5 — `@uploop/state-machine` ✅

- [x] `createStateMachine()` — FSM with constrained transitions
- [x] Entry/exit hooks
- [x] `is()` / `can()` / `available()` state introspection
- [x] `reset()` / `setData()` methods
- [x] `visualize()` — ASCII diagram
- [x] `data` / `value` getters
- [x] 10 state machine unit tests

## Phase 6 — `@uploop/css` ✅

- [x] `theme()` / `extendTheme()` / `applyTheme()` — design tokens
- [x] `utility()` / `generateUtilities()` — utility class generation
- [x] `variant()` — responsive/variant support (hover, dark, media queries)
- [x] `inject()` / `getSheet()` / `removeSheet()` — CSS injection
- [x] `dynamic.js` — `createNamedStyle`, `createGradientStyle`, `createEventStyle`
- [x] `colors.js` — `hexToRgb`, `lighten`, `darken`, `alpha`, `contrast`
- [x] `chain.js` — `css()` chainable builder
- [x] `animation.js` — `injectAnimations`, `ANIMATIONS`
- [x] `optimizer.js` — `markUsed`, `getUsedClasses`, `stats`
- [x] 51 exports, 51 unit tests

## Phase 7 — Examples ✅

- [x] Counter (core reactivity)
- [x] Todo (CRUD + filtering)
- [x] Form (city input + validation state machine)
- [x] Blog (data grid)
- [x] Carousel (image gallery with transitions)
- [x] Paint (canvas drawing)
- [x] Audio Player
- [x] Video Player
- [x] Tetris (canvas game)
- [x] Lucky Wheel (canvas)
- [x] Fishes (canvas animation)
- [x] Cars (canvas)
- [x] CSS Demo (utility classes showcase)
- [x] **Router** — multi-page app with guards, params, layouts
- [x] **Store** — shopping cart with localStorage persistence + derived values
- [x] **State Machine** — traffic light FSM with auto-cycling
- [x] **Animation** — bouncing ball (canvas), CSS transitions, keyframe animations
- [x] **Async Data** — debounce, suspend, error retry, interruptible fetch, cache with SWR
- [x] Demo gallery (19 examples in tabbed UI)
- [x] HyperGraph Inspector (8 debug tabs)

## Phase 8 — Polish 🟡

- [x] README rewrite
- [x] Protocol docs (core, html, store)
- [x] Counter Reset button fix
- [x] HyperGraph Inspector (Graph, Nodes, Edges, State, Events, Signals, Metadata)
- [ ] Library build config (vite library mode)
- [ ] npm publish setup
- [ ] CDN bundle
- [ ] Test suite for all html features

## v0.3.1 — Sugar Syntax & Cleanup 🔴

- [ ] B1: String event shorthand `@click="inc"`
- [ ] B4: Two-way binding `:model=`
- [ ] B2+B3: Auto-extract for form inputs
- [ ] B5: Simple setter shorthand
- [ ] C1: Extract `component()` internals (378 → ~150 lines)
- [ ] C2: Remove `_pendingVC` DOM side-channel
- [ ] C3-L1: Runtime HTML validation in html tag
- [ ] C3-L2: Lit-plugin docs + `.vscode/settings.json`

## v0.4.0 — Architecture Breakthroughs 🔴

- [ ] G1-G4: Graph engine upgrade (tree ops, plan(), serialize)
- [ ] H1-H5: HTML system upgrade (stable binding IDs, unified parser, template tree)
- [ ] E1-E4: Execution breakthrough (template diffing, DOM patch, graph-driven render)
- [ ] DOM `patch` strategy (O(changed) not O(full-tree))
- [ ] `temperature` + `lifetime` data tiers

## Stats

- **Packages:** 7 (@uploop/core, html, store, router, css, state-machine, devutils)
- **Source files:** 45
- **Examples:** 19
- **Unit tests:** 181 passing + 1 skipped
- **Test files:** 21
