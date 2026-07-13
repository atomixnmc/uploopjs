/**
 * Execution Protocol — v0.0.3
 *
 * Every render target (DOM, Canvas, SSR, WebGL, Worker) implements
 * this protocol. The runner orchestrates the pipeline; targets handle
 * the mechanics of producing and applying output.
 *
 * ─── Strategy ───────────────────────────────────────────
 *
 *   patch    — surgical update: only changed nodes modified.
 *              Preserves DOM state, focus, canvas, scroll.
 *              Best for: DOM (VDOM diff / signal patch).
 *
 *   replace  — full teardown + rebuild: destroy all output,
 *              recreate from template. Runner handles resource
 *              preservation, focus save/restore, event rebinding.
 *              Best for: SSR strings, canvas redraw.
 *
 *   redraw   — discard previous frame, draw new frame.
 *              No diffing. Every frame is a fresh render pass.
 *              Best for: Canvas 2D, WebGL, game loops.
 *
 * ─── Runner Pipeline ─────────────────────────────────────
 *
 *   state change
 *       │
 *       ▼
 *   render(template, state) → Output
 *       │
 *       ▼
 *   strategy === 'patch' ?
 *       │
 *       ├── YES → patch(target, prevOutput, nextOutput, delta)
 *       │
 *       └── NO  → preReplace(target)          // save resources, focus
 *                 replace(target, nextOutput)   // innerHTML, clear+redraw
 *                 postReplace(target)           // restore resources, focus, rebind
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
 * Create the default DOM execution target.
 *
 * Uses strategy: 'replace' with innerHTML (v0.0.2 behavior).
 * Will be upgraded to strategy: 'patch' in a later step.
 *
 * @returns {import('./types.js').ExecutionTarget}
 */
export function createDOMExecution() {
  /** @type {import('./types.js').ExecutionTarget} */
  return {
    strategy: 'replace',

    render(template, state) {
      if (typeof template === 'string') return template
      if (template && typeof template.toString === 'function') return template.toString()
      return String(template)
    },

    replace(target, output) {
      target.innerHTML = output
    },

    patch(target, prevOutput, nextOutput, delta) {
      // Apply patch instructions from delta
      if (delta?.parts) {
        for (const part of delta.parts) {
          if (part.type === 'text' && part.node) {
            part.node.textContent = String(part.value ?? '')
          } else if (part.type === 'prop' && part.node) {
            part.node[part.name] = part.value
          }
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
 * Compute delta between previous and next template outputs.
 * Compares parts by ID to find changed text/prop/bool values.
 *
 * @param {Object|string} prevOutput
 * @param {Object|string} nextOutput
 * @returns {Object|null} delta { parts: [...] } or null if no changes
 */
function computeDelta(prevOutput, nextOutput) {
  // If outputs are template results with parts, diff the parts
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

  function mount(target, template, state) {
    _target = target
    _prevOutput = execution.render(template, state)
    const unmount = execution.mount(target, _prevOutput)
    return () => {
      unmount?.()
      _target = null
      _prevOutput = null
    }
  }

  function update(template, state) {
    if (!_target) return

    const nextOutput = execution.render(template, state)

    if (options.onRender) options.onRender(_target, nextOutput)

    if (execution.strategy === 'patch' && execution.patch) {
      // Compute delta from old and new template outputs
      const delta = computeDelta(_prevOutput, nextOutput)
      if (delta) {
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
    }
  }

  return { mount, update, unmount }
}
