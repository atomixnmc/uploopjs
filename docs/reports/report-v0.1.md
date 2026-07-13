# Uploop v0.0.1 — Codebase Evaluation Report

> **Date:** 2026-06-01
> **Scope:** `packages/core`, `packages/html`, `packages/store`, `examples/`
> **Goal:** Evaluate code quality, identify what works and what doesn't, and chart a path toward React/Solid-level DX without JSX.

---

## Summary

Uploop has a **genuinely novel architecture** (HyperGraph, first-class frames, event pipeline with guards) and a **good template syntax** (`@click`, `.prop`, `?bool`). However, the current render strategy — `innerHTML` replacement on every state change — forces a cascade of workarounds that make the codebase feel hacky. Fixing the render pipeline eliminates ~80% of the ugly code.

---

## 🟢 What's Good

### 1. HyperGraph Architecture

Every component exports an inspectable graph of typed nodes and edges via `describe()`. This is something React, Solid, and Vue don't offer at the framework level. It makes DevTools, debugging, and visualization first-class.

```json
{
  "kind": "uploop.loop",
  "name": "Counter",
  "nodes": {
    "state": { "type": "data" },
    "inc":   { "type": "update", "reads": ["state"], "writes": ["state"] },
    "view":  { "type": "view", "dependsOn": ["state"] }
  },
  "edges": [["state","view"], ["inc","state"], ["inc","view"]]
}
```

**File:** `packages/core/src/loop.js`, `packages/core/src/graph.js`

### 2. Core/HTML Separation

`@uploop/core` imports zero browser APIs. Same architectural instinct as `react` vs `react-dom`. Dependency arrow is correct:

```
core ← store ← html ← router
```

No DOM, no `HTMLElement`, no `innerHTML`, no CSS in core.

### 3. Event Pipeline with Guards

Every `send()` creates a typed **EventEnvelope** with:

- Unique `id`
- `cause` field (tracks which event triggered this one)
- `depth` counter (prevents infinite recursion)
- `transaction` grouping
- `maxEventDepth` and `maxEventsPerTransaction` guards

This makes event chains debuggable and prevents runaway cascades — a real concern in event-driven architectures that most frameworks ignore.

**File:** `packages/core/src/loop.js` (lines 70–170)

### 4. Frame Scheduler as First-Class

`micro | visual | idle | manual` scheduling is baked into the core, not bolted on. Components can declare their scheduling needs:

```js
const Scene = Drawable({
  frame: "visual",   // auto-rAF, elapsed/delta injected
  draw: (ctx, state, children, { elapsed }) => { ... }
})
```

**File:** `packages/core/src/frame.js`

### 5. CSP-Safe Event Binding

Instead of inline `onclick="..."` (blocked by strict CSP), Uploop uses `addEventListener`:

```js
html`<button @click=${handler}>Click</button>`
// → <button data-up-event="click:0">Click</button>
// → applyBindings() → addEventListener('click', handler)
```

**File:** `packages/html/src/html.js`, `packages/html/src/events.js`

### 6. `createComponentType` — Higher-Order Archetypes

A factory for reusable component classes with shared lifecycle:

```js
const Drawable = createComponentType({
  cycleMethods: { composition: "create", draw: true }
})

const Wheel = Drawable({
  name: "Wheel",
  state: { radius: 14 },
  draw: (ctx, s, _c, { elapsed }) => { /* render */ }
})
```

This is the right composability pattern — define a class of components once, instantiate many.

**File:** `packages/html/src/component.js` (lines 509–571)

### 7. `computeParts` + `compose` — Reactive Children

In the Cars example, `Car` computes child positions from its own state, and children react automatically:

```js
// Car: state.x changes → computeParts recomputes → Wheel/Door get new props
computeParts: (s) => ({
  wheels: s.wheelOffsets.map(wo => ({ x: s.x + wo.ox, y: s.y + wo.oy })),
  doors:  s.doorOffsets.map(d => ({ x: s.x + d.ox, y: s.y + d.oy }))
}),
compose: ({ wheels, doors, html: h }) => [
  ...wheels.map(w => h`<Wheel x=${w.x} y=${w.y}/>`),
  ...doors.map(d => h`<Door x=${d.x} y=${d.y}/>`)
]
```

**File:** `examples/cars/main.js`

### 8. Persistent Resource Management

Canvas, video, and other "live" DOM elements survive re-renders via `save()` / `restore()`. This is a real problem (even React portals don't fully solve it) and the approach is creative.

**File:** `packages/html/src/component.js` (lines 53–75, 296–318)

---

## 🔴 What's Bad

### 1. `innerHTML` Replacement Destroys the DOM Every Render

**This is the root cause of most problems.** On every state change:

```
state changes → view() → html string → element.innerHTML = htmlStr
                                           ↑
                                     destroys all DOM state
```

This causes:

| Problem | Impact |
|---|---|
| **Performance** | Full DOM teardown + rebuild on every keystroke |
| **State loss** | Input focus, cursor position, scroll position, CSS transitions, iframe state — all gone |
| **Canvas wipe** | Every canvas drawing is erased (hence `saveResources`/`restoreResources`) |
| **Event listener loss** | All listeners destroyed, must be rebound via `applyBindings()` |

React avoids this with Virtual DOM diffing. SolidJS avoids it by tracking which DOM node is bound to which signal and updating only that node. Lit avoids it by cloning `<template>` once and patching bindings.

### 2. Index-Based Event Routing Is Fragile

```
data-up-event="click:0"
data-up-event="click:1"
```

When child templates nest inside parent templates, indices must be remapped:

```js
// html.js — fragile index arithmetic on nested templates
for (let bi = 0; bi < innerBindings.length; bi++) {
  const newIdx = offset + bi
  const oldIdx = innerBindings[bi].index
  innerBindings[bi].index = newIdx
  htmlStr = htmlStr.replace(
    new RegExp('data-up-event="' + innerBindings[bi].name + ':' + oldIdx + '"', 'g'),
    'data-up-event="' + innerBindings[bi].name + ':' + newIdx + '"'
  )
}
```

One off-by-one, one regex mismatch, and events silently go to the wrong handler. This is the **serialization problem** — you can't pass functions through strings, so you need an indirect naming scheme.

### 3. `component()` Is a 570-Line Monolith

One function handles:

- State initialization
- Update handler dispatch
- Effect system wiring
- View rendering (string, template, and instance variants)
- Mount lifecycle
- Canvas frame loop (`startFrameLoop` / `stopFrameLoop`)
- Focus preservation (`saveFocus` / `restoreFocus`)
- Persistent resource management
- Virtual container lifecycle
- Scope resolution
- Nested `create()` factory (228 lines)
- `componentTag` mini template parser

**File:** `packages/html/src/component.js` (entire file)

This needs decomposition into composable pieces: render pipeline, mount lifecycle, frame loop, resource manager — each as separate modules.

### 4. Global Scope Registry on `document.__uploop_scopes`

```js
registerScope("cars", { scene: Scene, sky: Sky, road: Road })
// stores on: document.__uploop_scopes = { cars: { scene: ..., sky: ... } }

// Later, in processVirtualContainers:
const Comp = resolveScope("cars", "scene")
// reads from: document.__uploop_scopes["cars"]["scene"]
```

Problems:

- **Implicit dependencies** — you can't see from the template which components are used
- **Breaks tree-shaking** — bundler can't trace string-based lookups
- **Prevents SSR** — `document` is undefined on the server
- **Name collisions** — two scopes with the same name clobber each other

Components should be importable values passed directly, not string-lookup entries on a global registry.

### 5. `html` Template Tag Uses Regex String Parsing

```js
const eventMatch = prevStr.match(/@(\w+)\s*=$/)  // detects @click=
const propMatch  = prevStr.match(/\.(\w+)\s*=$/)  // detects .value=
const boolMatch  = prevStr.match(/\?(\w+)\s*=$/)  // detects ?checked=
```

Edge cases that will break:

- `@click` appearing in text content or attribute values
- Multi-line templates where `=` and the next character are on different lines
- Unicode attribute names
- Expressions adjacent without whitespace: `@click=${fn}@focus=${fn2}`

A proper template parser (even a simple character-by-character one) would be more robust than regex-based matching.

---

## 🟠 What's Ugly / Hacky

### 1. Two-Pass Rendering with DOM Side-Channels

```js
processUploopAttributes(element, ctx)   // pass 1: capture → root._pendingVC
restoreResources(element)                // re-insert saved canvas
processVirtualContainers(element, ctx)   // pass 2: create instances on restored canvas
```

The ordering dependency between these passes is implicit. `_pendingVC` is smuggled through a DOM element property (`root._pendingVC`) — side-channel state management.

**File:** `packages/html/src/component.js` (lines 118–151)

### 2. The `_ownerSend` Property on Bindings

Each binding gets an ad-hoc `_ownerSend` property to track which component's `send()` should handle it:

```js
// component.js line ~110
if (!b._ownerSend) b._ownerSend = loop.send
```

Works, but the ownership model (parent `send` vs child `send`) is unclear from the API surface. A binding should know its owner by construction, not by mutation after the fact.

### 3. `componentTag` Reimplements JSX With Regex

```js
// Literal tag name: <Wheel x=${10} y=${20}/>
const tagMatch = raw.match(/^\s*<(\w+)([^>]*?)\s*\/>\s*$/s)

// Dynamic tag name: <${SomeClass} x=${10}/>
const dynMatch = raw.match(/^\s*<\x00(\d+)\x00([^>]*?)\s*\/>\s*$/s)

// Then parse attributes with a second regex pass
const attrRe = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\x00(\d+)\x00)/g

// Then parse boolean attributes with a third pass
const boolRe = /(\w+)(?=\s|$|\/>)/g
```

This is a fragile mini-parser built on regex. It doesn't handle self-closing tags with children, whitespace variations, or attribute edge cases.

**File:** `packages/html/src/html.js` (lines 437–490)

### 4. Focus Preservation via CSS Selector Reconstruction

To re-find a focused element after `innerHTML` destroys it:

```js
const selector = `input[type="text"][placeholder="What needs to be done?"]`
```

If conditional rendering changes the DOM structure between renders, the selector won't match and focus is lost anyway. This is a workaround for a problem that shouldn't exist — if you don't destroy the DOM, focus is never lost.

**File:** `packages/html/src/component.js` (lines 434–476)

### 5. Resource Save/Restore Re-inserts DOM Elements

After `innerHTML` nukes the canvas, `restoreResources()` physically moves the old canvas element back into the DOM:

```js
// find the old canvas, remove the new (empty) canvas, re-insert the old one
const dup = container.querySelector('canvas[data-up-provide]')
if (dup && dup !== el) dup.remove()
if (!container.contains(el)) container.insertBefore(el, ...)
```

This DOM surgery is clever but fragile and a clear symptom of the innerHTML approach.

---

## Root Cause Analysis

```
innerHTML replacement on every render
        │
        ├── destroys DOM state → saveResources / restoreResources
        ├── destroys input focus → saveFocus / restoreFocus
        ├── destroys canvas drawings → persistent resource system
        ├── requires rebinding events → index-based data-up-event markers
        ├── requires index remapping → fragile regex arithmetic
        └── requires two-pass processing → _pendingVC side-channel
```

**Every hacky/ugly item in this report exists because `innerHTML` destroys the DOM.** Fix the render pipeline and ~80% of the ugly code disappears.

---

## The Path Forward

### The Architecture You Want

```js
// Your syntax is GOOD — keep it
const view = html`
  <div>
    <h1>${state.title}</h1>                          // text binding
    <input .value=${state.text}                      // property binding
           @input=${['input', e => e.target.value]} /> // event binding
    <button ?disabled=${state.loading}               // boolean attribute
            @click=${() => send('submit')}>
      Submit
    </button>
  </div>
`

// What it SHOULD produce internally:
{
  template: <template>,     // cloneable DOM fragment (built once)
  bindings: [
    { type: 'text',  el: textNode, get: () => state.title },
    { type: 'prop',  el: inputEl,  name: 'value', get: () => state.text },
    { type: 'event', el: inputEl,  name: 'input', handler: ... },
    { type: 'bool',  el: buttonEl, name: 'disabled', get: () => state.loading },
    { type: 'event', el: buttonEl, name: 'click', handler: ... },
  ]
}

// Then on state change:
//   DON'T: element.innerHTML = newHtml
//   DO:    for each binding → if value changed → surgically update node
```

### Concrete Steps

#### Step 1: Switch from `innerHTML` to `<template>` Cloning + Patching

**Model: Lit, SolidJS**

- `html\`...\`` produces a `<template>` element and a binding map
- First render: clone template once, apply bindings, append to DOM
- Re-render: only update the specific text nodes, attributes, and properties that changed
- This eliminates: resource save/restore, focus preservation hacks, index remapping, two-pass processing

#### Step 2: Signal-Driven DOM Updates

**Model: SolidJS**

```js
// Bind a signal directly to a DOM node
createEffect(() => {
  textNode.data = signal.get()
})

// Bind a signal to an element property
createEffect(() => {
  inputEl.value = signal.get()
})
```

No "re-render everything" step — just the changed node. The signals already exist (`createSignal` in core), they just need to be wired to DOM bindings.

#### Step 3: Eliminate Index-Based Event Routing

With `<template>` cloning, you hold direct references to DOM elements. Bind event handlers during the initial clone, not via string markers + `querySelector`:

```js
// Instead of:
// htmlStr += `data-up-event="click:0"` → innerHTML → querySelector → addEventListener

// Do:
const button = template.content.querySelector('button')
button.addEventListener('click', handler)
```

#### Step 4: Eliminate the Global Scope Registry

Pass component references directly as values:

```js
// Instead of:
registerScope("cars", { scene: Scene })
// <scene w="700" h="300"/>  → resolveScope("cars", "scene")

// Do:
// Pass Scene directly as a value through the template
html`<${Scene} w=${700} h=${300} running=${state.running}/>`
```

The `componentTag` mini-JSX parser already handles `${Component}` — extend it instead of adding a parallel scope lookup path.

#### Step 5: Decompose `component()` into Composable Modules

```
packages/html/src/
  component.js       → thin orchestrator (~80 lines)
  render.js           → render pipeline (html → template → DOM)
  mount.js            → mount lifecycle
  frame-loop.js       → canvas rAF loop
  resources.js        → persistent resource management
  focus.js            → focus preservation (only needed as safety net)
  bindings.js         → template binding application
```

#### Step 6: Replace Regex Parsing in `html` Tag

The current approach of matching `@(\w+)\s*=$` on the preceding string is correct in concept but fragile in implementation. Instead:

```js
// Match from the template strings array, not regex on the joined string
const prefix = strings[i]  // the string BEFORE the ${expression}
const suffix = strings[i + 1]  // the string AFTER

// Check the end of prefix for binding markers
if (prefix.endsWith('@')) {
  // read event name from start of suffix (before first non-identifier char)
}
```

Or better: use a tiny character-level parser that walks the template parts.

---

## What NOT to Change

These are genuinely good and should be preserved:

- **HyperGraph model and `describe()`** — your differentiator
- **`@click` / `.prop` / `?bool` syntax** — good DX, keep it
- **Core/HTML separation** — architecture is correct
- **Event pipeline with depth/transaction guards** — robust
- **Frame scheduler** — first-class is right
- **`computeParts` + `compose` reactive children** — elegant
- **`createComponentType` factory** — right composability pattern

---

## Appendix: File-by-File Notes

| File | Lines | Verdict | Key Issue |
|---|---|---|---|
| `core/src/signal.js` | 36 | ✅ Clean | Solid, straightforward |
| `core/src/frame.js` | 72 | ✅ Clean | Well-designed scheduler |
| `core/src/loop.js` | 220 | ✅ Good | Event pipeline is the highlight |
| `core/src/graph.js` | 310 | ✅ Good | Architecture-first, maybe merge with loop |
| `core/src/effect.js` | 58 | ✅ Clean | Simple, composable |
| `core/src/batch.js` | 24 | ⚠️ Thin | Uses global state on function object |
| `core/src/scope.js` | 19 | ✅ Clean | Minimal, correct |
| `html/src/html.js` | 490 | 🔴 Problematic | Template engine needs rewrite |
| `html/src/component.js` | 571 | 🔴 Problematic | Monolith — needs decomposition |
| `html/src/dom.js` | 68 | ⚠️ Thin | `innerHTML` approach is the problem |
| `html/src/events.js` | 60 | ⚠️ Redundant | Will be replaced by direct binding |
| `html/src/element.js` | 110 | ✅ Good | WebComponent bridge is clean |
| `html/src/hydrate.js` | 28 | 🟡 Placeholder | Needs real implementation |
| `examples/counter/main.js` | 65 | ✅ Good | Clean demo, good showcase |
| `examples/todo/main.js` | 200 | ✅ Good | Best example — full CRUD |
| `examples/cars/main.js` | 530 | ⚠️ Complex | Good ideas, scope registry hurts it |
| `examples/fishes/main.js` | 635 | 🔴 Imperative | Doesn't showcase framework |

---

## Bottom Line

Uploop's **architecture** is ahead of where React was at v0.0.1. The HyperGraph model, event pipeline, and frame scheduler are genuinely good ideas that don't exist in other frameworks.

Uploop's **render pipeline** is behind. The `html` tag → string → `innerHTML` approach forces workarounds that make the codebase feel hacky.

**The fix is surgical, not fundamental.** Switch from string-based innerHTML replacement to template cloning + signal-driven DOM patching. Keep the template syntax, the HyperGraph, the event pipeline, and the component model. One architectural shift eliminates the vast majority of ugly code.
