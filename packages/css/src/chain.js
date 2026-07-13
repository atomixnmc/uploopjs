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

  constructor(sheet) {
    this.#sheet = sheet || getSheet()
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
   * Build and inject the CSS class.
   * Called automatically by toString(), but can be called explicitly.
   * @returns {{ className: string, css: string }}
   */
  done() {
    if (this._result) return this._result
    const className = `up-css-${++_uid}`
    const css = Object.entries(this.#decls)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ')
    if (this.#sheet) {
      try { this.#sheet.insertRule(`.${className} { ${css} }`) } catch (e) {}
    }
    this._result = { className, css }
    return this._result
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
      return target
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
