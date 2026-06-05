import { describe, it, expect } from 'vitest'
import { html, applyBindings } from '../src/html.js'

describe('html template tag — stable binding IDs', () => {
  it('single-level map: each button has unique id and correct handler', () => {
    const items = [{ id: 'counter' }, { id: 'todo' }, { id: 'cars' }]
    const result = html`
      <div>${items.map(item => html`
        <button data-testid="${item.id}" @click=${() => item.id}></button>
      `)}</div>
    `
    expect(result.bindings.length).toBe(3)
    const ids = result.bindings.map(b => b.id)
    expect(new Set(ids).size).toBe(3)
    expect(result.bindings[0].value()).toBe('counter')
    expect(result.bindings[1].value()).toBe('todo')
    expect(result.bindings[2].value()).toBe('cars')
  })

  it('applyBindings attaches correct unique handlers', () => {
    const calls = []
    const items = [{ id: 'counter' }, { id: 'todo' }]
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
    expect(calls).toEqual(['counter', 'todo'])
  })

  it('double-nested map preserves correct unique handlers', () => {
    const calls = []
    const groups = [
      { name: 'A', tabs: [{ id: 'counter' }, { id: 'todo' }] },
      { name: 'B', tabs: [{ id: 'cars' }] },
    ]
    const result = html`
      <div>${groups.map(g => html`
        <div>${g.tabs.map(t => html`
          <button data-testid="${t.id}" @click=${() => calls.push(t.id)}></button>
        `)}</div>
      `)}</div>
    `
    expect(result.bindings.length).toBe(3)
    expect(new Set(result.bindings.map(b => b.id)).size).toBe(3)
    for (const b of result.bindings) b.value()
    expect(calls).toEqual(['counter', 'todo', 'cars'])
  })

  it('double-nested DOM test: clicking fires unique handlers', () => {
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
