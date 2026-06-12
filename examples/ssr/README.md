# Uploop SSR Example

Minimal server-side rendering example using `@uploop/sst`.

## Run

```bash
node examples/ssr/server.js
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## What It Shows

- A `Counter` component defined once, rendered on the server via `renderToString()`
- HTML is delivered to the client with the component's initial state already rendered
- In production, the client would call `hydrate()` to attach event listeners and make the component interactive

## Files

| File | Purpose |
|---|---|
| `server.js` | Node.js HTTP server that renders a Counter component to HTML |
| `README.md` | This file |

## How SSR Works in Uploop

1. **Component definition** — same `component()` API used on client and server
2. **Server render** — `renderToString(Counter, { count: 0 })` calls the view function with server state and returns an HTML string
3. **Client delivery** — HTML is sent in the HTTP response
4. **Hydration** — client calls `hydrate(Counter, target, {}, serverState)` to attach events and make the component live

No separate "server component" model needed — the same component works everywhere.
