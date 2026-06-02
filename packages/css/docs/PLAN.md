# @uploop/css — Implementation Plan

## Status: v0.1.0 → v0.2.0

Currently a single-file monolithic port from the archived `uploop.cssUtil.js`.
Needs modularization, design token system, variant engine, and tree-shaking
to become a real Tailwind-alternative utility CSS engine.

---

## Current State

Single file: `src/index.js` (~190 lines). 7 exports.

| Export | Purpose | Completeness |
|---|---|---|
| `breakpoints` | 8 viewport constants | Rudimentary |
| `spacing` | 0–12 rem + quarter steps | OK |
| `spacingTiny` | Tiny spacing scale | Niche |
| `colors` | 24 named hex colors | Flat — no shades, no CSS vars |
| `inject(config)` | Global utility class generation | All-at-once, no tree-shaking |
| `createAdoptedSheet()` | Shadow DOM utilities | Useful but duplicates logic |
| `createNamedStyle()` / `createGradientStyle()` / `createEventStyle()` | Dynamic one-off classes | Good jQuery-inspired API |

## Gap Analysis

### Critical

- **No modular structure** — single file vs. planned 5 files
- **No tree-shaking / on-demand generation** — all utilities injected upfront
- **No responsive variants** — `breakpoints` exist but never used
- **No pseudo-class variants** — no `hover:`, `focus:`, `active:`, `dark:`
- **No CSS variable strategy** — colors are hardcoded hex, no `--color-*` vars
- **No `theme()` API** — can't define, extend, or switch themes
- **No `utility()` / `variant()` / `generate()` API** — no composable programmatic API
- **No tests** — zero coverage
- **No graph integration** — Style Protocol not implemented
- **No dark mode** — claimed in readme, not present
- **No class conflict resolution** — dupes swallowed via try/catch
- **No arbitrary values** — only predefined keys, no `w-[327px]`

### Missing Utilities (removed from archived version)

Typography: `text-transform`, `text-decoration`, `text-indent`, `text-shadow`,
`text-overflow`, `text-wrap`, `word-break`, `word-spacing`, `word-wrap`, `hyphens`

Font: `font-size` (rem-based), `font-family`, `font-style`, `font-variant`,
`font-variant-numeric`, `font-variant-position`, `letter-spacing`

Line: `line-height`, `line-style`
Background: `bg-position`, `bg-size`, `bg-repeat`, `bg-attachment`, `bg-blend`
Border: `border-style`
Flex: `flex-wrap`, `align-items` (full), `align-content`, `align-self`
List: `list-style-type`, `list-style-position`
Positioning: `top/right/bottom/left` shorthands
Sizing: `resize`
Other: `float`, `content`, relative scales, percentage scales, px spacing

### Integration Gap

- No component-scoped styles — all utilities are global
- Examples use inline `style=""` instead of CSS utility classes
- No chain-style API (`css.bg('primary').p(4).rounded('md')`)

---

## Target Architecture

```
packages/css/src/
  index.js          barrel re-export
  tokens.js         spacing, colors, breakpoints, typography scales
  theme.js          theme(), extendTheme(), CSS variable generation
  utility.js        utility(), generateUtilities(), utility registry
  variant.js        variant(), hover/focus/dark/responsive variant engine
  inject.js         inject(), createAdoptedSheet(), sheet management
  dynamic.js        createNamedStyle(), createGradientStyle(), createEventStyle()
  chain.js          css() chainable style builder (jQuery-inspired)

packages/css/test/
  theme.test.js
  utility.test.js
  variant.test.js
  inject.test.js
  dynamic.test.js
```

---

## Phased Plan

### Phase 1 — Modularize ✅
Split `index.js` into 7 modules. Each < 150 lines. Independently testable.
Barrel re-export preserves backward compatibility.

### Phase 2 — Design Token System + CSS Variables
- `theme()` — define theme with colors, spacing, typography tokens
- `extendTheme()` — compose themes
- `applyTheme()` — set CSS custom properties on `:root`
- Generate `--color-*`, `--spacing-*`, `--font-*` CSS variables
- Support light/dark theme objects

### Phase 3 — Variant Engine
- Pseudo-class variants: `hover`, `focus`, `active`, `focus-visible`, `disabled`
- Responsive variants: `sm`, `md`, `lg`, `xl`, `xl2`
- Dark mode variant: `dark`
- `variant(baseUtility, variants)` — compose any combination
- `registerVariant(name, generator)` — extensible

### Phase 4 — On-Demand Generation
- Lazy injection mode — inject CSS vars upfront, utilities on first use
- Class registry — track what's been injected to avoid dupes
- (Future) Build-time scanning for tree-shaking

### Phase 5 — Re-add Missing Utilities
- Port removed utility categories from archived version
- Prioritize: font-size, line-height, text-transform, letter-spacing,
  flex-wrap, align-items, border-style, bg-*, list-style
- Consolidate naming conventions

### Phase 6 — Chain-Style API
```js
const btn = css().bg('primary').text('white').px(4).py(2).rounded('md')
// → injects className string or returns { className, css }
```

### Phase 7 — Graph Integration
- Implement Style Protocol from Architecture doc
- Style nodes with `tokens` array and `dependsOn` theme references
- Re-inject CSS when theme dependencies change

### Phase 8 — Tests
- Unit tests for all modules
- Integration test for inject → DOM → rendered styles
- Variant combination matrix tests

### Phase 9 — Example Migration
- Replace inline `style=""` in Counter, Todo, Form, etc. with utility classes
- Add CSS-util demo tab showing theme switching, variants in action

---

## Priority Execution

| # | Task | Effort | Impact |
|---|---|---|---|
| 1 | Modularize into 7+ files | 1d | Foundation |
| 2 | Design tokens + CSS variables | 1d | Unblocks theming |
| 3 | Variant engine | 1.5d | Tailwind parity |
| 4 | On-demand generation (lazy) | 1d | Production ready |
| 5 | Re-add missing utilities | 0.5d | Feature parity |
| 6 | Tests | 1d | Release confidence |
| 7 | Chain-style API | 0.5d | DX differentiator |
| 8 | Graph integration | 1d | Architecture |
| 9 | Example migration | 0.5d | Dogfooding |

Total: ~8 days to v0.2.0.
