# uploop-schema — v0.6.x Design & Plan

> **The JavaScript-first, functional, AI-readable data structure layer for Uploop HyperGraph.**
>
> Schemaless when you want speed. Schema-rich when you want safety. Intent-driven when AI is involved. Always dynamic.

---

## 1. Why This Exists

### The Problem

Uploop's data nodes today are bare `createSignal` wrappers — a get/set with no shape, no validation, no relations, no type info:

```js
// Current state — a data node knows nothing about itself
const graph = createGraph({
  nodes: {
    name: { type: 'data', default: '' },
    email: { type: 'data', default: '' },
    age: { type: 'data', default: 0 }
  }
})

// No way to know: is email valid? is age an integer? does age have a min?
// No way to relate nodes. No way for AI to understand the data model.
```

Every framework builds schema differently:
- **ORM (Prisma/Drizzle)**: Class-based, static, build-step, database-first. Not dynamic. Not JavaScript-native.
- **Zod/Yup**: Good validation libs, but disconnected from the runtime graph. No HyperGraph integration. No entity concept.
- **JSON Schema**: Machine-readable but not executable JavaScript. No composition. No runtime dynamism.
- **TypeScript interfaces**: Compile-time only. Erased at runtime. Not dynamic.

**Uploop needs its own answer**: a schema layer that is JavaScript-functional, composable at runtime, AI-readable, and aligned with the HyperGraph engine.

### The Opportunity

Uploop already has the right primitives:
- **HyperGraph**: Typed nodes + edges with metadata (temperature, lifetime, cache, reads/writes).
- **Data nodes**: Reactive signals.
- **describe()**: Runtime manifest export.
- **Data classification**: hot/warm/cold, transient/persistent, client/remote.

What's missing is the **data shape** layer — the schema that tells you *what* a data node contains, not just *how* it behaves.

---

## 2. Core Design Principles

| Principle | What it means |
|-----------|--------------|
| **JavaScript-first** | No classes, no prototypes, no decorators, no build step. Plain functions that return functions. |
| **Functional** | Every schema is `(value) → ValidationResult`. Pure. Composable. Testable. |
| **Schemaless-by-default** | Any data is valid unless you constrain it. Constraints are additive. Opt-in safety. |
| **Runtime dynamic** | Build, merge, extend, pick, omit schemas at runtime. No static analysis required. |
| **AI-first** | Every schema exports `.describe()` — machine-readable manifest. Metadata-rich. Intent-first communication. |
| **HyperGraph native** | Schema entities ARE HyperGraph nodes. Relations ARE edges. Schema IS the graph manifest plus shapes. |
| **More dynamic than ORM** | No codegen. No migration files. No class hierarchy. Shapes are data, not classes. |
| **Intent-first for AI** | AI agents communicate *data intent* in token-efficient form, not full schemas. Fuzzy matching bridges intent ↔ precision. |

---

## 3. The API — `@uploop/schema`

### 3.1 Package Structure

```
@uploop/schema/
├── src/
│   ├── index.js          # Public API
│   ├── core.js           # schema(), validate(), ValidationResult
│   ├── primitives.js     # string(), number(), boolean(), date(), literal(), enumeration()
│   ├── structural.js     # object(), array(), tuple(), record()
│   ├── relational.js     # ref(), entity(), computed()
│   ├── modifiers.js      # optional(), nullable(), withDefault(), transform(), pipe()
│   ├── compose.js        # extend(), merge(), pick(), omit(), partial(), required()
│   ├── hypergraph.js     # toGraph(), fromSchema(), registerEntity()
│   ├── describe.js       # .describe() → manifest, .diff() → structural comparison
│   ├── infer.js          # toJSONSchema(), toTypeScript(), toGraphQL()
│   ├── intent.js         # intent(), intentToken, resolveIntent, suggestIntent
│   ├── wire.js           # client/server schema contract, versioning, negotiation
│   └── utils.js          # isSchema(), isEntity(), coerce, helpers
├── test/
│   ├── primitives.test.js
│   ├── structural.test.js
│   ├── relational.test.js
│   ├── compose.test.js
│   ├── hypergraph.test.js
│   ├── intent.test.js
│   ├── wire.test.js
│   └── ai-readability.test.js
└── package.json
```

### 3.2 The Primitives

```js
import {
  schema, type,
  string, number, boolean, date, literal, enumeration,
  object, array, tuple, record,
  ref, entity, computed,
  optional, nullable, withDefault, transform, pipe,
  extend, merge, pick, omit, partial, required,
  lazy, union, intersection,
  intent, resolveIntent, suggestIntent, intentToken
} from '@uploop/schema'
```

#### 3.2.1 `schema(name, config)` — The Atomic Schema

Every schema is built from this. All other primitives are sugar over `schema()`.

**Do not use `s()` — it is too ambiguous for AI.** Use the full word `schema()` so both humans and LLMs understand it immediately.

```js
const Name = schema('Name', {
  type: 'string',
  validate(v) {
    if (typeof v !== 'string') return fail('must be a string')
    if (v.length === 0) return fail('must not be empty')
    if (v.length > 100) return fail('too long (max 100)')
    return ok(v)
  },
  meta: {
    description: 'A person\'s display name',
    example: 'Alice',
    tags: ['user', 'identity'],
    aiRole: 'identity.displayName'
  }
})
```

Internal shape:
```js
// A schema is a plain object (closure-backed) with:
{
  kind: 'uploop.schema',
  name: 'Name',
  type: 'string',            // base type
  _validate: (v) => Result,  // the validation function
  _meta: { description, example, tags, aiRole, ... },
  _modifiers: [],            // chain of transforms
  // Methods:
  optional(), nullable(), withDefault(v), transform(fn), pipe(other),
  describe(), toJSONSchema(), toTypeScript()
}
```

#### 3.2.2 Type Constraints

```js
string()
// .min(n) .max(n) .length(n) .regex(/.../) .email() .url() .uuid()
// .trim() .lowercase() .uppercase()

number()
// .min(n) .max(n) .integer() .positive() .negative() .finite()

boolean()

date()
// .min(d) .max(d) .past() .future()

literal(value)        // exact match
enumeration(values)   // one of array
```

#### 3.2.3 Structural Constraints

```js
object({ field: schema, ... })
// .strict() — reject unknown keys
// .passthrough() — keep unknown keys (default)
// .extend({...}) — add fields
// .pick([...])  — keep only named fields
// .omit([...])  — remove named fields
// .partial()    — make all fields optional
// .required()   — make all fields required

array(ofSchema)
// .min(n) .max(n) .length(n) .nonEmpty() .unique()

tuple([schema, schema, ...])   // fixed-length positional

record(keySchema, valueSchema) // dynamic keys
```

#### 3.2.4 Entities & Relations — The HyperGraph Bridge

This is the breakthrough. Entities connect schema to the HyperGraph engine.

```js
const User = entity('User', {
  id: string().uuid().withDefault(() => crypto.randomUUID()),
  name: string().min(1).max(100),
  email: string().email(),
  age: number().integer().min(0).max(150).optional(),
  createdAt: date().withDefault(() => new Date()),
  role: enumeration(['user', 'admin', 'mod']).withDefault('user')
}, {
  // Entity-level metadata — feeds HyperGraph node metadata
  temperature: 'cold',         // how hot is this data?
  lifetime: 'persistent',      // how long does it live?
  owner: 'server',             // who owns the source of truth?
  consistency: 'strong',       // eventual / strong
  cache: { ttl: 300_000 },     // cache policy
  description: 'A registered user',
  aiRole: 'identity.User'
})

const Post = entity('Post', {
  id: string().uuid().withDefault(() => crypto.randomUUID()),
  title: string().min(1),
  body: string(),
  // RELATION: this IS a HyperGraph edge
  author: ref('User'),           // many-to-one
  tags: array(string()).withDefault([])
}, {
  temperature: 'warm',
  lifetime: 'persistent',
  owner: 'server',
  cache: { ttl: 60_000, swr: true }
})
```

When you call `entity()`, it:
1. Creates a schema validator for the shape.
2. Registers the entity in the schema registry.
3. Exports `describe()` that includes relations as HyperGraph edges.
4. Can be fed into `createGraph()` to auto-generate data nodes + edges.

```js
User.describe()
// → {
//   kind: 'uploop.entity',
//   entity: 'User',
//   fields: {
//     id:    { type: 'string', format: 'uuid', default: '<fn>', optional: false },
//     name:  { type: 'string', min: 1, max: 100 },
//     email: { type: 'string', format: 'email' },
//     age:   { type: 'number', integer: true, min: 0, max: 150, optional: true },
//     createdAt: { type: 'date', default: '<fn>', optional: false },
//     role:  { type: 'enum', values: ['user','admin','mod'], default: 'user' }
//   },
//   relations: [],
//   meta: { temperature: 'cold', lifetime: 'persistent', ... }
// }

Post.describe()
// → {
//   kind: 'uploop.entity',
//   entity: 'Post',
//   fields: { ... },
//   relations: [
//     { field: 'author', ref: 'User', type: 'manyToOne', inverse: 'posts' }
//   ],
//   edges: [['Post.author', 'User.id']]    // ← HyperGraph edges
// }
```

#### 3.2.5 Modifiers — Transform & Default

```js
optional(schema)            // allow undefined
nullable(schema)            // allow null
withDefault(schema, valueOrFn)
transform(schema, fn)       // value → transformed value
pipe(schema, ...schemas)    // chain multiple schemas (left-to-right)
preprocess(schema, fn)      // transform BEFORE validation
postprocess(schema, fn)     // transform AFTER validation
```

#### 3.2.6 Composition

```js
// Extend: add fields
const AdminUser = extend(User, { permissions: array(string()) })

// Merge: combine two object schemas
const Profile = merge(User, Address)

// Pick/Omit: subset of fields
const PublicUser = pick(User, ['id', 'name', 'role'])

// Partial: all fields optional
const UserPatch = partial(User)

// Lazy: for recursive schemas
const TreeNode = object({
  value: string(),
  children: array(lazy(() => TreeNode))
})

// Union: one of several schemas
const Result = union([
  object({ ok: literal(true), data: User }),
  object({ ok: literal(false), error: string() })
])

// Intersection: all schemas must match
const Timestamped = intersection(User, object({ createdAt: date(), updatedAt: date() }))
```

### 3.3 Integration with `createGraph()`

This is the north star — schema entities feed directly into the HyperGraph engine.

```js
import { entity, toGraph } from '@uploop/schema'
import { createGraph } from '@uploop/core'

// 1. Define entities
const User = entity('User', { name: string(), email: string().email() })
const Post = entity('Post', { title: string(), author: ref('User') })

// 2. Generate a HyperGraph from entities
const appGraph = createGraph(toGraph([User, Post], {
  // Optional: additional non-entity nodes
  nodes: {
    searchQuery: { type: 'data', default: '', temperature: 'warm', lifetime: 'transient' },
    search: {
      type: 'update',
      reads: ['searchQuery', 'Post.title'],
      writes: ['searchResults'],
      run: async (data) => { /* fetch */ }
    }
  },
  edges: [
    ['onSearch', 'search']
  ]
}))

// 3. All entity data nodes exist + are typed
appGraph.get()
// → {
//     'User.name': '', 'User.email': '',
//     'Post.title': '', 'Post.author': null,
//     searchQuery: '', searchResults: []
//   }

// 4. Set with validation
appGraph.setEntity('User', { name: 'Alice', email: 'alice@x.com' })
//   → validates via User schema before setting data nodes

// 5. Describe includes entities
appGraph.describe()
//   → { kind: 'uploop.graph', entities: ['User', 'Post'], nodes: {...}, edges: [...] }
```

`toGraph()` generates:
- **Data nodes**: one per entity field, with defaults and metadata from the schema.
- **Edges**: from relation `ref()` declarations.
- **Update nodes** (optional): auto-generated CRUD handlers (`User.set`, `User.update`, etc.).
- **Temperature/lifetime/cache** metadata from entity config → node metadata.

### 3.4 Integration with `@uploop/store`

```js
import { store, fromEntity } from '@uploop/store'
import { entity, string, number } from '@uploop/schema'

const User = entity('User', { name: string(), age: number() })
const userStore = store(fromEntity(User))

// Auto-generated update handlers from entity fields
userStore.send('User.setName', 'Alice')    // validated
userStore.send('User.setAge', 30)          // validated
userStore.send('User.setAge', 'thirty')    // warns: type mismatch, expected number
userStore.send('User.set', { name: 'Bob', age: 25 })  // bulk set, validated
```

### 3.5 Validation Runtime

```js
import { validate, ok, fail, ValidationResult } from '@uploop/schema'

// Type: value → ValidationResult
const result = User.validate({ name: 'Alice', email: 'bad', age: 999 })
// → {
//     ok: false,
//     value: { name: 'Alice', email: 'bad', age: 999 },
//     errors: [
//       { path: 'email', message: 'must be a valid email', code: 'invalid_email' },
//       { path: 'age', message: 'must be ≤ 150', code: 'too_large' }
//     ]
//   }

// Or throw-based
User.assert({ name: 'Alice' })   // throws ValidationError
User.parse({ name: 'Alice' })    // throws ValidationError (same as assert)

// Safe access
User.safeParse({ name: 'Alice' }) // → { ok: false, errors: [...] }

// Coerce mode (for form data, query strings)
User.coerce({ name: 'Alice', age: '30' })
// → { ok: true, value: { name: 'Alice', email: undefined, age: 30 } }
```

---

## 4. AI-First Design

### 4.1 Machine-Readable Manifest

Every schema element exports a structured description:

```js
User.describe()
// → {
//   kind: 'uploop.entity',
//   entity: 'User',
//   fields: {
//     name: {
//       type: 'string',
//       required: true,
//       min: 1,
//       max: 100,
//       description: 'A person\'s display name',
//       example: 'Alice',
//       aiRole: 'identity.displayName'
//     },
//     email: {
//       type: 'string',
//       format: 'email',
//       required: true,
//       aiRole: 'identity.email'
//     }
//   },
//   meta: {
//     temperature: 'cold',
//     lifetime: 'persistent',
//     owner: 'server',
//     description: 'A registered user'
//   }
// }
```

AI tools can read this without understanding JavaScript closures. They know:
- What fields exist, their types, constraints, defaults.
- How entities relate (edges).
- Data temperature, lifetime, cache policy.
- Semantic roles via `aiRole`.

### 4.2 Schema Diffing

```js
import { diff } from '@uploop/schema'
const AdminUser = User.extend('AdminUser', { permissions: array(string()) })
diff(User, AdminUser)
// → {
//     added: [{ path: 'permissions', type: 'array<string>' }],
//     removed: [],
//     changed: [{ path: 'name', entity: 'User → AdminUser' }]
//   }
```

AI can use this to generate migrations, API changelogs, or refactor plans.

### 4.3 Export Formats

```js
User.toJSONSchema()   // → standard JSON Schema Draft 2020-12
User.toTypeScript()   // → 'type User = { name: string; email: string; ... }'
User.toGraphQL()      // → 'type User { name: String! email: String! ... }'
User.toZod()          // → 'z.object({ name: z.string().min(1).max(100), ... })'
User.toFormSchema()   // → array of { name, type, label, required, ... } for form generators
```

### 4.4 AI Metadata Convention

```js
const Product = entity('Product', {
  name: string(),
  price: number().min(0),
  category: ref('Category')
}, {
  aiRole: 'commerce.product',
  description: 'A product in the catalog. price is in USD cents.',
  tags: ['ecommerce', 'product'],
  // AI-specific hints
  aiHints: {
    searchable: ['name'],
    sortable: ['price', 'createdAt'],
    filterable: ['category', 'price']
  }
})
```

---

## 5. Intent Schema — Fuzzy, Token-Efficient AI Communication

### 5.1 The Problem

AI agents (LLMs) need to communicate data structures, but full schemas are expensive in tokens:

```
Full entity definition:        ~200 tokens
Intent representation:         ~15 tokens  (93% reduction)
```

When an AI agent proposes "I need user data with name and email", it should not have to emit a full `entity()` definition. It should emit a minimal *intent* that the system can resolve against known schemas or expand on demand.

### 5.2 `intent()` — The Loose Schema

An intent is a token-minimal data shape description. It is valid JavaScript, human-readable, and LLM-friendly:

```js
import { intent, resolveIntent, suggestIntent, intentToken } from '@uploop/schema'

// An AI agent emits this — minimal, clear, 15 tokens
const userIntent = intent({
  name: 'str',           // shorthand for "a string"
  email: 'email',        // shorthand for "an email string"
  age: 'int?',           // shorthand for "an optional integer"
  role: ['user','admin'] // shorthand for "enum of these values"
})

// A precise entity defined elsewhere in the codebase
const User = entity('User', {
  name: string().min(1).max(100),
  email: string().email(),
  age: number().integer().min(0).max(150).optional(),
  role: enumeration(['user', 'admin', 'mod']).withDefault('user')
})
```

### 5.3 Resolving Intent Against Schema

`resolveIntent()` fuzzy-matches an intent against a precise schema. It tells you what matches, what's missing, and what's extra:

```js
const resolution = resolveIntent(userIntent, User.describe())
// → {
//     match: 'partial',              // 'exact' | 'partial' | 'mismatch' | 'unknown'
//     matched: ['name', 'email'],
//     partial: ['age', 'role'],      // intent is looser than schema
//     missingInIntent: ['id', 'createdAt'],  // schema has fields intent didn't mention
//     extraInIntent: [],             // intent has fields schema doesn't know
//     score: 0.85                    // 0–1 confidence
//   }
```

This is the bridge between "what the AI thinks it needs" and "what the system actually has".

### 5.4 `suggestIntent()` — AI Proposes Missing Fields

When an intent is incomplete, the system can ask the AI to fill gaps:

```js
const suggestion = suggestIntent(userIntent, User.describe())
// → {
//     hint: 'User entity requires "id" (uuid) and "createdAt" (date)',
//     suggestedAdditions: [
//       { field: 'id', type: 'uuid', reason: 'required for identity' },
//       { field: 'createdAt', type: 'date', reason: 'tracked by User entity' }
//     ]
//   }

// AI agent can then extend its intent:
const fullIntent = intent({
  ...userIntent.shape,
  id: 'uuid',
  createdAt: 'date'
})
```

### 5.5 Intent Token Compression

For maximum LLM context efficiency, intents can be compressed to token-minimal strings and decompressed back:

```js
// Full intent object
const intent = intent({
  user: {
    name: 'str',
    email: 'email',
    posts: ['Post']        // relation: array of Post
  }
})

// Compress to token string (for LLM context windows)
const token = intentToken(intent)
// → "U:{name:s,email:e,posts:[Post]}"

// Decompress back
const restored = intentToken.parse(token)
// → intent({ user: { name: 'str', email: 'email', posts: ['Post'] } })
```

#### Token Shorthand Reference

LLMs are trained on these shorthands and emit them naturally:

| Intent shorthand | Meaning | Example output |
|-----------------|---------|---------------|
| `s` or `str` | string | `{ name: 'str' }` |
| `n` or `num` | number | `{ age: 'num' }` |
| `b` or `bool` | boolean | `{ active: 'bool' }` |
| `i` or `int` | integer | `{ count: 'int' }` |
| `d` or `date` | date | `{ createdAt: 'date' }` |
| `e` or `email` | email string | `{ email: 'email' }` |
| `u` or `url` | URL string | `{ website: 'url' }` |
| `uid` or `uuid` | UUID string | `{ id: 'uuid' }` |
| `[T]` or `[Type]` | array of T | `{ tags: '[str]' }` |
| `T?` or `str?` | optional T | `{ age: 'int?' }` |
| `T!` or `str!` | required T (explicit) | `{ name: 'str!' }` |
| `{...}` | nested object | `{ addr: { st:'str', zip:'str' } }` |
| `\|` or `or` | union | `{ status: 'ok\|err\|pending' }` |
| `K:V` | record/map | `{ meta: 'str:num' }` |
| bare `Name` | ref to entity | `{ author: 'User' }` |

### 5.6 End-to-End AI Workflow

```
1. LLM emits intent (minimal tokens):
   intent({ product: { name:'str', price:'num', stock:'int?', cat:'Category' } })

2. System resolves against known schemas:
   resolveIntent(intent, [Product, Category].map(e => e.describe()))
   → { match: 'partial', missingInIntent: ['id','createdAt','description'], score: 0.72 }

3. System suggests additions via suggestIntent():
   → { hint: 'Product requires id (uuid), createdAt (date)', suggestedAdditions: [...] }

4. LLM refines intent (or system auto-fills from schema defaults):
   intent({ product: { name:'str', price:'num', stock:'int?', cat:'Category', id:'uuid', createdAt:'date' } })

5. Resolution now matches; system generates full entity or maps to existing one.
```

### 5.7 Loose Schema for Exploration

When no precise schema exists yet, intents serve as exploration tools:

```js
// AI agent: "I want to build a blog. What entities do I need?"
const blogIntent = intent({
  Post: { title: 'str', body: 'str', author: 'User', tags: '[str]', publishedAt: 'date?' },
  User: { name: 'str', email: 'email', bio: 'str?' },
  Comment: { body: 'str', author: 'User', post: 'Post', createdAt: 'date' }
})

// System: "Let me suggest constraints and relations..."
const enriched = suggestIntent(blogIntent)
// → adds: Post.id (uuid), User.id (uuid), Comment.id (uuid)
// → suggests: Post.comments → Comment (hasMany), author fields → User (manyToOne)

// AI or developer can then materialize:
const Post = entity('Post', {
  id: string().uuid().withDefault(uuid),
  title: string().min(1),
  body: string(),
  author: ref('User'),
  tags: array(string()).withDefault([]),
  publishedAt: date().optional(),
  comments: array(ref('Comment'))
})
```

---

## 6. Client/Server Interaction with uploop-schema

### 6.1 The Shared Schema Contract

With uploop-schema, client and server share the same entity definitions. This eliminates the "two sources of truth" problem:

```
┌─────────────────────────────────────────────────┐
│                 @uploop/schema                   │
│                                                   │
│  ┌──────────┐    entity('User', {...})    ┌──────┐│
│  │  Client  │ ◄──────────────────────────►│Server││
│  │          │   same validation rules     │      ││
│  │  .validate()  same types/constraints   │.validate()│
│  │  .describe()  same manifest            │.describe()│
│  │  toGraph()    same HyperGraph          │toGraph()│
│  └──────────┘                             └──────┘│
└─────────────────────────────────────────────────┘
```

#### Pros

| Advantage | How |
|-----------|-----|
| **Single source of truth** | Define entity once, use everywhere. No duplicated type definitions. |
| **Validation parity** | `User.validate()` returns identical results on client and server. No "server rejected what client accepted" bugs. |
| **Schema-driven APIs** | Server auto-generates route validation from entities. Client auto-generates form validation. |
| **Schema manifest on wire** | Server sends `User.describe()` as JSON. Client hydrates it into executable schema at runtime. No codegen. |
| **Version negotiation** | `diff(oldSchema, newSchema)` detects breaking changes. Client can request compatible schema version. |
| **AI-native API design** | AI agent reads `describe()` manifest, understands the full data model without inspecting server code. |
| **Dynamic schema updates** | Server can push schema changes over WebSocket. Client hot-reloads entity definitions without page refresh. |
| **Zero build step** | No code generation from schema → TypeScript. Schemas are runtime objects. `describe()` is plain JSON. |

#### Cons & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Schema payload size** — `describe()` can be large for many entities | Lazy loading: only send schemas for requested routes. Compress with `intentToken()`. |
| **Validation perf on server** — deep validation per request | Cache parsed results. Skip validation for internal calls. Benchmark-driven optimization. |
| **Client can't trust client validation alone** | Server always re-validates. Client validation is UX sugar, not security. |
| **Schema version mismatch** — client has old schema, server has new | Version header in every request. Server auto-coerces or rejects with upgrade hint. |
| **Entity explosion** — too many entities make manifest huge | Namespacing: `{ auth: [User, Session], commerce: [Product, Cart, Order] }`. Load by domain. |

### 6.2 Schema Wire Protocol

```
Client                                Server
  │                                      │
  │  GET /api/schema/manifest            │
  │  ──────────────────────────────────► │
  │                                      │
  │  { version: 1, entities: [...] }    │
  │ ◄────────────────────────────────── │
  │                                      │
  │  hydrate client-side schemas         │
  │  User = fromJSON(manifest.User)      │
  │                                      │
  │  POST /api/users                     │
  │  Body: { name: 'Alice', ... }        │
  │  Header: X-Schema-Version: 1         │
  │  ──────────────────────────────────► │
  │                                      │
  │  Server validates with same schema   │
  │  200 { ok: true, data: {...} }       │
  │  or 409 { error: 'schema_mismatch',  │
  │           serverVersion: 2,          │
  │           diff: {...} }              │
  │ ◄────────────────────────────────── │
  │                                      │
  │  Client auto-fetches new manifest    │
  │  and hot-reloads schemas             │
```

### 6.3 Server-Side Usage

```js
// server.js — using uploop-schema + uploop-sst
import { entity, string, number, enumeration } from '@uploop/schema'
import { createService } from '@uploop/sst'

const User = entity('User', {
  id: string().uuid().withDefault(crypto.randomUUID),
  name: string().min(1).max(100),
  email: string().email(),
  role: enumeration(['user', 'admin']).withDefault('user')
}, {
  temperature: 'cold',
  lifetime: 'persistent',
  owner: 'server',
  cache: { ttl: 300_000 }
})

// Auto-generated REST endpoints with validation
const userService = createService(User, {
  // createService reads entity.describe() and generates:
  // GET    /api/users     → list (with filters from aiHints.filterable)
  // GET    /api/users/:id → get by id
  // POST   /api/users     → create (validates body against User schema)
  // PATCH  /api/users/:id → update (validates partial against User.partial())
  // DELETE /api/users/:id → delete
})

// Or manual route with schema validation
app.post('/api/users', async (req, res) => {
  const result = User.safeParse(req.body)
  if (!result.ok) {
    return res.status(400).json({
      error: 'validation_failed',
      details: result.errors
    })
  }
  const user = await db.users.insert(result.value)
  res.json({ ok: true, data: user })
})
```

### 6.4 Client-Side Usage

```js
// client.js — using uploop-schema on the frontend
import { fromJSON, intent, resolveIntent } from '@uploop/schema'
import { createGraph } from '@uploop/core'

// 1. Fetch server schema manifest at boot
const manifest = await fetch('/api/schema/manifest').then(r => r.json())

// 2. Hydrate executable schemas from JSON manifest
const User = fromJSON(manifest, 'User')
const Post = fromJSON(manifest, 'Post')

// 3. Build client-side HyperGraph from entities
const appGraph = createGraph(toGraph([User, Post]))

// 4. Form validation uses the same schema as server
function handleSubmit(formData) {
  const result = User.safeParse(formData)
  if (!result.ok) {
    showErrors(result.errors)   // same error format as server returns
    return
  }
  // POST to server — server validates again (security)
  await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(result.value),
    headers: { 'X-Schema-Version': manifest.version }
  })
}
```

### 6.5 Schema Version Negotiation

```js
// server.js
const v1 = entity('User', { name: string(), email: string().email() })
const v2 = entity('User', { name: string(), email: string().email(), avatar: string().url().optional() })

// diff tells us what changed
diff(v1, v2)
// → { added: ['avatar'], removed: [], changed: [], breaking: false }

// Breaking change detection
const v3 = entity('User', { name: string(), email: string().email(), age: number() }) // age was optional, now required
diff(v2, v3)
// → { added: [], removed: [], changed: [{ field: 'age', fromOptional: true, toOptional: false }], breaking: true }

// Server negotiates version
app.get('/api/schema/manifest', (req, res) => {
  const clientVersion = parseInt(req.headers['x-schema-version'] || '0')
  if (clientVersion < currentVersion) {
    res.json({
      version: currentVersion,
      entities: allEntities.map(e => e.describe()),
      diff: clientVersion > 0 ? diff(getVersion(clientVersion), getVersion(currentVersion)) : null,
      breaking: clientVersion > 0 ? isBreaking(getVersion(clientVersion), getVersion(currentVersion)) : false
    })
  } else {
    res.status(304).end() // not modified
  }
})
```

---

## 7. Dynamic / Schemaless Mode

The "schemaless" part of the name means: **you don't have to define everything upfront**.

### 7.1 Loose Object

```js
// No schema at all — just a named bag
const Config = entity('Config', {}, { loose: true })
// Accepts any keys, any values. Still registered in HyperGraph as a scope.

Config.validate({ theme: 'dark', layout: 'grid', experimental: true })
// → { ok: true }  — always passes
```

### 7.2 Partial Schema

```js
const Partial = object({
  name: string(),
  // everything else: accept anything
}, { passthrough: true })

Partial.validate({ name: 'Alice', color: 'blue', extra: 42 })
// → { ok: true, value: { name: 'Alice', color: 'blue', extra: 42 } }
```

### 7.3 Runtime-Extended Schemas

```js
// Start with nothing
let FormSchema = object({})

// Add fields as user adds form inputs
FormSchema = FormSchema.extend({ name: string() })
FormSchema = FormSchema.extend({ email: string().email() })

// Validate at any point
FormSchema.validate({ name: 'Alice', email: 'alice@x.com', extra: 'ignored' })
```

### 7.4 From Intent to Schema at Runtime

An AI agent can propose an intent, and the system materializes it into a full schema at runtime:

```js
// AI emits intent
const aiIntent = intent({
  Survey: {
    title: 'str',
    questions: '[{ text:str, type:str|num|bool, required:bool? }]',
    createdAt: 'date'
  }
})

// System materializes into executable entity
const Survey = entity.fromIntent('Survey', aiIntent, {
  temperature: 'warm',
  lifetime: 'session',
  owner: 'client'
})

// Now use it like any entity
Survey.validate({ title: 'Feedback', questions: [{ text: 'Rating', type: 'num', required: true }] })
// → { ok: true, ... }
```

This is the "dynamic" promise — schemas are not compile-time artifacts. They are live JavaScript objects you can build, mutate, and introspect at runtime, including from AI-generated intents.

---

## 8. HyperGraph Alignment

### 8.1 How Entity Maps to HyperGraph

```
Entity definition:
  entity('User', { name: string(), email: string().email(), posts: array(ref('Post')) })

HyperGraph nodes generated:
  'User.name'     → { type: 'data', default: '', temperature: 'cold', lifetime: 'persistent' }
  'User.email'    → { type: 'data', default: '', ... }
  'User.posts'    → { type: 'data', default: [], ... }
  'User.set'      → { type: 'update', reads: ['User.*'], writes: ['User.*'], run: validateAndSet }
  'User.validate' → { type: 'update', reads: ['User.*'], writes: [], run: validateOnly }

HyperGraph edges generated:
  ['User.posts', 'Post.id']  → relation edge
```

### 8.2 Schema Metadata → Node Metadata

| Schema config | HyperGraph node metadata |
|--------------|-------------------------|
| `temperature: 'cold'` | `NodeDef.temperature` → frame lane selection |
| `lifetime: 'persistent'` | `NodeDef.lifetime` → persistence strategy |
| `owner: 'server'` | `NodeDef.owner` → cache authority |
| `cache: { ttl: 300_000 }` | `NodeDef.cache` → SWR / cache policy |
| `consistency: 'strong'` | `NodeDef.consistency` → transaction behavior |

### 8.3 Full Example: E-Commerce

```js
const User = entity('User', {
  id: string().uuid().withDefault(uuid),
  name: string().min(1),
  email: string().email(),
}, { temperature: 'cold', lifetime: 'persistent', owner: 'server', cache: { ttl: 600_000 } })

const Product = entity('Product', {
  id: string().uuid().withDefault(uuid),
  name: string(),
  price: number().integer().min(0),       // cents
  stock: number().integer().min(0),
  category: ref('Category')
}, { temperature: 'cold', lifetime: 'persistent', owner: 'server', cache: { ttl: 120_000 } })

const Cart = entity('Cart', {
  id: string().uuid().withDefault(uuid),
  userId: ref('User'),
  items: array(object({
    productId: ref('Product'),
    quantity: number().integer().min(1),
    priceAtAdd: number().integer().min(0)
  })),
  total: computed(['items'], (c) =>
    c.items.reduce((sum, i) => sum + i.priceAtAdd * i.quantity, 0)
  )
}, { temperature: 'warm', lifetime: 'session', owner: 'client', cache: false })

const Order = entity('Order', {
  id: string().uuid().withDefault(uuid),
  userId: ref('User'),
  items: array(ref('OrderItem')),
  status: enumeration(['pending', 'paid', 'shipped', 'delivered', 'cancelled']),
  total: number().integer().min(0)
}, { temperature: 'cold', lifetime: 'persistent', owner: 'server', consistency: 'strong' })

// Generate the full HyperGraph
const storeGraph = createGraph(toGraph([User, Product, Cart, Order], {
  name: 'ecommerce',
  edges: [
    ['cart.checkout', 'order.create'],
    ['order.pay', 'order.status'],
  ]
}))

// AI can read the entire data model
storeGraph.describe()
// → full HyperGraph manifest with 4 entities, fields, relations, metadata
```

---

## 9. Implementation Plan

### Phase 1: Core Schema Engine (v0.6.0)

**Goal**: The schema primitives work. Validation works. `describe()` works.

- [ ] `@uploop/schema/src/core.js` — `schema()`, `ok()`, `fail()`, `validate()`, `ValidationResult`
- [ ] `@uploop/schema/src/primitives.js` — `string()`, `number()`, `boolean()`, `date()`
- [ ] `@uploop/schema/src/structural.js` — `object()`, `array()`, `tuple()`, `record()`
- [ ] `@uploop/schema/src/modifiers.js` — `optional()`, `nullable()`, `withDefault()`, `transform()`
- [ ] `@uploop/schema/src/compose.js` — `extend()`, `merge()`, `pick()`, `omit()`, `partial()`
- [ ] `@uploop/schema/src/describe.js` — `.describe()` on all types
- [ ] `@uploop/schema/src/index.js` — public API export
- [ ] `@uploop/schema/test/primitives.test.js`
- [ ] `@uploop/schema/test/structural.test.js`
- [ ] `@uploop/schema/test/compose.test.js`
- [ ] `@uploop/schema/package.json`

### Phase 2: Entities & Relations (v0.6.1)

**Goal**: `entity()` and `ref()` connect schema to the HyperGraph.

- [ ] `@uploop/schema/src/relational.js` — `entity()`, `ref()`, `computed()`
- [ ] `@uploop/schema/src/hypergraph.js` — `toGraph()`, `fromSchema()`, entity registry
- [ ] `@uploop/schema/test/relational.test.js`
- [ ] `@uploop/schema/test/hypergraph.test.js`

### Phase 3: Intent Schema & AI Communication (v0.6.2)

**Goal**: AI agents can communicate data intent with minimal tokens.

- [ ] `@uploop/schema/src/intent.js` — `intent()`, `resolveIntent()`, `suggestIntent()`, `intentToken()`
- [ ] `@uploop/schema/src/wire.js` — schema manifest wire protocol, version negotiation
- [ ] `@uploop/schema/test/intent.test.js`
- [ ] `@uploop/schema/test/wire.test.js`
- [ ] `@uploop/schema/test/ai-readability.test.js`

### Phase 4: Integration & Export (v0.6.3)

**Goal**: Schema ↔ Graph ↔ Store ↔ Server integration. AI export formats.

- [ ] `@uploop/schema/src/infer.js` — `toJSONSchema()`, `toTypeScript()`, `toGraphQL()`
- [ ] `@uploop/store` integration — `store.fromEntity()`
- [ ] `@uploop/core` integration — `createGraph(toGraph([...entities]))` tested
- [ ] `@uploop/sst` integration — `createService(entity)` auto-generates REST endpoints
- [ ] `@uploop/schema/test/infer.test.js`

### Phase 5: Polish & DX (v0.6.4)

- [ ] `@uploop/schema/src/utils.js` — `isSchema()`, `isEntity()`, `diff()`, `coerce()`, `fromJSON()`
- [ ] Lazy schemas: `lazy()`
- [ ] Union / intersection types: `union()`, `intersection()`
- [ ] Async validation support
- [ ] Error formatting: `formatErrors()`, `flatten()`
- [ ] `entity.fromIntent()` — materialize entity from AI intent at runtime
- [ ] docs: `@uploop/schema` README, HOWTO section

---

## 10. Comparison: Why Not Just Use Zod?

| | Zod | uploop-schema |
|---|---|---|
| **Paradigm** | Validation library | Schema engine + HyperGraph + AI intent |
| **Entity concept** | None — just schemas | `entity()` registers in HyperGraph, exports relations |
| **Graph integration** | Manual wiring | `toGraph()` auto-generates data nodes + edges |
| **Data temperature / lifetime** | None | First-class — feeds Runner optimization |
| **AI readability** | `.describe()` is opaque (closures) | Structured manifest with `aiRole`, relations, metadata |
| **AI intent communication** | None | `intent()` token-minimal shapes, `resolveIntent()`, `suggestIntent()` |
| **Runtime dynamism** | Static at definition time | `extend()`, `pick()`, `omit()`, `merge()` at runtime |
| **Store integration** | Manual | `store.fromEntity()` auto-generates validated handlers |
| **Client/server contract** | Manual | `describe()` over wire, version negotiation, `fromJSON()` |
| **Export targets** | JSON Schema only | JSON Schema, TypeScript, GraphQL, form schema |
| **Design** | TypeScript-first, class-heavy internally | JavaScript-first, closure-based, no classes, no prototypes |

---

## 11. Anti-Goals (v0.6.x)

- **No ORM/query builder**: This is not Prisma. No SQL generation. No migration engine.
- **No GraphQL server**: We can export to GraphQL SDL, but we don't serve it.
- **No protobuf serialization**: We describe data, not wire format (yet — could be v0.7.x).
- **No strict-mode-only**: Schemaless (passthrough, loose) is a first-class mode. Intent mode is loose-by-design.
- **No TypeScript requirement**: Works in plain JS. `.d.ts` files are optional.
- **No runtime type decorators**: No experimental TC39 proposals. Pure ESM JavaScript.

---

## 12. Success Criteria

After v0.6.x, a developer should be able to:

```js
// 1. Define data model in one place
const User = entity('User', {
  name: string(),
  email: string().email(),
  posts: array(ref('Post'))
})

// 2. Use it on the frontend (validated forms, HyperGraph state)
const graph = createGraph(toGraph([User, Post]))
appGraph.setEntity('User', formData)  // validated

// 3. Use it on the backend (API validation, data storage)
app.post('/users', (req, res) => {
  const result = User.safeParse(req.body)
  if (!result.ok) return res.status(400).json(result.errors)
  // ...
})

// 4. AI understands the app
User.describe() // ← feed to AI agent for codegen, docs, tests, refactors

// 5. AI communicates data intent with minimal tokens
const aiIntent = intent({ User: { name: 'str', email: 'email', posts: '[Post]' } })
const token = intentToken(aiIntent)  // "U:{n:s,e:e,p:[Post]}" — 15 tokens
resolveIntent(aiIntent, User.describe())  // → { match: 'partial', score: 0.78, ... }

// 6. The same schema drives DevTools
HyperGraphInspector.show(User.describe())
// → visual entity-relationship diagram in DevTools panel

// 7. Client and server share the same schema contract
const manifest = await fetch('/api/schema/manifest').then(r => r.json())
const ClientUser = fromJSON(manifest, 'User')
ClientUser.validate({ name: 'Alice', email: 'alice@x.com' })
// → identical validation result as server
```

---

## 13. File Layout in the Monorepo

```
Sources/uploopjs/
├── packages/
│   ├── core/           # (existing) createLoop, createGraph, createSignal, execution
│   ├── html/           # (existing) DOM adapter, html``, component()
│   ├── store/          # (existing) store(), derived(), persist() — add fromEntity()
│   ├── schema/         # ← NEW: @uploop/schema
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   ├── core.js
│   │   │   ├── primitives.js
│   │   │   ├── structural.js
│   │   │   ├── relational.js
│   │   │   ├── modifiers.js
│   │   │   ├── compose.js
│   │   │   ├── hypergraph.js
│   │   │   ├── describe.js
│   │   │   ├── infer.js
│   │   │   ├── intent.js     # ← NEW
│   │   │   ├── wire.js       # ← NEW
│   │   │   └── utils.js
│   │   ├── test/
│   │   │   ├── primitives.test.js
│   │   │   ├── structural.test.js
│   │   │   ├── relational.test.js
│   │   │   ├── compose.test.js
│   │   │   ├── hypergraph.test.js
│   │   │   ├── intent.test.js   # ← NEW
│   │   │   ├── wire.test.js     # ← NEW
│   │   │   └── ai-readability.test.js
│   │   └── package.json
│   ├── sst/            # (existing) — add createService(entity), schema manifest endpoint
│   ├── router/         # (existing)
│   ├── css/            # (existing)
│   ├── state-machine/  # (existing)
│   └── devutils/       # (existing) — add schema/entity visualizer in Inspector
```

---

## 14. Risk Analysis

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Too ORM-like** — users expect migrations, queries | Medium | Clear naming ("entity" not "model"). No DB coupling. Document boundaries. |
| **Validation perf** — deep object validation on every set | Medium | Lazy validation (opt-in). `.coerce()` for fast paths. Schema cache. |
| **Bundle size** — schema DSL adds weight | Low | Tree-shakeable. Core primitives < 5 KB gzip. Intent module is lightweight. |
| **Zod comparison fatigue** — "why not just zod?" community pushback | Low | Focus on HyperGraph integration + AI intent + client/server contract. Zod can't do any of these. |
| **Complexity creep** — too many primitives too early | Medium | Phase only `string`, `number`, `boolean`, `object`, `array`, `entity`, `ref`, `intent` for v0.6.0. Add others later. |
| **AI intent misunderstanding** — LLMs emit wrong shorthands | Medium | `intentToken` is forgiving. `resolveIntent()` handles mismatch. Shorthand table is short and documented. LLM training data includes these conventions. |

---

## 15. Naming

| Internal name | Package name | Tagline |
|--------------|-------------|---------|
| uploop-schema | `@uploop/schema` | *The data shape layer for HyperGraph. Schemaless when you want speed. Schema-rich when you want safety. Intent-driven when AI is involved.* |

Recommendation: **`@uploop/schema`** — straightforward, follows existing convention, clear meaning for both humans and AI.

---

## 16. Next Steps

1. **Review this design** — validate against the vision: AI-first, JavaScript-functional, more dynamic than ORM, HyperGraph-aligned, intent-driven AI communication, unified client/server contract.
2. **Create `@uploop/schema` package** — scaffold with `package.json` and `src/index.js`.
3. **Implement Phase 1** — `schema()`, `string()`, `number()`, `boolean()`, `object()`, `array()` + `describe()`.
4. **Implement Phase 2** — `entity()`, `ref()`, `toGraph()`.
5. **Implement Phase 3** — `intent()`, `resolveIntent()`, `suggestIntent()`, `intentToken()`, wire protocol.
6. **Integrate** — `store.fromEntity()`, `createGraph(toGraph(...))`, `createService(entity)`.
7. **Iterate** — AI exports, runtime materialization from intents, DevTools visualization.

---

*This is the missing piece: a data structure system that is as dynamic and composable as Uploop's update loop, as inspectable as its HyperGraph, as AI-readable as its manifest protocol, and now — with intent schemas — as token-efficient as an AI agent needs it to be.*
