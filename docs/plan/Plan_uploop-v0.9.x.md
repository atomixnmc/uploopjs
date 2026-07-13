# v0.9.x — Store, GQL & Storage Plan

> **Three pillars**: Declarative store flows, native graph query languages, and pluggable storage backends.

---

## 1. Store v2 — Declarative Data Flows

### 1.1 The Problem

Current `@uploop/store` is a simple loop wrapper. It does get/set/send/subscribe but has no concept of data flow between stores, no pipelines, no server-side database binding.

```js
// Current — everything is manual
const userStore = store({ state: { name: '', email: '' } })
const profileStore = store({ state: { displayName: '' } })

// To sync: manual wiring
userStore.subscribe(state => {
  profileStore.send('setDisplayName', state.name)
})
```

### 1.2 The Solution: `flow()`

Declarative data flows between stores, between stores and external sources, and across the network.

```js
import { store, flow } from '@uploop/store'

const userStore = storeFromEntity(User)
const profileStore = storeFromEntity(Profile)

// Declarative flow: user.name → profile.displayName
flow(userStore)
  .select('name')
  .pipe(v => v.toUpperCase())
  .into(profileStore, 'displayName')

// Flow with transform + validation
flow(userStore)
  .select(state => ({ name: state.name, email: state.email }))
  .validate(User)
  .pipe(data => ({ ...data, sanitized: true }))
  .into(logStore, 'lastUser')

// Flow to external sink
flow(userStore)
  .select('email')
  .debounce(300)
  .sink(async (email) => {
    await fetch('/api/check-email', { method: 'POST', body: JSON.stringify({ email }) })
  })

// Bidirectional flow (two one-way edges)
flow(userStore)
  .select('name')
  .sync(profileStore, 'displayName')   // keeps both in sync
```

**Flow primitives**:

| Operator | Purpose |
|----------|---------|
| `.select(keyOrFn)` | Extract value from source |
| `.pipe(fn)` | Transform value |
| `.validate(schema)` | Validate before flowing |
| `.debounce(ms)` | Debounce the flow |
| `.throttle(ms)` | Throttle the flow |
| `.filter(fn)` | Only flow when condition matches |
| `.distinct()` | Skip duplicate values |
| `.into(store, key)` | Write into another store |
| `.sink(asyncFn)` | Send to external sink (API, file, DB) |
| `.sync(store, key)` | Bidirectional sync (two one-way edges) |
| `.tap(fn)` | Side-effect without modifying value |
| `.catch(fn)` | Error handler |
| `.dispose()` | Stop the flow |

### 1.3 Store Composition

```js
import { compose } from '@uploop/store'

// Compose multiple stores into one observable namespace
const appStore = compose({
  users: userStore,
  products: productStore,
  cart: cartStore
})

// Query across composed stores
appStore.select('users.name')           // → 'Alice'
appStore.select(s => s.users.name)      // → 'Alice'
appStore.select('cart.total')           // → computed from cart store

// Flow across composed stores
flow(appStore)
  .select('cart.items')
  .pipe(items => items.length)
  .into(uiStore, 'cartCount')
```

### 1.4 Server-Side Store

```js
import { serverStore } from '@uploop/store'

// Database-backed store
const userStore = serverStore(User, {
  adapter: 'sqlite',       // 'sqlite' | 'postgres' | 'mongodb' | 'filesystem'
  connection: './data.db',
  table: 'users',          // table/collection name
  primaryKey: 'id',
  
  // Auto-generated CRUD handlers with DB operations
  queries: {
    findByEmail: (db, email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email),
    searchByName: (db, query) => db.prepare('SELECT * FROM users WHERE name LIKE ?').all(`%${query}%`)
  },
  
  // Sync strategy
  sync: {
    mode: 'write-through',   // 'write-through' | 'write-back' | 'read-through'
    cache: { ttl: 300_000 }
  }
})

// Same API as client store — but backed by SQLite
userStore.send('setName', 'Alice')   // → writes through to DB
const users = userStore.send('searchByName', 'Ali')  // → queries DB
```

**Server adapters**:

| Adapter | Target | Use case |
|---------|--------|----------|
| `sqlite` | SQLite (better-sqlite3) | Embedded, edge, single-server |
| `postgres` | PostgreSQL | Production, multi-server |
| `mongodb` | MongoDB | Document store |
| `filesystem` | Local files / S3 | Blobs, uploads, assets |
| `memory` | In-memory Map | Testing, caching |
| `rest` | Remote REST API | Microservices, external APIs |

---

## 2. `@uploop/gql` — Graph Query Languages

### 2.1 The Insight

HyperGraph IS a property graph:
- **Nodes**: entity data nodes, update nodes, view nodes
- **Edges**: `ref()` relations, reads/writes dependencies
- **Properties**: field values, metadata

Graph query languages (GraphQL, Gremlin, Cypher) are designed for exactly this structure. `@uploop/gql` makes HyperGraph queryable with these languages natively — no translation layer needed.

### 2.2 GraphQL Integration

```js
import { gql } from '@uploop/gql'

// ── Server: Auto-generate GraphQL schema from entities ─────
const schema = gql.schema({
  entities: [User, Post, Comment],
  
  // Auto-generated queries + mutations from entity CRUD
  queries: 'auto',     // user(id: ID!): User, users: [User], posts: [Post]...
  mutations: 'auto',   // createUser, updateUser, deleteUser...
  
  // Custom resolvers (HyperGraph-native)
  resolvers: {
    Query: {
      searchUsers: (_, { query }, { graph }) => {
        return graph.getNode('User.searchResults')
      }
    },
    User: {
      // Relation resolution — reads from HyperGraph edges
      posts: (user, _, { graph }) => {
        return graph.getNode('Post.list').filter(p => p.author === user.id)
      }
    }
  }
})

// ── Client: Query HyperGraph with GraphQL syntax ───────────
const query = gql`
  query UserWithPosts($id: ID!) {
    user(id: $id) {
      name
      email
      posts {
        title
        comments { body author { name } }
      }
    }
  }
`

// Executes against local HyperGraph — no network request
const result = gql.execute(query, { id: 'user-123' }, { graph: appGraph })
// → { user: { name: 'Alice', posts: [...] } }

// Or execute against remote GraphQL endpoint
const result = await gql.fetch('/api/graphql', query, { id: 'user-123' })
```

### 2.3 Gremlin Traversal

Gremlin is the standard traversal language for property graphs. HyperGraph IS a property graph → Gremlin works natively.

```js
import { gremlin } from '@uploop/gql'

// Traverse the HyperGraph with Gremlin syntax
const g = gremlin.traversal(appGraph)

// Find all posts by users over 30
const result = g.V()
  .hasLabel('User')
  .has('age', gt(30))
  .out('posts')              // follows ref('User') edge from Post
  .values('title')
  .toList()
// → ['Post 1', 'Post 2', ...]

// Complex traversal: users → posts → comments → authors
const commentAuthors = g.V()
  .hasLabel('User')
  .out('posts')
  .out('comments')
  .out('author')
  .dedup()
  .values('name')
  .toList()

// Create edges at runtime
g.V('user-1').addEdge('likes', g.V('post-5'))

// Drop vertices
g.V('post-3').drop()
```

**Gremlin step mapping to HyperGraph**:

| Gremlin step | HyperGraph operation |
|-------------|---------------------|
| `V()` | All entity data nodes |
| `hasLabel('User')` | Filter by entity name |
| `has('age', gt(30))` | Filter by property value |
| `out('posts')` | Follow ref edge |
| `in('author')` | Reverse edge traversal |
| `values('name')` | Extract field value |
| `addEdge('likes', target)` | Add runtime edge |
| `drop()` | Remove node / edge |
| `dedup()` | Deduplicate results |
| `count()`, `sum()`, `mean()` | Aggregations |

### 2.4 Cypher Integration

Cypher is Neo4j's declarative graph query language — the most readable graph query syntax.

```js
import { cypher } from '@uploop/gql'

// Query HyperGraph with Cypher syntax
const result = cypher.execute(appGraph, `
  MATCH (u:User)-[:posts]->(p:Post)-[:comments]->(c:Comment)
  WHERE u.age > 30
  RETURN u.name, p.title, count(c) as commentCount
  ORDER BY commentCount DESC
  LIMIT 10
`)

// Create nodes
cypher.execute(appGraph, `
  CREATE (p:Post {
    title: 'Hello World',
    body: 'My first post',
    author: $authorId
  })
`, { authorId: 'user-1' })

// Merge (upsert)
cypher.execute(appGraph, `
  MERGE (u:User { email: 'alice@x.com' })
  ON CREATE SET u.name = 'Alice', u.createdAt = datetime()
  ON MATCH SET u.lastLogin = datetime()
  RETURN u
`)
```

**Cypher clause mapping**:

| Cypher clause | HyperGraph operation |
|--------------|---------------------|
| `MATCH (u:User)` | entity data nodes |
| `-[:posts]->` | ref edge traversal |
| `WHERE u.age > 30` | field value filter |
| `RETURN u.name` | field projection |
| `CREATE (p:Post {...})` | entity.populate() + graph.set() |
| `MERGE` | upsert via validate + set |
| `SET u.name = 'X'` | graph.set('User.name', 'X') |
| `DELETE` | graph node removal |
| `ORDER BY`, `LIMIT`, `SKIP` | Sort, paginate |
| `count()`, `sum()`, `avg()` | Aggregations on projected data |

### 2.5 Unified Query API

```js
import { query } from '@uploop/gql'

// Same query, multiple languages — all execute against HyperGraph
const results = await query(appGraph, {
  // GraphQL
  graphql: `{ users(age_gt: 30) { name posts { title } } }`,
  
  // Gremlin
  gremlin: `g.V().hasLabel('User').has('age', gt(30)).out('posts').values('title')`,
  
  // Cypher
  cypher: `MATCH (u:User)-[:posts]->(p:Post) WHERE u.age > 30 RETURN p.title`,
  
  // Pick one
  language: 'cypher'
})
```

---

## 3. `uploop-storage` — Native Storage Adapters

### 3.1 The Problem

Current Uploop has no built-in persistence beyond `@uploop/store`'s `persist()` (localStorage). For real apps, you need IndexedDB (browser) and SQLite (server/edge).

### 3.2 Architecture

```
Sources/uploop-storage/          ← NEW project
├── packages/
│   ├── adapter-indexeddb/       # Browser IndexedDB adapter
│   │   ├── src/
│   │   │   ├── index.js         # IndexedDBAdapter
│   │   │   ├── schema.js        # Entity → IDB schema migration
│   │   │   └── query.js         # IndexedDB query builder
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── adapter-sqlite/          # SQLite adapter (Node/bun/deno)
│   │   ├── src/
│   │   │   ├── index.js         # SQLiteAdapter
│   │   │   ├── schema.js        # Entity → CREATE TABLE
│   │   │   ├── query.js         # SQL query builder
│   │   │   └── migrate.js       # Schema migration
│   │   ├── test/
│   │   └── package.json
│   │
│   └── core/                    # Shared storage abstractions
│       ├── src/
│       │   ├── index.js         # StorageEngine, Adapter protocol
│       │   ├── adapter.js       # Adapter interface (open, read, write, delete, query)
│       │   ├── migrate.js       # Migration engine
│       │   └── sync.js          # Sync engine (offline queue, conflict resolution)
│       ├── test/
│       └── package.json
├── docs/
├── package.json                 # Workspace root
└── README.md
```

### 3.3 Adapter Protocol

Every storage adapter implements the same interface:

```js
// Adapter protocol
{
  // Lifecycle
  open(): Promise<void>
  close(): Promise<void>
  
  // CRUD
  read(entityName, id): Promise<Object>
  write(entityName, id, data): Promise<void>
  delete(entityName, id): Promise<void>
  
  // Query
  query(entityName, filters, options): Promise<Array>
  
  // Schema
  registerEntity(entitySchema): Promise<void>   // create table/object store
  migrate(fromVersion, toVersion): Promise<void>
  
  // Bulk
  batch(operations): Promise<void>
  transaction(fn): Promise<void>
}
```

### 3.4 IndexedDB Adapter

```js
import { IndexedDBAdapter } from '@uploop-storage/adapter-indexeddb'
import { entity, string, number, ref } from '@uploop/schema'

const User = entity('User', {
  id: string().uuid(),
  name: string(),
  email: string().email()
})

// Open database
const db = new IndexedDBAdapter({
  name: 'my-app',
  version: 1,
  entities: [User, Post, Comment]
})

await db.open()

// CRUD — entity-aware
await db.write('User', 'user-1', { name: 'Alice', email: 'alice@x.com' })
const user = await db.read('User', 'user-1')
// → { id: 'user-1', name: 'Alice', email: 'alice@x.com' }

// Query — index-aware
const adults = await db.query('User', {
  where: { age: { gt: 18 } },
  orderBy: 'name',
  limit: 10
})

// Uses IndexedDB indexes auto-created from entity field metadata
```

### 3.5 SQLite Adapter

```js
import { SQLiteAdapter } from '@uploop-storage/adapter-sqlite'
import Database from 'better-sqlite3'

const db = new SQLiteAdapter({
  database: new Database('./data.db'),
  entities: [User, Post, Comment],
  migrations: './migrations/'    // auto-generate from entity diffs
})

await db.open()

// Auto-creates tables from entity schemas:
// CREATE TABLE users (
//   id TEXT PRIMARY KEY,
//   name TEXT NOT NULL,
//   email TEXT NOT NULL UNIQUE,
//   age INTEGER,
//   created_at TEXT DEFAULT (datetime('now'))
// )

// CRUD
await db.write('User', 'user-1', { name: 'Alice', email: 'alice@x.com' })

// SQL query with entity mapping
const users = await db.query('User', {
  where: { age: { gte: 18 } },
  join: ['posts'],           // JOIN posts ON posts.author_id = users.id
  orderBy: { name: 'asc' },
  limit: 10
})

// Raw SQL escape hatch
const results = await db.raw(`
  SELECT u.name, COUNT(p.id) as post_count
  FROM users u
  LEFT JOIN posts p ON p.author_id = u.id
  GROUP BY u.id
  HAVING post_count > 5
`)
```

### 3.6 StorageEngine — Unified Store + Storage

```js
import { StorageEngine } from '@uploop-storage/core'
import { IndexedDBAdapter } from '@uploop-storage/adapter-indexeddb'

// One engine — one API — multiple backends
const engine = new StorageEngine({
  adapter: new IndexedDBAdapter({ name: 'my-app', entities: [User, Post] }),
  
  // Sync strategy
  sync: {
    mode: 'offline-first',     // 'online-first' | 'offline-first' | 'cache-only'
    remote: '/api/sync',       // remote sync endpoint
    conflict: 'last-write-wins' // 'last-write-wins' | 'manual' | 'merge-fn'
  }
})

// Same API regardless of adapter
await engine.open()
await engine.write('User', user)
await engine.read('User', 'user-1')
await engine.query('User', { where: { age: { gt: 18 } } })
await engine.delete('User', 'user-1')

// Offline queue + sync
await engine.sync.push('User', { type: 'create', data: newUser })
await engine.sync.flush()  // send queued ops to server
await engine.sync.pull()   // fetch remote changes

// Subscribe to storage events
engine.onChange('User', (id, data) => {
  console.log('User changed:', id, data)
})
```

### 3.7 Migration Engine

```js
// Auto-detect schema changes and generate migrations
const v1 = entity('User', { name: string(), email: string() })
const v2 = entity('User', { name: string(), email: string(), avatar: string().url().optional() })

// diff tells the migration engine what changed
const changes = diff(v1, v2)
// → { added: ['avatar'], removed: [], changed: [] }

// Auto-generate migration
const migration = engine.migrate(v1, v2)
// → { version: 2, up: 'ALTER TABLE users ADD COLUMN avatar TEXT', down: '...' }

// Run migration
await engine.migrate(v1, v2)
```

---

## 4. Package Dependency Graph

```
@uploop/schema          ← entities, validation, describe, bind
    ↓
@uploop/core            ← createGraph, createLoop, signal
    ↓
@uploop/store           ← store, flow, compose, serverStore
    ↓
@uploop/gql             ← graphql, gremlin, cypher executors
    ↓
uploop-storage/core     ← StorageEngine, Adapter protocol
    ↓         ↓
adapter-idb    adapter-sqlite
```

---

## 5. Implementation Plan

### Phase 1: Store v2 (v0.9.0)
- [ ] `@uploop/store/src/flow.js` — `flow()`, `.select()`, `.pipe()`, `.into()`, `.sink()`, `.debounce()`, `.sync()`
- [ ] `@uploop/store/src/compose.js` — `compose()` multi-store composition
- [ ] `@uploop/store/src/server.js` — `serverStore()` with adapter protocol
- [ ] Tests: flow.test.js, compose.test.js

### Phase 2: GQL (v0.9.1)
- [ ] `@uploop/gql/src/graphql.js` — `gql.schema()`, `gql.execute()`, `gql.fetch()`
- [ ] `@uploop/gql/src/gremlin.js` — `g.V()`, `.has()`, `.out()`, `.values()`, traversal engine
- [ ] `@uploop/gql/src/cypher.js` — Cypher parser + HyperGraph executor
- [ ] `@uploop/gql/src/index.js` — `query()` unified API
- [ ] Tests: graphql.test.js, gremlin.test.js, cypher.test.js

### Phase 3: Storage (v0.9.2)
- [ ] `uploop-storage/core/src/adapter.js` — Adapter protocol definition
- [ ] `uploop-storage/core/src/engine.js` — StorageEngine with sync
- [ ] `uploop-storage/core/src/migrate.js` — Migration engine
- [ ] `uploop-storage/adapter-indexeddb/src/` — IndexedDB adapter
- [ ] `uploop-storage/adapter-sqlite/src/` — SQLite adapter
- [ ] Tests per adapter

---

## 6. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `flow()` is independent of store | Flows connect anything with `subscribe()` + `send()` — stores, graphs, external sinks |
| GQL executors run against HyperGraph, not a database | HyperGraph IS the graph. No translation. Gremlin `out('posts')` literally follows `ref('Post')` edges |
| Storage adapters implement a simple protocol | open/read/write/delete/query — any backend can implement this |
| Migrations auto-generated from `diff()` | Entity diffs already exist. Migrations are just SQL/IDB schema changes from those diffs |
| Same adapter protocol for both client and server | IndexedDB and SQLite implement the same interface. Swap adapters without changing code |
