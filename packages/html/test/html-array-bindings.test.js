import { describe, it, expect } from 'vitest'
import { html, applyBindings } from '../src/html.js'

describe('html template tag — array binding index remapping', () => {
  it('single-level map: each button has unique index and correct handler', () => {
    const items = [
      { id: 'counter' },
      { id: 'todo' },
      { id: 'cars' },
    ]

    const result = html`
      <div>${items.map(item => html`
        <button data-testid="${item.id}" @click=${() => item.id}></button>
      `)}</div>
    `

    expect(result.bindings.length).toBe(3)
    expect(result.bindings.map(b => b.index)).toEqual([0, 1, 2])
    expect(result.bindings[0].value()).toBe('counter')
    expect(result.bindings[1].value()).toBe('todo')
    expect(result.bindings[2].value()).toBe('cars')

    const h = result.toString()
    expect(h).toContain('data-up-event="click:0"')
    expect(h).toContain('data-up-event="click:1"')
    expect(h).toContain('data-up-event="click:2"')
    expect((h.match(/data-up-event="click:0"/g) || []).length).toBe(1)
    expect((h.match(/data-up-event="click:1"/g) || []).length).toBe(1)
    expect((h.match(/data-up-event="click:2"/g) || []).length).toBe(1)
  })

  it('applyBindings attaches correct unique handlers to each button', () => {
    const calls = []
    const items = [
      { id: 'counter' },
      { id: 'todo' },
    ]

    const result = html`
      <div>${items.map(item => html`
        <button data-testid="${item.id}" @click=${() => calls.push(item.id)}></button>
      `)}</div>
    `

    const root = document.createElement('div')
    root.innerHTML = result.toString()
    applyBindings(root, result.bindings, () => {})

    root.querySelector('[data-testid="counter"]').click()
    root.querySelector('[data-testid="todo"]').click()

    // Each button should have fired its own unique handler
    expect(calls).toEqual(['counter', 'todo'])
  })

  it('double-nested map (groups → tabs) preserves correct handlers', () => {
    const calls = []
    const groups = [
      { name: 'A', tabs: [{ id: 'counter' }, { id: 'todo' }] },
      { name: 'B', tabs: [{ id: 'cars' }] },
    ]

    const result = html`
      <div>${groups.map(g => html`
        <div>
          ${g.tabs.map(t => html`
            <button data-testid="${t.id}" @click=${() => calls.push(t.id)}></button>
          `)}
        </div>
      `)}</div>
    `

    expect(result.bindings.length).toBe(3)
    const indices = result.bindings.map(b => b.index)
    expect(new Set(indices).size).toBe(3)
    expect(indices).toEqual([0, 1, 2])

    // Each handler, when called, pushes its unique id
    let ids = []
    for (const b of result.bindings) ids.push(b.value())
    // calls.push returns the array length after push: 1, 2, 3
    expect(ids).toEqual([1, 2, 3])
    expect(calls).toEqual(['counter', 'todo', 'cars'])
  })

  it('double-nested DOM test: clicking buttons fires unique handlers', () => {
    const calls = []
    const groups = [
      { name: 'Apps', tabs: [{ id: 'c1' }, { id: 'c2' }] },
      { name: 'Games', tabs: [{ id: 'g1' }] },
    ]

    const result = html`
      <div>${groups.map(g => html`
        <div>${g.tabs.map(t => html`
          <button data-testid="${t.id}" @click=${() => calls.push(t.id)}></button>
        `)}</div>
      `)}</div>
    `

    const root = document.createElement('div')
    root.innerHTML = result.toString()
    applyBindings(root, result.bindings, () => {})

    root.querySelector('[data-testid="c1"]').click()
    root.querySelector('[data-testid="c2"]').click()
    root.querySelector('[data-testid="g1"]').click()

    expect(calls).toEqual(['c1', 'c2', 'g1'])
  })
})
