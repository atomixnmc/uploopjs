import { describe, it, expect } from 'vitest'
import { html, applyBindings } from '../src/html.js'

describe('DemoApp template — stable IDs with Home button + tab content', () => {
  const tabGroups = [
    { name: 'Apps', tabs: [{ id: 'counter' }, { id: 'todo' }] },
    { name: 'Games', tabs: [{ id: 'cars' }] },
  ]

  it('outer html with Home button + inner tab content preserves unique IDs', () => {
    const calls = []
    let state = { tab: 'counter' }
    const send = (event, id) => calls.push(id)

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

    expect(result.bindings.length).toBe(4)
    expect(new Set(result.bindings.map(b => b.id)).size).toBe(4)

    const root = document.createElement('div')
    root.innerHTML = result.toString()
    applyBindings(root, result.bindings, send)
    root.querySelectorAll('button').forEach(b => b.click())

    expect(calls).toContain('landing')
    expect(calls).toContain('counter')
    expect(calls).toContain('todo')
    expect(calls).toContain('cars')
  })
})
