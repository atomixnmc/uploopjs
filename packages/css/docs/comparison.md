# @uploop/css vs Tailwind CSS

## Philosophy

| | @uploop/css | Tailwind CSS |
|---|---|---|
| **Paradigm** | Runtime CSS engine | Build-time CSS generator |
| **How it works** | Generates CSS classes via JS at runtime, injects into document | Scans source files at build time, outputs a static CSS file |
| **Build step** | None — pure ESM imports | Required — PostCSS plugin |
| **Output** | Injected into `<style>` or `CSSStyleSheet` | Static `.css` file |
| **Dead code elimination** | Runtime pruning via DOM observation | Build-time purging via content scanning |

## Theming

| | @uploop/css | Tailwind CSS |
|---|---|---|
| **Theme definition** | `theme()` / `extendTheme()` JS functions | `tailwind.config.js` or CSS variables |
| **Runtime switching** | `applyTheme(darkTheme)` — instant, no reload | CSS class toggling with `dark:` prefix |
| **CSS variables** | First-class (`--color-*`, `--spacing-*`, `--fontSize-*`) | Optional via `theme()` in config |
| **Theme inheritance** | `extendTheme(base, overrides)` — composable | `presets` or explicit override in config |
| **Scoped themes** | Apply to any DOM subtree via `applyTheme(t, el)` | CSS variables on a wrapper class |

## Dynamic Styles

| | @uploop/css | Tailwind CSS |
|---|---|---|
| **Programmatic styles** | `createNamedStyle()`, `createGradientStyle()`, `createEventStyle()` | Not available (static classes only) |
| **Chainable API** | `css().bg('primary').p(4).rounded('md').done()` | Not available |
| **Runtime class creation** | `createNamedStyle({background: userColor})` | Requires `style` attribute or inline CSS |
| **Pseudo-class styles** | `createEventStyle({event:'hover', transform:'scale(1.1)'})` | `hover:scale-110` (must be pre-defined) |

## Variants

| | @uploop/css | Tailwind CSS |
|---|---|---|
| **Pseudo-classes** | `hover`, `focus`, `focus-visible`, `active`, `disabled` | Same, plus `focus-within`, `visited`, `target`, etc. |
| **Responsive** | `sm`, `md`, `lg`, `xl`, `xl2`–`xl5` | `sm`, `md`, `lg`, `xl`, `2xl` |
| **Dark mode** | `dark` variant via `prefers-color-scheme` | `dark:` class or media strategy |
| **Custom variants** | `registerVariant('group-hover', fn)` | Plugin API |
| **Arbitrary variants** | Via `registerVariant()` | `[&:nth-child(3)]:` supported |

## Utility Classes

| | @uploop/css | Tailwind CSS |
|---|---|---|
| **Spacing** | `p-4`, `m-2`, `gap-3`, `rounded-2` | Same naming convention |
| **Colors** | `text-primary`, `bg-success`, `border-danger` | `text-red-500`, `bg-emerald-600` |
| **Display** | `d-flex`, `d-grid`, `d-none` | `flex`, `grid`, `hidden` |
| **Flex** | `flex-row`, `justify-between`, `items-center` | Same |
| **Grid** | `grid-cols-3` | Same, plus `col-span-*`, `row-span-*` |
| **Typography** | `text-center`, `font-bold`, `leading-4`, `tracking-w1` | Same naming |
| **Sizing** | `w-4`, `h-4`, `min-w-4`, `max-w-4` | Same, plus `vw`, `vh`, percentage |
| **Borders** | `border-solid`, `border-2` | Same |
| **Shadows** | `shadow-4` | `shadow-md`, `shadow-lg` (named tiers) |

## Size & Performance

| | @uploop/css | Tailwind CSS |
|---|---|---|
| **Core JS** | ~6KB (tree-shakeable) | N/A (no JS runtime) |
| **Generated CSS** | ~10KB (injected on demand) | ~15KB gzipped (purged), ~3MB unminified (full) |
| **Tree-shaking** | Runtime: `usedRules()` prunes unused classes | Build-time: content scanning removes unused |
| **Incremental** | Classes injected on first use (via optimizer) | Regenerated on file change |

## Platform Support

| | @uploop/css | Tailwind CSS |
|---|---|---|
| **Browser** | ✅ ESM import, CDN-ready | ✅ Static CSS file |
| **Shadow DOM** | ✅ `createAdoptedSheet()` | ❌ Not supported |
| **SSR / Node** | ✅ `utility()` generates rules without DOM | ✅ Outputs static CSS |
| **Web Components** | ✅ Adopted stylesheets | ❌ Requires workarounds |
| **React / Vue / Svelte** | ✅ Framework-agnostic | ✅ Plugin for each |

## When to use which

**Use @uploop/css when:**
- You're building Uploop components (native integration)
- You need runtime theme switching without reload
- You're building Web Components or Shadow DOM apps
- You want programmatic style creation (dynamic user colors, gradients)
- You prefer a JS-native API over a config file
- You want to avoid a build step entirely

**Use Tailwind CSS when:**
- You want the largest ecosystem (plugins, UI kits, templates)
- You need production CSS output with zero JS runtime
- Your team already knows Tailwind conventions
- You need IDE autocomplete for utility classes (Tailwind intellisense)
- You want arbitrary value support (`w-[327px]`, `top-[17%]`)
- You need the complete utility set (5000+ classes)
