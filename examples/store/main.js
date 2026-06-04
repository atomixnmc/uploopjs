/**
 * Store Example — Shopping cart with persistence
 *
 * Demonstrates:
 *   • External store shared across components
 *   • localStorage persistence
 *   • Derived values (total, count)
 *   • Selectors
 */

import { html, component } from '@uploop/html'
import { store, persist, derived } from '@uploop/store'

// ── Product catalog ──────────────────────────────────────
const PRODUCTS = [
  { id: 1, name: 'Widget', price: 9.99 },
  { id: 2, name: 'Gadget', price: 19.99 },
  { id: 3, name: 'Doohickey', price: 4.99 },
  { id: 4, name: 'Thingamajig', price: 14.99 }
]

// ── Cart store ───────────────────────────────────────────
const cartStore = store({
  name: 'cart',
  state: {
    items: [] // { id, name, price, qty }
  },
  update: {
    addItem: (s, product) => {
      const existing = s.items.find(i => i.id === product.id)
      if (existing) {
        return {
          items: s.items.map(i =>
            i.id === product.id ? { ...i, qty: i.qty + 1 } : i
          )
        }
      }
      return { items: [...s.items, { ...product, qty: 1 }] }
    },

    removeItem: (s, id) => ({
      items: s.items.filter(i => i.id !== id)
    }),

    updateQty: (s, id, qty) => {
      if (qty <= 0) return { items: s.items.filter(i => i.id !== id) }
      return { items: s.items.map(i => i.id === id ? { ...i, qty } : i) }
    },

    clearCart: () => ({ items: [] })
  }
})

// Persist cart to localStorage
persist(cartStore, { key: 'uploop-cart', include: ['items'] })

// Derived values
const cartTotal = derived(cartStore, s =>
  s.items.reduce((sum, i) => sum + i.price * i.qty, 0).toFixed(2)
)
const cartCount = derived(cartStore, s =>
  s.items.reduce((sum, i) => sum + i.qty, 0)
)

// ── Product card component ───────────────────────────────
const ProductCard = component('ProductCard', {
  view: (state) => html`
    <div style="border:1px solid #ddd;border-radius:8px;padding:1rem;display:flex;flex-direction:column;gap:0.5rem;">
      <strong>${state.name}</strong>
      <span style="color:#888;">$${state.price.toFixed(2)}</span>
      <button @click=${() => cartStore.send('addItem', state)}
        style="padding:0.3rem 0.75rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer;">
        Add to Cart
      </button>
    </div>
  `
})

// ── Cart item component ──────────────────────────────────
const CartItem = component('CartItem', {
  view: (state) => html`
    <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid #eee;">
      <span style="flex:1;">${state.name}</span>
      <span style="color:#888;font-size:0.85rem;">$${state.price.toFixed(2)}</span>
      <input type="number" .value=${String(state.qty)} min="0" max="99"
        @input=${['updateQty', e => [state.id, Number(e.target.value)]]}
        style="width:50px;padding:0.2rem;text-align:center;border:1px solid #ccc;border-radius:4px;"
      />
      <button @click=${() => cartStore.send('removeItem', state.id)}
        style="background:none;border:none;cursor:pointer;color:#f44;font-size:1.1rem;">×</button>
    </div>
  `
})

// ── Cart panel ───────────────────────────────────────────
const CartPanel = component('CartPanel', {
  view: () => {
    const items = cartStore.select('items')
    const total = cartTotal.get()
    const count = cartCount.get()

    return html`
      <div style="border:2px solid #646cff;border-radius:8px;padding:1rem;">
        <h3 style="margin:0 0 0.5rem;">🛒 Cart (${count})</h3>

        ${items.length === 0
          ? html`<p style="color:#888;">Cart is empty</p>`
          : html`
            ${items.map(item => CartItem(item))}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem;padding-top:0.5rem;border-top:2px solid #eee;">
              <strong>Total: $${total}</strong>
              <button @click=${() => cartStore.send('clearCart')}
                style="padding:0.25rem 0.75rem;background:#f44336;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.85rem;">
                Clear
              </button>
            </div>
          `
        }
      </div>
    `
  }
})

// ── Main store demo ──────────────────────────────────────

export const StoreDemo = component('StoreDemo', {
  view: () => {
    return html`
      <div style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:1rem;">
        <h2>🛍 Uploop Store Demo</h2>
        <p style="color:#888;font-size:0.85rem;">
          External store with localStorage persistence, derived values, and selectors.
          Items persist across page reloads!
        </p>

        <!-- Product grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:1rem;margin:1rem 0;">
          ${PRODUCTS.map(p => ProductCard(p))}
        </div>

        <!-- Cart -->
        ${CartPanel()}

        <details style="margin-top:1.5rem;font-size:0.8rem;color:#888;">
          <summary>Debug Info</summary>
          <pre>Items: ${JSON.stringify(cartStore.select('items'), null, 2)}
Total: $${cartTotal.get()}
Count: ${cartCount.get()}</pre>
        </details>
      </div>
    `
  }
})

export default StoreDemo
