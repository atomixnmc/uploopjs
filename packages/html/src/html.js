/**
 * HTML template literal tag.
 * Returns a template descriptor that the DOM adapter can render.
 *
 * Features:
 * - `${value}` text/attribute interpolation
 * - `@click=${handler}` CSP-safe event binding (data-up-event marker)
 * - `.value=${val}` property binding (data-up-prop marker)
 * - `?checked=${bool}` boolean attribute binding (data-up-bool marker)
 *
 * Bindings use globally unique IDs (not position-based indices), so
 * nested templates never need index remapping — no regex string munging.
 */

// ─── Global state ────────────────────────────────────────────

const _componentRegistry = {}
let _bindIdCounter = 0

function nextBindId() {
  return 'b' + (++_bindIdCounter)
}

export function registerComponent(name, comp) {
  _componentRegistry[name] = comp
}

export function html(strings, ...values) {
  const parts = []
  const bindings = []

  strings.forEach((str, i) => {
    parts.push(str)

    if (i < values.length) {
      const value = values[i]
      const prevStr = str

      // ── Event binding: @click=${handler} ──────────────────
      const eventMatch = prevStr.match(/@(\w+)\s*=$/)
      if (eventMatch) {
        const eventName = eventMatch[1]
        const id = nextBindId()
        bindings.push({ type: 'event', name: eventName, value, id })
        parts[parts.length - 1] = prevStr.slice(0, -eventMatch[0].length) +
          `data-up-event="${eventName}:${id}"`
        parts.push('')
        return
      }

      // ── Property binding: .value=${val} ───────────────────
      const propMatch = prevStr.match(/\.(\w+)\s*=$/)
      if (propMatch) {
        const propName = propMatch[1]
        const id = nextBindId()
        bindings.push({ type: 'prop', name: propName, value, id })
        parts[parts.length - 1] = prevStr.slice(0, -propMatch[0].length) +
          `data-up-prop="${propName}:${id}"`
        parts.push('')
        return
      }

      // ── Boolean attribute: ?checked=${bool} ───────────────
      const boolMatch = prevStr.match(/\?(\w+)\s*=$/)
      if (boolMatch) {
        const attrName = boolMatch[1]
        const id = nextBindId()
        bindings.push({ type: 'bool', name: attrName, value, id })
        parts[parts.length - 1] = prevStr.slice(0, -boolMatch[0].length) +
          `data-up-bool="${attrName}:${id}"`
        parts.push('')
        return
      }

      // ── Template object interpolation ─────────────────────
      let strVal
      if (value && typeof value === 'object' && 'template' in value) {
        // Nested template — merge bindings directly (IDs already globally unique)
        const innerBindings = value.bindings || []
        bindings.push(...innerBindings)
        strVal = value.toString()
      } else if (Array.isArray(value)) {
        // Array of templates/nodes — merge bindings + join HTML
        strVal = value.map(v => {
          if (v && typeof v === 'object' && 'template' in v) {
            bindings.push(...(v.bindings || []))
            return v.toString()
          }
          return v === null || v === undefined ? '' : String(v)
        }).join('')
      } else {
        strVal = value === null || value === undefined ? '' : String(value)
      }
      parts.push(strVal)
    }
  })

  let template = parts.join('')

  // Post-process: resolve PascalCase component tags from registry
  const pascalRe = /<([A-Z]\w*)\s*([^>]*)\/>/g
  let pm
  while ((pm = pascalRe.exec(template))) {
    const tagName = pm[1]
    const comp = _componentRegistry[tagName]
    if (!comp) continue
    const props = {}
    const attrStr = pm[2].trim()
    const attrRe = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\x00(\d+)\x00)/g
    let am
    while ((am = attrRe.exec(attrStr))) {
      const key = am[1]
      let n = am[2] ?? am[4]
      if (n === 'true') { props[key] = true }
      else if (n === 'false') { props[key] = false }
      else if (!isNaN(Number(n)) && am[4]) { props[key] = Number(n) }
      else { props[key] = n ?? am[3] ?? '' }
    }
    const inst = comp(props)
    const rendered = String(inst)
    template = template.replace(pm[0], rendered)
  }

  // Post-process: resolve data-up placeholder attributes
  // (Previously done via regex remapping — now handled by componentTag)
  template = componentTag(template)

  return {
    template,
    bindings,
    toString() { return template },
    toJSON() { return template }
  }
}

/**
 * Apply event/prop/bool bindings from a template descriptor to DOM elements.
 * Uses globally unique binding IDs — no index-based lookup needed.
 */
export function applyBindings(root, bindings, send, state) {
  if (!root || !bindings) return

  for (const binding of bindings) {
    if (binding.type === 'event') {
      const { name: eventName, value: handler, id } = binding
      const targets = root.querySelectorAll(`[data-up-event="${eventName}:${id}"]`)
      for (const target of targets) {
        target.removeAttribute('data-up-event')
        const useSend = binding._ownerSend || send
        if (typeof handler === 'function') {
          target.addEventListener(eventName, handler)
        } else if (typeof handler === 'string') {
          target.addEventListener(eventName, (e) => { if (useSend) useSend(handler, e) })
        } else if (Array.isArray(handler)) {
          const [name, transform] = handler
          target.addEventListener(eventName, (e) => {
            const payload = transform ? transform(e) : e
            if (useSend) useSend(name, payload)
          })
        }
      }
    }

    if (binding.type === 'prop') {
      const { name: propName, value, id } = binding
      const targets = root.querySelectorAll(`[data-up-prop="${propName}:${id}"]`)
      for (const target of targets) {
        target.removeAttribute('data-up-prop')
        const val = typeof value === 'function' ? value(state) : value
        target[propName] = val
      }
    }

    if (binding.type === 'bool') {
      const { name: attrName, value, id } = binding
      const targets = root.querySelectorAll(`[data-up-bool="${attrName}:${id}"]`)
      for (const target of targets) {
        target.removeAttribute('data-up-bool')
        const val = typeof value === 'function' ? value(state) : value
        if (val) target.setAttribute(attrName, '')
        else target.removeAttribute(attrName)
      }
    }
  }
}

/**
 * Check if a value is an html template descriptor.
 */
export function isHtmlTemplate(value) {
  return value && typeof value === 'object' && 'template' in value
}

/**
 * Process Uploop-specific DOM attributes on a root element.
 * Returns pending virtual container data (no DOM side-channel).
 */
export function processUploopAttributes(root, ctx) {
  if (!root) return []

  const resources = root.querySelectorAll('[register-resource]')
  for (const el of resources) {
    const name = el.getAttribute('register-resource') || el.id
    el.removeAttribute('register-resource')
    if (ctx && ctx.registerResource) {
      ctx.registerResource(name, {
        save() {
          return {
            idx: [...el.parentElement.children].indexOf(el),
            containerId: el.parentElement?.id || '',
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            html: el.innerHTML
          }
        },
        restore(data, rootEl) {
          if (!data) return
          const container = data.containerId
            ? rootEl?.querySelector?.('#' + data.containerId)
            : rootEl
          if (!container) return
          // Find duplicate and replace with the preserved element
          let dup = data.tag && data.id
            ? container.querySelector(data.tag + '#' + data.id)
            : null
          if (dup && dup !== el && dup.parentNode) {
            dup.parentNode.replaceChild(el, dup)
          } else if (!container.contains(el)) {
            if (data.idx >= 0 && data.idx < container.children.length) {
              container.insertBefore(el, container.children[data.idx])
            } else {
              container.appendChild(el)
            }
          }
        }
      })
    }
  }

  // Process data-up-provide attributes
  const providers = root.querySelectorAll('[data-up-provide]')
  for (const el of providers) {
    const name = el.getAttribute('data-up-provide')
    if (name && ctx) {
      ctx[name] = ctx[name] || (() => el)
    }
  }

  // Collect pending virtual container definitions (no DOM side-channel)
  const pendingVC = []
  const vContainers = root.querySelectorAll('[uploop-containers]')
  for (const container of vContainers) {
    const mode = container.getAttribute('uploop-containers')
    const scopeName = container.getAttribute('uploop-scope') || container.getAttribute('data-up-scope') || ''
    container.removeAttribute('uploop-containers')
    container.setAttribute('data-up-containers', mode)
    if (mode === 'virtual' && container.tagName?.toLowerCase() === 'canvas') {
      const defs = []
      for (const childEl of container.children) {
        const props = {}
        for (const attr of childEl.attributes) {
          const n = attr.value
          const val = n === 'true' ? true : n === 'false' ? false : (!isNaN(Number(n)) ? Number(n) : n)
          props[attr.name] = val
        }
        defs.push({ tag: childEl.tagName.toLowerCase(), props })
      }
      pendingVC.push({ scopeName, defs })
    }
  }

  return pendingVC
}

/**
 * Hydrate virtual container instances from pending definitions.
 */
export function processVirtualContainers(root, ctx, pendingVC = []) {
  if (!root) return

  const containers = root.querySelectorAll('[data-up-containers]')
  if (containers.length === 0) return

  // Process each pending definition against each container
  let vcIdx = 0
  for (const container of containers) {
    const mode = container.getAttribute('data-up-containers')
    // Read scope from uploop-scope attribute set on canvas
    const scopeAttr = container.getAttribute('uploop-scope') || container.getAttribute('data-up-scope') || ''
    container.removeAttribute('data-up-containers')

    if (mode === 'virtual' && container.tagName?.toLowerCase() === 'canvas') {
      const ctx2d = container.getContext('2d')

      // Match pending definitions by scope name
      const pendingForContainer = pendingVC.filter(p => p.scopeName === scopeAttr)

      for (const entry of pendingForContainer) {
        const existing = entry._instances || []
        const instances = [...existing]

        for (const def of entry.defs) {
          const existingInst = existing.find(i =>
            i.constructor && (i.constructor.name === def.tag || i.constructor.name?.toLowerCase() === def.tag))

          if (existingInst && ctx2d) {
            const newProps = def.props
            const cur = existingInst.loop?.get()
            let changed = false
            for (const [k, v] of Object.entries(newProps)) {
              if (cur && cur[k] !== v) { changed = true; break }
            }
            if (changed && existingInst.loop) {
              existingInst.loop.set({ ...cur, ...newProps })
            }
            existingInst.ctx2d = ctx2d
            if (existingInst.startFrameLoop) existingInst.startFrameLoop(container)
          } else {
            const scope = ctx?.scope || resolveScope(scopeAttr)
            const Comp = scope ? scope[def.tag] : null
            if (Comp) {
              const inst = Comp({ ...def.props, w: Number(container.getAttribute('width') || 700), h: Number(container.getAttribute('height') || 300) })
              if (ctx2d) inst.ctx2d = ctx2d
              if (inst.startFrameLoop) inst.startFrameLoop(container)
              instances.push(inst)
            }
          }
        }

        entry._instances = instances
      }
    }
  }
}

// ─── Scope registry ─────────────────────────────────────────

let _scopeRegistry = null

export function resolveScope(name) {
  if (!name) return null
  if (typeof document !== 'undefined') {
    const reg = document.__uploop_scopes
    return reg ? reg[name] : null
  }
  return _scopeRegistry ? _scopeRegistry[name] : null
}

export function registerScope(scopeName, classes) {
  if (typeof document !== 'undefined') {
    const reg = document.__uploop_scopes || (document.__uploop_scopes = {})
    if (!reg[scopeName]) reg[scopeName] = {}
    Object.assign(reg[scopeName], classes)
  } else {
    if (!_scopeRegistry) _scopeRegistry = {}
    if (!_scopeRegistry[scopeName]) _scopeRegistry[scopeName] = {}
    Object.assign(_scopeRegistry[scopeName], classes)
  }
}

// ─── Component tag parsing ──────────────────────────────────

export function componentTag(template) {
  const tagRe = /<([\w-]+)\s*([^>]*)\/>/g
  let result = template
  let m
  while ((m = tagRe.exec(template))) {
    const tagName = m[1]
    const attrStr = m[2].trim()
    const props = {}
    const attrRe = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\x00(\d+)\x00)/g
    let am
    while ((am = attrRe.exec(attrStr))) {
      const key = am[1]
      let val = am[2] ?? am[4]
      if (val === 'true') props[key] = true
      else if (val === 'false') props[key] = false
      else if (!isNaN(Number(val)) && am[4]) props[key] = Number(val)
      else props[key] = val ?? am[3] ?? ''
    }
  }
  return result
}

export { consumeContext, resolveContext }
function consumeContext(root, name) {
  let current = root
  while (current) {
    const provider = current.getAttribute?.('data-up-provide')
    if (provider === name) return current
    current = current.parentElement
  }
  return null
}
function resolveContext(data) { return data }
