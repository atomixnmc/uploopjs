# Plan: Uploop HTML Graph Renderer v0.10

## Goal

Make Uploop HTML rendering more performant without breaking the current component and `html` syntax. The existing string descriptor remains valid; the new path adds graph metadata beside it, then lets execution patch exact DOM nodes when enough information is available.

## Design Direction

Uploop's substrate is HyperGraph, so the renderer should not stop at "VDOM as a tree." The template parser should produce a small graph-shaped render plan:

- static template fragments
- dynamic text, attribute, property, boolean, and event binding nodes
- component boundary nodes
- keyed list nodes from `loop(items, keyFn, viewFn)`
- dependency edges from state/signal reads to render nodes
- DOM anchors that let execution mutate direct targets

The first public primitive should be `loop(...)`, not `repeat(...)`, to keep naming aligned with the framework.

## Compatibility Rules

- Keep `html\`...\`` syntax and descriptor fields working.
- Keep current component declarations working.
- Keep event binding syntax like `@click=${handler}` working.
- Keep current string rendering as the fallback.
- Add graph metadata as additive fields.
- Make graph execution opt-in until it is at feature parity.

## Phase 1: Compatibility Scaffold

- Add `loop(items, viewFn)` and `loop(items, keyFn, viewFn)`.
- Render loop entries through the current html string/binding path.
- Preserve unique binding IDs inside loop entries.
- Expose keyed loop metadata in `graphParts`.
- Export `resolvePascalTags` for sibling packages that already depend on it.

## Phase 2: Graph Template IR

- Replace ad hoc `parts` metadata with a typed graph template object.
- Represent static, text, attr, prop, bool, event, component, and loop nodes.
- Preserve source order and parent/child edges.
- Track template-level anchors before touching live DOM.
- Keep `template`, `bindings`, `parts`, and `values()` as compatibility fields.

## Phase 3: Direct DOM Surgery

- Compile the graph template into DOM anchors.
- Patch text nodes by direct `nodeValue` updates.
- Patch attributes and properties on direct element references.
- Attach/detach event listeners only when handler identity changes.
- Patch keyed `loop` children by key: move, insert, update, remove.
- Fall back to the existing replace path for unsupported template shapes.

## Phase 4: State Dependency Edges

- Capture render-time state/signal reads per graph node.
- Connect HyperGraph data nodes to render nodes.
- Schedule only affected render nodes when state changes.
- Keep full component re-render as the debug and compatibility fallback.

## Breaking Change Assessment

This should not be a breaking change if delivered in layers. The public syntax can stay stable while the internal renderer grows from string output to graph output. The only breaking risk is if `loop(...)` semantics are changed after release, so the primitive should start small and explicit:

```js
loop(items, item => html`<li>${item.name}</li>`)
loop(items, item => item.id, item => html`<li>${item.name}</li>`)
```

## Validation

- Unit tests for loop rendering, nested bindings, and graph metadata.
- Existing html integration tests unchanged.
- Package build for `@uploop/html`.
- Sibling `uploop-ge` build, because it consumes the local html source directly.
