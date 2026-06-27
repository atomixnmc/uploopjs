<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/atomixnmc/uploopjs/main/docs/uploop-dark.svg">
    <img alt="Uploop" src="https://raw.githubusercontent.com/atomixnmc/uploopjs/main/docs/uploop-light.svg" width="480">
  </picture>
</p>

<p align="center">
  <strong>The HyperGraph Application Framework — one entity definition drives everything.</strong>
</p>

<p align="center">
  <a href="https://github.com/atomixnmc/uploopjs/actions/workflows/gh-pages.yml"><img src="https://github.com/atomixnmc/uploopjs/actions/workflows/gh-pages.yml/badge.svg" alt="Pages"></a>
  <a href="https://github.com/atomixnmc/uploopjs/actions/workflows/release.yml"><img src="https://github.com/atomixnmc/uploopjs/actions/workflows/release.yml/badge.svg" alt="Release"></a>
  <a href="#"><img src="https://img.shields.io/badge/tests-254%20passed-brightgreen" alt="Tests"></a>
  <a href="#"><img src="https://img.shields.io/badge/bundle-~26KB%20gzip-blue" alt="Size"></a>
  <a href="#"><img src="https://img.shields.io/badge/version-v0.8.x-orange" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-purple" alt="License"></a>
</p>

---

**Uploop** is a graph-native, AI-readable application framework where data shapes, UI components, execution strategies, and wire formats are declared as a single **HyperGraph** — inspectable, optimizable, and translatable by both humans and AI.

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

Components are just one part of the HyperGraph. Define an entity once and get validation, CRUD, form UI, binary streaming, AI manifests, TypeScript types, GraphQL SDL, and database schemas — automatically.

```js
import { entity, string, number, ref, toGraph, createStreamCodec, entityComponent } from '@uploop/schema'

// Define once
const User = entity('User', {
  name: string().min(1),
  email: string().email(),
  age: number().min(0),
  posts: array(ref('Post')),
  temperature: 'hot',
  cache: { ttl: 60000, swr: true }
})

// Get everything automatically
User.describe()          // AI-readable manifest
User.validate(data)      // Runtime validation (client + server)
toGraph([User])          // HyperGraph data nodes + edges
createStreamCodec(User)  // Binary wire format (60% smaller than JSON)
entityComponent(User)    // Auto-generated form/table/display UI
storeFromEntity(User)    // Store with CRUD handlers
toJSONSchema(User)       // JSON Schema export
toTypeScript(User)       // TypeScript interface
toGraphQL(User)          // GraphQL SDL
```

## Why Uploop?

| | React + Next.js | Uploop |
|---|---|---|
| **Architecture** | Component tree | **HyperGraph** (nodes + edges) |
| **Data model** | Manual (Zod/Yup + GraphQL + forms) | **One entity → everything** |
| **Bundle (gzip)** | ~85 KB | **~26 KB** |
| **Build step** | Required (JSX, RSC) | **None** (pure ESM) |
| **Async handling** | Manual boilerplate | **Declarative metadata** |
| **AI-readable** | No built-in | **`describe()` on everything** |
| **Binary wire** | JSON only | **60% smaller, zero-copy** |
| **Real-time** | Manual (socket.io) | **Built-in WebSocket + streaming** |
| **Execution tuning** | One-size-fits-all | **24 pre-tuned profiles** |

- **~26 KB gzip** — ~70% smaller than React + Next.js
- **No build step** — pure ESM, works from CDN or local file
- **No JSX** — standard tagged template literals
- **CSP-safe** — `@click` uses `addEventListener`, no inline `onclick`
- **WebComponent bridge** — `defineElement()` produces standard custom elements
- **12 packages** — core, html, schema, store, flows, stream, router, css, state-machine, sst, devutils, auth
- **Server-side rendering** — `renderToString()` + `hydrate()` in `@uploop/sst`
- **Remote loops** — `createRemoteLoop()` bridges client-server state over WebSocket
- **Service layer** — FeathersJS-style CRUD + real-time events on graph data nodes

## Async Metadata — Zero Boilerplate

Declare async behavior as metadata on your handlers. The framework handles debouncing, aborting, caching, and error recovery:

```js
import { createLoop } from '@uploop/core'

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

## Packages

| Package | Description | Size | Status |
|---------|-------------|------|--------|
| `@uploop/core` | HyperGraph engine, signals, loops, frames, async metadata | 62 KB | ✅ |
| `@uploop/html` | DOM adapter, template tag, WebComponent, suspend | 37 KB | ✅ |
| `@uploop/schema` | Entity definitions, validation, AI manifest, intent, wire protocol | ~15 KB | ✅ v0.6 |
| `@uploop/store` | External store, selectors, derived, persist, storeFromEntity | 6 KB | ✅ |
| `@uploop/flows` | 24 pre-tuned profiles, 10 strategies, pipelines, queues | ~10 KB | ✅ v0.7 |
| `@uploop/stream` | Binary codec, zero-copy, self-framing, reader/writer | ~8 KB | ✅ v0.8 |
| `@uploop/router` | Route matching, guards, layouts, lazy loading | 9 KB | ✅ |
| `@uploop/css` | Utility CSS, theme tokens, variants, animations | 53 KB | ✅ |
| `@uploop/sst` | SSR, hydration, remote loops, FeathersJS-style services | — | ✅ |
| `@uploop/devutils` | HyperGraph Inspector, event capture, debug panel | — | ✅ |
| `@uploop/auth` | Auth as HyperGraph nodes, JWT/OAuth strategies | — | 🟡 v0.9 |
| `@uploop/state-machine` | Finite state machine, entry/exit hooks, guards | 4 KB | ✅ |

## The "One Definition" Promise

Uploop's entity is the single source of truth. No other framework provides this:

```js
const Post = entity('Post', {
  title: string().min(1).max(200),
  body: string(),
  author: ref('User'),
  tags: array(string()),
  publishedAt: date(),
  temperature: 'warm',
  lifetime: 'persistent',
  cache: { ttl: 300000, swr: true }
})

// → Validation (client + server, same code)
const result = Post.validate({ title: 'Hello', body: 'World' })

// → HyperGraph (data nodes + edges + temperature routing)
const graph = createGraph(toGraph([User, Post]))

// → Binary wire format (self-framing, 60% smaller than JSON)
const codec = createStreamCodec(Post)
const buffer = codec.encode({ title: 'Hello', body: 'World' })
const decoded = codec.view(buffer)  // zero-copy access

// → Pre-tuned execution (form flow for data entry)
const tuned = createFlow(graph, flows.form)

// → AI communication (15 tokens for intent, ~200 for JSON)
const aiIntent = intent({ Post: { title: 'str', body: 'str', author: 'User' } })
const token = intentToken(aiIntent)  // compact token for LLM

// → Form UI (auto-generated from entity shape)
const PostForm = entityComponent(Post, { mode: 'form' })
```

## AI-First Design

Uploop is the first framework built for AI-augmented development. Every module exports `describe()` — a JSON-safe manifest that LLMs can read:

```js
import { describe } from '@uploop/schema'

const manifest = describe([User, Post])
// LLM receives: { entities, fields, relations, validation, cache, meta, aiHints }
// AI can generate: new entities, UI components, tests, queries, migration scripts

// Intent schema — AI communicates in 15 tokens instead of 200
const intent = intent({ Post: { title: 'str|required', body: 'str', author: 'User' } })
const token = intentToken(intent)  // "p.P=streq:.u:a"

// Server responds with full schema resolution
const resolved = resolveIntent(intent, registry)
```

## Executor Diversity — Right Strategy for Each Use Case

No other framework ships different execution strategies. Uploop's `@uploop/flows` provides 24 pre-tuned profiles:

| Category | Profiles | Strategy |
|----------|----------|----------|
| **Web UI** | form, list, dashboard, chat, infiniteScroll, searchTypeahead | Reactive Tower |
| **Real-Time** | realtimeCollab, liveLeaderboard, liveCursor | Stream Relay |
| **Data** | dataGrid, dataPipeline, analyticsRealtime | Batch Pipeline |
| **Media** | videoPlayer, canvas2D, webGL3D, animation, imageEditor | SceneGraph Booster |
| **Games** | turnBased, realTime, physics | Fixed Timestep |
| **Infra** | offlineFirst, ssrHydration, serviceWorker | Persisted Cascade |
| **AI** | aiAgent | Stream Relay + Batch Pipeline |

Plus 10 reusable strategies: temperature lane routing, dependency batch optimization, critical path scheduling, event rate classification, orphan detection, merge impact analysis, frame budget enforcement, backpressure control, cache-aware skipping, predictive prefetching.

## Binary Streaming — Entity = Wire Format

`@uploop/stream` eliminates the schema/wire-format gap. Your entity definition IS the binary protocol:

```js
import { createStreamCodec, createStreamWriter, createStreamReader } from '@uploop/stream'

const codec = createStreamCodec(ChatMessage)
const writer = createStreamWriter({ codec })

// Write individual messages or batch
writer.frame({ id: 1, body: 'hi', type: 'text' })
writer.batch([
  { id: 2, body: 'hello', type: 'text' },
  { userId: 3, online: true }
])

// Read with zero-copy views
const reader = createStreamReader()
for await (const { entity, data } of reader.feed(buffer)) {
  // data is a zero-copy view into the ArrayBuffer — no deserialization
  console.log(data.body)  // reads directly from buffer
}
```

Wire size: ~82 bytes vs ~200 bytes JSON (59% smaller). 1MB binary payloads: direct copy vs 1.3MB base64-encoded.

## Quick Start

```bash
git clone https://github.com/atomixnmc/uploopjs.git
cd uploopjs
npm install
npm run dev
```

Open `http://localhost:3000` — you'll see the demo gallery.

🌐 **Live demo:** [atomixnmc.github.io/uploopjs](https://atomixnmc.github.io/uploopjs/)

## Server-Side Toolset (SST)

Uploop ships a **battery-included server framework** where HTTP, WebSocket, binary streaming, SQLite, and multiplayer games are all wired through the same HyperGraph model.

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
| `/todos` | Entity-driven service + REST API |
| `/chat` | Real-time WebSocket + binary streaming |
| `/chess` | Multiplayer chess (PvP + PvE with AI) |
| `/slither` | Multiplayer snake game (15fps) |
| `/css-demo` | Server-side CSS theming |
| `/api-docs` | Interactive API tester |
| `/hypergraph` | Live HyperGraph diagnostics dashboard |

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
```

**254 unit tests** across 14 test files. Zero regressions.

## Roadmap

### Now — v0.8.x

`@uploop/schema` ✅ · `@uploop/flows` ✅ · `@uploop/stream` ✅

Binary streaming, entity-driven CRUD, 24 flow profiles, AI intent schema, client/server wire protocol.

### Next — v0.9.x

`@uploop/auth` · `@uploop/gql` (GraphQL/Gremlin/Cypher on HyperGraph) · `uploop-storage` (IndexedDB + SQLite adapters) · Store v2 (declarative flows, serverStore)

### v1.0 — Long Runtime Convergence

Uploop converges with **[Long](https://github.com/atomixnmc/long)** (private beta) — a performant polyglot JavaScript/TypeScript runtime built on Uploop's HyperGraph architecture. Long provides:

- **Native FFmpeg** — hardware-accelerated media processing
- **GPU rendering** — WebGPU + native GPU via wgpu
- **DevTools** — Vite-class bundler + dev server with graph-aware HMR
- **5ms startup** — native execution, temperature-aware memory management

Same HyperGraph, same entities, same flows — compiled to native. No code changes needed.

### v2.0 — i2c Ecosystem

Uploop integrates with **[Quang](https://github.com/atomixnmc)** (AI-first cloud native), **HyperAI** (transformer for HyperGraph), and **Minh** (AI agent platform similar to Gemini).

## Bridge-vs-Rival Strategy

| | Bridge To (Integrate) | Rival (Compete) |
|---|---|---|
| **Platforms** | Cloudflare, Firebase, Bun, Deno, Node | — |
| **Frameworks** | — | React, Next.js, Nuxt, SvelteKit |
| **Services** | FeathersJS (patterns), GraphQL (language) | Express, Fastify, Hono |

Uploop components export as standard WebComponents via `defineElement()` — a bridge for incremental adoption inside any host framework.

## Docs

| Document | Description |
|---|---|
| [HOWTO.md](./docs/HOWTO.md) | Developer guide — syntax, patterns, comparisons |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Full architecture — graph engine, event pipeline, protocols |
| [AI_GUIDELINE.md](./docs/AI_GUIDELINE.md) | Rules for AI agents and human contributors |
| [PLAN.md](./docs/PLAN.md) | Rework plan phases and design decisions |
| [TODO.md](./docs/TODO.md) | Living task list — phases, status, stats |
| [design/](./docs/design/) | Per-module design docs |
| [plan/](./docs/plan/) | Major version plans (v0.6–v2.0) |
| [progress/](./docs/progress/) | Version progress tracking |
| [reports/](./docs/reports/) | Cross-framework comparison, architecture analysis |

## License

MIT
