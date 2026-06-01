# Uploop Architecture

> Uploop = a universal update-loop architecture for UI, data, events, storage, and side effects.

## Core Thesis

React asks: *"How do we describe UI as state changes?"*

Uploop asks: *"How does data move through time, frames, components, stores, effects, cache, network, and rendering?"*

## Architecture Pillars

### 1. Everything is an Updater

An updater is not just a component. It can represent: UI component, request handler, animation frame, cache policy, database sync, signal, event stream, WebSocket channel, worker job, WebGPU render pass.

### 2. One-Way by Default, Two-Way by Protocol

```
Input -> Update -> Frame -> Output
```

Two-way binding becomes a declared channel, not magic.

### 3. Store is a Bus, Not Global State

Data types:
- **hot** = live, frequently updated
- **cold** = cached, loaded on demand
- **transient** = temporary frame/local data
- **stable** = persisted
- **remote** = network-backed
- **derived** = computed

### 4. Frame is First-Class

```
micro-frame     instant UI patch
visual-frame    requestAnimationFrame
network-frame   request/response cycle
storage-frame   local/session/db write
server-frame    SSR/edge update
gpu-frame       WebGL/WebGPU render
```

## Package Architecture

```
@uploop/core     - Pure update protocol (no DOM, no browser)
@uploop/html     - DOM/WebComponent adapter
@uploop/store    - External store, selectors, derived state
@uploop/css      - Utility CSS engine
@uploop/router   - Route updater
@uploop/motion   - Frame/spring animation updater
@uploop/devtools - Inspector/debugger
```

### Dependency Graph

```
core
  +-- store
  +-- html
  |     +-- css (optional)
  +-- router
  +-- motion
  +-- devtools
```

**Rule: Core knows nothing about HTML.** No `HTMLElement`, no `customElements`, no `innerHTML`, no CSS.

## Core Data Flow

```
event -> updater -> state patch -> frame scheduler -> subscribers/effects
```

### Core API

```js
createLoop(config)   - Core update loop
createSignal()       - Signal primitive
createFrame(mode)    - Frame scheduler
createEffect()       - Effect system
batch()              - Batch updates
dispose()            - Cleanup
plugin()             - Plugin protocol
```

### HTML Adapter API

```js
html`...`            - Template literal for HTML
component(name, cfg) - HyperGraph component definition
defineElement()      - WebComponent registration
patchDOM()           - DOM patching (CSP-safe)
hydrate()            - SSR hydration
```

## HyperGraph Model

Every component is an executable graph:

```
nodes:
  - data nodes (state)
  - update nodes (transformations)
  - view nodes (render)
  - event nodes (triggers)
  - effect nodes (side effects)

edges:
  - event -> update
  - update -> data
  - data -> view
  - view -> DOM
```

## Protocols (1.0)

1. **HyperGraph Manifest** - Every component exports `.describe()`
2. **Update Protocol** - Standard shape for every update
3. **Data Access Protocol** - Who reads/writes data
4. **Event Protocol** - Portable event shape
5. **Effect Protocol** - Explicit side effects
6. **Frame/Scheduler Protocol** - Frame-aware updates
7. **View Adapter Protocol** - Graph -> render target
8. **Style Protocol** - Graph-aware styling
9. **Router Protocol** - Routes as data/resource graph
10. **DevTools Protocol** - Why did this update?

## Detailed Protocol Docs

- [@uploop/core Protocol](./protocol-core.md) — signals, loops, frames, effects, batching, HyperGraph manifest
- [@uploop/html Protocol](./protocol-html.md) — template tags, component lifecycle, event binding, WebComponents
- [@uploop/store Protocol](./protocol-store.md) — external stores, selectors, derived state, persistence

## Build Order

1. `@uploop/core` - Foundation
2. `@uploop/html` - DOM rendering
3. `@uploop/store` - External state
4. `@uploop/router` - Navigation
5. `@uploop/css` - Styling
6. `@uploop/motion` - Animation
7. `@uploop/devtools` - Debugging
8. `@uploop/cli` - Tooling
