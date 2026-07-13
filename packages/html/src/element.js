import { component } from './component.js'

const definedElements = new Map()

/**
 * Define a WebComponent from an Uploop component descriptor.
 *
 * @param {string} tagName - Custom element tag (must contain hyphen)
 * @param {Object} compDesc - Component descriptor from component()
 * @param {Object} [options]
 * @param {boolean} [options.useShadowDOM=true] - Use Shadow DOM
 * @returns {Object} Component descriptor (same object)
 */
export function defineElement(tagName, compDesc, options = {}) {
  const { useShadowDOM = true } = options

  // SSR guard: HTMLElement may not exist (Node.js)
  if (typeof HTMLElement === 'undefined') return compDesc

  if (definedElements.has(tagName)) {
    console.warn(`Element "${tagName}" already defined, skipping`)
    return compDesc
  }

  // Validate tag name
  if (!tagName.includes('-')) {
    throw new Error(`Custom element tag "${tagName}" must contain a hyphen`)
  }

  // Create the WebComponent class
  class UploopElement extends HTMLElement {
    constructor() {
      super()

      if (useShadowDOM) {
        this.attachShadow({ mode: 'open' })
      }

      this._unmount = null
      this._props = {}
    }

    connectedCallback() {
      // Read attributes as props
      const props = {}
      for (const attr of this.attributes) {
        if (attr.name.startsWith('data-')) {
          const key = attr.name.replace('data-', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())
          props[key] = attr.value
        } else if (attr.name === 'props') {
          try {
            Object.assign(props, JSON.parse(attr.value))
          } catch (e) {
            console.warn(`Invalid props JSON on <${tagName}>:`, attr.value)
          }
        }
      }

      this._props = props

      // Create a fresh instance for this element
      const instance = compDesc.create(props)
      this._instance = instance

      // Mount to shadow root or self
      const root = useShadowDOM ? this.shadowRoot : this
      instance.mount(root)
    }

    disconnectedCallback() {
      if (this._unmount) {
        this._unmount()
        this._unmount = null
      }
    }

    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal === newVal) return
      this._props[name.replace('data-', '')] = newVal
    }

    static get observedAttributes() {
      return []
    }
  }

  customElements.define(tagName, UploopElement)
  definedElements.set(tagName, UploopElement)

  // Add a static helper to create tag strings
  compDesc.tag = (props = {}) => {
    const attrStr = Object.entries(props)
      .map(([k, v]) => `data-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}="${v}"`)
      .join(' ')
    return `<${tagName} ${attrStr}></${tagName}>`
  }

  return compDesc
}
