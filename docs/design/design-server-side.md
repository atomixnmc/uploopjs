# @uploop/sst — Server-Side Toolset Design

> v0.5.0 — SSR, hydration, remote loops, and services

## Overview

@uploop/sst brings Uploop's reactive update-loop model to the server. It provides
server-side rendering (SSR) with automatic client-side hydration, a service layer
for CRUD + real-time events, and a foundation for remote loop communication.

The key insight: Uploop components are already pure — views are `(state) → html`
functions, execution targets are swappable, and `html()` returns structured output.
SSR is just swapping the execution target from DOM to string.

### What's Included

| Export | Purpose |
|---|---|
| `renderToString(Comp, props)` | Render a component to an HTML string on the server |
| `renderToHtml(Comp, props)` | Full SSR pipeline: create → set state → render → HTML |
| `hydrate(Comp, target, props, state)` | Reattach events to server-rendered HTML on the client |
| `createHydrationRoot(serverState)` | Manage multi-component hydration from server state |
| `createService(loop, config)` | Wrap a loop with CRUD methods + real-time events |
| `createServiceApp()` | Manage multiple named services |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        @uploop/sst                               │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │   SSR Layer      │  │  Hydration Layer  │  │ Service Layer  │  │
│  │                  │  │                   │  │                │  │
│  │ renderToString() │  │   hydrate()       │  │ createService()│  │
│  │ renderToHtml()   │  │   createHydration │  │ createService  │  │
│  │                  │  │   Root()          │  │ App()          │  │
│  └────────┬─────────┘  └────────┬──────────┘  └───────┬────────┘  │
│           │                     │                      │          │
│           └─────────────────────┼──────────────────────┘          │
│                                 │                                  │
│                    ┌────────────┴────────────┐                    │
│                    │     @uploop/core        │                    │
│                    │  component / createLoop │                    │
│                    │  createStringExecution  │                    │
│                    │  createDOMExecution     │                    │
│                    └────────────┬────────────┘                    │
│                                 │                                  │
│                    ┌────────────┴────────────┐                    │
│                    │     @uploop/html        │                    │
│                    │  html`` / applyBindings │                    │
│                    │  createDOM              │                    │
│                    └─────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: SSR → Hydration

```
  Server                          Network              Client
  ──────                          ───────              ──────

  renderToString(Counter) ──► <div>Count: 0</div> ──► innerHTML
       │                         (HTML string)              │
       │                                              hydrate(Counter, el)
       │                                                    │
       │                                         ┌──────────┴──────────┐
       │                                         │  loop = createLoop   │
       │                                         │  mount(el, {count:0})│
       │                                         │  attach events       │
       │                                         └─────────────────────┘
```

## API Reference

### renderToString(Comp, props)

Renders a component to an HTML string. Purely synchronous — no DOM required.

```js
const Counter = component('Counter', {
  state: { count: 0 },
  view: (s) => html`<div>Count: ${s.count}</div>`
})

const html = renderToString(Counter, { count: 5 })
// → '<div>Count: 5</div>'
```

Event bindings and prop markers are preserved in the HTML as `data-up-event`
and `data-up-prop` attributes, ready for client-side hydration:

```js
const Form = component('Form', {
  state: { text: '' },
  view: (s, { send }) => html`<input .value=${s.text} @input=${() => send('input')} />`
})

const html = renderToString(Form, { text: 'hello' })
// → '<input data-up-prop="value" data-up-event="input:0">'
```

### hydrate(Comp, target, props, serverState)

Reattaches event listeners and state to server-rendered HTML. Creates a new loop
instance with the server state, then mounts the component onto the existing DOM.

```js
const target = document.getElementById('app')
const inst = hydrate(Counter, target, {}, { count: 0 })

// Component is now live — events fire, state updates re-render
inst.loop.send('inc')
```

### createService(loop, config)

Wraps a Uploop loop with FeathersJS-style CRUD methods and real-time events:

```js
const service = createService(cartLoop, {
  methods: {
    find: () => cartLoop.get().items,
    create: (item) => { cartLoop.send('addItem', item); return item },
    remove: (id) => { cartLoop.send('removeItem', id); return { id } }
  }
})

// CRUD
await service.create({ id: 1, name: 'Widget' })
await service.find()

// Real-time
service.on('created', (item) => console.log('New item:', item))
```

### createServiceApp()

Manages multiple named services. Each service wraps a loop:

```js
const app = createServiceApp()

app.use('products', {
  loop: productLoop,
  methods: {
    find: () => productLoop.get().products,
    create: (data) => { productLoop.send('createProduct', data); return data }
  }
})

app.use('users', {
  loop: userLoop,
  methods: {
    find: () => userLoop.get().users
  }
})

const products = app.service('products')
await products.find()
```

## Example: Counter Component (SSR + Hydration)

### Server (Node.js)

```js
import http from 'node:http'
import { component } from '@uploop/core'
import { html } from '@uploop/html'
import { renderToString } from '@uploop/sst'

const Counter = component('Counter', {
  state: { count: 0 },
  view: (s) => html`<div>Count: ${s.count}</div>`
})

const server = http.createServer((req, res) => {
  const html = renderToString(Counter, { count: 0 })
  res.end(`<!DOCTYPE html>
<html>
<body>
  <div id="app">${html}</div>
  <script type="module">
    import { hydrate } from '@uploop/sst'
    import { Counter } from './counter.js'
    hydrate(Counter, document.getElementById('app'), {}, { count: 0 })
  </script>
</body>
</html>`)
})

server.listen(3000)
```

### Client

```js
import { hydrate } from '@uploop/sst'
import { Counter } from './counter.js'

const target = document.getElementById('app')
const inst = hydrate(Counter, target, {}, { count: 0 })

// Component is live — events fire, state re-renders
```

## Example: Real-Time Chat (Remote Loop over WebSocket)

The service layer combined with Uploop's event model enables real-time communication.
A WebSocket transport would serialize event envelopes between client and server loops:

```
Client Loop                         WebSocket                  Server Loop
───────────                         ─────────                  ───────────

send('sendMessage', msg) ──► { type:'sendMessage', ... } ──► handler(msg)
       │                                                            │
       │                                                            ▼
       │                                                    merge → state.msg
       │                                                            │
       │                                                            ▼
       ◄─────────────────── { type:'notify', state } ──────── subscribe
       │
       ▼
merge → render
```

### Server

```js
import { createLoop } from '@uploop/core'
import { createService } from '@uploop/sst'

const chatLoop = createLoop({
  state: { messages: [] },
  update: {
    sendMessage: (s, msg) => ({
      messages: [...s.messages, { ...msg, id: Date.now(), time: new Date().toISOString() }]
    })
  }
})

const chatService = createService(chatLoop, {
  methods: {
    find: () => chatLoop.get().messages,
    create: (msg) => { chatLoop.send('sendMessage', msg); return msg }
  }
})

// Broadcast to all connected clients
chatLoop.subscribe((state) => {
  broadcast({ type: 'messages', data: state.messages })
})

export { chatService }
```

### Client

```js
import { component } from '@uploop/core'
import { html } from '@uploop/html'
import { hydrate } from '@uploop/sst'

const Chat = component('Chat', {
  state: { messages: [], draft: '' },
  update: {
    receiveMessages: (s, messages) => ({ messages }),
    setDraft: (s, draft) => ({ draft }),
    sendMessage: (s, msg) => ({ messages: [...s.messages, msg], draft: '' })
  },
  view: (s, { send }) => html`
    <div class="chat">
      <ul>${s.messages.map(m => html`<li><b>${m.user}:</b> ${m.text}</li>`)}</ul>
      <input .value=${s.draft} @input=${(e) => send('setDraft', e.target.value)}
             @keypress=${(e) => e.key === 'Enter' && send('sendMessage', { user: 'me', text: s.draft })} />
    </div>
  `
})

// Connect to WebSocket
const ws = new WebSocket('wss://chat.example.com')
ws.onmessage = (e) => {
  const { type, data } = JSON.parse(e.data)
  if (type === 'messages') Chat.loop.send('receiveMessages', data)
}
```

## Comparison with React/Next.js SSR

| Feature | React/Next.js | Uploop SST |
|---|---|---|
| SSR entry | `renderToString()` / RSC | `renderToString()` — one function |
| Hydration | `hydrateRoot()` + event replay | `hydrate()` — one function |
| State model | useState, useReducer, external libs | Built-in loop: state + update handlers |
| Real-time | Separate WebSocket lib + state mgmt | Same `send()` API for local + remote |
| Service layer | tRPC, REST endpoints | `createService()` — loop → CRUD |
| Execution targets | DOM only (React DOM) | Pluggable: DOM, string, canvas, WebGL |
| Bundle size | ~45 kB (react-dom) | ~2 kB core + ~1 kB html |
| Data flow | Props down, events up (unidirectional) | Event-driven: send → handler → merge → notify |
| Server components | RSC (separate paradigm) | Same component works on server + client |
| Learning curve | JSX, hooks, effects, memo, context | 3 concepts: state, update, view |

### Key Differences

1. **No dual model**: React has server components (RSC) and client components — two different execution models. Uploop components are the same model; only the execution target changes.

2. **State is built-in**: React requires external state management (Redux, Zustand) for complex state. Uploop's loop provides state, event handlers, effects, and subscriptions in one API.

3. **Events are first-class**: Uploop's `send(event, payload)` is the universal communication primitive — works for local UI, network transport, and service calls. React separates onClick, fetch, WebSocket, and state updates into different APIs.

4. **Smaller surface area**: Uploop SSR is ~100 lines vs React's multi-package architecture (react, react-dom, react-server, react-client).

---
