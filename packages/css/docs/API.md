# @uploop/css — API Reference

## Overview

`@uploop/css` is a utility-first CSS engine for the Uploop framework.
It generates Tailwind-style utility classes at runtime with zero build step,
supports dynamic theme switching via CSS custom properties, and provides
a jQuery-inspired chainable API for scoped styles.

```js
import { theme, inject, css, applyTheme } from "@uploop/css"
```

---

## Modules

| Module | Purpose |
|---|---|
| `tokens.js` | Design tokens (spacing, colors, breakpoints, typography) |
| `theme.js` | Theme creation, extension, and application |
| `utility.js` | Utility class definitions and generation |
| `variant.js` | Pseudo-class, responsive, and dark mode variants |
| `inject.js` | CSS injection into DOM and Shadow DOM |
| `dynamic.js` | Dynamic style creation (jQuery-inspired) |
| `chain.js` | Chainable style builder |
| `optimizer.js` | Runtime class tracking and rule pruning |

---

## Theme System

### `theme(config?)`

Create a theme object from token overrides.

```js
const myTheme = theme({
  name: "brand",
  mode: "light",
  colors: { primary: "#4f46e5", secondary: "#7c3aed" },
  spacing: { 4: 8 }, // override spacing scale
})
```

Returns a `Theme` object with:
- `.name` — theme identifier
- `.mode` — `"light"` or `"dark"`
- `.colors` / `.spacing` / `.fontSize` — merged token maps
- `.cssVars` — flat `--color-*`, `--spacing-*`, `--fontSize-*` map
- `.cssVarsString` — inline style string

### `extendTheme(base, overrides?)`

Create a new theme inheriting from an existing one.

```js
const darkBrand = extendTheme(darkTheme, {
  name: "dark-brand",
  colors: { primary: "#818cf8" },
})
```

### `applyTheme(theme, root?)`

Apply a theme by setting CSS custom properties on a DOM element.
Defaults to `document.documentElement` (`:root`).

```js
applyTheme(darkTheme) // sets --color-primary, --spacing-4, etc. on :root
applyTheme(myTheme, document.getElementById("widget"))
```

Sets `data-theme` and `data-color-scheme` attributes.

### Pre-built

```js
import { lightTheme, darkTheme } from "@uploop/css"
```

---

## Utility Classes

### `utility(opts?)`

Generate utility rules from selected groups.

```js
const rules = utility({ groups: ["spacing", "colors"] })
// → [{ selector: ".m-4", css: "margin: 4rem" }, ...]
```

**Available groups**: `spacing`, `colors`, `display`, `flex`, `grid`, `sizing`,
`typography`, `borders`, `shadows`, `position`, `overflow`, `cursor`, `background`

### `utilityDefs`

Registry of utility group factories. Extend with custom utilities:

```js
utilityDefs.myUtils = (tokens) => [
  { selector: ".my-class", css: "display: block" },
]
```

### `generateUtilities(tokens?)`

Alias for `utility()` — generate all utilities.

---

## CSS Injection

### `inject(config?)`

Inject utility CSS into the global stylesheet.

```js
const result = inject()
// → { sheet: CSSStyleSheet, count: 1547 }

// Only specific groups:
inject({ groups: ["spacing", "colors", "display"] })

// Custom tokens:
inject({ spacing: { 0: 0, 4: 2 }, colors: { brand: "#f00" } })
```

### `createAdoptedSheet(config?)`

Create a `CSSStyleSheet` for Shadow DOM adoption.

```js
const sheet = createAdoptedSheet({ groups: ["spacing", "typography"] })
shadowRoot.adoptedStyleSheets = [sheet]
```

### `getSheet()` / `removeSheet()`

Manage the global Uploop stylesheet.

---

## Variant Engine

### `variant(opts)`

Generate variants for utility rules.

```js
// Generate hover variants for color utilities
const rules = variant({ apply: ["hover", "focus"], groups: ["colors"] })
```

**Built-in variants**: `hover`, `focus`, `focus-visible`, `active`, `disabled`,
`dark`, `sm`, `md`, `lg`, `xl`, `xl2`, `xl3`, `xl4`, `xl5`

### `registerVariant(name, fn)`

Register a custom variant generator.

```js
registerVariant("group-hover", (sel, css) =>
  `.group:hover ${sel} { ${css} }`
)
```

### `hasVariant(name)` / `variantNames()`

Query the variant registry.

---

## Dynamic & Scoped Styles

### `createNamedStyle(styleObj, sheet?)`

Create a single CSS class from a plain JS object.

```js
const { className } = createNamedStyle({
  color: "red",
  fontSize: "1.5rem",
  fontWeight: "bold",
})
// className: "up-style-42"
// CSS: .up-style-42 { color: red; font-size: 1.5rem; font-weight: bold; }
```

### `createGradientStyle(config, sheet?)`

Create a linear-gradient CSS class.

```js
const { className } = createGradientStyle({
  colors: ["#4f46e5", "#7c3aed"],
  dir: "135deg",
})
```

### `createEventStyle(config, sheet?)`

Create a pseudo-class CSS rule.

```js
const { className } = createEventStyle({
  event: "hover",
  transform: "translateY(-2px)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
})
// CSS: .up-ev-7:hover { transform: translateY(-2px); box-shadow: ...; }
```

---

## Chainable Style Builder

### `css(sheet?)`

Fluent API for building scoped styles — inspired by jQuery.

```js
const btn = css()
  .prop("background", "var(--color-primary)")
  .prop("color", "white")
  .prop("padding", "0.5rem 1rem")
  .prop("border-radius", "8px")
  .done()

// btn.className → "up-css-1"
// btn.css → "background: var(--color-primary); color: white; ..."
```

`css()` returns a `ChainBuilder` with:
- `.prop(name, value)` — set any CSS property
- `.done()` — inject class and return `{ className, css }`
- `.toString()` — returns className (auto-injects)

---

## Runtime Optimizer

### `markUsed(classes)`

Mark class names as "used" for pruning.

```js
markUsed("bg-primary text-white p-4 rounded-2")
markUsed(["d-flex", "gap-4"])
```

### `watchDOM(root?)` / `unwatchDOM()`

Start/stop a `MutationObserver` that automatically tracks class usage.

```js
watchDOM() // start watching document.body
```

### `usedRules(opts?)`

Generate only rules for classes that have been marked as used.

```js
const pruned = usedRules()
// → only rules matching classes seen in DOM
```

### `stats(opts?)`

Get savings statistics.

```js
const s = stats()
// → { used: 48, total: 1547, savings: "97% (1499 rules pruned)" }
```

### `getUsedClasses()` / `resetUsed()` / `hasTracking()`

Query and reset the class usage registry.

---

## Design Tokens (data only, tree-shakeable)

```js
import {
  breakpoints,  // { z:0, sm:576, md:768, lg:992, xl:1200, ... }
  spacing,      // { 0:0, 0_25:0.25, 0_5:0.5, ..., 12_75:12.75 }
  colors,       // { primary:"#646cff", secondary:"#6c757d", ... }
  fontSize,     // { 0:0, 1:1, ..., 12_75:12.75 } (rem)
  fontWeight,   // { thin:100, ..., black:900 }
  spacingTiny,  // { t2:-0.05, ..., w3:0.1 }
  relativeScales, // { none:0, xs:0.75, ..., xl6:6 }
  percentageScales, // { pc0:0, ..., pc99:99 }
} from "@uploop/css"
```

---

## Utility Class Reference

### Spacing
| Class | CSS |
|---|---|
| `m-{key}` | `margin: {val}rem` |
| `mt-{key}`, `mr-{key}`, `mb-{key}`, `ml-{key}` | margin-top/right/bottom/left |
| `mx-{key}`, `my-{key}` | margin-left+right / top+bottom |
| `p-{key}`, `pt-{key}`, ... | padding (same pattern) |
| `gap-{key}` | `gap: {val}rem` |
| `rounded-{key}` | `border-radius: {val}rem` |

### Colors
| Class | CSS |
|---|---|
| `text-{name}` | `color: {hex}` |
| `bg-{name}` | `background-color: {hex}` |
| `border-{name}` | `border-color: {hex}` |

### Display
`d-block`, `d-inline-block`, `d-inline`, `d-flex`, `d-grid`, `d-none`, `d-contents`

### Flex
`flex-row`, `flex-column`, `flex-row-reverse`, `flex-column-reverse`, `flex-wrap-wrap`, `flex-wrap-nowrap`, `flex-wrap-wrap-reverse`
`justify-start`, `justify-end`, `justify-center`, `justify-between`, `justify-around`, `justify-evenly`
`items-start`, `items-end`, `items-center`, `items-between`, `items-around`, `items-evenly`

### Grid
`grid-cols-{1..12}` → `grid-template-columns: repeat(n, 1fr)`

### Sizing
`w-{key}`, `h-{key}`, `min-w-{key}`, `min-h-{key}`, `max-w-{key}`, `max-h-{key}`

### Typography
`text-left`, `text-center`, `text-right`, `text-justify`
`text-uppercase`, `text-lowercase`, `text-capitalize`, `text-none`
`font-thin`..`font-black` (100..900), `font-sans`, `font-serif`, `font-mono`
`text-{key}` → `font-size: {val}rem`
`leading-{key}` → `line-height: {val}rem`
`tracking-{key}` → `letter-spacing: {val}rem`

### Borders
`border-solid`, `border-dashed`, `border-dotted`, `border-double`, `border-none`
`border-{key}` → `border-width: {val}rem`

### Shadows
`shadow-{key}` → `box-shadow: 0 {val*0.25}rem {val*0.5}rem rgba(0,0,0,0.15)`

### Position
`pos-static`, `pos-relative`, `pos-absolute`, `pos-fixed`, `pos-sticky`

### Overflow
`overflow-hidden`, `overflow-auto`, `overflow-scroll`, `overflow-visible`

### Cursor
`cursor-pointer`, `cursor-grab`, `cursor-move`, `cursor-not-allowed`, `cursor-wait`, `cursor-help`

### Background
`bg-pos-left`, `bg-pos-center`, `bg-pos-right`
`bg-size-auto`, `bg-size-cover`, `bg-size-contain`
`bg-repeat-no-repeat`, `bg-repeat-repeat`, `bg-repeat-repeat-x`, `bg-repeat-repeat-y`

---

## Quick Recipes

### Theme switch
```js
import { darkTheme, lightTheme, applyTheme } from "@uploop/css"

function toggleDark() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark"
  applyTheme(isDark ? lightTheme : darkTheme)
}
```

### Scoped component style
```js
import { createNamedStyle } from "@uploop/css"

const headerStyle = createNamedStyle({
  padding: "1rem 1.5rem",
  borderBottom: "1px solid #eee",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
})

// In component: <header class="${headerStyle.className}">...</header>
```

### Hook-style with chain API
```js
import { css, createEventStyle } from "@uploop/css"

const btn = css().bg("var(--color-primary)").prop("color", "white")
  .prop("padding", "0.5rem 1.5rem").prop("border-radius", "8px")
  .prop("border", "none").prop("cursor", "pointer").done()

const hover = createEventStyle({
  event: "hover",
  opacity: "0.9",
  transform: "translateY(-1px)",
})

// <button class="${btn.className} ${hover.className}">Click</button>
```
