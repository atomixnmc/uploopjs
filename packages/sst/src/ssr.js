/**
 * Server-Side Rendering for Uploop components.
 *
 * Renders a component or instance to an HTML string on the server.
 *
 *   import { renderToString } from '@uploop/sst'
 *   const html = renderToString(Counter, { count: 5 })
 */

/**
 * Render a component to an HTML string.
 *
 * Works with or without an execution target on the component.
 * If the component has no execution target (SSR-only usage),
 * it directly calls the view function with the given state.
 *
 * @param {Function|Object} Comp - Component descriptor or instance
 * @param {Object} [props={}] - Initial state
 * @returns {string} HTML string
 */
export function renderToString(Comp, props = {}) {
  // Component descriptor with view function
  if (Comp && typeof Comp.view === 'function') {
    const state = { ...(Comp._initialState || {}), ...props }
    const result = Comp.view(state, { send: Comp.loop?.send || (() => {}) })
    return typeof result === 'string' ? result : String(result)
  }

  // Component descriptor with create/mount and execution target
  if (Comp && typeof Comp.create === 'function') {
    const inst = Comp.create(props)
    const target = { _html: '', setAttribute() {}, removeAttribute() {}, querySelector() { return null } }
    inst.mount(target)
    if (target._html) return target._html
    // Fallback: render view directly
    const state = inst.loop.get()
    if (typeof Comp.view === 'function') {
      const result = Comp.view(state, { send: inst.loop.send })
      return typeof result === 'string' ? result : String(result)
    }
    // Instance with render method
    if (typeof inst.render === 'function') {
      return inst.render(state)
    }
    return ''
  }

  // Instance with render
  if (Comp && typeof Comp.render === 'function') {
    return Comp.render(props)
  }

  // Plain string
  if (typeof Comp === 'string') return Comp
  return String(Comp)
}
