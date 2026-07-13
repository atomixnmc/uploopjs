/**
 * Minimal DOM patching utilities.
 * Not a full virtual DOM — just enough to efficiently update
 * the rendered output of a component.
 */

/**
 * Create DOM nodes from an HTML string
 * @param {string} htmlStr
 * @returns {DocumentFragment}
 */
export function createDOM(htmlStr) {
  const template = document.createElement('template')
  template.innerHTML = htmlStr.trim()
  return template.content
}

/**
 * Patch an element's content with new HTML.
 * Uses innerHTML for now (can be optimized later with morphdom/idiomorph).
 *
 * @param {HTMLElement} element - Target element
 * @param {string} htmlStr - New HTML content
 */
export function patchDOM(element, htmlStr) {
  if (!element || !htmlStr) return
  element.innerHTML = htmlStr
}

/**
 * Apply property bindings to DOM elements.
 * Supports .prop=${value} syntax.
 *
 * @param {HTMLElement} root - Root element to search from
 * @param {Array} bindings - Template bindings
 * @param {Object} state - Current state values
 */
export function applyPropBindings(root, bindings, state) {
  if (!root || !bindings) return

  // Walk all elements and apply property bindings
  const elements = root.querySelectorAll('*')
  for (const binding of bindings) {
    if (binding.type === 'prop') {
      // Find elements with data-up-prop attribute (set during render)
      const selector = `[data-up-prop="${binding.name}"]`
      const el = root.querySelector(selector) || root
      const val = typeof binding.value === 'function' ? binding.value(state) : binding.value
      el[binding.name] = val
    }
    if (binding.type === 'bool') {
      const selector = `[data-up-bool="${binding.name}"]`
      const el = root.querySelector(selector) || root
      const val = typeof binding.value === 'function' ? binding.value(state) : binding.value
      if (val) {
        el.setAttribute(binding.name, '')
      } else {
        el.removeAttribute(binding.name)
      }
    }
  }
}
