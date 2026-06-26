# @uploop/schema Design

## Overview

`@uploop/schema` is the data shape layer for Uploop HyperGraph. It provides JavaScript-functional, AI-readable, runtime-dynamic schema primitives that integrate directly with `createGraph()` and `@uploop/store`.

```
entity definition  →  schema validator  →  HyperGraph nodes + edges
                        │
                        ├── describe()  →  AI-readable manifest
                        ├── validate()  →  runtime type checking
                        ├── toGraph()   →  auto-generate data nodes
                        └── intent()    →  AI token-efficient communication
```

## Core Concepts

### 1. Schema as Function

Every schema is `(value) → ValidationResult`. No classes. No prototypes. Pure functions that return functions.

```js
const Name = schema('Name', { type: 'string', validate(v) { ... } })
Name.validate('Alice')  // → { ok: true, value: 'Alice' }
```

### 2. Schemaless by Default

Any data is valid unless you constrain it. Constraints are additive. Opt-in safety.

```js
const Loose = object({}, { passthrough: true })  // accepts anything
const Strict = object({ name: string() })         // validates
```

### 3. Runtime Dynamic

Build, merge, extend, pick, omit schemas at runtime. No build step.

```js
const UserPatch = partial(User)
const PublicUser = pick(User, ['id', 'name'])
const AdminUser = extend(User, { permissions: array(string()) })
```

### 4. AI-First

Every schema exports `.describe()` — a structured machine-readable manifest with types, constraints, relations, `aiRole` hints, and data temperature metadata.

### 5. HyperGraph Native

`entity()` definitions feed directly into `createGraph()` via `toGraph()`. Relations (`ref()`) become HyperGraph edges. Data temperature/lifetime/cache metadata flows to node metadata.

### 6. Intent-First for AI

`intent()` provides token-minimal data shapes for AI communication (~15 tokens vs ~200). `resolveIntent()` fuzzy-matches intents against precise schemas.

## Package Structure

```
@uploop/schema/
├── src/
│   ├── index.js          # Public API
│   ├── core.js           # schema(), validate(), ok(), fail(), ValidationResult
│   ├── describe.js       # .describe() on all types
│   ├── primitives.js     # string(), number(), boolean(), date()
│   ├── structural.js     # object(), array(), tuple(), record()
│   ├── modifiers.js      # optional(), nullable(), withDefault(), transform()
│   ├── compose.js        # extend(), merge(), pick(), omit(), partial()
│   ├── relational.js     # entity(), ref(), computed()
│   ├── hypergraph.js     # toGraph(), fromSchema(), registerEntity()
│   ├── infer.js          # toJSONSchema(), toTypeScript()
│   ├── intent.js         # intent(), resolveIntent(), suggestIntent(), intentToken()
│   ├── wire.js           # client/server schema contract, versioning
│   └── utils.js          # isSchema(), isEntity(), diff(), coerce(), fromJSON()
└── test/
    ├── primitives.test.js
    ├── structural.test.js
    ├── compose.test.js
    ├── relational.test.js
    ├── hypergraph.test.js
    └── intent.test.js
```

## Key Types

### Schema

```js
{
  kind: 'uploop.schema',
  name: string,
  type: string,
  _validate: (value) => ValidationResult,
  _meta: { description, example, tags, aiRole },
  _modifiers: [],
  optional(), nullable(), withDefault(v), transform(fn), pipe(other),
  describe()
}
```

### ValidationResult

```js
{ ok: true, value: any }
// or
{ ok: false, value: any, errors: [{ path: string, message: string, code: string }] }
```

### Entity

```js
{
  kind: 'uploop.entity',
  entity: string,
  fields: { [name]: FieldDef },
  relations: [{ field, ref, type, inverse }],
  edges: [[from, to]],
  meta: { temperature, lifetime, owner, consistency, cache, description, aiRole },
  validate(), describe(), toGraph()
}
```

## API Reference

### Atomic
- `schema(name, config)` — base schema factory
- `ok(value)` — success result
- `fail(message, code?)` — failure result
- `validate(schema, value)` → ValidationResult

### Primitives
- `string()` → StringSchema  `.min(n) .max(n) .email() .url() .uuid() .regex() .trim()`
- `number()` → NumberSchema  `.min(n) .max(n) .integer() .positive() .negative()`
- `boolean()` → BooleanSchema
- `date()` → DateSchema  `.min(d) .max(d) .past() .future()`
- `literal(value)` — exact match
- `enumeration(values)` — one of array

### Structural
- `object({ field: schema })` → ObjectSchema  `.strict() .passthrough()`
- `array(ofSchema)` → ArraySchema  `.min(n) .max(n) .nonEmpty()`
- `tuple([...schemas])` — fixed-length positional
- `record(keyS, valS)` — dynamic key-value

### Modifiers
- `optional(schema)` — allow undefined
- `nullable(schema)` — allow null
- `withDefault(schema, value)` — default value
- `transform(schema, fn)` — value → value
- `pipe(...schemas)` — chain left-to-right

### Composition
- `extend(base, additions)` — add fields
- `merge(...schemas)` — combine objects
- `pick(schema, keys)` — keep only
- `omit(schema, keys)` — remove
- `partial(schema)` — all optional
- `required(schema)` — all required

### Relational
- `entity(name, fields, meta?)` → Entity
- `ref(entityName)` — relation reference
- `computed(deps, fn)` — derived field

### HyperGraph Integration
- `toGraph(entities, extra?)` → GraphConfig
- `fromSchema(entity)` → LoopConfig

### Intent
- `intent(shape)` → Intent
- `resolveIntent(intent, describe)` → Resolution
- `suggestIntent(intent, describe)` → Suggestions
- `intentToken(intent)` → compressed string
- `intentToken.parse(token)` → Intent

## Validation Strategy

1. **Lazy by default**: Schemas are validated only when `.validate()` is called, not on every `set()`.
2. **Coerce mode**: `.coerce()` attempts type coercion before validation (for form data, query params).
3. **Safe parse**: `.safeParse()` never throws, always returns `ValidationResult`.
4. **Assert mode**: `.assert()` throws `ValidationError` on failure.
5. **Partial validation**: `object.partial()` allows missing fields during validation.

## Integration Points

| Package | Integration |
|---------|-------------|
| `@uploop/core` | `toGraph([entities])` → `createGraph()` config |
| `@uploop/store` | `store.fromEntity(User)` → auto update handlers |
| `@uploop/html` | schema → form field validation messages |
| `@uploop/stream` | entity → binary codec generation |
| `@uploop/sst` | `createService(entity)` → auto REST endpoints |
