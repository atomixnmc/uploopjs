# Server-Side Rendering — Full Evaluation

> Analyzing what Uploop needs for a React-comparable SSR ecosystem:
> HTML rendering, hydration, streaming, data fetching, routing,
> CSS, and client-server state sync.

## Browser API Dependency Audit

### Core Package — Browser APIs Used

| API | File | Purpose | Server Impact |
|---|---|---|---|
| `requestAnimationFrame` | `component-frame.js`, `frame.js` | Visual frame loop | Need `setImmediate` shim or sync mode |
| `requestIdleCallback` | `frame.js` | Idle frame scheduling | Need `setTimeout(fn, 0)` fallback |
| `element.setAttribute` | `component.js` | Mark mounted components (`data-up-component`) | Harmless — call on any object with string key |
| `element.removeAttribute` | `component.js` | Cleanup on unmount | Harmless |
| `element.innerHTML` | `component.js`, `execution.js` | DOM replacement + cleanup | **BLOCKER** — needs string target |
| `element.querySelector` | `component.js` | Canvas search | **BLOCKER** — needs adapter |
| `ownerDocument.activeElement` | `execution.js` | Focus save/restore | N/A on server (no focus) |
| `document.createTreeWalker` | `execution.js` (focus restore) | Walk DOM for focus element | N/A on server |

### HTML Package — Browser APIs Used

| API | File | Purpose | Server Impact |
|---|---|---|---|
| `document.createElement('template')` | `dom.js` | Parse HTML string to DOM | **BLOCKER** — don't need DOM on server |
| `template.innerHTML` | `dom.js` | Set template content | **BLOCKER** |
| `document.createTreeWalker` | `html.js`, `dom-execution.js` | Find comment markers | Only needed for patch strategy |
| `root.querySelectorAll` | `html.js` (applyBindings) | Find event/prop targets | Only needed for hydration |
| `element.addEventListener` | `html.js`, `events.js` | Attach event handlers | Only needed for hydration |
| `element.removeAttribute` | `html.js` | Clean up data-up markers | Only needed for hydration |
| `HTMLElement` | `element.js` | WebComponent base class | Already guarded: `typeof HTMLElement === 'undefined'` |
| `customElements.define` | `element.js` | Register WebComponent | Already guarded |
| `MutationObserver` | html `component.js` | Detect DOM changes | Only needed in browser |

### Key Finding

**Core is ~90% server-ready.** The only blockers are `innerHTML` / `querySelector`
in `component.js` and `execution.js` — both are execution-target concerns that
are designed to be swappable.

**HTML package is ~40% server-ready.** The `html()` tag and `processUploopAttributes`
work on strings. Everything else (applyBindings, createDOMExecution, element.js)
is browser-only by design — these are the *client hydration layer*.

---

## SSR Subsystem Evaluation

### 1. HTML Rendering (renderToString)

**Status: 20 lines to ship**

Uploop's component model is already pure. Views are `(state) → html\`...\``.
The `html()` tag returns `{ template, bindings, parts }` — structured output
with zero DOM dependency.

```js
// What's needed:
import { createFrame } from '@uploop/core'

function createStringExecution() {
  return {
    strategy: 'replace',
    render(template) { return String(template) },
    replace(target, output) { target._html = output },
    mount(target, output) { target._html = output; return () => {} },
    unmount(target) { target._html = '' },
    hooks: { preReplace: () => ({}), postReplace: () => {} }
  }
}

function renderToString(Component, props = {}) {
  const exec = createStringExecution()
  // Create component instance with string execution target
  const instance = Component.create(props)
  // Mount on a virtual target (plain object)
  const target = {}
  instance.mount(target)
  return target._html
}
```

**React equivalent:** `renderToString()` — 1 API, ~50 lines. Uploop needs the same.

**Edge cases handled:**
- Nested components: `html()` already inlines child component output via PascalCase resolution
- Array children: `html()` already handles `.map()` → joined strings
- Async components: Need `suspend()` awareness for streaming (see #3 below)

### 2. Hydration (client-side attachment to server HTML)

**Status: ~80 lines to ship**

This is the hardest part. The server sends HTML with `data-up-event`, `data-up-prop`,
`data-up-bool` markers already embedded. The client must:

1. **Skip initial render** — don't replace innerHTML, the DOM already exists
2. **Walk existing DOM** — find markers, attach listeners
3. **Connect loop to existing DOM** — subscribe to state changes, patch existing nodes

```js
function hydrate(Component, targetElement, props = {}, serverState = {}) {
  const exec = createDOMExecution() // or patch execution
  const instance = Component.create({ ...props, ...serverState })

  // Hydration mode: skip replace, just bind to existing DOM
  // The DOM already has data-up-event/data-up-prop markers from SSR
  const result = {
    template: targetElement.innerHTML,
    bindings: extractBindingsFromDOM(targetElement), // walk DOM for markers
    parts: [] // not needed — DOM is already rendered
  }

  // Apply event/prop bindings to existing DOM nodes
  applyBindings(targetElement, result.bindings, instance.loop.send, instance.loop.get())

  // Subscribe to future state changes (now use patch strategy)
  instance.loop.subscribe(() => {
    // On state change, re-render view and patch DOM
    const newView = Component.view(instance.loop.get(), { send: instance.loop.send })
    patchTemplate(targetElement, result, newView)
  })

  return instance
}
```

**What makes this easy:** Uploop's `data-up-event` markers are already embedded in
the template string. Server-rendered HTML already contains `data-up-event="click:b1"`.
The client just needs to `querySelectorAll('[data-up-event]')` and attach listeners.

**What makes this hard:** Ensuring the client's state matches what the server rendered.
If the server rendered with `{ count: 5 }` but the client initializes with `{ count: 0 }`,
the first re-render will produce different HTML than what's in the DOM. Need state
serialization (see #7).

**React equivalent:** `hydrateRoot()` — ~200 lines in React. Uploop needs ~80 lines
because the marker system already exists.

### 3. Streaming (renderToPipeableStream)

**Status: ~120 lines to ship**

React's streaming sends HTML chunks as data resolves. Uploop's `suspend()` metadata
already knows which data is pending. The streaming story:

```js
function renderToStream(Component, props = {}) {
  return new ReadableStream({
    async start(controller) {
      // 1. Render shell (static parts of template)
      const shell = renderShell(Component, props)
      controller.enqueue(shell.beforeSuspense)

      // 2. For each suspend() boundary, resolve data and stream content
      for (const boundary of shell.suspenseBoundaries) {
        try {
          const data = await boundary.resolve()
          const content = renderSuspenseContent(boundary.component, data)
          controller.enqueue(content)
        } catch (e) {
          controller.enqueue(boundary.fallback)
        }
      }

      // 3. Close with footer scripts (state serialization, client bundle)
      controller.enqueue(shell.afterSuspense)
      controller.close()
    }
  })
}
```

**What Uploop already has:**
- `suspend(dataKey, { loading, error, render })` — knows what's pending
- Template parts with IDs — can identify suspense boundaries
- Async metadata (`debounce`, `error`, `interruptible`) — works on server

**What's needed:**
- Template-level suspense boundary markers (`<!--up:suspense:b5-->`)
- `renderShell()` — render up to first suspense boundary, stop
- Stream writer that emits chunks as promises resolve

**React equivalent:** `renderToPipeableStream` — ~500 lines. Uploop needs ~120
because the suspense metadata already exists.

### 4. Data Fetching (Server Components equivalent)

**Status: Works today with patterns, needs ~60 lines of sugar**

React Server Components fetch data on the server. Uploop's equivalent is just
`createLoop()` with async update handlers:

```js
// This works TODAY on Node.js:
import { createLoop } from '@uploop/core'

const productLoop = createLoop({
  state: { products: [], loading: true },
  update: {
    load: {
      error: { retry: 2, fallback: { products: [] } },
      cache: { ttl: 60000, swr: true },
      run: async () => {
        const products = await db.query('SELECT * FROM products')
        return { products, loading: false }
      }
    }
  }
})

// On server, resolve data before rendering:
await productLoop.send('load')
// Now productLoop.get().products has data — pass to component view

function renderProductPage() {
  const state = productLoop.get()
  return ProductPage(state) // html`...` → string
}
```

**What Uploop already has:**
- Async update handlers (`run: async (state) → partialState`)
- `suspend()`, `error()`, `cache()` metadata
- `isPending()`, `getError()`, `getCached()` introspection
- Pure functions — no hooks, no component lifecycle to worry about

**What's needed:**
- `loadData(Component)` — collect all `suspend` data keys, resolve in parallel
- Per-route data loading convention
- `renderToStream()` integration (stream shell, resolve data, stream content)

**React equivalent:** RSC + `use()` hook — complex architecture. Uploop needs ~60
lines of sugar on top of what already exists.

### 5. Routing (Server-Side)

**Status: ~50 lines to ship**

`@uploop/router` is already pure JS. Route matching works on server. Need:

```js
import { createRouter } from '@uploop/router'

const router = createRouter({
  '': { view: HomePage },
  'products/:id': { view: ProductPage },
  '*': { view: NotFoundPage }
}, { useHash: false }) // server uses path-based routing

// Express/Fastify adapter:
app.get('*', async (req, res) => {
  const match = router.match(req.path)
  if (!match) return res.status(404).send('Not found')

  // Load route data
  const data = await loadRouteData(match)

  // Render to string
  const html = renderToString(match.view, { params: match.params, ...data })
  res.send(wrapInDocument(html))
})
```

**React equivalent:** Next.js App Router — huge framework. Uploop needs a thin
adapter because routing is already pure logic.

### 6. CSS (Server-Side Extraction)

**Status: ~40 lines to ship**

`@uploop/css` generates utility classes. For SSR:

```js
import { generateUtilities, theme, inject, getUsedClasses } from '@uploop/css'

// On server:
function renderPage(Component) {
  // Track CSS usage during render
  markUsed('p-4 m-2 text-center') // called by component views

  const html = renderToString(Component)

  // Extract critical CSS
  const usedClasses = getUsedClasses()
  const criticalCSS = `<style>${generateCriticalCSS(usedClasses)}</style>`

  return `<!DOCTYPE html>
<html>
<head>${criticalCSS}</head>
<body><div id="app">${html}</div></body>
</html>`
}
```

**What Uploop already has:**
- `getUsedClasses()` — tracks what classes were used during rendering
- `generateUtilities()` — generates CSS rules
- `theme()` / `extendTheme()` — design tokens work on server
- `colors()` utilities — pure functions

**What's needed:**
- `generateCriticalCSS(usedClasses)` — generate only the CSS for used classes
- Theme injection as `<style>` tag (currently uses DOM `inject()`)

### 7. Client-Server State Sync

**Status: ~30 lines to ship**

The server renders with initial state. The client must hydrate from that state:

```js
// Server: serialize state into HTML
function renderPage(Component, props) {
  const instance = Component.create(props)
  const state = instance.loop.get()
  const html = instance.render()

  return `<!DOCTYPE html>
<html>
<body>
  <div id="app">${html}</div>
  <script>
    window.__UPLOOP_STATE__ = ${JSON.stringify(state)}
  </script>
  <script type="module" src="/client.js"></script>
</body>
</html>`
}

// Client: hydrate from serialized state
import { hydrate } from '@uploop/html/hydrate'

const serverState = window.__UPLOOP_STATE__
hydrate(App, document.getElementById('app'), {}, serverState)
```

**What Uploop already has:**
- `graph.serialize()` / `graph.fromJSON()` — state serialization
- `createLoop({ state: initialState })` — accepts initial state
- `createGraph.fromJSON()` — reconstructs graph with data

**What's needed:**
- `hydrate()` function (see #2 above)
- `window.__UPLOOP_STATE__` convention
- JSON serialization of loop/graph state (already works via `serialize()`)

---

## Implementation Estimate

| Subsystem | Lines | Difficulty | Dependencies |
|---|---|---|---|
| `createStringExecution()` | ~20 | Trivial | None |
| `renderToString()` | ~30 | Trivial | String execution |
| `hydrate()` | ~80 | Medium | applyBindings, patchTemplate |
| `renderToStream()` | ~120 | Medium | suspend metadata, stream API |
| Data fetching sugar | ~60 | Easy | createLoop async handlers |
| Server router adapter | ~50 | Easy | @uploop/router |
| Critical CSS extraction | ~40 | Easy | @uploop/css optimizer |
| State serialization bridge | ~30 | Easy | graph.serialize() |
| **Total** | **~430 lines** | | |

All subsystems are independent — can ship incrementally.

### Comparison

| Framework | SSR Story | Code Size | Uploop Equivalent |
|---|---|---|---|
| React | `react-dom/server` | ~3,000 lines | ~430 lines |
| Solid | `solid-js/web` | ~1,500 lines | ~430 lines |
| Vue | `@vue/server-renderer` | ~2,000 lines | ~430 lines |

Uploop's smaller line count is because:
1. **Template structure is simple** — tagged template literals, not JSX/VNodes
2. **No VDOM reconciliation** — server renders strings, client patches from template parts
3. **Execution targets are swappable** — DOM target and string target share 90% of code
4. **Async metadata is declarative** — no hook ordering, no fiber scheduling, no suspense internals

### Recommended Ship Order

```
1. createStringExecution + renderToString     (~50 lines)  → SSR works
2. hydrate()                                  (~80 lines)  → full SSR+hydration
3. State serialization bridge                 (~30 lines)  → correct hydration
4. Server router adapter                      (~50 lines)  → multi-page SSR
5. Critical CSS extraction                    (~40 lines)  → production CSS
6. renderToStream()                           (~120 lines) → streaming SSR
7. Data fetching sugar                        (~60 lines)  → RSC-like patterns
```

### What Makes This Different From React

React's SSR complexity comes from:
- Fiber architecture (interruptible rendering)
- VDOM reconciliation (server VDOM ≠ client VDOM)
- Hook ordering (must call hooks in same order server and client)
- Selective hydration (only hydrate visible parts)

Uploop avoids all four:
- **No fiber** — synchronous event pipeline, `send()` → handler → merge → notify
- **No VDOM** — template strings on server, template parts for client diff
- **No hooks** — config objects, no call-order dependency
- **Selective hydration is natural** — `data-up-*` markers are already in the DOM, you can hydrate any subtree independently
