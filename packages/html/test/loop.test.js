import { describe, it, expect } from 'vitest'
import { html, applyBindings, loop } from '../src/index.js'

describe('loop() html list primitive', () => {
  it('renders positional loop entries through the existing html string path', () => {
    const items = ['alpha', 'beta']
    const result = html`
      <ul>${loop(items, item => html`<li>${item}</li>`)}</ul>
    `

    expect(result.toString()).toContain('<li>alpha</li>')
    expect(result.toString()).toContain('<li>beta</li>')
  })

  it('preserves unique event bindings inside keyed loop entries', () => {
    const calls = []
    const items = [{ id: 'a' }, { id: 'b' }]
    const result = html`
      <div>${loop(items, item => item.id, item => html`
        <button data-id="${item.id}" @click=${() => calls.push(item.id)}>${item.id}</button>
      `)}</div>
    `

    const root = document.createElement('div')
    root.innerHTML = result.toString()
    applyBindings(root, result.bindings, () => {})
    root.querySelector('[data-id="a"]').click()
    root.querySelector('[data-id="b"]').click()

    expect(calls).toEqual(['a', 'b'])
    expect(new Set(result.bindings.map(b => b.id)).size).toBe(2)
  })

  it('records keyed loop metadata for graph execution without changing public shape', () => {
    const items = [{ id: 10, name: 'ten' }, { id: 20, name: 'twenty' }]
    const result = html`
      <section>${loop(items, item => item.id, item => html`<p>${item.name}</p>`)}</section>
    `

    const loopPart = result.graphParts.find(part => part.type === 'loop')
    expect(loopPart).toMatchObject({ keyed: true, keys: [10, 20], length: 2 })
    expect(result.template).toBe(result.toString())
    expect(result.graphTemplate.kind).toBe('uploop.html.graph-template')
  })
})
