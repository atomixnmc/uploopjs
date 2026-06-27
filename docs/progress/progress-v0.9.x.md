# v0.9.x — Store v2, GQL & Storage (Planned)

> **Status:** Planned 📋  
> **Date:** 2026-06-26  
> **Depends on:** v0.6 (schema) ✅, v0.7 (flows) ✅, v0.8 (stream) ✅

## Overview

Three pillars for v0.9: declarative store flows with server-side database adapters, native graph query languages (GraphQL/Gremlin/Cypher) on HyperGraph, and pluggable storage backends (IndexedDB, SQLite).

## Phase 1 — Store v2 (Declarative Flows)

- [ ] `@uploop/store/src/flow.js` — `flow()`, `.select()`, `.pipe()`, `.into()`, `.sink()`, `.debounce()`, `.throttle()`, `.sync()`
- [ ] `@uploop/store/src/compose.js` — `compose()` multi-store composition with cross-store queries
- [ ] `@uploop/store/src/server.js` — `serverStore()` with adapter protocol
- [ ] Memory adapter (for testing)
- [ ] Tests: flow.test.js, compose.test.js, server.test.js

### Store v2 API

```js
// Declarative flows
flow(userStore).select('name').pipe(v => v.toUpperCase()).into(profileStore, 'displayName')

// Server-side store with database
const userStore = serverStore(User, { adapter: 'sqlite', connection: './data.db' })
```

## Phase 2 — GQL (Graph Query Languages)

- [ ] `@uploop/gql/src/graphql.js` — `gql.schema()`, `gql.execute()`, `gql.fetch()`
- [ ] `@uploop/gql/src/gremlin.js` — `g.V()`, `.has()`, `.out()`, `.values()`, traversal engine
- [ ] `@uploop/gql/src/cypher.js` — Cypher parser + HyperGraph executor
- [ ] `@uploop/gql/src/index.js` — `query()` unified API
- [ ] Tests: graphql.test.js, gremlin.test.js, cypher.test.js

### GQL API

```js
// GraphQL — query local HyperGraph
gql`{ users(age_gt: 30) { name posts { title } } }`

// Gremlin — traverse edges natively
g.V().hasLabel('User').has('age', gt(30)).out('posts').values('title')

// Cypher — most readable graph syntax
MATCH (u:User)-[:posts]->(p:Post) WHERE u.age > 30 RETURN p.title
```

## Phase 3 — Storage (Native Adapters)

- [ ] `uploop-storage/core/src/adapter.js` — Adapter protocol (open, read, write, delete, query, migrate)
- [ ] `uploop-storage/core/src/engine.js` — StorageEngine with sync (offline queue, conflict resolution)
- [ ] `uploop-storage/core/src/migrate.js` — Migration engine (auto-generate from entity diff)
- [ ] `uploop-storage/adapter-indexeddb/` — Browser IndexedDB adapter
- [ ] `uploop-storage/adapter-sqlite/` — Node/bun SQLite adapter
- [ ] Tests per adapter

### Storage API

```js
const engine = new StorageEngine({
  adapter: new IndexedDBAdapter({ name: 'my-app', entities: [User, Post] })
})
await engine.open()
await engine.write('User', user)
await engine.query('User', { where: { age: { gt: 18 } } })
```

## Revised Priorities (from framework comparison)

| Priority | Task | Reason |
|----------|------|--------|
| **P0** | `@uploop/auth` | Blocking real app adoption (not in original plan, should be v0.9 or sooner) |
| **P0** | Store v2 + serverStore | Connects entities to databases |
| **P1** | GQL | Unique differentiator — no other framework does this |
| **P1** | Storage (IndexedDB) | Offline-first for PWAs |
| **P2** | Storage (SQLite) | Server-side persistence |
| **P2** | Edge adapters | Deployment story |
