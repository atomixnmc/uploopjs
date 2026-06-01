# @uploop/store Protocol

## Overview

`@uploop/store` provides external state management — stores that can be shared across components. It wraps `@uploop/core`'s `createLoop()` with convenience methods for selecting, deriving, and persisting state.

```
store(config) → { get, set, send, subscribe, select, derived }
```

## store(config)

Creates an external store (a standalone update loop).

### Config Schema

```js
{
  name: string,                    // optional, for debugging
  state: { ... },                  // initial state
  update: {                        // named update handlers
    [name]: (state, ...payload) => partialState
  },
  effect: {                        // side-effect handlers
    [name]: (ctx, ...payload) => void
  }
}
```

### Return Value

```js
{
  get()                    // → current state
  set(patch)               // set state (partial or function updater)
  send(event, ...args)     // invoke update handler
  subscribe(fn)            // subscribe → unsubscribe
  select(selector)         // select a slice of state
  derived(fn)              // create derived signal
  on(event, handler)       // register update handler at runtime
  effect(name, handler)    // register effect at runtime
  describe()               // → HyperGraph manifest
  dispose()                // clean up
}
```

### select(selector)

```js
store.select('user.name')              // → by dot path
store.select(s => s.user.name)         // → by function
```

### derived(fn)

Creates a reactive value that recomputes on state change:

```js
const completedCount = store.derived(
  s => s.todos.filter(t => t.done).length
)

completedCount.get()                   // → number
completedCount.subscribe(n => ...)     // → unsubscribe
```

## createSelector(selectFn, equalityFn)

Memoized selector that only recomputes when the derived value changes:

```js
const selectActiveTodos = createSelector(
  s => s.todos.filter(t => !t.done),
  (a, b) => a.length === b.length
)
```

## createComposedSelector(selectors, combiner)

Combines multiple selectors:

```js
const selectSummary = createComposedSelector(
  [selectAllTodos, selectActiveTodos],
  (all, active) => ({ total: all.length, active: active.length })
)
```

## derived(deriveFn, subscribe)

Generic derived value from any subscribable source:

```js
const d = derived(
  () => compute(a.get(), b.get()),
  (cb) => { /* subscribe to changes, call cb(...) */ }
)
```

## persist(store, config)

Persists store state to localStorage:

```js
persist(myStore, {
  key: 'my-app:settings',
  paths: ['preferences.theme', 'preferences.locale']
})
```

### Options

| Option        | Default                  | Description                       |
|---------------|--------------------------|-----------------------------------|
| `key`         | `'uploop:store'`         | localStorage key                  |
| `paths`       | `[]` (all)               | Specific state paths to persist   |
| `serialize`   | `JSON.stringify`         | Custom serializer                 |
| `deserialize` | `JSON.parse`             | Custom deserializer               |
