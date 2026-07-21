/**
 * Execution Protocol — v0.9.0
 *
 * Every render target (DOM, Canvas, SSR, WebGL, Worker) implements
 * this protocol. The runner orchestrates the pipeline; targets handle
 * the mechanics of producing and applying output.
 *
 * ─── Strategy ───────────────────────────────────────────
 *
 *   patch    — GDOM surgery: granular DOM updates via marker
 *              resolution. Only changed nodes are touched.
 *              Preserves DOM state, focus, canvas, scroll, events.
 *              Best for: DOM (HyperGraph-driven incremental updates).
 *
 *   replace  — full teardown + rebuild: destroy all output,
 *              recreate from template. Runner handles resource
 *              preservation, focus save/restore, event rebinding.
 *              Best for: SSR strings, canvas redraw, first mount.
 *
 *   redraw   — discard previous frame, draw new frame.
 *              No diffing. Every frame is a fresh render pass.
 *              Best for: Canvas 2D, WebGL, game loops.
 *
 * ─── GDOM Surgery Pipeline (patch strategy) ──────────────
 *
 *   state change
 *       │
 *       ▼
 *   render(template, state) → Output (with parts[] metadata)
 *       │
 *       ▼
 *   computeDelta(prevOutput, nextOutput)
 *       │
 *       ├── structural: added / removed parts
 *       └── value: changed text / prop / bool
 *       │
 *       ▼
 *   patch(target, prevOutput, nextOutput, delta)
 *       │
 *       ├── text: resolve <!-- up:id --> markers → update textContent
 *       ├── prop: resolve [data-up-prop] → set property
 *       ├── bool: resolve [data-up-bool] → toggle attribute
 *       └── batch: collect mutations → apply synchronously
 *
 * ─── Lifecycle ───────────────────────────────────────────
 *
 *   mount(target, output)   → attach output to target, start reacting
 *   unmount(target)          → detach, stop reacting, cleanup
 *
 *   Canonical names: mount / unmount / render / update
 *   Aliased via renameLifeCycleMethods in the target config.
 */

/**
 * @typedef {Object} ExecutionTarget
 *
 * @property {'patch'|'replace'|'redraw'} strategy
 *   Primary update strategy for this target.
 *
 * @property {Function} render
 *   (template, state) → Output
 *   Produce output from template + current state.
 *   For DOM: html`` → string or fragment.
 *   For Canvas: no-op (state is drawn in draw()).
 *   For SSR: html`` → HTML string.
 *
 * @property {Function} [patch]
 *   (target, prevOutput, nextOutput, delta) → void
 *   Apply surgical updates. Only called when strategy === 'patch'.
 *   delta describes what changed (for DOM: which nodes, for GPU: which buffers).
 *
 * @property {Function} [replace]
 *   (target, nextOutput) → void
 *   Full replacement of output. Called when strategy === 'replace'.
 *
 * @property {Function} mount
 *   (target, output) → unmountFn
 *   Attach output to target. Return cleanup function.
 *
 * @property {Function} unmount
 *   (target) → void
 *   Detach output, stop reacting, cleanup subscriptions.
 *
 * @property {Object} [renameLifeCycleMethods]
 *   Map canonical names to domain-specific names.
 *   Example: { mount: 'plug', unmount: 'unplug', render: 'draw' }
 *
 * @property {Object} [hooks]
 *   preReplace: (target) → snapshot
 *     Called before replace(). Saves DOM state (focus, scroll, resources).
 *   postReplace: (target, snapshot) → void
 *     Called after replace(). Restores saved state, rebinds events.
 */

/**
 * Create the default DOM execution target with GDOM surgery.
 *
 * Uses strategy: 'patch' with marker-based DOM node resolution.
 * Prop/bool bindings target elements via data-up-* attributes.
 * Text bindings target comment markers (<!-- up:id -->).
 *
 * @returns {import('./types.js').ExecutionTarget}
 */
export function createDOMExecution() {
  /** @type {import('./types.js').ExecutionTarget} */
  // Cache: id → resolved DOM node for O(1) subsequent patches
  let _compactGraph = null

  return {
    strategy: 'replace',

    render(template, state) {
      if (typeof template === 'string') return template
      if (template && typeof template.toString === 'function') return template.toString()
      return String(template)
    },

    replace(target, output) {
      _compactGraph = null
      target.innerHTML = output
    },

    // Called by component after replace, before postReplace (attrs still present)
    _buildGraph(target) {
      _compactGraph = new Map()
      for (const el of target.querySelectorAll('[data-up-id]')) {
        _compactGraph.set(el.getAttribute('data-up-id'), el)
      }
      for (const el of target.querySelectorAll('[data-up-prop]')) {
        const attr = el.getAttribute('data-up-prop')
        const colon = attr.lastIndexOf(':')
        if (colon > 0) _compactGraph.set(attr.slice(colon + 1), el)
      }
      for (const el of target.querySelectorAll('[data-up-bool]')) {
        const attr = el.getAttribute('data-up-bool')
        const colon = attr.lastIndexOf(':')
        if (colon > 0) _compactGraph.set(attr.slice(colon + 1), el)
      }
    },

    patch(target, prevOutput, nextOutput, delta) {
      if (!delta) return

      // Build compact graph on first patch after replace (lazy init).
      // Index ALL data-up-* attributes: up-id (text), up-prop (property),
      // up-bool (boolean attr). These get stripped by applyBindings after
      // first render, so we must capture references before that happens.
      if (!_compactGraph) {
        _compactGraph = new Map()
        // Text binding points
        for (const el of target.querySelectorAll('[data-up-id]')) {
          _compactGraph.set(el.getAttribute('data-up-id'), el)
        }
        // Prop binding points (may already be stripped by applyBindings)
        for (const el of target.querySelectorAll('[data-up-prop]')) {
          const attr = el.getAttribute('data-up-prop')
          const colon = attr.lastIndexOf(':')
          if (colon > 0) _compactGraph.set(attr.slice(colon + 1), el)
        }
        // Bool binding points
        for (const el of target.querySelectorAll('[data-up-bool]')) {
          const attr = el.getAttribute('data-up-bool')
          const colon = attr.lastIndexOf(':')
          if (colon > 0) _compactGraph.set(attr.slice(colon + 1), el)
        }
      }

      const mutations = []

      // Text patches — O(1) lookup via compact graph
      if (delta.textParts) {
        for (const part of delta.textParts) {
          const el = _compactGraph.get(part.id)
          if (el) mutations.push({ el, value: String(part.value ?? ''), type: 'text' })
        }
      }

      // Prop patches — compact graph first, querySelector fallback
      if (delta.propParts) {
        for (const part of delta.propParts) {
          let el = _compactGraph.get(part.id)
          if (!el) {
            el = target.querySelector('[data-up-prop="' + part.name + ':' + part.id + '"]')
            if (el) _compactGraph.set(part.id, el)
          }
          if (el) mutations.push({ el, name: part.name, value: part.value, type: 'prop' })
        }
      }

      // Bool patches — compact graph first, querySelector fallback
      if (delta.boolParts) {
        for (const part of delta.boolParts) {
          let el = _compactGraph.get(part.id)
          if (!el) {
            el = target.querySelector('[data-up-bool="' + part.name + ':' + part.id + '"]')
            if (el) _compactGraph.set(part.id, el)
          }
          if (el) mutations.push({ el, name: part.name, value: part.value, type: 'bool' })
        }
      }

      // Apply all mutations in a single synchronous batch
      for (const m of mutations) {
        if (m.type === 'text') {
          m.el.textContent = m.value
        } else if (m.type === 'prop') {
          m.el[m.name] = m.value
        } else if (m.type === 'bool') {
          if (m.value) m.el.setAttribute(m.name, '')
          else m.el.removeAttribute(m.name)
        }
      }
    },

    mount(target, output) {
      if (output) target.innerHTML = output
      return () => { target.innerHTML = '' }
    },

    unmount(target) {
      target.innerHTML = ''
    },

    hooks: {
      preReplace(target) {
        // Save state before DOM destruction
        const active = target.ownerDocument?.activeElement
        const snapshot = {
          focus: active && target.contains(active) ? {
            tag: active.tagName,
            type: active.type || '',
            placeholder: active.getAttribute('placeholder') || '',
            name: active.getAttribute('name') || '',
            selectionStart: (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') ? active.selectionStart : -1,
            selectionEnd: (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') ? active.selectionEnd : -1
          } : null
        }
        return snapshot
      },

      postReplace(target, snapshot) {
        // Restore focus if possible
        if (!snapshot?.focus) return
        const { tag, type, placeholder, name, selectionStart, selectionEnd } = snapshot.focus
        let el = null
        if (placeholder) {
          el = target.querySelector(`${tag.toLowerCase()}[placeholder="${placeholder.replace(/"/g, '\\"')}"]`)
        } else if (name) {
          el = target.querySelector(`${tag.toLowerCase()}[name="${name}"]`)
        } else if (type) {
          el = target.querySelector(`${tag.toLowerCase()}[type="${type}"]`)
        } else {
          el = target.querySelector(tag.toLowerCase())
        }
        if (el) {
          el.focus()
          if (selectionStart >= 0 && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            const t = (el.type || 'text').toLowerCase()
            if (t !== 'checkbox' && t !== 'radio' && t !== 'submit' && t !== 'button' && t !== 'reset' && t !== 'image') {
              try { el.setSelectionRange(selectionStart, selectionEnd) } catch (e) {}
            }
          }
        }
      }
    }
  }
}

/**
 * Create an SSR execution target that renders to strings.
 *
 * Uses strategy: 'replace' with a plain object as target.
 * Output is accumulated on `target._html` instead of DOM.
 *
 * @returns {import('./types.js').ExecutionTarget}
 */
export function createStringExecution() {
  return {
    strategy: 'replace',

    render(template, state) {
      if (typeof template === 'string') return template
      if (template && typeof template.toString === 'function') return template.toString()
      return String(template)
    },

    replace(target, output) {
      target._html = output
    },

    mount(target, output) {
      if (output) target._html = output
      return () => { target._html = '' }
    },

    unmount(target) {
      target._html = ''
    },

    hooks: {
      preReplace(target) {
        return {}
      },
      postReplace(target, snapshot) {
        // No focus restore needed on server
      }
    }
  }
}

/**
 * Validate that a target object conforms to the execution protocol.
 * Logs warnings for missing required methods.
 *
 * @param {Object} target
 * @param {string} [label] — target name for warning messages
 * @returns {boolean}
 */
export function validateExecutionTarget(target, label = 'execution target') {
  const required = ['strategy', 'render', 'mount', 'unmount']
  const missing = required.filter(k => typeof target[k] !== 'function' && k !== 'strategy')
  if (missing.length > 0) {
    console.warn(`[Uploop] ${label} missing required methods: ${missing.join(', ')}`)
    return false
  }
  if (!['patch', 'replace', 'redraw'].includes(target.strategy)) {
    console.warn(`[Uploop] ${label} unknown strategy: "${target.strategy}". Expected "patch", "replace", or "redraw".`)
    return false
  }
  if (target.strategy === 'patch' && typeof target.patch !== 'function') {
    console.warn(`[Uploop] ${label} strategy is "patch" but patch() method is missing.`)
    return false
  }
  if (target.strategy === 'replace' && typeof target.replace !== 'function') {
    console.warn(`[Uploop] ${label} strategy is "replace" but replace() method is missing.`)
    return false
  }
  return true
}

/**
 * Create the runner pipeline that orchestrates execution.
 *
 * @param {import('./types.js').ExecutionTarget} execution
 * @param {Object} options
 * @param {Function} options.onRender — called before render
 * @param {Function} options.onPatch — called after patch
 * @param {Function} options.onReplace — called after replace
 * @returns {Object} runner
 */
/**
 * Compute structured delta between previous and next template outputs.
 * Categorizes changes by type for targeted GDOM surgery:
 *
 *   textParts — text binding value changes (IDs match, values differ)
 *   propParts — property binding value changes
 *   boolParts — boolean attribute toggle changes
 *   addedParts — new parts not in previous output (first render, structural change)
 *   removedParts — old parts gone from next output (structural change)
 *
 * Returns null if no parts metadata is available (string-only output).
 * Returns an object with empty arrays if no changes detected.
 *
 * @param {Object|string} prevOutput
 * @param {Object|string} nextOutput
 * @returns {Object|null} structured delta or null
 */
export function computeDelta(prevOutput, nextOutput) {
  const prevParts = prevOutput?.parts || []
  const nextParts = nextOutput?.parts || []

  // String-only outputs have no parts — delta is meaningless
  if (prevParts.length === 0 && nextParts.length === 0) return null

  const textParts = []
  const propParts = []
  const boolParts = []
  const addedParts = []
  const removedParts = []

  // Index previous parts by ID for O(1) lookup
  const prevById = {}
  for (const p of prevParts) {
    prevById[p.id] = p
  }

  // Index next parts for added detection
  const nextById = {}
  for (const p of nextParts) {
    nextById[p.id] = true
  }

  // Detect added + changed parts
  for (const p of nextParts) {
    const prev = prevById[p.id]
    if (!prev) {
      addedParts.push(p)
      continue
    }

    const prevVal = prev.value
    const nextVal = p.value

    if (prevVal !== nextVal) {
      // Attribute-value changes (style, class, SVG attrs) can't be patched
      // surgically — HTML doesn't allow elements inside attribute values.
      // Treat them as structural changes to trigger a full replace.
      if (p._inAttr || prev._inAttr) {
        addedParts.push(p)
      } else if (p.type === 'text') {
        textParts.push({ id: p.id, type: 'text', value: nextVal })
      } else if (p.type === 'prop') {
        propParts.push({ id: p.id, type: 'prop', name: p.name, value: nextVal })
      } else if (p.type === 'bool') {
        boolParts.push({ id: p.id, type: 'bool', name: p.name, value: nextVal })
      }
    }
  }

  // Detect removed parts
  for (const p of prevParts) {
    if (!nextById[p.id]) {
      removedParts.push(p)
    }
  }

  const hasChanges = textParts.length > 0 || propParts.length > 0 || boolParts.length > 0

  return {
    textParts,
    propParts,
    boolParts,
    addedParts,
    removedParts,
    hasChanges
  }
}

/**
 * @private — kept for backward compat with old callers
 * @deprecated Use computeDelta() which returns structured output
 */
function _computeDeltaLegacy(prevOutput, nextOutput) {
  const prevParts = prevOutput?.parts || []
  const nextParts = nextOutput?.parts || []
  const changed = []

  const prevById = {}
  for (const p of prevParts) prevById[p.id] = p

  for (const p of nextParts) {
    const prev = prevById[p.id]
    if (!prev) continue
    if (p.type === 'text' && prev.value !== p.value) {
      changed.push(p)
    } else if ((p.type === 'prop' || p.type === 'bool') && prev.value !== p.value) {
      changed.push(p)
    }
  }

  return changed.length > 0 ? { parts: changed } : null
}

export function createRunner(execution, options = {}) {
  let _prevOutput = null
  let _target = null
  let _isFirstUpdate = true

  function mount(target, template, state) {
    _target = target
    _isFirstUpdate = true
    // First mount always uses replace for initial DOM population
    _prevOutput = execution.render(template, state)
    const unmount = execution.mount(target, _prevOutput)
    return () => {
      unmount?.()
      _target = null
      _prevOutput = null
      _isFirstUpdate = true
    }
  }

  function update(template, state) {
    if (!_target) return

    const nextOutput = execution.render(template, state)

    if (options.onRender) options.onRender(_target, nextOutput)

    // First update after mount: use replace for full DOM population
    // (comment markers need to be in the DOM before patch can resolve them)
    if (_isFirstUpdate) {
      _isFirstUpdate = false
      const snapshot = execution.hooks?.preReplace?.(_target)
      if (execution.replace) {
        execution.replace(_target, nextOutput)
      }
      if (execution.hooks?.postReplace) {
        execution.hooks.postReplace(_target, snapshot)
      }
      if (options.onReplace) options.onReplace(_target, nextOutput)
      _prevOutput = nextOutput
      return
    }

    // Subsequent updates: use patch strategy for GDOM surgery
    if (execution.strategy === 'patch' && execution.patch) {
      const delta = computeDelta(_prevOutput, nextOutput)
      if (delta?.hasChanges) {
        execution.patch(_target, _prevOutput, nextOutput, delta)
      }
      if (options.onPatch) options.onPatch(_target, delta)
    } else if (execution.strategy === 'redraw' || execution.strategy === 'replace') {
      const snapshot = execution.hooks?.preReplace?.(_target)
      if (execution.replace) {
        execution.replace(_target, nextOutput)
      }
      if (execution.hooks?.postReplace) {
        execution.hooks.postReplace(_target, snapshot)
      }
      if (options.onReplace) options.onReplace(_target, nextOutput)
    }

    _prevOutput = nextOutput
  }

  function unmount() {
    if (_target) {
      execution.unmount(_target)
      _target = null
      _prevOutput = null
      _isFirstUpdate = true
    }
  }

  return { mount, update, unmount }
}
