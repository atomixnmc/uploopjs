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
// ════════════════════════════════════════════════════════════
// Component Registry — for resolving PascalCase tags in html()
// ════════════════════════════════════════════════════════════

const _componentRegistry = {}

// Per-render binding ID counter — starts fresh each html() call.
// Nested template descriptors get their IDs relabeled on merge
// so there are zero collisions without module-level state.

export function registerComponent(name, comp) {
  _componentRegistry[name] = comp
}

// ════════════════════════════════════════════════════════════
// Single-pass character scanners (no regex)
// ════════════════════════════════════════════════════════════

const $SPACE = 32   // ' '
const $TAB = 9      // '\t'
const $CR = 13      // '\r'
const $NL = 10      // '\n'
const $EQ = 61      // '='
const $LT = 60      // '<'
const $GT = 62      // '>'
const $SLASH = 47   // '/'
const $AT = 64      // '@'
const $DOT = 46     // '.'
const $QM = 63      // '?'
const $CLN = 58     // ':'
const $DQ = 34      // '"'
const $SQ = 39      // "'"
const $A = 65       // 'A'
const $Z = 90       // 'Z'
const $a = 97       // 'a'
const $z = 122      // 'z'
const $0 = 48       // '0'
const $9 = 57       // '9'
const $_ = 95       // '_'

function isSpace(c) { return c === $SPACE || c === $TAB || c === $CR || c === $NL }
function isWord(c) { return (c >= $a && c <= $z) || (c >= $A && c <= $Z) || (c >= $0 && c <= $9) || c === $_ }
function isUpper(c) { return c >= $A && c <= $Z }

/**
 * Check if a static string ends inside a quoted HTML attribute value.
 * Used to decide whether text markers are safe (text content) or would
 * corrupt attribute values (style, class, SVG paths, aria-label, etc.).
 *
 * Returns true if the last unescaped quote in `str` opens an attribute
 * that hasn't been closed — meaning any interpolation here is inside
 * an attribute value.
 *
 * @param {string} str — the static prefix before an interpolation
 * @returns {boolean}
 */
function isInsideAttribute(str) {
  let inDouble = false
  let inSingle = false
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c === 92 /* \ */) { i++; continue } // skip escaped char
    if (c === 34 /* " */ && !inSingle) inDouble = !inDouble
    else if (c === 39 /* ' */ && !inDouble) inSingle = !inSingle
  }
  return inDouble || inSingle
}

/**
 * Detect a binding suffix at the end of a static string part
 * (the text immediately before `${...}` in the template literal).
 *
 * Patterns detected:
 *   @eventName  =$   → event binding
 *   .propName   =$   → property binding
 *   ?attrName   =$   → boolean binding
 *
 * Returns { type, name, prefix, marker } or null.
 * - prefix: everything in `str` before the binding pattern
 * - marker: opening of the data-up-* attribute, e.g. `data-up-event="click:`
 */
function detectBindingSuffix(str) {
  let end = str.length - 1
  // Skip trailing whitespace
  while (end >= 0 && isSpace(str.charCodeAt(end))) end--
  if (end < 0 || str.charCodeAt(end) !== $EQ) return null

  // end is at '=' — skip whitespace between name and '='
  let eqPos = end
  end = eqPos - 1
  while (end >= 0 && isSpace(str.charCodeAt(end))) end--
  if (end < 0) return null

  // Walk backward over word chars (the binding name)
  const c = str.charCodeAt(end)
  if (!isWord(c)) return null

  let nameEnd = end
  while (end >= 0 && isWord(str.charCodeAt(end))) end--

  // end is at the char before the name, or -1
  if (end < 0) return null

  const prefixChar = str.charCodeAt(end)
  let type, marker

  if (prefixChar === $AT) { type = 'event'; marker = 'data-up-event="' }
  else if (prefixChar === $DOT) { type = 'prop';  marker = 'data-up-prop="' }
  else if (prefixChar === $QM)  { type = 'bool';  marker = 'data-up-bool="' }
  else if (prefixChar === $CLN) { type = 'attr';  marker = 'data-up-attr="' }
  else return null

  const name = str.slice(end + 1, nameEnd + 1)
  const prefix = str.slice(0, end)

  return { type, name, prefix, marker }
}

/**
 * Parse HTML-attribute syntax from a string into a flat props object.
 * Handles: key="val", key='val', bare-boolean-key
 * No regex — walks the string character by character.
 */
function parseAttrs(attrStr) {
  const props = {}
  let i = 0
  const len = attrStr.length

  while (i < len) {
    // Skip whitespace
    while (i < len && isSpace(attrStr.charCodeAt(i))) i++
    if (i >= len) break

    // Skip HTML comments <!-- ... -->
    if (i + 3 < len && attrStr[i] === '<' && attrStr[i+1] === '!' && attrStr[i+2] === '-' && attrStr[i+3] === '-') {
      i += 4
      while (i + 2 < len && !(attrStr[i] === '-' && attrStr[i+1] === '-' && attrStr[i+2] === '>')) i++
      i += 3 // skip -->
      continue
    }

    // Read key (word chars)
    const keyStart = i
    while (i < len && isWord(attrStr.charCodeAt(i))) i++
    const key = attrStr.slice(keyStart, i)
    if (!key) { i++; continue }

    // Optional whitespace before '='
    while (i < len && isSpace(attrStr.charCodeAt(i))) i++

    if (i < len && attrStr.charCodeAt(i) === $EQ) {
      i++ // skip '='
      while (i < len && isSpace(attrStr.charCodeAt(i))) i++

      if (i < len) {
        const quote = attrStr.charCodeAt(i)
        if (quote === $DQ || quote === $SQ) {
          i++ // skip opening quote
          const valStart = i
          while (i < len && attrStr.charCodeAt(i) !== quote) i++
          const val = attrStr.slice(valStart, i)
          i++ // skip closing quote
          const n = Number(val)
          props[key] = isNaN(n) ? val : n
        }
      }
    } else {
      // Boolean (bare) attribute
      props[key] = true
    }
  }
  return props
}

/**
 * Find and resolve PascalCase component tags in a static string.
 * Scans character by character for `<Uppercase.../>` patterns,
 * looks up the component registry, and replaces with rendered output.
 * Returns the string with all known component tags resolved.
 */
export function resolvePascalTags(str) {
  let result = ''
  let i = 0
  const len = str.length

  while (i < len) {
    // Find next '<'
    const lt = str.indexOf('<', i)
    if (lt === -1) {
      result += str.slice(i)
      break
    }
    result += str.slice(i, lt)
    i = lt + 1
    if (i >= len) { result += '<'; break }

    // Skip HTML comments <!-- ... -->
    if (i + 2 < len && str[i] === '!' && str[i+1] === '-' && str[i+2] === '-') {
      const commentEnd = str.indexOf('-->', i + 3)
      if (commentEnd !== -1) {
        i = commentEnd + 3
        continue
      }
      result += '<'
      continue
    }

    // Check for PascalCase: first char must be A-Z
    if (!isUpper(str.charCodeAt(i))) {
      result += '<'
      continue
    }

    // Read tag name (word chars)
    const tagStart = i
    while (i < len && isWord(str.charCodeAt(i))) i++
    const tagName = str.slice(tagStart, i)
    if (!tagName) { result += '<'; continue }

    const comp = _componentRegistry[tagName]
    if (!comp) {
      // Not a registered component — restore what we consumed
      result += '<' + tagName
      continue
    }

    // Skip whitespace, then find '/>'
    while (i < len && isSpace(str.charCodeAt(i))) i++
    const close = str.indexOf('/>', i)
    if (close === -1) {
      // No closing '/>' — not a self-closing tag, restore
      result += '<' + tagName + str.slice(tagStart + tagName.length, i)
      continue
    }

    // Parse attributes between tag name + whitespace and '/>'
    const attrStr = str.slice(i, close)
    const props = parseAttrs(attrStr)

    // Skip past '/>'
    i = close + 2

    // Create component instance and render
    try {
      if (typeof comp.create === 'function') {
        const inst = comp.create(props)
        const rendered = inst.render()
        result += rendered
      }
    } catch (e) {
      console.warn('[Uploop] failed to render component "' + tagName + '":', e)
    }
  }

  return result
}

/**
 * Resolve a template value to a string, merging nested template bindings.
 */
function isLoopValue(value) {
  return !!(value && typeof value === 'object' && value.__uploopLoop === true)
}

function resolveValue(value, bindings, idOffset, graphParts) {
  if (isLoopValue(value)) {
    const id = 'b' + (++idOffset.count)
    const entries = value.entries || []
    if (graphParts) {
      graphParts.push({
        id,
        type: 'loop',
        keyed: value.keyed,
        keys: value.keys || [],
        length: entries.length
      })
    }

    let html = ''
    for (const entry of entries) {
      html += resolveValue(entry.view, bindings, idOffset, graphParts)
    }
    return html
  }
  if (value && typeof value === 'object' && 'template' in value && 'bindings' in value) {
    // Nested template descriptor — relabel its binding IDs to avoid collisions
    const nestedBindings = value.bindings || []
    if (nestedBindings.length > 0) {
      const oldToNew = new Map()
      for (const b of nestedBindings) {
        const oldId = b.id
        const newId = 'b' + (++idOffset.count)
        oldToNew.set(oldId, newId)
        b.id = newId
      }
      bindings.push(...nestedBindings)
      // Rewrite IDs in the nested template HTML.
      // Two-phase replacement to prevent cascading:
      //   b1→b2 then b2→b3 would turn original b1 into b3.
      //   Phase 1 replaces with temp markers, Phase 2 unwraps them.
      let html = value.toString()
      const TEMP = '\x00'
      for (const [oldId, newId] of oldToNew) {
        const search = ':' + oldId + '"'
        const marker = ':' + TEMP + newId + TEMP + '"'
        html = html.split(search).join(marker)
      }
      for (const [, newId] of oldToNew) {
        const marker = ':' + TEMP + newId + TEMP + '"'
        const final = ':' + newId + '"'
        html = html.split(marker).join(final)
      }
      return html
    }
    bindings.push(...nestedBindings)
    return value.toString()
  }

  if (Array.isArray(value)) {
    let str = ''
    for (const v of value) {
      if (v && typeof v === 'object' && 'template' in v && 'bindings' in v) {
        str += resolveValue(v, bindings, idOffset, graphParts)
      } else {
        str += v === null || v === undefined ? '' : String(v)
      }
    }
    return str
  }

  return value === null || value === undefined ? '' : String(value)
}

// ════════════════════════════════════════════════════════════
// html() — single-pass template parser (no regex)
// ════════════════════════════════════════════════════════════

export function html(strings, ...values) {
  const bindings = []
  // Per-call ID counter — nested templates get relabeled, so no
  // module-level state is needed for collision-free IDs.
  const idOffset = { count: 0 }
  const fragments = []

  // Accumulated static prefix across all parts — needed so
  // isInsideAttribute can track quote state across multi-interpolation
  // attributes like style="width:${a}px;height:${b}px"
  let _accPrefix = ''

  // Metadata describing each dynamic position for incremental patching
  const parts = []
  const graphParts = []

  for (let i = 0; i < strings.length; i++) {
    let str = strings[i]
    _accPrefix += str

    if (i < values.length) {
      const value = values[i]

      // 1. Check for binding suffix on the static prefix
      const binding = detectBindingSuffix(str)
      if (binding) {
        const id = 'b' + (++idOffset.count)
        bindings.push({ type: binding.type, name: binding.name, value, id })
        // Resolve PascalCase tags in the prefix (before the binding marker)
        fragments.push(resolvePascalTags(binding.prefix) + binding.marker + binding.name + ':' + id + '"')
        parts.push({ id, type: binding.type, name: binding.name, value })
        graphParts.push({ id, type: binding.type, name: binding.name, value })
        continue
      }

      // 2. Resolve PascalCase tags in the static string part
      str = resolvePascalTags(str)

      // 2b. Dynamic component: <${Comp} /> or <${Comp} attr=${val} />
      // Pattern: static part before binding ends with '<', next static starts with '/>'
      if (i + 1 < strings.length && typeof value === 'function' && value._isComponent) {
        const nextStr = strings[i + 1]
        const trimmed = nextStr.trimStart()
        if (trimmed.startsWith('/>') || trimmed.startsWith('>')) {
          const isSelfClosing = trimmed.startsWith('/>')
          const attrStr = isSelfClosing ? nextStr.slice(0, nextStr.indexOf('/>')) : ''
          const props = attrStr ? parseAttrs(attrStr) : {}
          try {
            const inst = value.create ? value.create(props) : value(props)
            const rendered = typeof inst.render === 'function' ? inst.render() : String(inst ?? '')
            fragments.push(str + rendered)
            // Skip the next static part (/> and onwards)
            i++
            continue
          } catch (e) {
            // Fall through to normal binding if component rendering fails
          }
        }
      }

      // 3. Handle the value — text interpolation, loop, or nested template merge
      if (isLoopValue(value)) {
        const strVal = resolveValue(value, bindings, idOffset, graphParts)
        fragments.push(str + strVal)
      } else if (value && typeof value === 'object' && 'template' in value && 'bindings' in value) {
        // Nested template descriptor — merge bindings, inline HTML.
        // The nested template's own parts live in its descriptor,
        // and its markers are already embedded in the returned HTML.
        const strVal = resolveValue(value, bindings, idOffset, graphParts)
        fragments.push(str + strVal)
      } else if (Array.isArray(value)) {
        // Array — handle each element individually
        let html = str
        for (const v of value) {
          if (isLoopValue(v)) {
            html += resolveValue(v, bindings, idOffset, graphParts)
          } else if (v && typeof v === 'object' && 'template' in v && 'bindings' in v) {
            html += resolveValue(v, bindings, idOffset, graphParts)
          } else {
            const id = 'b' + (++idOffset.count)
            const strVal = String(v ?? '')
            // Only wrap in markers if we're in text content, not an attribute value
            if (isInsideAttribute(_accPrefix)) {
              html += strVal
            } else {
              html += '<!-- up:' + id + ' -->' + strVal + '<!-- /up:' + id + ' -->'
            }
            parts.push({ id, type: 'text', value: v })
            graphParts.push({ id, type: 'text', value: v })
          }
        }
        fragments.push(html)
      } else {
        // Plain scalar — record value for patch diffing.
        // Only wrap in markers for text content, not attribute values
        // (style, class, SVG attrs, aria-label, etc. would break).
        const id = 'b' + (++idOffset.count)
        const strVal = String(value ?? '')
        if (isInsideAttribute(_accPrefix)) {
          fragments.push(str + strVal)
        } else {
          fragments.push(str + '<!-- up:' + id + ' -->' + strVal + '<!-- /up:' + id + ' -->')
        }
        parts.push({ id, type: 'text', value })
        graphParts.push({ id, type: 'text', value })
      }
    } else {
      // Final string part (after all values) — just resolve PascalCase tags
      fragments.push(resolvePascalTags(str))
    }
  }

  const template = fragments.join('')

  return {
    template,
    bindings,
    parts,
    graphParts,
    graphTemplate: {
      kind: 'uploop.html.graph-template',
      strategy: 'compat-scaffold',
      parts: graphParts
    },
    graphValues: values,
    values: () => {
      const result = {}
      for (const p of parts) {
        if (p.type === 'text' || p.type === 'prop' || p.type === 'bool') {
          result[p.id] = p.value
        }
      }
      return result
    },
    toString: () => template,
    toJSON: () => template
  }
}

/** @type {WeakMap<Element, Map<string, EventListener>>} */
const _eventBindingState = new WeakMap()

/**
 * Apply event bindings to mounted DOM by finding data-up-event markers.
 */
export function applyBindings(root, bindings, send, state) {
  if (!root || !bindings) return

  for (const binding of bindings) {
    if (binding.type === 'event') {
      const { name: eventName, value: handler, id } = binding
      const selector = `[data-up-event="${eventName}:${id}"]`
      const targets = root.querySelectorAll(selector)

      for (const target of targets) {
        target.removeAttribute('data-up-event')
        const useSend = binding._ownerSend || send

        let listener = null
        if (typeof handler === 'function') {
          listener = handler
        } else if (typeof handler === 'string') {
          listener = (e) => { if (useSend) useSend(handler, e) }
        } else if (Array.isArray(handler)) {
          const [name, transform] = handler
          listener = (e) => {
            const payload = transform ? transform(e) : e
            if (useSend) useSend(name, payload)
          }
        }

        if (listener) {
          let listeners = _eventBindingState.get(target)
          if (!listeners) {
            listeners = new Map()
            _eventBindingState.set(target, listeners)
          }
          const prev = listeners.get(eventName)
          if (prev) target.removeEventListener(eventName, prev)
          target.addEventListener(eventName, listener)
          listeners.set(eventName, listener)
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
 * Find a marker comment node (<!--up:id-->) within root using TreeWalker.
 * @param {Node} root
 * @param {string} id
 * @returns {Comment|null}
 */
function findMarker(root, id) {
  const doc = root.ownerDocument || (typeof document !== 'undefined' ? document : null)
  if (!doc) return null
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  const target = 'up:' + id
  let node
  while ((node = walker.nextNode())) {
    const comment = /** @type {Comment} */ (node)
    if (comment.data && comment.data.trim() === target) return comment
  }
  return null
}

/**
 * Apply incremental DOM updates by comparing old and new template results.
 * Only touches DOM nodes whose values actually changed.
 *
 * @param {Element} root - the mounted DOM root element
 * @param {Object} oldResult - previous return value from html()
 * @param {Object} newResult - new return value from html()
 */
export function patchTemplate(root, oldResult, newResult) {
  if (!root || !oldResult || !newResult) return

  const oldParts = oldResult.parts || []
  const newParts = newResult.parts || []

  // Build a map of old values + detect structural changes
  const oldById = {}
  for (const p of oldParts) {
    oldById[p.id] = { value: p.value, type: p.type, name: p.name }
  }

  const mutations = []

  for (const p of newParts) {
    const old = oldById[p.id]
    if (!old) {
      // New part added — will be patched via replace on first mismatch
      continue
    }
    const newVal = p.value
    const oldVal = old.value

    if (p.type === 'text' && oldVal !== newVal) {
      // Resolve both marker comments and update text between them
      const open = findMarker(root, p.id)
      if (open) {
        // Collect all text nodes between open marker and its close marker
        const close = findMarker(root, '/' + p.id)
        if (close) {
          let node = open.nextSibling
          while (node && node !== close) {
            if (node.nodeType === 3) { // TEXT_NODE
              mutations.push({ node, value: String(newVal ?? '') })
            }
            node = node.nextSibling
          }
        }
      }
      // If no marker found, fall back to full replace (first render or non-marked template)
    } else if (p.type === 'prop' && oldVal !== newVal) {
      const el = root.querySelector('[data-up-prop="' + p.name + ':' + p.id + '"]')
      if (el) mutations.push({ el, name: p.name, value: newVal, type: 'prop' })
    } else if (p.type === 'bool' && oldVal !== newVal) {
      const el = root.querySelector('[data-up-bool="' + p.name + ':' + p.id + '"]')
      if (el) mutations.push({ el, name: p.name, value: newVal, type: 'bool' })
    }
    // Event bindings don't need patching — listeners survive on DOM nodes
  }

  // Apply all mutations in a single synchronous batch to avoid layout thrashing
  for (const m of mutations) {
    if (m.type === 'text' || m.node) {
      m.node.nodeValue = m.value
    } else if (m.type === 'prop') {
      m.el[m.name] = m.value
    } else if (m.type === 'bool') {
      if (m.value) m.el.setAttribute(m.name, '')
      else m.el.removeAttribute(m.name)
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
  if (!root) return []

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
          tag: el.tagName.toLowerCase(),
          id: el.id || ''
        }),
        restore: (data, mountRoot) => {
          // Find the target container in current DOM (survives innerHTML)
          const container = data.containerId
            ? mountRoot.querySelector('#' + data.containerId)
            : mountRoot
          if (!container) return
          // Remove duplicate by replacing it with the preserved element
          let dup = container.querySelector(data.tag + '[data-up-provide]')
          if (!dup && data.id) dup = mountRoot.querySelector('#' + data.id)
          if (dup && dup !== el && dup.parentNode) {
            dup.parentNode.replaceChild(el, dup)
          } else if (!container.contains(el)) {
            container.appendChild(el)
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
  const pendingVC = []
  if (vContainers.length > 0) {
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
        pendingVC.push({ scopeName, defs })
      }
    }
  }
  return pendingVC
}

// ════════════════════════════════════════════════════════════
// WeakMap-based state for virtual containers
// Replaces ad-hoc DOM properties (_pendingVC, _upInstances).
// Keyed by element reference — survives innerHTML replacement
// through resource restore (same element object is preserved).
// ════════════════════════════════════════════════════════════

/** @type {WeakMap<Element, { pendingVC?: Array, instances?: Array }>} */
const _vcState = new WeakMap()

/**
 * Second-pass: process virtual containers AFTER resource restore.
 * The restored canvas element is now in DOM. On first render,
 * creates component instances. On re-render, pushes new props
 * from the captured placeholder DOM attributes to existing instances.
 */
export function processVirtualContainers(root, ctx, pendingVC) {
  if (!root || !pendingVC) return

  // Fallback: if pendingVC wasn't passed explicitly, read from WeakMap
  if (!Array.isArray(pendingVC)) {
    const rootState = _vcState.get(root)
    pendingVC = rootState ? rootState.pendingVC || [] : []
  }
  if (pendingVC.length === 0) return

  // Clean up pending VC from state
  const rootState = _vcState.get(root)
  if (rootState) rootState.pendingVC = undefined

  const containers = root.querySelectorAll('[data-up-containers]')
  for (const container of containers) {
    const mode = container.getAttribute('data-up-containers')
    const scopeName = container.getAttribute('uploop-scope') || container.getAttribute('data-up-scope') || ''
    if (mode !== 'virtual' || container.tagName?.toLowerCase() !== 'canvas') continue

    const ctx2d = container.getContext?.('2d') || null
    const entry = pendingVC.find(p => p.scopeName === scopeName)
    if (!entry) continue

    container.innerHTML = ''

    // Read existing instances from WeakMap instead of container._upInstances
    let contState = _vcState.get(container)
    if (!contState) {
      contState = { instances: [] }
      _vcState.set(container, contState)
    }
    const existing = contState.instances || []

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
      contState.instances = instances

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
            // Read instances from WeakMap instead of container._upInstances
            const state = _vcState.get(container)
            for (const inst of (state ? state.instances || [] : [])) {
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

    let Cls, attrStr, tagName = ''

    // Case 1: <Wheel .../> — literal tag, lookup from classes
    const tagMatch = raw.match(/^\s*<(\w+)([^>]*?)\s*\/>\s*$/s)
    if (tagMatch) {
      tagName = tagMatch[1]
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
          tagName = Cls.name || 'DynamicComponent'
          attrStr = dynMatch[2] || ''
        } else { return null }
      } else { return null }
    }

    // Check for :props= binding — pass raw JS object directly to Cls()
    if (attrStr) {
      const pm = attrStr.match(/:props\s*=\s*\x00(\d+)\x00/)
      if (pm) {
        const idx = parseInt(pm[1])
        if (idx < values.length) return Cls(values[idx])
      }
    }

    // Parse attributes
    const props = {}
    const quotedKeys = new Set()
    if (attrStr) {
      const attrRe = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\x00(\d+)\x00)/g
      let m
      while ((m = attrRe.exec(attrStr))) {
        const key = m[1]
        if (m[2] !== undefined) { const n = Number(m[2]); props[key] = isNaN(n) ? m[2] : n; quotedKeys.add(key) }
        else if (m[3] !== undefined) { const n = Number(m[3]); props[key] = isNaN(n) ? m[3] : n; quotedKeys.add(key) }
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

    // ─── Dev-mode warnings ───────────────────────────────
    if (typeof DEV !== 'undefined' && DEV) {
      if (Cls._originalView) {
        // 1. Unknown prop check via describe()
        if (typeof Cls.describe === 'function') {
          const graph = Cls.describe()
          const knownKeys = new Set()
          if (graph && graph.nodes) {
            for (const [k, node] of Object.entries(graph.nodes)) {
              if (node && node.type === 'data') knownKeys.add(k)
            }
          }
          for (const key of Object.keys(props)) {
            if (!knownKeys.has(key)) {
              console.warn('[Uploop] ' + tagName + ': unknown prop "' + key + '"')
            }
          }
        }
        // 2. Function props with 'on' prefix — suggest @callback
        for (const [key, val] of Object.entries(props)) {
          if (typeof val === 'function' && key.startsWith('on')) {
            console.warn('[Uploop] ' + tagName + ': prop "' + key + '" is a function — consider @' + key + ' for callbacks')
          }
        }
        // 3. Quoted strings that look like booleans
        for (const key of quotedKeys) {
          if (props[key] === 'true' || props[key] === 'false') {
            console.warn('[Uploop] ' + tagName + ': prop "' + key + '" is the string "' + props[key] + '" — use ${' + props[key] + '} or bare attribute for boolean')
          }
        }
      }
    }

    return Cls(props)
  }
  return tag
}
