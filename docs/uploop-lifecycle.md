# Uploop Component Lifecycle

## Two Dispatch Modes

The callable descriptor (`Component(props, ...children)`) routes based on arguments:

| Call | Children? | Route | Returns |
|------|-----------|-------|---------|
| `GridSearch({ query: 'h' })` | No | `renderTemplate(props)` | html template object (for embedding in `html\`...\``) |
| `Car({ x: 50 }, Wheel(), Door())` | Yes | `create(props, ...children)` | component instance with `loop`, `render`, `children` |

## Standard Lifecycle (DOM Components)

```
Component.create(props)
  → loop created
  → view(state, { send, html }) → html template
  → instance returned { loop, render, mount, children }

mount(el)
  → renderView() → html template
  → element.innerHTML = htmlStr
  → applyBindings(element, bindings, loop.send, loop.get())
  → mountHook(el, ctx) if defined
  → subscribe to loop → on state change: re-render
  → return unmount function

unmount()
  → unsubscribe loop
  → unmountHook(el, ctx) if defined
  → element.innerHTML = ''
```

## Canvas/Drawable Lifecycle

```
Drawable(props, child1, child2)
  → calls create(props, ...children)
  → loop created, lifecycle methods attached (render, etc.)
  → instance returned { loop, render, children, ... }

Parent rAF loop:
  → child.render(ctx, childState, child.children, elapsed)
  → iterates child's children recursively
```

## createComponentType

Defines reusable component archetypes with pre-configured hooks.

### Config

| Field | Value | Purpose |
|-------|-------|---------|
| `state` | `{ x: 0, y: 0 }` | Base state merged with instance state |
| `update` | `{ inc: (s) => ({...}) }` | Base update handlers |
| `mount` | `(el, ctx) => {}` | Base mount hook (chained with instance mount) |
| `unmount` | `(el, ctx) => {}` | Base unmount hook |
| `cycleMethods.composition` | `'create'` | Route children to `create()` (canvas/Drawable) or `'createHtml'` (DOM) |
| `cycleMethods.afterFrame` | `['render', 'refresh']` | Methods to call after each frame |

### Custom Methods (render, draw, etc.)

Any function field not matching the standard hooks (state, update, effect, mount, unmount, view, name) is automatically stored on instances via `lifecycleMethods`.

```js
const Wheel = Drawable({
  name: 'Wheel',
  state: { radius: 14 },
  render: (ctx, state, children, elapsed) => { /* ... */ }
})

const inst = Wheel({ x: 20 })
inst.render(ctx, inst.loop.get(), inst.children, 100)  // ✅
```

## Composition Patterns

### Pattern A: Literal Composition (Canvas/Drawable)

```js
// Create parent with children via natural function call
const car = Car({ x: 50, y: 100 },
  Wheel({ x: 70, y: 138 }),
  Wheel({ x: 140, y: 138 }),
  Door({ x: 58, y: 104 }),
  Door({ x: 126, y: 104 })
)

// Parent's render() iterates children
car.render(ctx, car.loop.get(), car.children, elapsed)
```

### Pattern B: HTML Template (DOM)

```js
// Component as inline function call in html\`...\` template
html`${GridSearch({ query: state.search, onSearch: (q) => send('search', q) })}`

// Component as WebComponent tag
html`${GridItem.tag({ title: item.title, content: item.content })}`
```

### Pattern C: Mounted Child (DOM with own re-render cycle)

```js
// In parent's mount hook:
const child = CityInput.create({ onSelect: (city) => send('input', 'city', city) })
child.mount(el.querySelector('#city-input-root'))

// Re-mount after parent re-render:
parent.loop.subscribe(() => requestAnimationFrame(() => mountChild()))
```

## Resource Persistence

Resources declared via `registerResource()` survive `innerHTML` replacement:

```js
ctx.registerResource('canvas', {
  save: () => canvas.toDataURL(),
  restore: (dataUrl) => { /* recreate canvas, draw saved pixels */ }
})
```

Before `innerHTML`: `saveResources()` calls all registered `save()` handlers.
After `innerHTML` + bindings: `restoreResources()` calls all `restore()` handlers.
