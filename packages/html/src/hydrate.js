/**
 * SSR hydration for Uploop components.
 * Reattaches event listeners to pre-rendered HTML.
 *
 * @param {HTMLElement} root - Root element to hydrate
 * @param {Object} components - Map of component names to descriptors
 */
export function hydrate(root, components) {
  // For each component, find its DOM elements and re-attach
  for (const [name, compDesc] of Object.entries(components)) {
    const selector = `[data-up-component="${name}"]`
    const elements = root.querySelectorAll(selector)

    for (const el of elements) {
      // Re-mount the component to the existing DOM
      const props = {}
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-up-prop-')) {
          const key = attr.name.replace('data-up-prop-', '')
          props[key] = attr.value
        }
      }
      const instance = compDesc.create(props)
      instance.mount(el)
    }
  }
}
