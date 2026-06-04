/**
 * Uploop Suspend Helper — v0.3.0
 *
 * Declarative async data loading with zero boilerplate.
 * Works with createLoop() to automatically handle loading,
 * error, and success states for async data fetching.
 *
 * ─── Usage ────────────────────────────────────────────
 *
 *   import { suspend } from '@uploop/html'
 *
 *   const loop = createLoop({
 *     state: { products: [] },
 *     cache: { products: { ttl: 60000, swr: true } },
 *     error: { fetchProducts: { retry: 3, fallback: {} } },
 *     update: {
 *       fetchProducts: async (state) => {
 *         const res = await fetch('/api/products')
 *         return { products: await res.json() }
 *       }
 *     }
 *   })
 *
 *   // In view:
 *   suspend(loop, 'products', 'fetchProducts', {
 *     loading: () => html`<div>Loading products...</div>`,
 *     error: (err) => html`<div>Error: ${err.message} <button @click=${retry}>Retry</button></div>`,
 *     render: (products) => html`<ul>${products.map(p => html`<li>${p}</li>`)}</ul>`
 *   })
 *
 * ─── Auto-Fetch ───────────────────────────────────────
 *
 * If no event has been sent yet and the key is empty/default,
 * suspend() will call `send(fetchEvent)` automatically.
 * Set `autoFetch: false` to disable.
 *
 * @module @uploop/html/suspend
 */

/**
 * Suspend rendering while async data loads.
 *
 * Renders `loading` while `isPending(fetchEvent)` is true.
 * Renders `error` if `getError(fetchEvent)` returns an error.
 * Renders `render(data)` when data is ready.
 *
 * @param {Object} loop — createLoop() instance
 * @param {string} dataKey — state key to read
 * @param {string} fetchEvent — event name that triggers data fetch
 * @param {Object} options
 * @param {Function} options.loading — (state) → template while loading
 * @param {Function} options.error — (errorInfo, { retry, state }) → template on error
 * @param {Function} options.render — (data, state) → template when ready
 * @param {boolean} [options.autoFetch=true] — auto-trigger fetch if data is empty
 * @returns {*} template result
 */
export function suspend(loop, dataKey, fetchEvent, options = {}) {
  const {
    loading = () => '',
    error: errorView = () => '',
    render = (v) => v,
    autoFetch = true
  } = options

  const state = loop.get()
  const data = state[dataKey]
  const isError = loop.getError ? loop.getError(fetchEvent) : null
  const pending = loop.isPending ? loop.isPending(fetchEvent) : false

  // ── Error state ──────────────────────────────────────
  if (isError) {
    const retry = () => {
      loop.clearError?.(fetchEvent)
      loop.send(fetchEvent)
    }
    return errorView(isError, { retry, state })
  }

  // ── Loading state ────────────────────────────────────
  if (pending) {
    return loading(state)
  }

  // ── Auto-fetch on first render ───────────────────────
  if (autoFetch && !pending && !isError) {
    const isEmpty = data === undefined || data === null ||
      (Array.isArray(data) && data.length === 0) ||
      (typeof data === 'object' && Object.keys(data).length === 0)
    if (isEmpty) {
      // Use microtask to avoid send-during-render
      Promise.resolve().then(() => loop.send(fetchEvent))
      return loading(state)
    }
  }

  // ── Ready state ──────────────────────────────────────
  return render(data, state)
}
