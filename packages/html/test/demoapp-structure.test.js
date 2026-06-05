import { describe, it, expect } from 'vitest'
import { html, applyBindings } from '../src/html.js'

describe('DemoApp template structure — index remapping', () => {
  // Exact same structure as DemoApp's view
  const tabGroups = [
    { name: 'Apps', tabs: [{ id: 'counter' }, { id: 'todo' }] },
    { name: 'Games', tabs: [{ id: 'cars' }] },
  ]

  it('outer html with Home button + inner tab content preserves indices', () => {
    const calls = []
    let state = { tab: 'counter' }
    const send = (event, id) => calls.push(id)

    // This mirrors DemoApp's view exactly
    const result = html`
      <div>
        <div>
          ${state.tab !== "landing"
            ? html`<button @click=${() => send("switch", "landing")}>Home</button>`
            : ""}
        </div>
        ${state.tab !== "landing"
          ? html`
              ${tabGroups.map(group => html`
                <div>
                  ${group.tabs.map(t => html`
                    <button @click=${() => send("switch", t.id)}>${t.id}</button>
                  `)}
                </div>
              `)}
              <div id="demo-slot"></div>
            `
          : ""}
      </div>
    `

    // Total bindings: 1 (Home) + 3 (counter, todo, cars) = 4
    expect(result.bindings.length).toBe(4)

    // All indices unique
    const indices = result.bindings.map(b => b.index)
    expect(new Set(indices).size).toBe(4)

    // Verify DOM click behavior
    const root = document.createElement('div')
    root.innerHTML = result.toString()
    applyBindings(root, result.bindings, send)

    // Click counter button
    root.querySelectorAll('button').forEach(b => b.click())

    // Should have received: landing, counter, todo, cars
    // (order depends on DOM querySelectorAll order)
    expect(calls).toContain('landing')
    expect(calls).toContain('counter')
    expect(calls).toContain('todo')
    expect(calls).toContain('cars')
  })
})
