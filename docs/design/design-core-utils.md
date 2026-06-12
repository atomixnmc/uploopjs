# Core Utilities — Audit of `_archive/lib/uploop.utils.js`

> **Purpose:** Evaluate old utility exports. Keep what's useful, discard what's harmful, identify what's missing for v0.3.0.

---

## Old Utils: Verdict Per Export

### `patchObjectPrototype()` — DON'T BRING BACK

```js
Object.defineProperty(Object.prototype, '_uid', { get: ... })
```

**Verdict: Harmful.** Mutating `Object.prototype` is a well-known anti-pattern:
- Pollutes `for...in` loops (even with `enumerable: false`, can confuse other code)
- Conflicts with other libraries that also monkey-patch Object
- Breaks `hasOwnProperty` expectations
- Makes debugging harder (every object has `_uid`)
- The getter-then-define pattern is clever but fragile — relies on prototype chain behavior that JITs may not optimize

**What to use instead:** `WeakMap` for object→ID mapping:

```js
const _objectIds = new WeakMap()
let _nextId = 0

export function uid(obj) {
  if (!_objectIds.has(obj)) _objectIds.set(obj, ++_nextId)
  return _objectIds.get(obj)
}
```

This gives the same capability (stable unique IDs for objects) without polluting any prototype. Use it internally for tracking component instances, render targets, or binding references — never expose it to user code.

---

### `polyfills()` — DON'T BRING BACK

Just calls `patchObjectPrototype()`. Same verdict.

---

### `createUUID()` — BRING BACK, BUT DIFFERENTLY

```js
export function createUUID() {
    return crypto.randomUUID();
}
```

**Verdict: Useful concept, wrong implementation.** The current codebase generates IDs like:
- Events: `ev_${++_evCounter}` (sequential, not unique across sessions)
- Transactions: `tx_${Date.now()}_${Math.random()}` (fragile, collision possible)

For v0.3.0 features that need stable cross-session IDs (persisted events, SSR hydration markers, binding stable IDs, serialized graph nodes), we need proper UUIDs.

**What to build:** A multi-strategy UUID utility that degrades gracefully:

```js
// core/src/uuid.js
export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()                    // Modern browsers, Node 19+
  }
  // Fallback: RFC 4122 v4 via Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}
```

Use it for: event envelope IDs (replace `ev_${++counter}`), transaction IDs, binding stable IDs (Breakthrough 2), component instance IDs, persisted store keys.

---

### `getObjectByPath(path, obj)` — BRING BACK, EXPAND

```js
export function getObjectByPath(path, obj) {
    var keys = path.split('.');
    var value = obj;
    for (var i = 0; i < keys.length; i++) {
        value = value[keys[i]];
    }
    return value;
}
```

**Verdict: Useful, but incomplete.** This pattern already exists in `store.js` (the `select()` method). The problem: the same logic is duplicated wherever someone needs dot-path access. The graph engine's `reads`/`writes` paths will need this. Selectors need this. Derived values need this.

**What to build:** A pair of utilities — `getPath` + `setPath`:

```js
// core/src/path.js
export function getPath(obj, path) {
  if (typeof path === 'function') return path(obj)
  if (typeof path !== 'string') return obj
  return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj)
}

export function setPath(obj, path, value) {
  const keys = path.split('.')
  const last = keys.pop()
  const target = keys.reduce((o, k) => {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {}
    return o[k]
  }, obj)
  target[last] = value
  return obj
}
```

Usage in graph engine:
```js
// Instead of: state.count (hardcoded single key)
// Support: state['user.profile.name'] (nested path from graph reads/writes)
const value = getPath(state, nodeDef.reads[0])
```

Usage in store (replace inline implementation):
```js
function select(selector) {
  return getPath(loop.get(), selector)
}
```

---

### `fromStringsToTemplate(strings, ...values)` — DON'T BRING BACK

```js
export function fromStringsToTemplate(strings, ...values) {
    let str = '';
    strings.forEach((string, i) => {
        str += string + (values[i] || '');
    });
    return str;
}
```

**Verdict: Too trivial.** This is the simplest possible tagged template implementation — just concatenation. The `html()` tag already does this internally (and much more: binding detection, marker insertion, nested template handling). The SSR execution target will need a similar but different template processor (one that doesn't insert `data-up-*` markers). This utility is not reusable in that form.

**What the SSR target actually needs:** A `renderToString()` function that processes `html\`...\`` templates but outputs clean HTML strings without bindings. That's a specific execution strategy, not a general utility.

---

## What's Missing (Needs to Be Built)

The old utils covered basic needs. The v0.3.0 architecture needs more.

### 1. Deep Clone — `clone(obj)`

**Why needed:** The graph's `describe()` currently does `JSON.parse(JSON.stringify(graph))` which is lossy:
- Loses `Function` references (intentional for describe, but not for state snapshot)
- Loses `undefined` values
- Loses `Map`, `Set`, `Date` objects
- Throws on circular references

The graph engine, persistence layer, and SSR serialization all need reliable deep cloning.

```js
// core/src/clone.js
export function clone(obj, seen = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj
  if (seen.has(obj)) return seen.get(obj)  // circular ref

  if (obj instanceof Map) {
    const copy = new Map()
    seen.set(obj, copy)
    for (const [k, v] of obj) copy.set(clone(k, seen), clone(v, seen))
    return copy
  }
  if (obj instanceof Set) {
    const copy = new Set()
    seen.set(obj, copy)
    for (const v of obj) copy.add(clone(v, seen))
    return copy
  }
  if (obj instanceof Date) return new Date(obj)
  if (Array.isArray(obj)) {
    const copy = []
    seen.set(obj, copy)
    for (let i = 0; i < obj.length; i++) copy[i] = clone(obj[i], seen)
    return copy
  }

  const copy = Object.create(Object.getPrototypeOf(obj))
  seen.set(obj, copy)
  for (const key of Object.keys(obj)) copy[key] = clone(obj[key], seen)
  return copy
}
```

### 2. Deep Equal — `equals(a, b)`

**Why needed:** 
- Effect handlers need to know if a state value actually changed
- Selectors need memoization (same inputs → skip recompute)
- Template-patch needs to know which template tree nodes differ
- The ring buffer executor discards duplicate events

```js
// core/src/equals.js
export function equals(a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false
    for (const [k, v] of a) if (!b.has(k) || !equals(v, b.get(k))) return false
    return true
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false
    for (const v of a) if (!b.has(v)) return false
    return true
  }
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()

  const keysA = Object.keys(a), keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) if (!Object.hasOwn(b, key) || !equals(a[key], b[key])) return false
  return true
}
```

### 3. Graph Serializer — `serialize(graph)` / `deserialize(json)`

**Why needed:** The graph uses `Map` extensively (nodeDefs, dataNodes, updateFns, dataToViews, dataToUpdates). `JSON.stringify` can't serialize `Map`. The `describe()` workaround (JSON roundtrip of only the nodes/edges objects) works for introspection but can't reconstruct a working graph.

For v0.3.0 features:
- `graph.serialize()` needed for SSR state transfer
- `graph.diff()` needs to compare old and new graph state
- Persistence (`persist()`) needs to store complex state
- DevTools need full graph inspection

```js
// core/src/serialize.js
export function serialize(value) {
  return JSON.stringify(value, (key, val) => {
    if (val instanceof Map) return { __type: 'Map', entries: [...val.entries()] }
    if (val instanceof Set) return { __type: 'Set', values: [...val.values()] }
    if (val instanceof Date) return { __type: 'Date', value: val.toISOString() }
    if (typeof val === 'function') return { __type: 'Function', name: val.name || 'anonymous' }
    if (val === undefined) return { __type: 'undefined' }
    return val
  })
}

export function deserialize(json) {
  return JSON.parse(json, (key, val) => {
    if (val?.__type === 'Map') return new Map(val.entries)
    if (val?.__type === 'Set') return new Set(val.values)
    if (val?.__type === 'Date') return new Date(val.value)
    if (val?.__type === 'Function') return null  // can't revive, return null
    if (val?.__type === 'undefined') return undefined
    return val
  })
}
```

---

## Recommended `@uploop/core` Utils Package

```
packages/core/src/
  uuid.js       — uuid() with crypto.randomUUID + fallback          (~20 lines)
  path.js       — getPath(obj, path), setPath(obj, path, value)    (~20 lines)
  clone.js      — clone(obj) with Map/Set/Date/circular support     (~40 lines)
  equals.js     — equals(a, b) with Map/Set/Date support            (~40 lines)
  serialize.js  — serialize(value), deserialize(json)               (~30 lines)
```

**Total: ~150 lines.** Each utility is independently importable (tree-shakeable). No dependencies between them. All use standard JS — no polyfills, no prototype mutations.

### Migration plan

| Current Code | Replace With |
|---|---|
| `store.select()` inline `split('.').reduce()` | `import { getPath } from '@uploop/core'` |
| `describe()` → `JSON.parse(JSON.stringify(graph))` | `import { clone } from '@uploop/core'` |
| `ev_${++_evCounter}` sequential IDs | `import { uuid } from '@uploop/core'` |
| `tx_${Date.now()}_${Math.random()}` | `uuid()` |
| Future: selector memoization | `import { equals } from '@uploop/core'` |
| Future: SSR state transfer | `import { serialize, deserialize } from '@uploop/core'` |

### What NOT to add to core utils

| Don't add | Because |
|---|---|
| Lodash-style collection utilities (groupBy, sortBy, pick, omit) | Not core's job. User can import lodash if needed. Core stays minimal. |
| Promise utilities (delay, timeout, retry) | The interruptible/cache/error metadata will handle this at the graph level |
| DOM utilities | `@uploop/html` owns DOM concerns |
| Polyfills (Array.from, Object.assign, Promise) | Target is modern ESM browsers. No IE11. |
| Prototype mutations of ANY kind | Never. Use WeakMap. |
