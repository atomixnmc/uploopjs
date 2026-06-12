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

## Phase 9 — E2E Tests (Playwright) ✅

- [x] `tab-navigation.spec.js` — demo gallery tabs + URL routing
- [x] `store.spec.js` — cart CRUD + persistence
- [x] `transition.spec.js` — CSS transitions DOM persistence
- [x] `canvas.spec.js` — Bouncing Ball + Cars pixel rendering
- [x] `counter.spec.js` — increment/decrement/reset
- [x] `todo.spec.js` — add/toggle/remove/filter
- [x] `router.spec.js` — guards, params, layouts, login flow
- [x] `statemachine.spec.js` — traffic light transitions
- [x] `form.spec.js` — city input + validation
- [x] `async-data.spec.js` — debounce, suspend, error, cache
- [x] `css-demo.spec.js` — utility classes rendering
- [x] `blog.spec.js` — data display + navigation
- [x] `grid.spec.js` — sort/filter on data grid
- [x] `carousel.spec.js` — auto-advance, prev/next, dots
- [x] `audioplayer.spec.js` — playback controls
- [x] `videoplayer.spec.js` — playback controls
- [x] `paint.spec.js` — canvas drawing interaction
- [x] `tetris.spec.js` — game rendering + input
- [x] `wheel.spec.js` — spin animation
- [x] `fishes.spec.js` — particle animation
- [x] `cars.spec.js` — canvas animation + speed control

> 📖 See [E2E-GUIDE.md](./E2E-GUIDE.md) for test patterns per example type.

## v0.3.1 — Sugar Syntax & Cleanup ✅

- [x] C1: Extract `component()` internals (440 → 3 modules)
- [x] C2: Remove `_pendingVC` DOM side-channel (WeakMap instead)
- [x] Remove `data-force-update` dead code
- [x] Remove `_validateTimer` from component state
- [x] Fix `batch._depth` function properties (createBatcher factory)
- [x] Snapshot protocol formalized (no _bindings/_send/_get smuggling)
- [x] _ownerSend mutation removed
- [x] Triple-fallback canvas search fixed
- [ ] B1: String event shorthand `@click="inc"`
- [ ] B4: Two-way binding `:model=`
- [ ] B2+B3: Auto-extract for form inputs
- [ ] B5: Simple setter shorthand
- [ ] C3-L1: Runtime HTML validation in html tag

## v0.4.0 — Architecture Breakthroughs ✅

- [x] G1-G4: Graph engine upgrade — plan(), whatReads/writes, transitiveDeps, criticalPath, findOrphans, mergeStats, diff, serialize/fromJSON, topologicalSort
- [x] H1-H5: HTML system upgrade — single-pass character scanner (no regex), template parts, stable binding IDs
- [x] E1-E4: Execution breakthrough — computeDelta(), patch strategy, createDOMPatchExecution(), runner upgrade
- [x] DOM `patch` strategy (O(changed) not O(full-tree)) — 6.5× to 41× speedup
- [x] `temperature` + `lifetime` data tiers — frame lane auto-selection
- [x] onDataChange() — granular data node subscriptions
- [x] events.rate/hot — event frequency tracking
- [x] eventChain() — causal chain tracing (opt-in)
- [x] inferTemperature() — heuristic data classification (opt-in)

## v0.5.0 — Server-Side Toolset ✅

- [x] `@uploop/sst` package — SSR, hydration, remote loops, services
- [x] `renderToString()` — render components to HTML strings
- [x] `hydrate()` — attach listeners to server-rendered DOM
- [x] `createRemoteLoop()` — client proxy for remote state
- [x] `createTransportServer()` — WebSocket server for local loops
- [x] `createService()` — FeathersJS-style CRUD + real-time events
- [x] `createServiceApp()` — multi-service registry
- [x] Core: `createFrame('sync')` mode for SSR
- [x] Core: `createStringExecution()` target
- [x] Example: `examples/ssr/` — Node.js HTTP SSR server
- [x] Docs: `design-server-side.md`, `progress-v0.5.md`, `report-v0.5-planning.md`
- [x] Tests: 8 SST tests (SSR, hydration, services)

## Stats

- **Packages:** 8 (@uploop/core, html, store, router, css, state-machine, sst, devutils)
- **Source files:** 55
- **Examples:** 20
- **Unit tests:** 228 passing + 2 skipped
- **Test files:** 27
