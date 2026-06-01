/**
 * CSP-safe event binding utilities.
 * Uses addEventListener instead of inline onclick handlers.
 */

const eventRegistry = new WeakMap()

/**
 * Bind events to a DOM element using the template bindings
 * @param {HTMLElement} element
 * @param {Array} bindings - Template bindings
 * @param {Object} ctx - Context with send() or direct handlers
 */
export function bindEvents(element, bindings, ctx) {
  if (!element || !bindings) return

  for (const binding of bindings) {
    if (binding.type === 'event') {
      const eventName = binding.name
      const handler = binding.value

      if (typeof handler === 'function') {
        element.addEventListener(eventName, handler)
      } else if (typeof handler === 'string') {
        // String handler name -> send to loop
        element.addEventListener(eventName, (e) => {
          if (ctx && ctx.send) {
            ctx.send(handler, e)
          }
        })
      } else if (Array.isArray(handler)) {
        // [eventName, transformFn] -> send transformed value
        const [name, transform] = handler
        element.addEventListener(eventName, (e) => {
          const payload = transform ? transform(e) : e
          if (ctx && ctx.send) {
            ctx.send(name, payload)
          }
        })
      }
    }
  }
}

/**
 * Clean up all events bound to an element
 * @param {HTMLElement} element
 */
export function unbindEvents(element) {
  // WeakMap tracks nothing extra since we use addEventListener directly
  // Each component handles its own cleanup
}
