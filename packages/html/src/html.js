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
 * @param {TemplateStringsArray} strings
 * @param {...any} values
 * @returns {Object} Template descriptor
 */
export function html(strings, ...values) {
  const parts = []
  const bindings = []

  strings.forEach((str, i) => {
    parts.push(str)

    if (i < values.length) {
      const value = values[i]
      const prevStr = str

      // Detect event binding: @click=${handler}
      const eventMatch = prevStr.match(/@(\w+)\s*=$/)
      if (eventMatch) {
        const eventName = eventMatch[1]
        const bindingIndex = bindings.length
        bindings.push({
          type: 'event',
          name: eventName,
          value,
          index: bindingIndex
        })
        parts[parts.length - 1] = prevStr.slice(0, -eventMatch[0].length) +
          `data-up-event="${eventName}:${bindingIndex}"`
        parts.push('')
        return
      }

      // Detect property binding: .value=${val}
      const propMatch = prevStr.match(/\.(\w+)\s*=$/)
      if (propMatch) {
        const propName = propMatch[1]
        const bindingIndex = bindings.length
        bindings.push({
          type: 'prop',
          name: propName,
          value,
          index: bindingIndex
        })
        parts[parts.length - 1] = prevStr.slice(0, -propMatch[0].length) +
          `data-up-prop="${propName}:${bindingIndex}"`
        parts.push('')
        return
      }

      // Detect boolean attribute: ?checked=${bool}
      const boolMatch = prevStr.match(/\?(\w+)\s*=$/)
      if (boolMatch) {
        const attrName = boolMatch[1]
        const bindingIndex = bindings.length
        bindings.push({
          type: 'bool',
          name: attrName,
          value,
          index: bindingIndex
        })
        parts[parts.length - 1] = prevStr.slice(0, -boolMatch[0].length) +
          `data-up-bool="${attrName}:${bindingIndex}"`
        parts.push('')
        return
      }

      // Text/attribute interpolation — embed value directly into template string
      let strVal
      if (value && typeof value === 'object' && 'template' in value) {
        const offset = bindings.length
        const innerBindings = value.bindings || []
        let htmlStr = value.toString()
        for (let bi = 0; bi < innerBindings.length; bi++) {
          const newIdx = offset + bi
          const oldIdx = innerBindings[bi].index
          innerBindings[bi].index = newIdx
          if (innerBindings[bi].type === 'event') {
            htmlStr = htmlStr.replace(
              new RegExp('data-up-event="' + innerBindings[bi].name + ':' + oldIdx + '"', 'g'),
              'data-up-event="' + innerBindings[bi].name + ':' + newIdx + '"'
            )
          }
          if (innerBindings[bi].type === 'prop') {
            htmlStr = htmlStr.replace(
              new RegExp('data-up-prop="' + innerBindings[bi].name + ':' + oldIdx + '"', 'g'),
              'data-up-prop="' + innerBindings[bi].name + ':' + newIdx + '"'
            )
          }
          if (innerBindings[bi].type === 'bool') {
            htmlStr = htmlStr.replace(
              new RegExp('data-up-bool="' + innerBindings[bi].name + ':' + oldIdx + '"', 'g'),
              'data-up-bool="' + innerBindings[bi].name + ':' + newIdx + '"'
            )
          }
        }
        bindings.push(...innerBindings)
        strVal = htmlStr
      } else if (Array.isArray(value)) {
        strVal = value.map(v => {
          if (v && typeof v === 'object' && 'template' in v) {
            const offset = bindings.length
            const innerBindings = v.bindings || []
            let htmlStr = v.toString()
            for (let bi = 0; bi < innerBindings.length; bi++) {
              const newIdx = offset + bi
              const oldIdx = innerBindings[bi].index
              innerBindings[bi].index = newIdx
              if (innerBindings[bi].type === 'event') {
                htmlStr = htmlStr.replace(
                  new RegExp('data-up-event="' + innerBindings[bi].name + ':' + oldIdx + '"', 'g'),
                  'data-up-event="' + innerBindings[bi].name + ':' + newIdx + '"'
                )
              }
              if (innerBindings[bi].type === 'prop') {
                htmlStr = htmlStr.replace(
                  new RegExp('data-up-prop="' + innerBindings[bi].name + ':' + oldIdx + '"', 'g'),
                  'data-up-prop="' + innerBindings[bi].name + ':' + newIdx + '"'
                )
              }
              if (innerBindings[bi].type === 'bool') {
                htmlStr = htmlStr.replace(
                  new RegExp('data-up-bool="' + innerBindings[bi].name + ':' + oldIdx + '"', 'g'),
                  'data-up-bool="' + innerBindings[bi].name + ':' + newIdx + '"'
                )
              }
            }
            bindings.push(...innerBindings)
            return htmlStr
          }
          return v === null || v === undefined ? '' : String(v)
        }).join('')
      } else {
        strVal = value === null || value === undefined ? '' : String(value)
      }
      parts[parts.length - 1] += strVal
    }
  })

  const template = parts.join('')

  return {
    template,
    bindings,
    values,
    toString: () => template,
    toJSON: () => template
  }
}

/**
 * Apply event bindings to mounted DOM by finding data-up-event markers.
 */
export function applyBindings(root, bindings, send, state) {
  if (!root || !bindings) return

  for (const binding of bindings) {
    if (binding.type === 'event') {
      const { name: eventName, value: handler, index } = binding
      const selector = `[data-up-event="${eventName}:${index}"]`
      const targets = root.querySelectorAll(selector)

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
      const { name: propName, value, index } = binding
      const targets = root.querySelectorAll(`[data-up-prop="${propName}:${index}"]`)
      for (const target of targets) {
        target.removeAttribute('data-up-prop')
        const val = typeof value === 'function' ? value(state) : value
        target[propName] = val
      }
    }

    if (binding.type === 'bool') {
      const { name: attrName, value, index } = binding
      const targets = root.querySelectorAll(`[data-up-bool="${attrName}:${index}"]`)
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
 * Check if a value is an html template descriptor
 */
export function isHtmlTemplate(val) {
  return val && typeof val === 'object' && 'template' in val && 'bindings' in val
}

// ════════════════════════════════════════════════════════════
// Uploop Attribute System — scope, context, auto-resource
// ════════════════════════════════════════════════════════════

/**
 * Post-process DOM after innerHTML + applyBindings.
 * Detects uploop-scope, provide-context, register-resource,
 * and uploop-containers attributes.
 */
export function processUploopAttributes(root, ctx) {
  if (!root) return

  // register-resource — auto-persist element across re-renders
  const resources = root.querySelectorAll('[register-resource]')
  for (const el of resources) {
    const name = el.getAttribute('register-resource')
    el.removeAttribute('register-resource')
    if (ctx.registerResource) {
      ctx.registerResource(name, {
        save: () => ({
          idx: el.parentNode ? Array.from(el.parentNode.children).indexOf(el) : -1,
          containerId: el.parentElement?.id || '',
          tag: el.tagName.toLowerCase()
        }),
        restore: (data, mountRoot) => {
          // Find the target container in current DOM (survives innerHTML)
          const container = data.containerId
            ? mountRoot.querySelector('#' + data.containerId)
            : mountRoot
          if (!container) return
          // Remove any duplicate canvas from the new innerHTML render
          const dup = container.querySelector(data.tag + '[data-up-provide]')
          if (dup && dup !== el) dup.remove()
          // Re-insert the original element
          if (!container.contains(el)) {
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

  // provide-context — mark element as context provider
  const providers = root.querySelectorAll('[provide-context]')
  for (const el of providers) {
    const name = el.getAttribute('provide-context')
    el.setAttribute('data-up-provide', name)
    el.removeAttribute('provide-context')
  }

  // uploop-scope — mark element as scope boundary
  const scopes = root.querySelectorAll('[uploop-scope]')
  for (const el of scopes) {
    const name = el.getAttribute('uploop-scope')
    el.setAttribute('data-up-scope', name)
    el.removeAttribute('uploop-scope')
  }

  // ─── Virtual Containers (capture phase) ──────────────────
  // Scans new DOM for uploop-containers and stores virtual
  // child props. Actual instance creation/update happens
  // in processVirtualContainers() after resource restore.
  const vContainers = root.querySelectorAll('[uploop-containers]')
  if (vContainers.length > 0) {
    if (!root._pendingVC) root._pendingVC = []
    for (const container of vContainers) {
      const mode = container.getAttribute('uploop-containers')
      const scopeName = container.getAttribute('uploop-scope') || container.getAttribute('data-up-scope') || ''

      container.removeAttribute('uploop-containers')
      container.setAttribute('data-up-containers', mode)

      if (mode === 'virtual' && container.tagName?.toLowerCase() === 'canvas') {
        const defs = []
        for (const childEl of Array.from(container.children)) {
          const props = {}
          for (const attr of Array.from(childEl.attributes)) {
            if (attr.name.startsWith('data-up-')) continue
            const val = attr.value
            if (val === 'true') props[attr.name] = true
            else if (val === 'false') props[attr.name] = false
            else { const n = Number(val); props[attr.name] = isNaN(n) ? val : n }
          }
          defs.push({ tag: childEl.tagName.toLowerCase(), props })
        }
        root._pendingVC.push({ scopeName, defs })
      }
    }
  }
}

/**
 * Second-pass: process virtual containers AFTER resource restore.
 * The restored canvas element is now in DOM. On first render,
 * creates component instances. On re-render, pushes new props
 * from the captured placeholder DOM attributes to existing instances.
 */
export function processVirtualContainers(root, ctx) {
  if (!root) return

  const pending = root._pendingVC || []
  if (pending.length === 0) return
  delete root._pendingVC

  const containers = root.querySelectorAll('[data-up-containers]')
  for (const container of containers) {
    const mode = container.getAttribute('data-up-containers')
    const scopeName = container.getAttribute('uploop-scope') || container.getAttribute('data-up-scope') || ''
    if (mode !== 'virtual' || container.tagName?.toLowerCase() !== 'canvas') continue

    const ctx2d = container.getContext?.('2d') || null
    const entry = pending.find(p => p.scopeName === scopeName)
    if (!entry) continue

    container.innerHTML = ''

    const existing = container._upInstances || []

    if (existing.length > 0) {
      // ── Re-render: push new props to existing instances ──
      for (let i = 0; i < existing.length && i < entry.defs.length; i++) {
        const inst = existing[i]
        const newProps = entry.defs[i]?.props
        if (inst && inst.loop && newProps) {
          const cur = inst.loop.get()
          let changed = false
          for (const [k, v] of Object.entries(newProps)) {
            if (cur[k] !== v) { changed = true; break }
          }
          if (changed) inst.loop.set({ ...cur, ...newProps })
        }
      }
      for (const inst of existing) {
        if (inst.ctx2d !== undefined && ctx2d) inst.ctx2d = ctx2d
      }
    } else {
      // ── First render: create component instances ──
      const instances = []
      for (const def of entry.defs) {
        const Comp = resolveScope(scopeName, def.tag)
        if (typeof Comp === 'function') {
          const inst = Comp(def.props)
          if (inst) {
            if (inst.ctx2d !== undefined && ctx2d) inst.ctx2d = ctx2d
            instances.push(inst)
          }
        } else {
          console.warn('[vc] component not found for tag:', def.tag, 'scope:', scopeName)
        }
      }
      container._upInstances = instances

      // Register canvas as persistent resource
      if (ctx.registerResource) {
        ctx.registerResource(`vc-canvas:${scopeName}`, {
          save: () => ({
            idx: container.parentNode ? Array.from(container.parentNode.children).indexOf(container) : -1,
            containerId: container.parentElement?.id || '',
            tag: container.tagName.toLowerCase()
          }),
          restore: (data, mountRoot) => {
            const target = data.containerId
              ? mountRoot.querySelector('#' + data.containerId)
              : mountRoot
            if (!target) return
            const dup = target.querySelector(data.tag + '[data-up-containers]')
            if (dup && dup !== container) dup.remove()
            if (!target.contains(container)) {
              if (data.idx >= 0 && data.idx < target.children.length) {
                target.insertBefore(container, target.children[data.idx])
              } else {
                target.appendChild(container)
              }
            }
            const freshCtx = container.getContext?.('2d')
            for (const inst of (container._upInstances || [])) {
              if (inst.ctx2d !== undefined && freshCtx) inst.ctx2d = freshCtx
            }
          }
        })
      }
    }
  }
}

/**
 * Walk up DOM to find nearest context provider, then search
 * descendants of the root if not found among ancestors.
 * `<canvas provide-context="canvas-context">` → { el, width, height, ctx2d }
 */
export function consumeContext(el, name) {
  // Search ancestors first
  let current = el
  while (current) {
    if (current.getAttribute?.('data-up-provide') === name) return resolveContext(current)
    current = current.parentElement
  }
  // Then search descendants (the common case — canvas is child of component root)
  if (el.querySelector) {
    const provider = el.querySelector(`[data-up-provide="${name}"]`)
    if (provider) return resolveContext(provider)
  }
  return null
}

function resolveContext(el) {
  if (el.tagName?.toLowerCase() === 'canvas') {
    return { el, width: el.width, height: el.height, ctx2d: el.getContext?.('2d') || null }
  }
  return { el }
}

/** Resolve component class from a named scope registry on document. */
export function resolveScope(scopeName, tagName) {
  if (typeof document === 'undefined') return null
  const reg = document.__uploop_scopes || (document.__uploop_scopes = {})
  return reg[scopeName]?.[tagName] || null
}

/** Register component classes in a named scope. */
export function registerScope(scopeName, classes) {
  if (typeof document === 'undefined') return
  const reg = document.__uploop_scopes || (document.__uploop_scopes = {})
  if (!reg[scopeName]) reg[scopeName] = {}
  Object.assign(reg[scopeName], classes)
}

// ════════════════════════════════════════════════════════════
// componentTag — JSX-like tagged template for compose()
// ════════════════════════════════════════════════════════════

export function componentTag(classes = {}) {
  const tag = (strings, ...values) => {
    let raw = ''
    for (let i = 0; i < strings.length; i++) {
      raw += strings[i]
      if (i < values.length) raw += '\x00' + i + '\x00'
    }

    let Cls, attrStr

    // Case 1: <Wheel .../> — literal tag, lookup from classes
    const tagMatch = raw.match(/^\s*<(\w+)([^>]*?)\s*\/>\s*$/s)
    if (tagMatch) {
      Cls = classes[tagMatch[1]]
      if (!Cls) return null
      attrStr = tagMatch[2] || ''
    } else {
      // Case 2: <${Class} .../> — dynamic class in tag position
      const dynMatch = raw.match(/^\s*<\x00(\d+)\x00([^>]*?)\s*\/>\s*$/s)
      if (dynMatch) {
        const clsIdx = parseInt(dynMatch[1])
        if (clsIdx < values.length && typeof values[clsIdx] === 'function') {
          Cls = values[clsIdx]
          attrStr = dynMatch[2] || ''
        } else { return null }
      } else { return null }
    }

    // Parse attributes
    const props = {}
    if (attrStr) {
      const attrRe = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\x00(\d+)\x00)/g
      let m
      while ((m = attrRe.exec(attrStr))) {
        const key = m[1]
        if (m[2] !== undefined) { const n = Number(m[2]); props[key] = isNaN(n) ? m[2] : n }
        else if (m[3] !== undefined) { const n = Number(m[3]); props[key] = isNaN(n) ? m[3] : n }
        else if (m[4] !== undefined) {
          const idx = parseInt(m[4])
          props[key] = idx < values.length ? values[idx] : undefined
        }
      }
      const boolRe = /(\w+)(?=\s|$|\/>)/g
      const bare = attrStr.replace(/\w+\s*=\s*(?:"[^"]*"|'[^']*'|\x00\d+\x00)/g, '')
      let bm
      while ((bm = boolRe.exec(bare))) {
        if (!(bm[1] in props)) props[bm[1]] = true
      }
    }

    return Cls(props)
  }
  return tag
}
