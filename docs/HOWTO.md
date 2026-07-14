# HOWTO — Uploop Developer Guide

Get from zero to building Uploop components in 5 minutes.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
git clone https://github.com/atomixnmc/uploopjs.git
cd uploopjs
npm install
npm run dev        # starts Vite at http://localhost:3000
npm test           # run 192 tests
```

## Project Structure

```
uploopjs/
├── packages/          # 7 monorepo packages
│   ├── core/          #   createLoop, createSignal, createGraph, batch, frame
│   ├── html/          #   html``, component(), defineElement(), suspend()
│   ├── store/         #   store(), derived(), persist()
│   ├── router/        #   createRouter() — guards, layouts, lazy loading
│   ├── css/           #   theme(), utility(), variant(), inject()
│   ├── state-machine/ #   createStateMachine() — FSM with hooks
│   └── devutils/      #   InspectorPanel, event capture
├── examples/          # 19 demo components
│   ├── main.js        #   Demo gallery with tab navigation
│   └── index.html     #   Entry point
├── docs/              # PLAN.md, TODO.md, EXAMPLES.md, HOWTO.md
└── vite.config.mjs    # Vite config (root: examples/)
```

## Your First Component

Create `examples/hello/main.js`:

```js
import { html, component } from '@uploop/html'

export const Hello = component('Hello', {
  state: { name: 'World' },

  update: {
    setName: (s, name) => ({ ...s, name })
  },

  view: (state, { send }) => html`
    <div>
      <h1>Hello, ${state.name}!</h1>
      <input
        .value=${state.name}
        @input=${['setName', e => e.target.value]}
        placeholder="Enter name"
      />
    </div>
  `
})
```

Then register it in `examples/main.js` by adding to the imports and tab groups.

## Core Concepts

### 1. State → Update → View

```
User clicks button
  → @click binding calls send('inc')
  → update handler (state) => newState
  → state changes
  → view re-renders
```

### 2. Event Bindings

| Syntax | Purpose | Example |
|--------|---------|---------|
| `@click=${fn}` | Event listener | `@click=${() => send('add')}` |
| `@input=${[event, fn]}` | Event + payload | `@input=${['input', e => e.target.value]}` |
| `.prop=${value}` | Property sync | `.value=${state.text}` |
| `?bool=${value}` | Boolean attribute | `?checked=${todo.done}` |

### 3. Async Handlers (v0.3.0)

Use object-form handlers for declarative async behavior:

```js
update: {
  search: {
    debounce: 300,          // auto-debounced
    interruptible: true,    // auto AbortController
    run: async (state, query, { signal }) => {
      const res = await fetch(`/api?q=${query}`, { signal })
      return { results: await res.json() }
    }
  }
}
```

Configure error handling:

```js
const loop = createLoop({
  state: { data: null },
  error: { fetch: { retry: 3, fallback: { data: [] } } },
  cache: { data: { ttl: 60000, swr: true } },
  update: {
    fetch: { run: async () => { /* ... */ } }
  }
})
```

Use `suspend()` in views:

```js
import { suspend } from '@uploop/html'

// In view:
suspend(loop, 'results', 'fetch', {
  loading: () => html`<div>Loading...</div>`,
  error: (err, { retry }) => html`<div>Error: ${err.message} <button @click=${retry}>Retry</button></div>`,
  render: (data) => html`<ul>${data.map(d => html`<li>${d}</li>`)}</ul>`
})
```

### 4. External Store

```js
import { store, persist, derived } from '@uploop/store'

const cart = store({
  state: { items: [] },
  update: {
    add: (s, item) => ({ items: [...s.items, item] }),
    remove: (s, id) => ({ items: s.items.filter(i => i.id !== id) })
  }
})

persist(cart, { key: 'cart', include: ['items'] })
const total = cart.derived(s => s.items.reduce((sum, i) => sum + i.price, 0))
```

### 5. Router

```js
import { createRouter } from '@uploop/router'

const router = createRouter({
  '': { view: HomePage },
  'users/:id': { view: UserPage },
  'admin': { view: AdminPage, guard: (s) => user.isAdmin },
  '*': { view: NotFound }
}, { useHash: true })

// In component:
router.render()          // current view
router.navigate('users/42')  // navigate
router.link('about')     // anchor click handler
router.params()          // { id: '42' }
```

### 6. State Machine

```js
import { createStateMachine } from '@uploop/state-machine'

const light = createStateMachine({
  initial: 'red',
  states: {
    red:    { on: { NEXT: 'green' }, entry: () => ({ color: '#f44' }) },
    yellow: { on: { NEXT: 'red' },   entry: () => ({ color: '#fa0' }) },
    green:  { on: { NEXT: 'yellow' },entry: () => ({ color: '#4c4' }) }
  }
})

light.send('NEXT')   // transition
light.is('green')    // check state
light.can('NEXT')    // valid transition?
light.data           // { color: '#4c4' }
```

## Testing

```bash
npm test                    # all 192 tests
npx vitest run packages/core/test/loop.test.js  # single file
```

Test structure mirrors source: `packages/<name>/test/<name>.test.js`.

## Building

```bash
npm run build   # vite build → dist/
```

The `dist/` output is deployed to GitHub Pages via Actions.

## Debugging

Click the ⚡ button (bottom-left) in the demo gallery to open the **HyperGraph Inspector** — 8 tabs showing Graph, Nodes, Edges, State, Events, Signals, Components, and Metadata for the active example.

Enable dev-mode validation:

```js
const loop = createLoop({
  dev: true,  // warns on unused keys, unknown events
  // ...
})
```

## Docs

- [EXAMPLES.md](./EXAMPLES.md) — detailed breakdown of all 20 examples
- [PLAN.md](./PLAN.md) — roadmap and key design decisions
- [TODO.md](./TODO.md) — task tracker with completion status
