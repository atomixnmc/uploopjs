/**
 * @uploop/sst — Server-Side Toolset
 *
 * SSR rendering, client-side hydration, remote loop transport,
 * and FeathersJS-style service layer.
 *
 *   Server:
 *     import { renderToString, renderToHtml } from '@uploop/sst'
 *     const html = renderToString(Counter, { count: 0 })
 *
 *   Client:
 *     import { hydrate, createHydrationRoot } from '@uploop/sst'
 *     hydrate(Counter, document.getElementById('app'), {}, { count: 0 })
 *
 *   Services:
 *     import { createService, createServiceApp } from '@uploop/sst'
 *     const app = createServiceApp()
 *     app.use('products', { loop: productLoop, methods: { ... } })
 */

export { renderToString } from './ssr.js'
export { hydrate, createHydrationRoot } from './hydrate.js'
export { createService, createServiceApp } from './service.js'
