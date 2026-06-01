# Uploop

> **The update loop for the web.**

Uploop is a universal update-loop architecture for UI, data, events, storage, and side effects. It's not just another component framework — it's a small, standard-like runtime model where UI, data, style, route, motion, and effects are designed as an executable **HyperGraph**.

## Architecture

```
@uploop/core     - Pure update protocol (no DOM, no browser)
@uploop/html     - DOM/WebComponent adapter  
@uploop/store    - External store, selectors, derived state
@uploop/css      - Utility CSS engine
@uploop/router   - Route updater
@uploop/motion   - Frame/spring animation updater
```

**Core knows nothing about HTML.** No `HTMLElement`, no `customElements`, no `innerHTML`.

## Quick Start

```bash
npm install
npm run dev
```

## Demo: Counter

```js
import { html, component } from '@uploop/html'

const Counter = component('Counter', {
  state: { count: 0 },

  update: {
    inc: (s) => ({ count: s.count + 1 }),
    dec: (s) => ({ count: s.count - 1 })
  },

  view: (state, { send }) => html`
    <div>
      <h2>Count: ${state.count}</h2>
      <button @click=${() => send('inc')}>+</button>
      <button @click=${() => send('dec')}>-</button>
    </div>
  `
})

// Mount to DOM
Counter.mount(document.getElementById('root'))
```

## Demo: Todos

```js
import { html, component } from '@uploop/html'

const Todo = component('Todo', {
  state: { text: '', todos: [], filter: 'all' },

  update: {
    input: (s, text) => ({ ...s, text }),
    add: (s) => s.text.trim()
      ? { text: '', todos: [...s.todos, { id: Date.now(), text: s.text, done: false }] }
      : s,
    toggle: (s, id) => ({ 
      todos: s.todos.map(t => t.id === id ? { ...t, done: !t.done } : t) 
    })
  },

  view: (state, { send }) => html`
    <div>
      <input .value=${state.text} @input=${['input', e => e.target.value]}>
      <button @click=${() => send('add')}>Add</button>
      <ul>
        ${state.todos.filter(t => !t.done).map(todo => html`
          <li @click=${() => send('toggle', todo.id)}>
            ${todo.text}
          </li>
        `)}
      </ul>
    </div>
  `
})
```

## Core Concepts

### Everything is an Updater
An updater is not just a component. It can represent: UI component, request handler, animation frame, cache policy, database sync, signal, event stream, WebSocket channel.

### One-Way by Default, Two-Way by Protocol
```
Input → Update → Frame → Output
```

### Store is a Bus, Not Global State
Data types: `hot`, `cold`, `transient`, `stable`, `remote`, `derived`

### Frame is First-Class
```
micro-frame     - Instant UI patch
visual-frame    - requestAnimationFrame
network-frame   - Request/response cycle
```

### HyperGraph Model
Every component exports its design graph. This gives you: devtools, AI generation, visual editor, debugging, optimization.

## Why Uploop?

- **6KB gzip** core
- **No build step** — pure ESM, works from any CDN
- **No JSX** — standard template literals
- **CSP-safe** — no inline `onclick` handlers
- **WebComponent** native
- **HyperGraph** architecture — inspectable, optimizable, AI-friendly

## Roadmap

See [docs/PLAN.md](./docs/PLAN.md) and [docs/TODO.md](./docs/TODO.md).

## License

MIT
