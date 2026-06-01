# Uploop Rework Plan

## Strategy: Quick Win / Best ROI

### Phase 0 — Docs & Structure (Day 1)

| Task | ROI |
|------|-----|
| Create ARCHITECTURE.md | High — team alignment |
| Create PLAN.md | High — track progress |
| Create TODO.md | High — actionable tasks |
| Restructure to npm workspaces | High — foundation |
| Archive old `lib/` flat structure | Medium — clean slate |

### Phase 1 — `@uploop/core` (Day 1-2)

| Task | ROI |
|------|-----|
| `createLoop()` — core update loop | **Critical** |
| `subscribe()` / `notify()` — pub/sub | **Critical** |
| `createSignal()` — signal primitive | High |
| `createFrame()` — micro/visual/idle scheduler | High |
| `createEffect()` — effect system | High |
| `batch()` — update batching | High |
| `plugin()` — plugin protocol | Medium |
| JSDoc types | Medium |

### Phase 2 — `@uploop/html` (Day 2-3)

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

### Phase 3 — Demo & Examples (Day 3)

| Task | ROI |
|------|-----|
| Counter demo with new API | **Critical** |
| TODO demo | High |
| Todos demo | High |
| Vite dev server demo | **Critical** |

### Phase 4 — `@uploop/store` (Day 3-4)

| Task | ROI |
|------|-----|
| `store()` — external store | High |
| `selector()` — derived selectors | High |
| `derived()` — computed values | High |
| Connect store to core loop | High |

### Phase 5 — `@uploop/router` (Day 4)

| Task | ROI |
|------|-----|
| Simple route matching | High |
| Navigation | High |
| Route params | High |
| Lazy component loading | Medium |

### Phase 6 — `@uploop/css` (Day 4-5)

| Task | ROI |
|------|-----|
| Utility class generation | High |
| Theme tokens | High |
| Dark mode | Medium |
| Responsive variants | Medium |

### Phase 7 — Polish & Publish (Day 5)

| Task | ROI |
|------|-----|
| README rewrite | High |
| Vite config for library build | High |
| Test setup | Medium |
| Package publishing | Medium |

## Quick Win Path

**The fastest path to a working demo:**

1. ✅ Docs created
2. Monorepo structure set up
3. `@uploop/core` — createLoop + subscribe + signal + frame
4. `@uploop/html` — html tag + component + defineElement + event binding
5. Counter demo in Vite
6. TODO demo in Vite

**This gives a working demo in ~3 focused sessions.**

## Key Design Decisions

1. **Core is pure** — no DOM, no browser APIs, no CSS
2. **HTML adapter subscribes to core** — not the other way around
3. **Events are CSP-safe** — `@click` syntax uses `addEventListener`
4. **Frames are first-class** — micro/visual/idle scheduling
5. **Components are HyperGraphs** — nodes + edges, inspectable
6. **Store is a bus** — external state connects via subscription
7. **No build required** — ESM CDN import works out of the box
