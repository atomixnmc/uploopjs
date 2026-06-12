import http from 'node:http'
import { component } from '@uploop/core'
import { html } from '@uploop/html'
import { renderToString } from '../../packages/sst/src/ssr.js'

const Counter = component('Counter', {
  state: { count: 0 },
  view: (s) => html`
    <div style="text-align:center;padding:2rem;font-family:sans-serif">
      <h1>SSR Counter</h1>
      <div style="font-size:3rem;margin:1rem">${s.count}</div>
      <button>+1 (hydrated on client)</button>
      <p style="color:#888;font-size:0.8rem;margin-top:1rem">
        Rendered on server at ${new Date().toISOString()}
      </p>
    </div>
  `
})

const server = http.createServer((req, res) => {
  const html = renderToString(Counter, { count: 0 })

  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Uploop SSR Example</title>
</head>
<body>
  <div id="app">${html}</div>
  <script type="module">
    // In production, this would hydrate the component
    console.log('Uploop SSR — component rendered on server')
  </script>
</body>
</html>`)
})

server.listen(3000, () => {
  console.log('Uploop SSR server running at http://localhost:3000')
})
