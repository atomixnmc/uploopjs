# Component Props — Flexibility Without Confusion

> **Problem:** JSX passes any JS value as a prop. Uploop's template syntax is string-based, creating ambiguity: is `x="100"` the number 100 or the string "100"? Can I pass a function? An object? Where do props work?

---

## What Already Works (But Isn't Obvious)

### `componentTag()` — the `<Widget/>` syntax in `compose()`

The `\x00` placeholder system in `componentTag()` preserves raw JS values from template interpolations:

```js
compose: ({ html: h }) => [
  h`<Wheel x=${100} radius=${14} />`,           // numbers ✓
  h`<Wheel config=${{ color: 'red' }} />`,       // objects ✓
  h`<Wheel onSpin=${() => send('spun')} />`,     // functions ✓
]
```

This works because `componentTag()` inserts `\x00${i}\x00` placeholders and resolves them to `values[i]` — the raw JS value, not its string representation.

**The confusion:** The number auto-conversion on QUOTED attributes (`x="100"` → number 100) is a heuristic, not a rule. There's no way to pass the string "100" via a quoted attribute. The `\x00` (interpolated) path passes raw values, but that's invisible to the developer.

### `component.create(props)` — direct JS API

Components are callable functions. The JS API always works:

```js
// Always works — passes any JS value
Wheel({ x: 100, config: { color: 'red' }, onSpin: () => send('spun') })

// In compose():
compose: () => [
  Wheel({ x: 100, config: { color: 'red' } }),
  SUV({ x: 200, y: 50 })
]
```

No template syntax needed. No parsing. No ambiguity. This is the escape hatch for complex props.

### Props merge into child state

```js
component('Wheel', {
  state: { x: 0, y: 0, radius: 14 },
  // ...
})

// create() does: { ...initialState, ...props }
Wheel({ x: 100 })        // state becomes { x: 100, y: 0, radius: 14 }
Wheel({ x: 100, y: 200 }) // state becomes { x: 100, y: 200, radius: 14 }
```

Any key in props that matches a state key gets merged. Unknown keys are silently added to state (this could be a bug vector — see dev-mode warnings below).

---

## The Confusion Points

### 1. `compose()` has `<Widget/>` syntax; `view()` does not

```js
// ✅ Works in compose():
compose: ({ html: h }) => [h`<Wheel x=${100}/>`]

// ❌ Does NOT work in view() — componentTag is not available:
view: (state, ctx) => html`
  <div>
    <Wheel x=${100}/>   <!-- Renders as literal text "<Wheel x=100/>" -->
  </div>
`
```

In `view()`, the regular `html()` tag processes the template. It has no concept of component tags. `<Wheel/>` is treated as an unknown HTML element and rendered as-is.

**This is the #1 source of confusion.** Users expect `<Widget/>` to work everywhere, like JSX.

### 2. Number auto-conversion is a heuristic, not a contract

```
x="100"     → Number("100") = 100 → { x: 100 }       (number)
x="Alice"   → Number("Alice") = NaN → { x: "Alice" }  (string)
x="0"       → Number("0") = 0 → { x: 0 }              (number, falsy!)
x="true"    → Number("true") = NaN → { x: "true" }    (string, not boolean!)
```

There's no way to pass the string "100" via a quoted attribute (it becomes the number 100). There's no way to pass `true`/`false` as booleans via quoted attributes (they become strings "true"/"false").

### 3. No distinction between "callback props" and "data props"

```js
// These look similar but mean different things:
h`<Car x=${100} speed=${1.5} />`               // data props — merged into child state
h`<Car onCrash=${() => send('crashed')} />`     // callback prop — also merged into child state
```

A callback stored in state is unusual. It works technically (the child can call `state.onCrash()`), but it's not idiomatic. In React, callbacks are passed as separate event handlers (`onClick`), not stored in state.

---

## Proposed Solutions

### 1. `:props` binding — explicit object passing (both html and componentTag)

A dedicated binding that says "this is a JS object, pass it directly to the component, don't parse it":

```js
// componentTag (compose):
h`<Wheel :props=${{ x: 100, y: 200, config: { color: 'red' }, onSpin: callback }}/>`

// html tag (view):
html`<div>
  ${ChildComponent({ x: 100, y: 200 })}        <!-- JS API, always works -->
</div>`
```

For `componentTag`: detect `:props=` as a special attribute. The value bypasses the regex parser and is passed directly to `create()`:

```js
// In componentTag(), add after existing attr parsing:
const propsMatch = raw.match(/:props\s*=\s*\x00(\d+)\x00/)
if (propsMatch) {
  const idx = parseInt(propsMatch[1])
  const propsObj = idx < values.length ? values[idx] : {}
  return Cls(propsObj)  // pass directly, no parsing
}
```

### 2. Allow `componentTag` in regular `view()` templates

Make `html()` detect `<PascalCase .../>` tags and route them to `componentTag()` for resolution. This makes the `<Widget/>` syntax work in both `compose()` and `view()`:

```js
// view() — proposed:
view: (state) => html`
  <div>
    <Wheel x=${state.wheelX} radius=${state.size} />
    <button @click="inc">+</button>
  </div>
`
```

**How it works:** In `html()`, after the existing `@event`, `.prop`, `?bool` detection, check if an element tag starts with an uppercase letter. If so, resolve it against a component registry (the `classes` map, already available) and replace the element with the component's rendered output.

**Registration:** Components register themselves so `html()` can find them:

```js
// Option A: import-time registration
import { registerComponent } from '@uploop/html'
registerComponent('Wheel', Wheel)

// Option B: pass to component() config
component('App', {
  components: { Wheel, Car, Sky },  // available in view() templates
  view: (state) => html`<Wheel x=${100}/>`
})
```

**Implementation (~40 lines):** In `html()`, after string concatenation but before returning the template, scan for `<[A-Z]\w*` patterns. Resolve against registered components. Replace with the component's rendered string. Collect nested bindings.

### 3. Prop type conventions and dev-mode warnings

Add convention and validation:

```js
// Convention: @ prefix for callbacks, no prefix for data
h`<Car x=${100} speed=${1.5} @onCrash=${handleCrash} />`
// x, speed → merged into child state (data props)
// @onCrash → reserved as callback (not merged into state)
```

**Dev-mode warnings:**

| Scenario | Warning |
|---|---|
| Unknown prop key (not in child's state) | `[Uploop] Wheel: unknown prop "colorr" (did you mean "color"?)` |
| Callback stored in state | `[Uploop] Car: prop "onCrash" is a function — did you mean @onCrash?` |
| Number-like string in quoted attr | `[Uploop] Wheel: "100" auto-converted to number 100. Use $\{100} for explicit number.` |
| Boolean-like string | `[Uploop] "true" is a string, not boolean. Use $\{true} or bare attribute "disabled".` |

### 4. `create()` as the always-correct JS path

Document the JS API as the canonical way to pass complex props:

```js
// When in doubt, use the JS API:
compose: () => [
  h`<Sky w=${700} h=${300} />`,            // simple, template syntax is fine
  Wheel({ x: 100, color: '#e74c3c' }),     // complex, JS API is clearer
  Car({                                    // very complex, JS API mandatory
    x: 200, y: 150, speed: 1.5,
    config: { doors: 4, engine: 'v8' },
    onCrash: (damage) => send('crashed', damage)
  })
]
```

The template syntax (`<Widget/>`) is sugar for simple cases. The JS API is the escape hatch for complex cases. This is the same model as: template literals for simple HTML, `component.create()` for complex composition.

---

## Summary: What Changes

| Change | Where | Lines | Impact |
|---|---|---|---|
| `:props` binding in componentTag | `html.js` → `componentTag()` | ~15 | Explicit object passing, no parsing |
| Allow `<Widget/>` in view() | `html.js` → `html()` | ~40 | Unified component syntax everywhere |
| Dev-mode prop warnings | `html.js` → new `validateProps()` | ~30 | Catches typos, type mismatches |
| `@callback` convention docs | `HOWTO.md` | 0 | Clear mental model |

**Total: ~85 lines. No breaking changes. All existing code works unchanged.**

---

## Anti-Patterns (What NOT to do)

| Don't | Because |
|---|---|
| Add TypeScript prop types now | v2.0.0 concern. JSDoc is sufficient for dev-mode warnings. |
| Add prop validation schema (like PropTypes) | Over-engineered. Dev-mode heuristics catch 80% of bugs. |
| Make every component auto-register globally | Name collisions. Explicit `components: {}` or `registerComponent()` is safer. |
| Add JSX-style spread props `<Widget ...${props}/>` | Template literals don't support spread natively. Use `:props=${obj}` instead. |
