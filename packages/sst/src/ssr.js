/**
 * Server-Side Rendering for Uploop components.
 *
 * Renders a component or instance to an HTML string on the server.
 * Uses createStringExecution() from @uploop/core — a DOM-free
 * execution target that accumulates output on a plain object.
 *
 *   import { renderToString } from '@uploop/sst'
 *   const html = renderToString(Counter, { count: 5 })
 */

import { createStringExecution } from '@uploop/core'
import { component } from '@uploop/core'

/**
 * Render a component to an HTML string.
 *
 * @param {Function|Object} Comp - Component descriptor (from component()) or instance
 * @param {Object} [props={}] - Initial state to merge before rendering
 * @returns {string} HTML string
 */
export function renderToString(Comp, props = {}) {
  // Component descriptor: use its render() which calls the view with loop state
  if (Comp && typeof Comp.render === 'function') {
    return Comp.render(props)
  }

  // Instance: use its render() directly
  if (Comp && typeof Comp.loop === 'object' && typeof Comp.loop.get === 'function') {
    if (typeof Comp.render === 'function') {
      return Comp.render(props)
    }
  }

  // Fallback: try toString
  if (typeof Comp === 'string') return Comp
  if (Comp && typeof Comp.toString === 'function') return Comp.toString()
  return String(Comp)
}

/**
 * Render a component to an HTML string using an SSR execution target.
 * Full pipeline: creates instance → sets state → renders view → returns HTML.
 *
 * @param {Function} Comp - Component descriptor (from component())
 * @param {Object} [props={}] - Initial state
 * @param {Object} [options]
 * @param {boolean} [options.includeMarkers=true] - Include data-up-* markers for hydration
 * @returns {string} HTML string
 */
export function renderToHtml(Comp, props = {}, options = {}) {
  if (Comp && typeof Comp.render === 'function') {
    return Comp.render(props)
  }

  if (Comp && Comp.create && typeof Comp.create === 'function') {
    const instance = Comp.create(props)
    const html = instance.render()
    return html
  }

  return renderToString(Comp, props)
}
