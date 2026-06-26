/**
 * Schema Demo — entity-driven forms, tables, and bindings.
 *
 * Shows:
 *   1. Entity definition with validation
 *   2. Auto-generated form component (entityComponent)
 *   3. Data binding to HyperGraph (bind)
 *   4. Table display mode
 *   5. Field mapping / aliases
 *   6. Computed fields
 */
import { html, component } from '@uploop/html'
import { createGraph } from '@uploop/core'
import {
  entity, string, number, boolean, enumeration, ref, computed,
  toGraph, bind, entityComponent, entityFields
} from '@uploop/schema'

// ── Entities ───────────────────────────────────────────────

const Product = entity('Product', {
  name: string().min(1).max(100),
  price: number().integer().min(0),
  quantity: number().integer().min(0).withDefault(0),
  category: enumeration(['electronics', 'clothing', 'food', 'books']),
  inStock: boolean().withDefault(true),
  total: computed(['price', 'quantity'], (p) => (p.price || 0) * (p.quantity || 0))
}, {
  temperature: 'warm',
  lifetime: 'session',
  description: 'A product in the catalog. price is in USD cents.',
  aiRole: 'commerce.product'
})

// ── Graph ──────────────────────────────────────────────────

const graph = createGraph(toGraph([Product], { name: 'schema-demo' }))
const productBind = bind(Product, graph)

// ── Product Form (auto-generated) ──────────────────────────

const ProductForm = component('ProductForm', entityComponent(Product, {
  mode: 'form',
  update: {
    // Custom override: log on save
    save(state) {
      const result = Product.validate(state)
      if (!result.ok) {
        alert('Validation errors:\n' + result.errors.map(e => e.path + ': ' + e.message).join('\n'))
        return state
      }
      alert('Saved: ' + JSON.stringify(result.value, null, 2))
      return result.value
    }
  }
}))

// ── Product Table (auto-generated) ─────────────────────────

const ProductTable = component('ProductTable', entityComponent(Product, {
  mode: 'table'
}))

// ── Demo Container ─────────────────────────────────────────

export const SchemaDemo = component('SchemaDemo', {
  state: {
    mode: 'form',       // 'form' | 'table' | 'bindings' | 'describe'
    products: [
      { name: 'Widget', price: 1999, quantity: 3, category: 'electronics', inStock: true },
      { name: 'T-Shirt', price: 2499, quantity: 10, category: 'clothing', inStock: true },
    ],
    describeOutput: ''
  },

  update: {
    switchMode(s, mode) {
      if (mode === 'describe') {
        const desc = Product.describe()
        return { ...s, mode, describeOutput: JSON.stringify(desc, null, 2) }
      }
      return { ...s, mode }
    },
    addProduct(s) {
      const newProduct = { name: 'New Item', price: 0, quantity: 1, category: 'electronics', inStock: true }
      return { ...s, products: [...s.products, newProduct] }
    }
  },

  view(state, { send }) {
    const fields = entityFields(Product)

    return html`
      <div class="schema-demo" style="padding:16px;max-width:720px;margin:0 auto;font-family:system-ui">
        <h2>📐 Schema Demo</h2>
        <p>Entity: <code>Product</code> — name, price, quantity, category, inStock, total (computed)</p>

        <!-- Mode tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          ${['form', 'table', 'describe'].map(m => html`
            <button
              @click=${() => send('switchMode', m)}
              style="padding:6px 14px;border:1px solid #ccc;border-radius:4px;background:${state.mode === m ? '#e0e7ff' : '#fff'};cursor:pointer"
            >${m === 'form' ? '📝 Form' : m === 'table' ? '📊 Table' : '🔍 Describe'}</button>
          `)}
        </div>

        <!-- Form mode -->
        ${state.mode === 'form' && html`
          <div>
            <h3>Auto-generated Form</h3>
            <p style="color:#666;font-size:13px">Generated from <code>entityComponent(Product, {mode:'form'})</code></p>
            ${ProductForm}
          </div>
        `}

        <!-- Table mode -->
        ${state.mode === 'table' && html`
          <div>
            <h3>Auto-generated Table</h3>
            <p style="color:#666;font-size:13px">Generated from <code>entityComponent(Product, {mode:'table'})</code></p>
            <button @click=${() => send('addProduct')} style="margin-bottom:8px;padding:4px 12px">+ Add Row</button>
            ${ProductTable({ items: state.products }, { send })}
          </div>
        `}

        <!-- Describe mode -->
        ${state.mode === 'describe' && html`
          <div>
            <h3>AI-Readable Manifest</h3>
            <p style="color:#666;font-size:13px"><code>Product.describe()</code> — JSON-serializable, no functions leaked</p>
            <pre style="background:#f5f5f5;padding:12px;border-radius:4px;overflow:auto;max-height:400px;font-size:12px">${state.describeOutput}</pre>
          </div>
        `}

        <!-- Field metadata table -->
        <div style="margin-top:24px">
          <h4>Field Metadata (entityFields)</h4>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#f5f5f5">
              <th style="padding:6px;text-align:left;border:1px solid #ddd">Name</th>
              <th style="padding:6px;text-align:left;border:1px solid #ddd">Type</th>
              <th style="padding:6px;text-align:left;border:1px solid #ddd">Input</th>
              <th style="padding:6px;text-align:left;border:1px solid #ddd">Required</th>
            </tr></thead>
            <tbody>
              ${fields.map(f => html`
                <tr>
                  <td style="padding:6px;border:1px solid #ddd"><code>${f.name}</code></td>
                  <td style="padding:6px;border:1px solid #ddd">${f.type}</td>
                  <td style="padding:6px;border:1px solid #ddd"><code>&lt;input type="${f.inputType}"&gt;</code></td>
                  <td style="padding:6px;border:1px solid #ddd">${f.required ? '✓' : ''} ${f.computed ? '(computed)' : ''}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </div>
    `
  }
})
