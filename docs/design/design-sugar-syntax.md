# Uploop Sugar Syntax — Template Binding Reference

> What's supported in `html\`...\`` templates.

---

## 1. Event Bindings — `@event=${handler}`

```js
html`<button @click=${() => send('inc')}>+</button>`
html`<input @input=${(e) => setName(e.target.value)} />`
html`<form @submit=${handleSubmit}>...</form>`
```

Expands to `data-up-event="click:b{N}"` attribute. Framework auto-binds handler.

| Prefix | Expansion | Example |
|--------|-----------|---------|
| `@click` | `data-up-event="click:id"` | `@click=${fn}` |
| `@input` | `data-up-event="input:id"` | `@input=${fn}` |
| `@submit` | `data-up-event="submit:id"` | `@submit=${fn}` |

---

## 2. Attribute Bindings — `:attr=${value}`

```js
html`<button :disabled=${isLoading}>Save</button>`
html`<div :class=${theme}>...</div>`
html`<a :href=${url}>Link</a>`
html`<input :value=${name} @input=${(e) => setName(e.target.value)} />`
```

Expands to `data-up-attr="attrname:id"` attribute.

---

## 3. Property Bindings — `.prop=${value}`

```js
html`<input .value=${name} />`
html`<video .currentTime=${seekPos} />`
```

Expands to `data-up-prop="propname:id"` attribute. Direct DOM property set.

---

## 4. Boolean Attributes — `?attr=${bool}`

```js
html`<input ?disabled=${isLocked} />`
html`<details ?open=${isExpanded}>...</details>`
```

Expands to `data-up-bool="attr:id"`. Toggles presence/absence of boolean attribute.

---

## 5. Dynamic Components — `<${Component} />`

```js
import { Card, Button } from './components.js'

const items = ['a', 'b', 'c']
html`
  <div>
    <${Card} title="Hello" />
    ${items.map(item => html`<${Button} label=${item} />`)}
  </div>
`
```

Detects `${ComponentReference}` followed by `/>` or `>`. Calls `component.create(props)` or `component(props)` and renders inline. Components must be registered via `component()`.

**Requirements:**
- Component must be an Uploop component (created via `component()`)
- Component reference must be in scope (local variable or import)
- Self-closing: `<${Comp} />` or open/close: `<${Comp}>...</${Comp}>`

---

## 6. Static PascalCase Components — `<ComponentName attr=${val} />`

```js
html`<UserCard name="John" email=${email} />`
```

Resolved at template compile time via `resolvePascalTags`. Component must be in the registry (created via `component()` before the template runs).

---

## Quick Reference

| Syntax | Type | Example |
|--------|------|---------|
| `@event=${fn}` | Event handler | `@click=${() => send('inc')}` |
| `:attr=${val}` | DOM attribute | `:disabled=${loading}`, `:class=${theme}` |
| `.prop=${val}` | DOM property | `.value=${name}` |
| `?attr=${bool}` | Boolean toggler | `?open=${expanded}` |
| `<${Comp} />` | Dynamic component | `<${Card} title="Hi" />` |
| `<CompName />` | Static component | `<UserCard name="John" />` |
| `${val}` | Text interpolation | `${count}` |
| `html\`...\`` | Nested template | `items.map(i => html\`<li>${i}</li>\`)` |

## Notes

- No JSX needed. No build step. Pure ESM tagged template literals.
- Backticks in template strings must be escaped: `\``
- HTML comments `<!-- ... -->` are properly skipped during parsing
- Dynamic components require `_isComponent` flag or `create()` method. Old-style function components are detected via `typeof value === 'function'` with fallback to `value(props)`.
