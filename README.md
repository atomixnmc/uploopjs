<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/atomixnmc/uploopjs/main/docs/uploop-dark.svg">
    <img alt="Uploop" src="https://raw.githubusercontent.com/atomixnmc/uploopjs/main/docs/uploop-light.svg" width="480">
  </picture>
</p>

<p align="center">
  <strong>The HyperGraph UI Framework — components are inspectable graphs of typed nodes.</strong>
</p>

<p align="center">
  <a href="https://github.com/atomixnmc/uploopjs/actions/workflows/gh-pages.yml"><img src="https://github.com/atomixnmc/uploopjs/actions/workflows/gh-pages.yml/badge.svg" alt="Pages"></a>
  <a href="https://github.com/atomixnmc/uploopjs/actions/workflows/release.yml"><img src="https://github.com/atomixnmc/uploopjs/actions/workflows/release.yml/badge.svg" alt="Release"></a>
  <a href="#"><img src="https://img.shields.io/badge/tests-346%20passed-brightgreen" alt="Tests"></a>
  <a href="#"><img src="https://img.shields.io/badge/bundle-~26KB%20gzip-blue" alt="Size"></a>
  <a href="#"><img src="https://img.shields.io/badge/version-v0.5.6-orange" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-purple" alt="License"></a>
</p>

---

**Uploop** is not another component framework. It's a universal update-loop architecture where UI, data, events, style, routing, and side effects are designed as an executable **HyperGraph** — a collection of typed nodes connected by edges, inspectable at runtime.

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
Counter.mount(document.getElementById('root'))
```

## Why Uploop?

|                   | React + Ecosystem     | Uploop             |
|-------------------|-----------------------|--------------------|
| Bundle (gzip)     | ~54-65 KB             | **~26 KB**         |
| Build step        | Required (JSX)        | **None**           |
| CSP-safe          | No (inline handlers)  | **Yes**            |
| Architecture      | Component tree        | **HyperGraph**     |
| Async handling    | Manual boilerplate    | **Declarative metadata** |
| Inspector         | React DevTools        | **Built-in HyperGraph Inspector** |

- **~26 KB gzip** — ~40% smaller than React + Tailwind + Zustand + Router + XState combined
- **No build step** — pure ESM, works from CDN or local file
- **No JSX** — standard tagged template literals
- **CSP-safe** — `@click` uses `addEventListener`, no inline `onclick`
- **WebComponent native** — `defineElement()` produces custom elements
- **8 packages** — core, html, store, router, css, state-machine, sst, devutils — all sharing one update loop
- **Server-side rendering** — `renderToString()` + `hydrate()` in `@uploop/sst`
- **Remote loops** — `createRemoteLoop()` bridges client-server state over WebSocket
- **Service layer** — FeathersJS-style CRUD + real-time events on graph data nodes

## Packages

| Package | Description | Size |
|---------|-------------|------|
| `@uploop/core` | Update loop, signals, frames, graph engine, async metadata | 62 KB |
| `@uploop/html` | DOM adapter, template tag, WebComponent, suspend helper | 37 KB |
| `@uploop/store` | External store, selectors, derived values, persistence | 6 KB |
| `@uploop/router` | Route matching, guards, layouts, lazy loading | 9 KB |
| `@uploop/css` | Utility CSS engine, theme tokens, variants, animations | 53 KB |
| `@uploop/state-machine` | Finite state machine, entry/exit hooks, guards | 4 KB |
| `@uploop/sst` | SSR, hydration, remote loops, FeathersJS-style services | — |
| `@uploop/devutils` | HyperGraph Inspector, event capture, debug panel | — |

## Async Metadata — Zero Boilerplate

Declare async behavior as metadata on your handlers:

```js
const search = createLoop({
  state: { query: '', results: [] },
  cache:  { results: { ttl: 10000, swr: true } },
  error:  { search: { retry: 3, fallback: { results: [] } } },
  update: {
    search: {
      debounce: 300,           // ← auto-debounced
      interruptible: true,     // ← auto AbortController
      run: async (s, query, { signal }) => {
        const res = await fetch(`/api?q=${query}`, { signal })
        return { results: await res.json() }
      }
    }
  }
})
```

No manual `setTimeout`, `clearTimeout`, `AbortController`, loading flags, or error state — the framework handles it all.

## Quick Start

```bash
git clone https://github.com/atomixnmc/uploopjs.git
cd uploopjs
npm install
npm run dev
```

Open `http://localhost:3000` — you'll see the demo gallery with 20 examples.

🌐 **Live demo:** [atomixnmc.github.io/uploopjs](https://atomixnmc.github.io/uploopjs/)

## Server-Side Toolset (SST)

Uploop ships a **battery-included server framework** where HTTP, WebSocket, SQLite,
and multiplayer games are all wired through the same `createLoop` model — no
separate state management, no separate WebSocket library.

```bash
cd server-examples
pnpm install
pnpm dev          # node --watch → instant hot reload
```

Open **http://localhost:3500** — 10 pages on one port:

| Page | Tech |
|------|------|
| `/` | Landing with feature cards |
| `/counter` | SSR + hydration |
| `/blog` | SSR + SQLite |
| `/todos` | Service pattern + REST API |
| `/chat` | Real-time WebSocket chat |
| `/chess` | Multiplayer chess (PvP + PvE with AI) |
| `/slither` | Multiplayer snake game (15fps) |
| `/css-demo` | Server-side CSS theming |
| `/api-docs` | Interactive API tester |
| `/hypergraph` | Live loop diagnostics dashboard |

```js
// Every feature is a createLoop — same API for SSR, WebSocket, games, and CRUD
const chessGame = createLoop({
  state: { board: createGame(), currentTurn: 'white', status: 'waiting' },
  update: {
    join(s, player) { /* ... */ },
    select(s, { row, col }) { /* validate + apply move */ },
    aiMove: { run: async (s) => { /* import AI, compute, return move */ } }
  }
})

chessGame.subscribe(state => broadcast(wsClients, state))
```

**346 unit tests + 46 E2E tests** across 38 test files. See
[server-examples/README.md](./server-examples/README.md) for the full architecture.

## Docs

| Document | Description |
|---|---|
| [HOWTO.md](./docs/HOWTO.md) | Developer guide — syntax, patterns, React comparison |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Full architecture — graph engine, event pipeline, protocols |
| [examples.md](./docs/examples.md) | All 20 examples with code snippets |
| [E2E-GUIDE.md](./docs/E2E-GUIDE.md) | Playwright e2e test patterns per example type |
| [PLAN.md](./docs/PLAN.md) | Original rework plan + design decisions |
| [TODO.md](./docs/TODO.md) | Living task list — phases, status, stats |
| [design/](./docs/design/) | Design docs — core, html, store, props, server-side |
| [progress/](./docs/progress/) | Version progress reports + planning documents |

## License

MIT
