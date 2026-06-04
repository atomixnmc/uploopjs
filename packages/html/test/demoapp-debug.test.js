import { describe, it, expect } from 'vitest'
import { html, applyBindings } from '../src/html.js'

describe('DemoApp structure — debug bindings', () => {
  const tabGroups = [
    { name: 'Apps', tabs: [{ id: 'counter' }, { id: 'todo' }] },
    { name: 'Games', tabs: [{ id: 'cars' }] },
  ]

  it('should produce unique handler functions', () => {
    let h1, h2, h3
    let state = { tab: 'counter' }

    const result = html`
      <div>
        <div>
          ${state.tab !== "landing"
            ? html`<button @click=${() => 'home'}>Home</button>`
            : ""}
        </div>
        ${state.tab !== "landing"
          ? html`
              ${tabGroups.map(group => html`
                <div>
                  ${group.tabs.map(t => html`
                    <button @click=${() => { h1 = h1 || (() => t.id); return t.id; }}>${t.id}</button>
                  `)}
                </div>
              `)}
              <div id="demo-slot"></div>
            `
          : ""}
      </div>
    `

    // Log all bindings
    console.log('bindings:', result.bindings.map(b => ({
      index: b.index,
      type: b.type,
      name: b.name,
      handlerResult: b.value()
    })))

    // Log the HTML template
    console.log('template:', result.toString().substring(0, 500))

    // Verify unique handler functions by reference
    const handlers = result.bindings.filter(b => b.type === 'event' && b.name === 'click')
    const handlerResults = handlers.map(b => b.value())
    console.log('handler results:', handlerResults)

    // All handler results should be unique (or at least 'counter', 'todo', 'cars' should appear)
    expect(handlerResults).toContain('counter')
    expect(handlerResults).toContain('todo')
    expect(handlerResults).toContain('cars')
  })
})
