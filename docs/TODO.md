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

- [x] `src/loop.js` — createLoop() with state + update + subscribe
- [x] `src/signal.js` — createSignal() primitive
- [x] `src/frame.js` — createFrame() scheduler (micro/visual/idle)
- [x] `src/effect.js` — createEffect() system
- [x] `src/batch.js` — batch() for coalesced updates
- [x] `src/scope.js` — dispose() and scope management
- [x] `src/plugin.js` — plugin protocol
- [x] `src/types.js` — JSDoc type definitions
- [x] `src/index.js` — public API barrel
- [x] `package.json` with correct name/exports
- [x] Tests for core loop (14 tests passing)

## Phase 2 — `@uploop/html` ✅

- [x] `src/html.js` — html template tag with `@click`/`.prop`/`?bool` bindings
- [x] `src/component.js` — component() HyperGraph definition
- [x] `src/element.js` — defineElement() WebComponent registration
- [x] `src/events.js` — CSP-safe event binding utilities
- [x] `src/dom.js` — patchDOM() and DOM utilities
- [x] `src/hydrate.js` — SSR hydration placeholder
- [x] `src/index.js` — public API barrel
- [x] `package.json` with core dependency

## Phase 3 — `@uploop/store` ✅

- [x] `src/store.js` — external store with select/derived
- [x] `src/selector.js` — memoized selectors
- [x] `src/derived.js` — derived values
- [x] `src/persist.js` — localStorage persistence
- [x] `src/index.js` — public API barrel

## Phase 4 — `@uploop/router` 🔴

- [ ] `src/router.js` — route matching + navigation
- [ ] `src/params.js` — path/query params
- [ ] `src/guard.js` — route guards
- [ ] `src/layout.js` — nested layouts
- [ ] `src/index.js` — public API barrel

## Phase 5 — `@uploop/css` 🔴

- [ ] `src/theme.js` — design tokens
- [ ] `src/utility.js` — utility class generation
- [ ] `src/variant.js` — responsive/variant support
- [ ] `src/inject.js` — CSS injection into DOM
- [ ] `src/index.js` — public API barrel

## Phase 6 — Demo & Examples 🟡

- [x] Counter example with new API
- [x] Todo example with new API
- [x] Demo app with tab navigation
- [x] HyperGraph debug panel
- [x] Vite dev server working
- [ ] Form example with new API
- [ ] Routing example
- [ ] Motion/animation example

## Phase 7 — Polish 🟡

- [x] README rewrite
- [x] Protocol docs (core, html, store)
- [x] Counter Reset button fix (html template part index bug)
- [x] HyperGraph Inspector with 7 debug tabs (Graph, Nodes, Edges, State, Events, Signals, Metadata)
- [ ] Library build config (vite library mode)
- [ ] npm publish setup
- [ ] CDN bundle
- [ ] Test suite for html package

## Legend

- ✅ **Done**
- 🟡 **Actively working / partially done**
- 🔴 **Not started**
