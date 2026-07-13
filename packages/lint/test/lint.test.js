import { describe, it, expect } from 'vitest'
import { checkString } from '../src/index.js'

const L = String.fromCharCode(60)
const G = String.fromCharCode(62)

describe('checkString', () => {
  it('passes valid Uploop component code', () => {
    const result = checkString(`
      import { html, component } from '@uploop/html'
      const App = component('App', {
        state: { count: 0 },
        update: { inc: (s) => ({ count: s.count + 1 }) },
        view: (state, { send }) => html\`${L}div${G}${L}button @click=\${() => send('inc')}${G}+${L}/button${G}${L}/div${G}\`
      })
    `)
    expect(result.ok).toBe(true)
  })

  it('detects @click outside html template', () => {
    const result = checkString(`const btn = '${L}button @click=doThing${G}Click${L}/button${G}'`)
    expect(result.warnings.some(w => w.code === 'click_outside_html')).toBe(true)
  })

  it('detects require() in ESM modules', () => {
    const result = checkString(`const fs = require('fs')`)
    expect(result.errors.some(e => e.code === 'cjs_in_esm')).toBe(true)
  })

  it('warns on html([...]) anti-pattern', () => {
    const result = checkString(`const btn = html(['${L}button${G}Click${L}/button${G}'])`)
    expect(result.warnings.some(w => w.code === 'html_array_call')).toBe(true)
  })

  it('detects React hooks in Uploop code', () => {
    const result = checkString(`const [count, setCount] = useState(0)`)
    expect(result.warnings.some(w => w.code === 'react_hooks_in_uploop')).toBe(true)
  })

  it('detects on* HTML attributes', () => {
    const result = checkString('html`' + L + 'button onchange=${handler}' + G + 'Click' + L + '/button' + G + '`')
    expect(result.errors.some(e => e.code === 'on_attr_not_supported')).toBe(true)
  })

  it('detects component with no view function', () => {
    const result = checkString(`const App = component('App', { state: { x: 1 }, update: {} })`)
    expect(result.errors.some(e => e.code === 'component_no_view')).toBe(true)
  })

  it('warns on component with no state', () => {
    const result = checkString(`const App = component('App', { view: () => 'hello' })`)
    expect(result.warnings.some(w => w.code === 'component_no_state')).toBe(true)
  })

  it('detects unmatched backticks', () => {
    const result = checkString('html`' + L + 'div' + G + 'hello')
    expect(result.errors.some(e => e.code === 'unmatched_backtick')).toBe(true)
  })

  it('warns on view function with block body and no return', () => {
    const result = checkString(`
      const App = component('App', {
        state: { x: 1 },
        view: (state) => { html\`${L}div${G}\${state.x}${L}/div${G}\` }
      })
    `)
    expect(result.warnings.some(w => w.code === 'view_no_return')).toBe(true)
  })

  it('detects node:fs import in browser code', () => {
    const result = checkString(`import fs from 'node:fs'`)
    expect(result.warnings.some(w => w.code === 'node_import_in_browser')).toBe(true)
  })

  it('clean code has no errors or warnings', () => {
    const result = checkString(`const x = 1`)
    expect(result.ok).toBe(true)
    expect(result.warnings.length).toBe(0)
  })
})
