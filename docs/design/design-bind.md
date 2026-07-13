# Data Binding Design — `bind()`

> **Extends:** design-schema.md § HyperGraph Integration  
> **Philosophy:** One-way internally. Closed-loop by protocol. Declarative mapping by convention.

## 1. The Gap

`toGraph()` creates data nodes from entities. `fromSchema()` creates update handlers. But the connections between entity fields, graph nodes, DOM elements, and external sources are still manual:

```js
// Without bind — manual wiring
const User = entity('User', { name: string(), email: string().email() })
const graph = createGraph(toGraph([User]))

// Every interaction requires manual get/set/send:
graph.set('User.name', 'Alice')
const name = graph.getNode('User.name')
input.value = name
input.addEventListener('input', e => graph.set('User.name', e.target.value))
// ... repeat for every field, every form, every API call
```

## 2. The Solution: `bind()`

A binding is a **declared connection** between an entity and a target. It auto-generates the read/write edges, validates data, and exports its own graph manifest.

```js
// With bind — declarative
const userBind = bind(User, graph)

// Populate: validate + write entity-shaped data to graph
userBind.populate({ name: 'Alice', email: 'alice@x.com' })

// Project: read graph nodes as entity-shaped object
const user = userBind.project()
// → { name: 'Alice', email: 'alice@x.com' }

// Patch: partial update with validation
userBind.patch({ name: 'Bob' })

// Subscribe: react to graph changes with entity-shaped data
userBind.subscribe(user => console.log(user))

// Form: auto-wire DOM elements by [name] convention
const formBind = userBind.form(document.querySelector('#signup'))
// Auto-wires: input[name="name"] ↔ User.name, input[name="email"] ↔ User.email
```

## 3. Core API

### `bind(entity, graph, options?)`

Creates a managed binding between an entity schema and a HyperGraph instance.

| Method | Purpose |
|--------|---------|
| `project()` | Read graph nodes → entity-shaped plain object |
| `populate(data)` | Validate + write entity data to graph nodes |
| `patch(partial)` | Partial update (validates merged state) |
| `subscribe(fn)` | React to any bound field change with entity-shaped data |
| `onChange(field, fn)` | React to a specific field change |
| `reset()` | Reset all bound nodes to their defaults |
| `snapshot()` | Take a snapshot of current bound state |
| `restore(snapshot)` | Restore graph nodes from a snapshot |
| `form(el, opts?)` | Create a form binding for a DOM element |
| `connect(source, opts?)` | Connect to an external data source (API) |
| `describe()` | Export binding manifest (edges, ports, channels) |

### `bind.form(entity, graph, element, options?)`

Auto-wires a DOM form to entity fields by matching `[name]` attributes.

**Convention**: `<input name="email">` binds to entity field `email` → graph node `User.email`.

**How it works (two one-way edges)**:

```
┌─────────────────────────────────────────────────────────────┐
│  READ EDGE:  graph node → input.value                       │
│  graph.onDataChange('User.email') → input.value = newVal    │
│                                                             │
│  WRITE EDGE: input event → update handler → graph node      │
│  input @input → send('User.setEmail', e.target.value)       │
│         → User.validate({ email: val }) → graph.set(...)    │
└─────────────────────────────────────────────────────────────┘
```

Each edge is traceable and appears in `describe()`.

**Field type → input mapping (convention)**:

| Entity field type | Default input | Binding |
|-------------------|---------------|---------|
| `string()` | `<input type="text">` | `.value` + `@input` |
| `string().email()` | `<input type="email">` | `.value` + `@input` |
| `number()` | `<input type="number">` | `.valueAsNumber` + `@input` |
| `boolean()` | `<input type="checkbox">` | `.checked` + `@change` |
| `date()` | `<input type="date">` | `.valueAsDate` + `@change` |
| `enumeration([...])` | `<select>` | `.value` + `@change` |
| `array(string())` | `<input type="text">` (tag input) | custom |
| `ref('Other')` | `<select>` (populated from Other entity) | custom |

### `bind.connect(entity, graph, source, options?)`

Connects an entity to an external data source with sync strategy.

```js
const userBind = bind(User, graph)

// REST API binding
const conn = userBind.connect({
  fetch: (id) => fetch(`/api/users/${id}`).then(r => r.json()),
  save: (data) => fetch('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}, {
  sync: 'swr',           // stale-while-revalidate | optimistic | pessimistic
  debounce: 300,         // ms before save after last change
  retry: 3,              // retry count on failure
  cacheTTL: 600_000      // ms before refetch
})

// Load from source
await conn.load('user-123')
// → GET /api/users/user-123 → User.validate(response) → bind.populate(data)

// Auto-save on change
conn.autoSave()
// → subscribes to graph changes, debounces, saves to API

// Manual save
await conn.save()
// → bind.project() → User.validate() → PUT /api/users/:id

// Polling sync
conn.poll(30_000)  // every 30 seconds
```

## 4. Semantic Mapping

### 4.1 Field Aliases

When entity field names don't match graph node names or API field names:

```js
const userBind = bind(User, graph, {
  map: {
    // Entity field 'email' → graph node 'User.emailAddress'
    email: 'emailAddress',
    // Entity field 'name' → API field 'full_name'
    name: { from: 'full_name', to: 'full_name' }
  }
})
```

### 4.2 Field Transforms

Transform values during populate/project:

```js
const userBind = bind(User, graph, {
  map: {
    name: {
      populate: (v) => v.trim(),          // API response → graph
      project: (v) => v.toUpperCase(),    // graph → consumer
      patch: (v) => v                      // form → graph
    }
  }
})
```

### 4.3 Virtual Fields

Fields that exist in the binding but not in the entity or graph:

```js
const userBind = bind(User, graph, {
  virtual: {
    fullName: {
      project: (data) => `${data.firstName} ${data.lastName}`,
      populate: (data) => {
        const [first, ...rest] = data.fullName.split(' ')
        return { firstName: first, lastName: rest.join(' ') }
      }
    }
  }
})
```

### 4.4 Nested Entities

Auto-flatten/expand nested entity relationships:

```js
const Post = entity('Post', {
  title: string(),
  author: ref('User')
})

const postBind = bind(Post, graph)
// project() expands: { title: '...', author: { name: 'Alice', email: '...' } }
// populate() flattens: { title: '...', author: 'user-123' }
// Expansion reads from User nodes in the same graph
```

## 5. Declarative Bindings (Configuration Mode)

The entire binding can be declared as a plain object — AI-readable, serializable:

```js
const userBindingConfig = {
  entity: 'User',
  fields: {
    name: { bind: true },
    email: { bind: true, validate: 'onBlur' },
    age: { bind: true, coerce: 'number' },
    role: { bind: true, as: 'select', options: ['user', 'admin', 'mod'] }
  },
  source: {
    type: 'rest',
    endpoint: '/api/users/:id',
    sync: { mode: 'swr', debounce: 300, retry: 3 }
  },
  form: {
    selector: '#user-form',
    mode: 'twoWay',          // two one-way edges
    submit: 'save',          // save | validate | custom
    resetOnSuccess: true
  }
}

// Materialize from config
const binding = bind.fromConfig(userBindingConfig, graph)
```

## 6. Integration with HyperGraph

Bindings export their own edges — they are inspectable graph additions:

```js
const bind = bind(User, graph)
bind.form(document.querySelector('#signup'))

bind.describe()
// → {
//     kind: 'uploop.binding',
//     entity: 'User',
//     fields: ['name', 'email', 'age'],
//     edges: [
//       { type: 'read', from: 'User.name', to: 'input#name.value' },
//       { type: 'write', from: 'input#name.@change', to: 'User.name', via: 'User.setName' },
//       { type: 'read', from: 'User.email', to: 'input#email.value' },
//       { type: 'write', from: 'input#email.@change', to: 'User.email', via: 'User.setEmail' }
//     ],
//     ports: {
//       in: ['User.name', 'User.email', 'User.age'],
//       out: ['User.setName', 'User.setEmail', 'User.setAge']
//     }
//   }
```

## 7. File Layout

```
@uploop/schema/src/
├── bind.js        # bind(), bind.form(), bind.connect()
├── ... (existing)
```

## 8. Implementation Priority

| Priority | Feature | Reason |
|----------|---------|--------|
| P0 | `bind(entity, graph)` — project, populate, patch, subscribe | Foundation |
| P0 | `bind.form(el)` — auto-wire DOM by [name] convention | Biggest DX win |
| P1 | `bind.connect(source)` — API sync with SWR, debounce | Completes the loop |
| P1 | Field aliases + transforms | Real-world naming mismatches |
| P2 | Virtual fields, nested entity expansion | Advanced use cases |
| P2 | Declarative config mode (`bind.fromConfig()`) | AI-codegen target |
| P3 | Validation modes (onBlur, onChange, onSubmit) | Form UX |

## 9. Design Rules

1. **One-way internally**: Every binding edge is a directed read or write. No magic `v-model`.
2. **Closed-loop by protocol**: Two-way binding is two one-way edges with declared ports.
3. **Convention over configuration**: `name="email"` binds to entity field `email` by default. Override explicitly.
4. **Entity is the contract**: Validation happens at the entity level. Bindings route data but don't define shapes.
5. **Inspectable**: Every binding exports `describe()` with edges and ports. AI and DevTools can trace data flow.
6. **Graph is the hub**: All data flows through HyperGraph nodes. DOM and API are ports on the graph.
