// ─── Chainable Style Builder ──────────────────────────────────
// jQuery-inspired fluent API for building styles.
//
//   css().bg('primary').text('white').px(4).py(2).rounded('md')
//   // → { className: '...', css: '...' }
//
// The chain tracks pending style declarations, and on toString()
// or .done(), injects a new CSS class into the global sheet.

import { getSheet } from './inject.js'
import { camelToKebab } from './dynamic.js'

let _uid = 0

/**
 * Start a chainable style builder.
 *
 * @param {CSSStyleSheet} [sheet] - Target sheet (default: global)
 * @returns {ChainBuilder}
 *
 * @example
 * const btn = css().bg('primary').text('white').px(4).py(2).rounded('md')
 * element.className = btn.className
 */
export function css(sheet) {
  return new ChainBuilder(sheet)
}

class ChainBuilder {
  #decls = {}
  #sheet
  #customSelector = null
  #variantBlocks = []

  constructor(sheet) {
    this.#sheet = sheet || (typeof document !== 'undefined' ? getSheet() : null)
  }

  /**
   * Access the internal declarations map (read-only snapshot).
   * @returns {Object<string, string|number>}
   */
  get decls() {
    return { ...this.#decls }
  }

  /**
   * Set any CSS property by kebab-case or camelCase name.
   * @param {string} prop
   * @param {string|number} value
   * @returns {ChainBuilder}
   */
  prop(prop, value) {
    const key = camelToKebab(prop)
    this.#decls[key] = value
    return this
  }

  /**
   * Merge declarations from another ChainBuilder or plain style object.
   * Does not mutate the source.
   *
   * @param {ChainBuilder|Object} other
   * @returns {ChainBuilder}
   *
   * @example
   * const base = css().px(4).py(2)
   * const btn = css().bg('blue').merge(base).done()
   */
  merge(other) {
    if (other instanceof ChainBuilder) {
      Object.assign(this.#decls, other.decls)
    } else if (other && typeof other === 'object') {
      for (const [k, v] of Object.entries(other)) {
        this.prop(k, v)
      }
    }
    return this
  }

  /**
   * Clone the chain (fork without affecting original).
   * @returns {ChainBuilder}
   *
   * @example
   * const base = css().px(4).py(2)
   * const btn = base.clone().bg('blue').done()
   */
  clone() {
    const c = new ChainBuilder(this.#sheet)
    Object.assign(c.#decls, this.#decls)
    c.#customSelector = this.#customSelector
    c.#variantBlocks = [...this.#variantBlocks]
    return c
  }

  /**
   * Use a custom CSS selector instead of the auto-generated class name.
   * Supports & for nesting reference.
   *
   * @param {string} selector
   * @returns {ChainBuilder}
   *
   * @example
   * css().select('& > li + li').borderTop('1px solid #eee').done()
   */
  select(selector) {
    this.#customSelector = selector
    return this
  }

  /**
   * Reference existing utility classes as base declarations.
   * Useful when you want to augment a utility class with extra styles.
   *
   * @param {...string} classNames - Utility class names (with or without dot)
   * @returns {ChainBuilder}
   *
   * @example
   * css().apply('bg-primary', 'p-4').prop('opacity', 0.9).done()
   */
  apply(...classNames) {
    for (const cn of classNames) {
      const clean = cn.replace(/^\./, '')
      this.#decls[`@apply ${clean}`] = null
    }
    return this
  }

  /**
   * Add a variant condition (hover, focus, responsive, etc.).
   *
   * @param {string} variantName - e.g. 'hover', 'md', 'dark'
   * @param {Function} fn - Receives a new ChainBuilder to define variant styles
   * @returns {ChainBuilder}
   *
   * @example
   * css().bg('blue').when('hover', c => c.bg('darkblue')).done()
   */
  when(variantName, fn) {
    const inner = new ChainBuilder(this.#sheet)
    fn(inner)
    this.#variantBlocks.push({ variant: variantName, decls: inner.decls })
    return this
  }

  /**
   * Generate an inline style string without injecting a class.
   * Useful for dynamic/one-off styles.
   *
   * @returns {string}
   *
   * @example
   * const style = css().px(4).bg('red').inline()
   * // → "padding: 4rem; background-color: red"
   */
  inline() {
    return Object.entries(this.#decls)
      .filter(([k]) => !k.startsWith('@'))
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ')
  }

  /**
   * Build and inject the CSS class.
   * Called automatically by toString(), but can be called explicitly.
   * @returns {{ className: string, css: string }}
   */
  done() {
    if (this._result) return this._result
    const className = this.#customSelector
      ? this.#customSelector.replace(/^\./, '').replace(/[^a-zA-Z0-9_-]/g, '-')
      : `up-css-${++_uid}`
    const selector = this.#customSelector || `.${className}`
    const css = Object.entries(this.#decls)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ')

    // Inject base rule
    if (this.#sheet && css) {
      try { this.#sheet.insertRule(`${selector} { ${css} }`) } catch (e) {}
    }

    // Inject variant rules
    for (const vb of this.#variantBlocks) {
      const variantCss = Object.entries(vb.decls)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ')
      if (!variantCss) continue
      // Build variant selector
      const variantSelector = `.${className}:${vb.variant}`
      try { this.#sheet.insertRule(`${variantSelector} { ${variantCss} }`) } catch (e) {}
    }

    this._result = { className, css }
    return this._result
  }

  /**
   * Export the class name and CSS without DOM injection (SSR-safe).
   * @returns {{ className: string, css: string }}
   *
   * @example
   * const { className, css } = css().bg('red').export()
   */
  export() {
    const className = `up-css-${++_uid}`
    const css = Object.entries(this.#decls)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ')
    return { className, css }
  }

  toString() {
    return this.done().className
  }

  valueOf() {
    return this.done().className
  }
}

// ─── Convenience chain methods ────────────────────────────────
// Dynamic property setters via Proxy for arbitrary CSS props.

/** @type {ProxyHandler<ChainBuilder>} */
const chainProxyHandler = {
  get(target, prop, receiver) {
    // If it's a real method, return it
    if (prop in target || typeof prop === 'symbol') {
      const val = Reflect.get(target, prop, receiver)
      return typeof val === 'function' ? val.bind(target) : val
    }
    // Otherwise, treat as CSS property shorthand
    // css().color('red') → css().prop('color', 'red')
    // css().bg('primary') → css().prop('background-color', ...)
    // css().px(4) → css().prop('padding-left', ...) + css().prop('padding-right', ...)
    return (...args) => {
      if (args.length === 0) return target
      const name = String(prop)

      // Shorthand expansions
      const shorthands = {
        m:  () => target.prop('margin', ...args),
        mt: () => target.prop('margin-top', ...args),
        mr: () => target.prop('margin-right', ...args),
        mb: () => target.prop('margin-bottom', ...args),
        ml: () => target.prop('margin-left', ...args),
        mx: () => { target.prop('margin-left', ...args); target.prop('margin-right', ...args) },
        my: () => { target.prop('margin-top', ...args); target.prop('margin-bottom', ...args) },
        p:  () => target.prop('padding', ...args),
        pt: () => target.prop('padding-top', ...args),
        pr: () => target.prop('padding-right', ...args),
        pb: () => target.prop('padding-bottom', ...args),
        pl: () => target.prop('padding-left', ...args),
        px: () => { target.prop('padding-left', ...args); target.prop('padding-right', ...args) },
        py: () => { target.prop('padding-top', ...args); target.prop('padding-bottom', ...args) },
        bg: () => target.prop('background-color', ...args),
        text: () => target.prop('color', ...args),
        rounded: () => target.prop('border-radius', ...args),
      }

      if (shorthands[name]) {
        shorthands[name]()
      } else {
        target.prop(name, ...args)
      }
      return receiver
    }
  }
}

/**
 * Create a proxy-wrapped chain builder that supports arbitrary
 * method calls as CSS property setters.
 *
 * @param {CSSStyleSheet} [sheet]
 * @returns {ChainBuilder & Proxy}
 *
 * @example
 *   css2().bg('red').fontSize('2rem').rounded('0.5rem').toString()
 */
export function css2(sheet) {
  return new Proxy(new ChainBuilder(sheet), chainProxyHandler)
}
