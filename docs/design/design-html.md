# @uploop/html Protocol

## Overview

`@uploop/html` is the DOM/WebComponent adapter for Uploop. It translates HyperGraph components into rendered HTML with CSP-safe event handling. It depends on `@uploop/core` — never the other way around.

```
component config → createLoop() → view function → html template → DOM mount + event binding
```

## html\`...\` Template Tag

A tagged template literal that returns a template descriptor.

### Supported Binding Syntaxes

| Syntax           | Type    | Result                              |
|------------------|---------|-------------------------------------|
| `${value}`       | text    | Embedded into template string        |
| `@click=${fn}`   | event   | Replaced with `data-up-event` marker |
| `.value=${val}`  | prop    | Replaced with `data-up-prop` marker  |
| `?checked=${bool}`| bool   | Replaced with `data-up-bool` marker  |
| `${html\`...\`}` | nested  | Nested template, bindings merged     |
| `${[a,b].map(x => html\`...\`)}` | list | Array of templates, rendered and merged |

### Template Descriptor

```js
{
  template: '<button data-up-event="click:0">click</button>',
  bindings: [
    { type: 'event', name: 'click', value: handlerFn, index: 0 }
  ],
  values: [handlerFn],
  toString() → template string
}
```

### CSP Safety

Instead of inline `onclick="..."` (blocked by CSP), `@click=${handler}`:
1. Creates a `data-up-event="click:0"` attribute on the element
2. During mount, `applyBindings()` finds elements by that marker
3. Attaches the handler via `addEventListener(eventName, handler)`

This works under strict CSP rules that block inline scripts.

## component(name, config)

Defines a HyperGraph component.

### Config Schema

```js
{
  state: { ... },                      // initial state (default: {})
  update: {                            // named event handlers
    [name]: (state, ...payload) => partialState
  },
  view: (state, { send, html }) =>     // render function
    string | html template descriptor,
  effect: {                            // side-effect handlers
    [name]: (ctx, ...payload) => void
  },
  mount: (element, ctx) => void,       // lifecycle: after first render
  unmount: (element, ctx) => void       // lifecycle: before cleanup
}
```

### Return Value (Component Descriptor)

```js
{
  name: string,                      // component display name
  loop: loop,                        // the underlying @uploop/core loop
  render(props) → string,            // render to HTML string
  mount(element, props) → unmount(), // mount to DOM element
  create(props) → instance,          // create standalone instance
  describe() → HyperGraph JSON,      // export graph manifest
  tag(props) → string                // (if defineElement was called) HTML tag string
}
```

### View Function Contract

```js
view(state, { send, html }) → string | html template
```

- `state` — current component state snapshot
- `send(event, ...args)` — trigger an update handler
- `html` — the template tag, passed for convenience
- Returns a string or html template descriptor

### Mount Lifecycle

```
mount(element, [props])
  → loop.set(props) if provided
  → renderView() → get template string
  → element.innerHTML = templateString
  → applyBindings(element, bindings, loop.send, loop.get())  ← attaches events, props
  → mountHook(element, ctx) if provided
  → subscribe to loop → on change: renderView() → element.innerHTML → applyBindings()
  → return unmount function
```

### create(props) — Standalone Instance

```js
const instance = MyComp.create({ initialProp: 'value' })
instance.mount(document.getElementById('root'))
instance.render()                    // → HTML string
instance.loop.send('inc')            // triggers re-render
instance.describe()                  // → HyperGraph JSON
```

Useful when you need multiple independent instances of the same component.

### Descriptor Graph (describe())

```json
{
  "kind": "uploop.loop",
  "name": "Counter",
  "nodes": {
    "state": { "type": "data", "access": "readwrite" },
    "inc": { "type": "update", "reads": ["state"], "writes": ["state"] },
    "view": { "type": "view", "dependsOn": ["state"] }
  },
  "edges": [
    ["state", "view"],
    ["inc", "state"],
    ["inc", "view"]
  ]
}
```

## defineElement(tagName, component, options)

Registers a WebComponent from a component descriptor.

### Options

```js
{ useShadowDOM: true }   // default: true
```

### Usage

```js
import { component, defineElement, html } from '@uploop/html'

const Counter = component('Counter', { ... })
defineElement('up-counter', Counter)

// In HTML:
// <up-counter></up-counter>
// <up-counter data-count="5"></up-counter>

// Generate tag strings:
Counter.tag({ count: 5 })  // → '<up-counter data-count="5"></up-counter>'
```

Attributes with `data-` prefix are automatically mapped to camelCase props.

## applyBindings(root, bindings, send, state)

Finds elements with `data-up-event`, `data-up-prop`, and `data-up-bool` markers and applies them.

### Event Binding

```html
<!-- @click=${handler} in template → -->
<button data-up-event="click:0">click</button>
<!-- applyBindings → -->
<button>click</button>  (with addEventListener('click', handler) attached)
```

Handler resolution:
| Value Type      | Behavior                              |
|-----------------|---------------------------------------|
| `function`      | `target.addEventListener(name, fn)`   |
| `string`        | `target.addEventListener(name, () => send(string))` |
| `[string, fn]`  | `target.addEventListener(name, e => send(string, fn(e)))` |

### Property Binding

```html
<!-- .value=${state.text} in template → -->
<input data-up-prop="value">
<!-- applyBindings → -->
<input>  (with input.value = state.text)
```

### Boolean Attribute Binding

```html
<!-- ?checked=${todo.done} in template → -->
<input data-up-bool="checked">
<!-- applyBindings → -->
<input checked> or <input>  (depending on value)
```

## DOM Utilities

### createDOM(htmlStr)
Creates a `DocumentFragment` from an HTML string.

### patchDOM(element, htmlStr)
Sets `element.innerHTML = htmlStr`.

### hydrate(root, components)
SSR hydration helper — finds elements with `data-up-component` markers and re-mounts components.
