# Uploop — Getting Started & How-To Guide

> **The update loop for the web.** Uploop is a universal update-loop architecture where UI, data, style, route, motion, and side effects are designed as an executable **HyperGraph**.

---

## Table of Contents

1. [What is Uploop?](#what-is-uploop)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [Component Syntax Reference](#component-syntax-reference)
5. [Template Syntax (html``)](#template-syntax-html)
6. [Lifecycle Methods](#lifecycle-methods)
7. [External Store (`@uploop/store`)](#external-store-uploopstore)
8. [Router (`@uploop/router`)](#router-uplooprouter)
9. [CSS Engine (`@uploop/css`)](#css-engine-uploopcss)
10. [State Machine (`@uploop/state-machine`)](#state-machine-uploopstate-machine)
11. [WebComponent Output](#webcomponent-output)
12. [Canvas & Graphics](#canvas--graphics)
13. [HyperGraph & Core API](#hypergraph--core-api)
14. [Comparison with React](#comparison-with-react)

---

## What is Uploop?

Uploop is not another React clone. It is a **runtime architecture** where every piece of your app — component state, external stores, CSS, routes, animations, even canvas draw calls — speaks the same protocol: `send(event, ...payload)` → update → view.

```
┌──────────────────────────────────────────────┐
│  @uploop/core      Pure update protocol      │
│  @uploop/html      DOM/WebComponent adapter   │
│  @uploop/store     External state bus         │
│  @uploop/css       Utility CSS engine         │
│  @uploop/router    Route updater              │
│  @uploop/state-machine   FSM engine           │
└──────────────────────────────────────────────┘
```

**Key differentiators:**
- **~6 KB gzip** core. No JSX, no build step, works from any CDN.
- **CSP-safe** — no inline `onclick` handlers (uses `@click` bindings).
- **One protocol everywhere** — component state, store, router, state machine all use the same `send()` / `get()` API.
- **HyperGraph export** — every component exports its structure as a graph (devtools, AI generation, visual editors).
- **Template literals, not JSX** — standard JavaScript, no transpiler needed.

---

## Quick Start

```bash
git clone <your-repo>
cd uploopjs
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The examples gallery is available at `http://localhost:5173/examples/`.

### Minimal Counter (from scratch)

```js
import { html, component } from '@uploop/html'

const Counter = component('Counter', {
  state: { count: 0 },

  update: {
    inc: (state) => ({ count: state.count + 1 }),
    dec: (state) => ({ count: state.count - 1 })
  },

  view: (state, { send }) => html`
    <div>
      <h2>${state.count}</h2>
      <button @click=${() => send('inc')}>+</button>
      <button @click=${() => send('dec')}>-</button>
    </div>
  `
})

Counter.mount(document.getElementById('root'))
```

That's it. No hooks, no `useState`, no JSX, no `setState` callbacks. Just `state` → `update` → `view`.

---

## Core Concepts

### The Update Loop

Every Uploop component runs on a single loop:

```
User action → send('event', payload) → update handler → new state → view() → DOM patch
```

1. **`send()`** dispatches a named event with optional payload.
2. An **update handler** receives `(state, ...payload)` and returns a **partial state** (merged with existing state via `{ ...oldState, ...returnValue }`).
3. The **view** function is called with the new state, returning a template literal.
4. The DOM is **patched in-place** (innerHTML replacement with binding preservation).

### State is Immutable (by convention)

Update handlers never mutate state. They always return a new partial object:

```js
update: {
  add: (state) => ({
    // Return only what changed. Merged with current state.
    todos: [...state.todos, { id: Date.now(), text: state.text, done: false }],
    text: ''
  })
}
```

### Everything is an Update Handler

An update handler `(state, ...args) => partialState` is the same whether it lives in a component, a store, a router, or a state machine. This is the **HyperGraph** principle — uniform data flow.

---

## Component Syntax Reference

### `component(name, config)`

```js
import { html, component } from '@uploop/html'

const MyComp = component('MyComp', {
  // ─── State ──────────────────────────────────
  state: {
    count: 0,
    name: 'World'
  },

  // ─── Update handlers ────────────────────────
  // Each handler: (state, ...payload) => partialState
  update: {
    inc: (state, by = 1) => ({ count: state.count + by }),
    setName: (state, name) => ({ name })
  },

  // ─── Effects ────────────────────────────────
  // Run on every state change (names match state keys, not events)
  effect: {
    count: (ctx) => {
      console.log('count changed to:', ctx.get().count)
    }
  },

  // ─── View ───────────────────────────────────
  view: (state, ctx) => html`
    <div>
      <h1>Hello ${state.name}</h1>
      <p>Count: ${state.count}</p>
      <button @click=${() => ctx.send('inc')}>+</button>
    </div>
  `
})
```

### Config fields

| Field | Type | Description |
|-------|------|-------------|
| `state` | `Object` | Initial state. Always a plain object. |
| `update` | `Object<string, Function>` | Event → handler map. Handler receives `(state, ...payload)`. |
| `effect` | `Object<string, Function>` | Side-effect handlers. Named after state keys. |
| `view` | `Function` | `(state, { send, get, html }) => HtmlTemplate` |
| `compose` | `Function` | `(ctx) => HtmlTemplate[]` — declarative child components. See [Canvas](#canvas--graphics). |
| `computeParts` | `Function` | `(state) => Object` — derive child props from state. |
| `classes` | `Object` | Map of child component classes available to `compose`. |
| `frame` | `'micro' \| 'visual' \| 'idle' \| 'manual'` | Frame scheduling mode. `'visual'` = requestAnimationFrame. |
| `execution` | `Object \| Function` | Custom DOM execution strategy. |
| `mount` | `Function` | `(element, ctx)` — called after DOM mount. |
| `unmount` | `Function` | `(element, ctx)` — called before DOM removal. |

### View context (`ctx`)

The second argument to `view()` provides:

| Property | Description |
|----------|-------------|
| `send(event, ...args)` | Dispatch an update event. |
| `get()` | Get current state. |
| `html` | The tagged template literal function (injected automatically). |
| `find(selector)` | `querySelector` on the component's root. |
| `registerResource(name, { save, restore })` | Register restore-able state (survives innerHTML). |

---

## Template Syntax (`html`)

Uploop uses **tagged template literals**, not JSX. The `html` function processes interpolated values into DOM bindings.

### Text interpolation

```js
html`<span>Count: ${state.count}</span>`
```

### Event bindings (`@` prefix)

```js
// Simple: just send an event
html`<button @click=${() => send('inc')}>+</button>`

// With payload:
html`<button @click=${() => send('remove', item.id)}>×</button>`

// Transformed event: [eventName, transformFn]
html`<input @input=${['setName', e => e.target.value]}>`

// Scoped to a CSS selector (delegation):
html`<ul @click=${['toggle', e => e.target.dataset.id, 'li']}>...</ul>`
```

The third argument (selector) enables event delegation — the handler fires only if the event target matches the selector. No inline `onclick` attributes are used; bindings are attached via `addEventListener`.

### Property bindings (`.` prefix)

```js
// One-way: state → DOM property
html`<input .value=${state.text}>`

// Two-way shorthand (both .value and @input combined internally):
html`<input .value=${state.text} @input=${['input', e => e.target.value]}>`
```

### Boolean attribute bindings (`?` prefix)

```js
html`<input type="checkbox" ?checked=${todo.done}>`
// Toggles the "checked" attribute based on truthiness.
```

### Nested templates

```js
html`<ul>
  ${items.map(item => html`<li>${item.text}</li>`)}
</ul>`
```

Templates are composable — each `html` call returns a `HtmlTemplate` object with `toString()` support.

### Conditional rendering

```js
${condition ? html`<p>Yes</p>` : ''}
// or
${items.length === 0 ? html`<p>No items</p>` : ''}
```

---

## Lifecycle Methods

### `mount(element, ctx)`

Called after the component's DOM is inserted. Use it to initialize third-party libraries, register resources, or observe the DOM.

```js
const MyComp = component('MyComp', {
  // ... state, update, view ...
  mount: (el, ctx) => {
    // el is the component root element
    console.log('mounted', el)

    // Register a resource that survives re-renders
    ctx.registerResource('canvas', {
      save: () => canvas.toDataURL(),
      restore: (data, root) => {
        const img = new Image()
        img.onload = () => root.querySelector('canvas').getContext('2d').drawImage(img, 0, 0)
        img.src = data
      }
    })
  }
})
```

### `unmount(element, ctx)`

Called before the component is removed from the DOM. Clean up timers, observers, event listeners.

```js
unmount: (el, ctx) => {
  clearInterval(el._timer)
}
```

### Effects

Effects run on state changes. The effect name matches a state key:

```js
effect: {
  count: (ctx) => {
    // Runs whenever state.count changes
    localStorage.setItem('count', ctx.get().count)
  }
}
```

Effects receive `{ get, send, onDispose }`. Use `onDispose(fn)` to register cleanup.

### `frame` scheduling

Controls when view re-renders are applied:

- `'micro'` (default) — queueMicrotask, instant but non-blocking.
- `'visual'` — requestAnimationFrame, for canvas/animations.
- `'idle'` — requestIdleCallback, for low-priority updates.
- `'manual'` — explicit `flush()` call only.

```js
component('Animated', {
  frame: 'visual',  // renders on each rAF
  state: { x: 0 },
  view: (state) => html`<div>${state.x}</div>`
})
```

---

## External Store (`@uploop/store`)

Stores are standalone update loops shared across components. They use the exact same `send()` / `get()` API.

### Creating a store

```js
import { store } from '@uploop/store'

const userStore = store({
  name: 'user',
  state: {
    name: '',
    email: '',
    loggedIn: false
  },
  update: {
    login: (state, user) => ({ ...user, loggedIn: true }),
    logout: () => ({ name: '', email: '', loggedIn: false }),
    updateName: (state, name) => ({ name })
  }
})

// Use it anywhere
userStore.send('login', { name: 'Alice', email: 'alice@ex.com' })
console.log(userStore.get())   // { name: 'Alice', ... }
console.log(userStore.select('name'))  // 'Alice'
```

### Store API

| Method | Description |
|--------|-------------|
| `get()` | Get full state. |
| `set(patch)` | Directly set state (bypasses update handlers). |
| `send(event, ...args)` | Dispatch event through registered update handlers. |
| `subscribe(fn)` | Subscribe to state changes. Returns unsubscribe function. |
| `select(keyPath \| fn)` | Select a slice of state. String or function. |
| `derived(fn)` | Create a derived signal from state changes. |
| `dispose()` | Clean up all subscriptions. |
| `describe()` | Export HyperGraph manifest. |

### Selectors

```js
import { createSelector } from '@uploop/store'

const activeTodoCount = createSelector(
  (state) => state.todos.filter(t => !t.done).length
)

// Usage
console.log(activeTodoCount(todoStore.get()))
```

### Derived values

```js
const nameSignal = userStore.derived(state => state.name.toUpperCase())
nameSignal.subscribe(name => console.log('Name changed:', name))
```

### Persistence

```js
import { persist } from '@uploop/store'

persist(userStore, 'user', {
  storage: localStorage,
  serialize: JSON.stringify,
  deserialize: JSON.parse
})
```

---

## Router (`@uploop/router`)

The router is a store with route-specific state. Navigation is just `send('navigate', path)`.

```js
import { createRouter } from '@uploop/router'
import { html, component } from '@uploop/html'

const router = createRouter({
  '':          { view: () => html`<h2>Home</h2>` },
  'about':     { view: () => html`<h2>About</h2>` },
  'users/:id': { view: (state) => html`<h2>User ${state.params.id}</h2>` },
  '*':         { view: () => html`<h2>404</h2>` }
}, {
  base: '',      // base path prefix
  useHash: false // true for hash-based routing (#/path)
})

const App = component('App', {
  state: { currentRoute: '' },
  view: (state) => html`
    <div>
      <nav>
        <a href="/" @click=${router.link('')}>Home</a>
        <a href="/about" @click=${router.link('about')}>About</a>
      </nav>
      <main>${router.render()}</main>
    </div>
  `
})
```

### Router API

| Method | Description |
|--------|-------------|
| `navigate(path)` | Navigate to a path (updates URL + state). |
| `link(path)` | Returns a click handler that prevents default + navigates. |
| `match()` | Get current matched route definition. |
| `render()` | Call current route's `view()` with state. |
| `params()` | Get route params (e.g. `{ id: '42' }`). |
| `query()` | Get query string params. |
| `send('navigate', path)` | Low-level navigation (same as `navigate()`). |
| `send('setQuery', obj)` | Update search params without full navigation. |
| `subscribe(fn)` | Subscribe to route changes. |
| `describe()` | Export HyperGraph manifest. |

### Dynamic route params

Routes support `:param` segments:

```js
'products/:category/:id': { view: (state) => html`
  <h2>${state.params.category} — ${state.params.id}</h2>
` }
```

---

## CSS Engine (`@uploop/css`)

`@uploop/css` is a zero-dependency, themable, tree-shakeable utility CSS engine. Think Tailwind but generated at runtime, with scoped styles and no build step.

### Utility classes (Tailwind-like)

```js
import { inject, generateUtilities, markUsed, watchDOM } from '@uploop/css'

// Generate and inject all utility classes
inject(generateUtilities())

// In your view, classes work like Tailwind:
html`<div class="d-flex p-4 gap-3 rounded-2 bg-primary text-white">
  <span class="font-bold text-2">Hello</span>
</div>`
```

### Available utility groups

| Group | Examples |
|-------|----------|
| **spacing** | `p-4`, `m-2`, `px-3`, `py-1`, `gap-3`, `rounded-2` |
| **colors** | `text-primary`, `bg-success`, `border-danger` |
| **display** | `d-flex`, `d-grid`, `d-block`, `d-none` |
| **flex** | `flex-row`, `flex-column`, `justify-center`, `items-start` |
| **grid** | `grid-cols-3`, `grid-cols-12` |
| **sizing** | `w-4`, `h-2`, `max-w-5`, `min-h-3` |
| **typography** | `text-center`, `font-bold`, `text-3`, `font-mono` |
| **borders** | `border-solid`, `border-1` |
| **shadows** | `shadow-2`, `shadow-4` |
| **position** | `pos-relative`, `pos-absolute`, `pos-fixed` |
| **overflow** | `overflow-hidden`, `overflow-auto` |
| **cursor** | `cursor-pointer`, `cursor-grab` |

### Theming

```js
import { theme, lightTheme, darkTheme, extendTheme, applyTheme } from '@uploop/css'

const brandTheme = extendTheme(lightTheme, {
  name: 'brand',
  colors: {
    primary: '#4f46e5',
    secondary: '#7c3aed'
  }
})

// Switch theme at runtime
applyTheme(lightTheme)   // light mode
applyTheme(darkTheme)    // dark mode
applyTheme(brandTheme)   // custom brand
```

### Chainable style builder (jQuery-inspired)

```js
import { css } from '@uploop/css'

const cardStyle = css()
  .prop('padding', '1.25rem')
  .prop('border-radius', '12px')
  .prop('background', 'var(--color-surface)')
  .prop('box-shadow', '0 2px 8px rgba(0,0,0,0.08)')
  .done()

// Use the generated class
html`<div class="${cardStyle.className}">Card content</div>`
```

Or use the Proxy-based shorthand:

```js
import { css2 } from '@uploop/css'

const btn = css2().bg('primary').text('white').px(4).py(2).rounded('md')
// btn.className = 'up-css-42'
```

### Dynamic & scoped styles

```js
import { createNamedStyle, createGradientStyle, createEventStyle } from '@uploop/css'

// Gradient button
const gradientBtn = createGradientStyle({
  colors: ['var(--color-primary)', 'var(--color-secondary)'],
  dir: '135deg'
})

// Hover effect
const liftStyle = createEventStyle({
  event: 'hover',
  transform: 'translateY(-2px)',
  boxShadow: '0 6px 20px rgba(0,0,0,0.12)'
})

// Use both
html`<button class="${gradientBtn.className} ${liftStyle.className}">Click</button>`
```

### Color utilities

```js
import { lighten, darken, alpha, contrast, shades } from '@uploop/css'

lighten('#646cff', 30)  // → lighter blue
darken('#646cff', 30)   // → darker blue
alpha('#646cff', 0.4)   // → rgba
contrast('#646cff')     // → 'white' or 'black' for readability
shades('#646cff', 10)   // → array of 10 shade variants
```

### Responsive variants

Variants use a `prefix:class` syntax:

```js
// hover variant
html`<button class="hover:bg-primary">Hover me</button>`

// responsive: sm (≥576px), md (≥768px), lg (≥992px), xl (≥1200px)
html`<div class="sm:d-flex md:grid-cols-2 lg:w-4">Responsive</div>`

// dark mode
html`<div class="dark:text-white">Visible in dark mode</div>`

// focus
html`<input class="focus:border-primary">`
```

### Pre-built animations

```js
import { injectAnimations, ANIMATIONS } from '@uploop/css'

injectAnimations()  // inject keyframe classes

html`<div class="${ANIMATIONS.fadeIn}">Fade in</div>`
html`<div class="${ANIMATIONS.slideUp}">Slide up</div>`
html`<div class="${ANIMATIONS.bounce}">Bounce</div>`
```

Modifiers: `up-anim-fast`, `up-anim-slow`, `up-anim-delay-100` through `500`. Honors `prefers-reduced-motion`.

### Runtime optimizer

```js
import { watchDOM, getUsedClasses, stats } from '@uploop/css'

// Track which classes are actually used in the DOM
watchDOM()

// Prune unused rules on injection
// Stats show the savings
console.log(stats())  // { total: 1500, used: 42, savings: '97%' }
```

---

## State Machine (`@uploop/state-machine`)

For complex UI flows with constrained state transitions (forms, wizards, multi-step animations).

```js
import { createStateMachine } from '@uploop/state-machine'

const formMachine = createStateMachine({
  name: 'form',
  initial: 'idle',
  data: { errors: {} },
  states: {
    idle: {
      on: { INPUT: 'dirty' }
    },
    dirty: {
      on: { INPUT: 'dirty', VALIDATE: 'validating' }
    },
    validating: {
      entry: (state) => {
        // Validate on enter
        const errors = validate(state.data)
        return { errors }
      },
      on: { VALID: 'valid', INVALID: 'invalid', INPUT: 'dirty' }
    },
    valid: {
      on: { INPUT: 'dirty', SUBMIT: 'submitting' }
    },
    invalid: {
      on: { INPUT: 'dirty' }
    },
    submitting: {
      on: { SUCCESS: 'submitted', FAIL: 'error' }
    },
    submitted: {
      on: { RESET: 'idle' }
    },
    error: {
      on: { SUBMIT: 'submitting' }
    }
  }
})

// Send events to transition
formMachine.send('INPUT')      // idle → dirty
formMachine.send('VALIDATE')   // dirty → validating

// Query current state
formMachine.is('valid')        // false
formMachine.can('SUBMIT')      // true
formMachine.value()            // 'dirty'
formMachine.available()        // ['INPUT', 'VALIDATE']
```

### State Machine API

| Method | Description |
|--------|-------------|
| `send(event)` | Trigger a transition. |
| `is(stateName)` | Check if currently in given state. |
| `can(event)` | Check if transition is valid from current state. |
| `value()` | Get current state name. |
| `available()` | Get valid transitions from current state. |
| `get()` | Get full state (value, prev, data). |
| `subscribe(fn)` | Subscribe to state changes. |
| `visualize()` | Print ASCII state diagram. |
| `describe()` | Export HyperGraph manifest. |

---

## WebComponent Output

Uploop components can be registered as native WebComponents:

```js
import { component, defineElement } from '@uploop/html'

const MyButton = component('MyButton', {
  state: { label: 'Click me', count: 0 },
  update: {
    click: (state) => ({ count: state.count + 1 })
  },
  view: (state, { send }) => html`
    <button @click=${() => send('click')}>
      ${state.label} (${state.count})
    </button>
  `
})

// Register as <my-button>
defineElement('my-button', MyButton, { useShadowDOM: true })
```

Usage in HTML (no JS needed after registration):

```html
<my-button data-label="Save"></my-button>
```

Pass props via `data-*` attributes or a `props` JSON attribute:

```html
<my-button props='{"label":"Delete"}'></my-button>
```

---

## Canvas & Graphics

Uploop supports canvas rendering with built-in frame timing and child composition — all through the same component model.

### `createComponentType(typeDefaults)`

Define a base type with shared config. All instances inherit state, update, effect, and lifecycle methods.

```js
import { createComponentType } from '@uploop/html'

const Drawable = createComponentType({
  state: { x: 0, y: 0, visible: true },
  cycleMethods: {
    composition: 'create',  // use create() not createHtml()
    draw: true              // call draw() each frame
  }
})

const Circle = Drawable({
  name: 'Circle',
  state: { radius: 30, color: '#e74c3c' },
  draw: (ctx, state, children, { elapsed, delta }) => {
    ctx.beginPath()
    ctx.arc(state.x, state.y, state.radius, 0, Math.PI * 2)
    ctx.fillStyle = state.color
    ctx.fill()
  }
})
```

### Frame-driven components

Set `frame: 'visual'` for automatic `requestAnimationFrame` scheduling:

```js
const Scene = component('Scene', {
  frame: 'visual',
  state: { running: false, speed: 1 },

  classes: { Sky, Road, Car },

  computeParts: (state) => ({
    cars: [/* derived car positions */]
  }),

  compose: ({ cars, html: h }) => [
    h`<Sky w=${700} h=${300}/>`,
    h`<Road w=${700} h=${300}/>`,
    ...cars.map(c => h`<Car x=${c.x} y=${c.y} speed=${c.speed}/>`)
  ],

  draw: (ctx, state, children, { elapsed }) => {
    // children are the composed Sky, Road, Car instances
    for (const child of children) {
      if (child.draw) child.draw(ctx, child.loop.get(), child.children, { elapsed })
    }
  }
})
```

### Virtual containers

Canvas child components are mounted in virtual containers, not real DOM. The canvas element declares this:

```html
<canvas uploop-containers="virtual" uploop-scope="cars">
  <scene w="700" h="300" running="${state.running}" speed="${state.speed}"></scene>
</canvas>
```

This resolves canvas context automatically — no manual `getContext('2d')`.

---

## HyperGraph & Core API

`@uploop/core` is the protocol layer. It knows nothing about HTML, DOM, or browsers.

### `createLoop(config)`

The core loop primitive. Components, stores, routers, and state machines all wrap this:

```js
import { createLoop } from '@uploop/core'

const loop = createLoop({
  name: 'myLoop',
  state: { count: 0 },
  update: {
    inc: (state) => ({ count: state.count + 1 })
  },
  effect: {
    count: (ctx) => console.log('count:', ctx.get().count)
  },
  maxEventDepth: 100,          // guard: max chained events
  maxEventsPerTransaction: 0   // guard: 0 = disabled
})

loop.send('inc')
loop.get()    // { count: 1 }
loop.describe()  // HyperGraph manifest
```

### `createGraph(config)`

Architecture-first primitive. Nodes declare `reads`/`writes` explicitly, edges define topology, and the Runner compiles dependency indexes:

```js
import { createGraph } from '@uploop/core'

const graph = createGraph({
  name: 'search',
  nodes: {
    query:    { type: 'data', default: '' },
    results:  { type: 'data', default: [] },
    loading:  { type: 'data', default: false },
    search:   { type: 'update', reads: ['query'], writes: ['results', 'loading'], run: async (data) => {
      return { loading: true, results: await fetchResults(data.query) }
    }},
    renderResults: { type: 'view', reads: ['results', 'loading'], run: (data) => {
      console.log('Render:', data.results)
    }}
  },
  edges: [
    ['search-input', 'search'],  // event → update
    ['query', 'search']          // data → depends
  ]
})

graph.send('search-input', 'hello')  // triggers the search update
graph.get()  // { query: 'hello', results: [...], loading: false }
```

### Frame scheduling modes

```js
// Micro (default): queueMicrotask, for standard UI updates
createLoop({ frame: 'micro' })

// Visual: requestAnimationFrame, for canvas/animations
createLoop({ frame: 'visual' })

// Idle: requestIdleCallback, for low-priority background work
createLoop({ frame: 'idle' })

// Manual: explicit flush only
createLoop({ frame: 'manual' })
```

### Guards

The loop protects against infinite chains:

- `maxEventDepth` (default 100) — rejects events deeper than N chained `send()` calls.
- `maxEventsPerTransaction` (default 0 = disabled) — rejects events if same event fires more than N times in a single transaction.

---

## Comparison with React

Honest comparison of approaches.

| Aspect | React | Uploop |
|--------|-------|--------|
| **Bundle size** | ~42 KB gzip (react + react-dom) | ~6 KB gzip core |
| **Build step** | JSX requires Babel/TypeScript | Standard ESM, no transpiler needed |
| **Templating** | JSX (XML-in-JS) | Tagged template literals |
| **State management** | `useState`, `useReducer`, hooks | Single `state` object + `update` handlers |
| **Component definition** | Function with hooks | Configuration object with `state`, `update`, `view` |
| **Rendering** | Virtual DOM diff → DOM patch | innerHTML replacement with binding preservation |
| **Event handling** | JSX `onClick={fn}` → synthetic events | `@click=${fn}` → native `addEventListener` |
| **CSP-safe** | No (inline handlers) | Yes (no inline `onclick`) |
| **External store** | Zustand, Redux, Jotai, etc. | Built-in `@uploop/store` (same protocol) |
| **Routing** | React Router (external) | Built-in `@uploop/router` (same protocol) |
| **CSS approach** | CSS-in-JS, CSS Modules, Tailwind | Built-in `@uploop/css` (runtime utility engine) |
| **State machine** | XState (external) | Built-in `@uploop/state-machine` (same protocol) |
| **Side effects** | `useEffect` (lifecycle-based) | `effect` handlers (data-driven, named by state key) |
| **Child composition** | JSX children / props.children | `compose()` + `computeParts()` (declarative) |
| **Frame control** | Manual rAF / `useRef` | Built-in `frame: 'visual'` scheduling |
| **WebComponent** | Requires wrapper | Native `defineElement()` output |
| **DevTools** | React DevTools | HyperGraph describe() — inspectable at runtime |
| **AI-friendly** | JSX + hooks = hard to statically analyze | Object config + HyperGraph manifest = machine-readable |
| **Canvas/graphics** | No built-in support | First-class `draw()`, frame scheduling, virtual containers |
| **Learning curve** | Moderate (hooks rules, closures) | Lower (plain objects, no hook rules) |

### Where Uploop is better

1. **No hook rules.** No "rules of hooks," no dependency arrays, no stale closures. Update handlers are pure functions that receive state and return a patch.

2. **Uniform protocol.** State, routing, CSS, effects, and animation all use `send()` / `get()`. Learn it once, use it everywhere.

3. **No build step.** Works from any CDN, any server. Import and go. Useful for prototyping, edge functions, and minimal setups.

4. **CSP-safe by design.** No inline `onclick` — all events are attached via `addEventListener`. Works with strict Content Security Policy headers.

5. **Canvas as first-class.** `draw()` callbacks with automatic rAF scheduling, virtual containers, and child composition. No manual canvas management.

6. **HyperGraph export.** Every component exports its structure. This enables devtools, visual editors, and AI code generation — similar to how GraphQL enables introspection.

### Where React is better

1. **Ecosystem.** React has a massive ecosystem of libraries, components, and tooling. Uploop is young — you'll build more from scratch.

2. **Virtual DOM diffing.** React's reconciliation algorithm is battle-tested for complex, deeply nested UIs with fine-grained updates. Uploop replaces innerHTML with binding preservation — sufficient for most cases but less optimized for massive lists with frequent mutations.

3. **React Native.** Uploop has no native mobile equivalent yet.

4. **Concurrent Mode / Suspense.** React's concurrent rendering for complex async orchestration has no equivalent in Uploop today.

5. **Server Components (RSC).** Uploop currently renders on the client. SSR/streaming is on the roadmap.

6. **Maturity.** React has 10+ years of production use, millions of users, and a well-funded team. Uploop is in active early development (v0.0.3).

### When to choose Uploop

- Prototypes and small-to-medium apps where bundle size matters.
- CSP-restricted environments (browser extensions, secure dashboards).
- Canvas-heavy interactive UIs (games, data viz, creative coding).
- Projects where you want a single mental model (everything is a loop).
- Edges/edge functions where no build step is an advantage.
- You're tired of hooks and want something simpler.

### When to choose React

- Large team projects with existing React expertise.
- Apps needing a rich third-party component ecosystem.
- React Native for cross-platform mobile.
- Complex async patterns requiring Suspense boundaries.
- Production-critical systems needing maximum community support.

### Honest verdict

Uploop is **not** a drop-in React replacement. It's a different philosophy: instead of component lifecycle hooks, you have a data-first update loop. Instead of JSX + virtual DOM, you have template literals + binding preservation. Instead of external libraries for every concern, you have a unified protocol that spans state, routes, CSS, and animations.

For the right project, Uploop is radically simpler. For a large React codebase, there's no migration path — and that's fine. Uploop isn't trying to be React. It's trying to be what comes _after_ components as the universal UI primitive.

---

## Package Reference

| Package | Import | Purpose |
|---------|--------|---------|
| `@uploop/core` | `{ createLoop, createGraph, createSignal, createFrame, batch, ... }` | Pure update protocol |
| `@uploop/html` | `{ html, component, defineElement, hydrate }` | DOM/WebComponent adapter |
| `@uploop/store` | `{ store, createSelector, derived, persist }` | External state bus |
| `@uploop/css` | `{ inject, theme, css, utility, variants, ANIMATIONS, ... }` | Utility CSS engine |
| `@uploop/router` | `{ createRouter }` | Route updater |
| `@uploop/state-machine` | `{ createStateMachine }` | FSM engine |

---

## Next Steps

- Browse the [examples gallery](../Sources/uploopjs/examples/) — counter, todo, form, cars (canvas), CSS demo, tetris, and more.
- Read the [Architecture Overview](./ARCHITECTURE.md) for the protocol-level design.
- Read the [Plan](./PLAN.md) and [TODO](./TODO.md) for upcoming features.
