// ─── Chainable Style Builder ──────────────────────────────────
// jQuery-inspired fluent API for building styles and parsing raw CSS.

import { getSheet } from './inject.js'
import { camelToKebab } from './dynamic.js'

let _uid = 0

function nextClassName() {
  return `up-css-${++_uid}`
}

function serializeDecls(decls) {
  return Object.entries(decls)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ')
}

function stripComments(text) {
  return String(text || '').replace(/\/\*[\s\S]*?\*\//g, '').trim()
}

export function parseCSS(text = '') {
  const clean = stripComments(text)
  const graph = {}
  const json = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let match

  while ((match = re.exec(clean))) {
    const selector = match[1].trim()
    const body = match[2].trim()
    if (!selector) continue

    const decls = {}
    for (const part of body.split(';')) {
      const item = part.trim()
      if (!item) continue
      const sep = item.indexOf(':')
      if (sep === -1) continue
      const key = item.slice(0, sep).trim()
      const value = item.slice(sep + 1).trim()
      if (key) decls[key] = value
    }

    graph[selector] = decls
    json.push({ selector, css: serializeDecls(decls) })
  }

  const normalizedText = json
    .map(rule => `${rule.selector} { ${rule.css} }`)
    .join('\n')

  return { graph, json, text: normalizedText }
}

function joinTemplate(strings, values) {
  let out = ''
  for (let i = 0; i < strings.length; i++) {
    out += strings[i]
    if (i < values.length) out += values[i]
  }
  return out
}

/**
 * Start a chainable style builder, or parse a CSS tagged template.
 */
export function css(first, ...values) {
  if (Array.isArray(first) && 'raw' in first) {
    return parseCSS(joinTemplate(first, values))
  }
  return new ChainBuilder(first)
}

class ChainBuilder {
  #decls = {}
  #sheet
  #selector = null
  #apply = []
  _result = null

  constructor(sheet, decls, selector, applyRefs) {
    this.#sheet = sheet || getSheet()
    this.#decls = { ...(decls || {}) }
    this.#selector = selector || null
    this.#apply = [...(applyRefs || [])]
  }

  get decls() {
    return { ...this.#decls }
  }

  prop(prop, value) {
    this.#decls[camelToKebab(prop)] = value
    this._result = null
    return this
  }

  props(obj) {
    if (!obj || typeof obj !== 'object') return this
    for (const [key, value] of Object.entries(obj)) {
      this.prop(key, value)
    }
    return this
  }

  merge(other) {
    if (!other) return this
    const decls = other instanceof ChainBuilder ? other.decls : other
    if (decls && typeof decls === 'object') this.props(decls)
    return this
  }

  clone() {
    return new ChainBuilder(this.#sheet, this.#decls, this.#selector, this.#apply)
  }

  select(selector) {
    this.#selector = String(selector || '').replace(/^\./, '')
    this._result = null
    return this
  }

  apply(...classNames) {
    this.#apply.push(...classNames.filter(Boolean))
    return this
  }

  inline() {
    return serializeDecls(this.#decls)
  }

  when(_variant, fn) {
    if (typeof fn === 'function') {
      const branch = this.clone()
      fn(branch)
    }
    return this
  }

  export() {
    const className = this.#selector || nextClassName()
    return { className, css: this.inline(), apply: [...this.#apply] }
  }

  done() {
    if (this._result) return this._result
    const result = this.export()
    if (this.#sheet && result.css) {
      try { this.#sheet.insertRule(`.${result.className} { ${result.css} }`) } catch (e) {}
    }
    this._result = result
    return result
  }

  toString() {
    return this.done().className
  }

  valueOf() {
    return this.done().className
  }
}

const shorthands = {
  m: (target, args) => target.prop('margin', ...args),
  mt: (target, args) => target.prop('margin-top', ...args),
  mr: (target, args) => target.prop('margin-right', ...args),
  mb: (target, args) => target.prop('margin-bottom', ...args),
  ml: (target, args) => target.prop('margin-left', ...args),
  mx: (target, args) => { target.prop('margin-left', ...args); target.prop('margin-right', ...args) },
  my: (target, args) => { target.prop('margin-top', ...args); target.prop('margin-bottom', ...args) },
  p: (target, args) => target.prop('padding', ...args),
  pt: (target, args) => target.prop('padding-top', ...args),
  pr: (target, args) => target.prop('padding-right', ...args),
  pb: (target, args) => target.prop('padding-bottom', ...args),
  pl: (target, args) => target.prop('padding-left', ...args),
  px: (target, args) => { target.prop('padding-left', ...args); target.prop('padding-right', ...args) },
  py: (target, args) => { target.prop('padding-top', ...args); target.prop('padding-bottom', ...args) },
  bg: (target, args) => target.prop('background-color', ...args),
  text: (target, args) => target.prop('color', ...args),
  rounded: (target, args) => target.prop('border-radius', ...args),
}

const chainProxyHandler = {
  get(target, prop, receiver) {
    if (prop in target || typeof prop === 'symbol') {
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    }

    return (...args) => {
      if (args.length === 0) return receiver
      const name = String(prop)
      if (shorthands[name]) shorthands[name](target, args)
      else target.prop(name, ...args)
      return receiver
    }
  }
}

export function css2(sheet) {
  return new Proxy(new ChainBuilder(sheet), chainProxyHandler)
}
