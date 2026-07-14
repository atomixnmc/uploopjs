/**
 * Uploop Component — v0.0.3
 *
 * The core component factory. Defines a HyperGraph component
 * as nodes + edges with an execution target. No DOM knowledge.
 *
 * ─── What's in core ──────────────────────────────────────
 *   • createLoop — reactive state, event pipeline, effects
 *   • Graph nodes — data, update, view, effect
 *   • render pipeline — view → execution protocol
 *   • instance creation — create() with children
 *   • frame loop — rAF for visual/draw components
 *   • lifecycle hooks — mount/unmount (canonical names)
 *
 * ─── What's delegated to execution target ────────────────
 *   • How output is rendered (DOM, Canvas, SSR, WebGL)
 *   • Pre/post replace hooks (focus, resources, bindings)
 *   • Mount/unmount mechanics (innerHTML, canvas context, etc.)
 *
 * @module @uploop/core/component
 */

import { createLoop } from './loop.js'
import { createSignal } from './signal.js'
import { createResourceManager } from './component-resources.js'
import { createFrameLoop } from './component-frame.js'
import { computeDelta } from './execution.js'

// ─── Snapshot Protocol ───────────────────────────────────────
// Typed container for data passed between preReplace and postReplace hooks.
// Execution targets read/write these fields; no underscore smuggling.

/**
 * Create a typed snapshot for the execution pipeline.
 * @param {Object} [overrides]
 * @returns {Snapshot}
 */
function createSnapshot(overrides = {}) {
  return {
    focus: null,
    bindings: [],
    send: null,
    get: null,
    resources: null,
    ...overrides
  }
}

/**
 * Define an Uploop HyperGraph component.
 *
 * @param {string} name — component display name
 * @param {Object} config
 * @param {Object} [config.state] — initial state
 * @param {Object<string,Function>} [config.update] — event handlers (state, ...args) → partialState
 * @param {Object<string,Function>} [config.effect] — side-effect handlers
 * @param {Function|Object} [config.view] — view function (state, { send, html }) → output
 * @param {Function} [config.mount] — lifecycle: after first render
 * @param {Function} [config.unmount] — lifecycle: before cleanup
 * @param {Object} [config.classes] — child component classes for compose
 * @param {Function} [config.compose] — compose children from projected parts
 * @param {Function} [config.project] — project state into parts (alias for computeParts)
 * @param {Function} [config.render] — custom render function
 * @param {Function} [config.draw] — canvas draw function (per-frame)
 * @param {'micro'|'visual'|'idle'|'manual'} [config.frame] — frame scheduling mode
 * @param {Object} [config.execution] — execution target (default: domExecution from @uploop/html)
 * @param {Object} [lifecycleMethods] — custom methods from createComponentType
 * @returns {Function} callable component descriptor
 */
export function component(name, config = {}, lifecycleMethods = {}) {
  const {
    state: initialState = {},
    update: updateHandlers = {},
    effect: effectHandlers = {},
    view,
    mount: mountHook,
    unmount: unmountHook,
    classes: componentClasses = {},
    compose: composeFn,
    project: projectFn,       // v0.0.3: alias for computeParts
    computeParts: computePartsFn = projectFn,
    render: renderFn,
    draw: drawFn,
    frame: frameMode,
    execution: rawExec            // v0.0.3: execution target or factory (optional)
  } = config

  if (!rawExec) {
    console.warn(
      `[Uploop] component("${name}") created without an execution target. ` +
      `The component will not render until an execution target is provided. ` +
      `Use createDOMExecution() or wrap with @uploop/html's component().`
    )
  }

  const loop = createLoop({
    name,
    state: { ...initialState },
    update: { ...updateHandlers },
    effect: { ...effectHandlers }
  })

  // execution can be a target object or a factory (loop) => target
  const exec = typeof rawExec === 'function' ? rawExec(loop) : rawExec

  // Fallback no-op execution (component works but doesn't render to DOM)
  const _exec = exec || {
    strategy: 'replace',
    render: (t) => String(t),
    replace: () => {},
    mount: () => () => {},
    unmount: () => {},
    hooks: {}
  }

  loop.registerNode('view', { type: 'view', dependsOn: ['state'] })
  if (view) loop.registerEdge('state', 'view')
  for (const key of Object.keys(updateHandlers)) {
    loop.registerEdge(key, 'state')
    loop.registerEdge(key, 'view')
  }

  // ─── Resource Manager ──────────────────────────────────────
  const resources = createResourceManager()

  // ─── Render ──────────────────────────────────────────────

  function renderView(viewProps) {
    if (viewProps) loop.set((prev) => ({ ...prev, ...viewProps }))
    const s = loop.get()
    if (typeof view === 'function') return view(s, { send: loop.send }) || ''
    return view || ''
  }

  function render(viewProps) {
    const result = renderView(viewProps)
    if (result && typeof result === 'object' && typeof result.toString === 'function') {
      return result.toString()
    }
    return String(result)
  }

  // ─── Mount ───────────────────────────────────────────────

  let _prevResult = null

  function mountTo(element, props) {
    if (!element) return () => {}

    function apply() {
      const result = renderView()
      if (!result) return

      let htmlStr, bindings = []
      if (result && typeof result === 'object') {
        htmlStr = result.toString?.() ?? String(result)
        bindings = result.bindings || []
      } else {
        htmlStr = String(result)
      }

      // GDOM Surgery: patch when possible, replace on structural changes
      if (_exec.strategy === 'patch' && _prevResult && _exec.patch) {
        const delta = computeDelta(_prevResult, result)
        if (delta?.hasChanges) {
          if (delta.addedParts?.length || delta.removedParts?.length) {
            // Structural change — full replace
            const snap = createSnapshot({ ...(_exec.hooks?.preReplace?.(element) ?? {}), bindings })
            _exec.replace(element, htmlStr)
            if (_exec._buildGraph) _exec._buildGraph(element)
            if (_exec.hooks?.postReplace) _exec.hooks.postReplace(element, snap)
          } else {
            // Value-only change — surgical patch
            _exec.patch(element, _prevResult, result, delta)
          }
          _prevResult = result
          return
        }
        // No changes — skip DOM update
        _prevResult = result
        return
      }

      // Full replace: first render, replace strategy, or no patch method
      const snap = createSnapshot({ ...(_exec.hooks?.preReplace?.(element) ?? {}), bindings })
      _exec.replace(element, htmlStr)
      // Build compact graph NOW — before postReplace strips data-up-* attrs
      if (_exec._buildGraph) _exec._buildGraph(element)
      if (_exec.hooks?.postReplace) _exec.hooks.postReplace(element, snap)
      _prevResult = result
    }

    if (props) loop.set((prev) => ({ ...prev, ...props }))
    apply()

    const unsubscribe = loop.subscribe(() => { apply() })

    if (mountHook) mountHook(element, { send: loop.send, get: loop.get, registerResource: resources.register })
    element.setAttribute?.('data-up-component', name)

    return () => {
      unsubscribe()
      if (unmountHook) unmountHook(element, { send: loop.send, get: loop.get, registerResource: resources.register })
      element.removeAttribute?.('data-up-component')
      _exec.unmount(element)
      resources.clear()
      _prevResult = null
    }
  }

  // ─── Instance Creation ───────────────────────────────────

  function create(props = {}, ...children) {
    const mergedState = { ...initialState, ...props }
    const instanceLoop = createLoop({
      name: `${name}-instance`,
      state: mergedState,
      update: updateHandlers,
      effect: effectHandlers
    })

    // Auto-compose children via composeFn if provided
    const hasCompose = typeof composeFn === 'function'
    const hasComputeParts = typeof computePartsFn === 'function'

    if (hasCompose && children.length === 0) {
      const parts = hasComputeParts ? computePartsFn(mergedState) : {}
      const composeCtx = { ...mergedState, ...parts }
      const result = composeFn(composeCtx)
      if (Array.isArray(result)) {
        children = result.filter(Boolean)
      } else if (result != null) {
        children = [result].filter(Boolean)
      }
    }
    const cleanChildren = children.filter(Boolean)

    // Reactive children: recompute parts → push props to children
    if (hasComputeParts && hasCompose && cleanChildren.length > 0) {
      instanceLoop.subscribe(() => {
        const s = instanceLoop.get()
        const newParts = computePartsFn(s)

        const flatParts = []
        for (const key of Object.keys(newParts)) {
          const val = newParts[key]
          if (Array.isArray(val)) flatParts.push(...val)
        }

        if (flatParts.length !== cleanChildren.length) return

        for (let i = 0; i < cleanChildren.length && i < flatParts.length; i++) {
          const child = cleanChildren[i]
          const newProps = flatParts[i]
          if (child && child.loop && newProps) {
            const current = child.loop.get()
            let changed = false
            for (const [k, v] of Object.entries(newProps)) {
              if (current[k] !== v) { changed = true; break }
            }
            if (changed) child.loop.set({ ...current, ...newProps })
          }
        }
      })
    }

    // ─── Frame Loop ─────────────────────────────────────
    const frameLoop = createFrameLoop(frameMode, lifecycleMethods, drawFn, renderFn, instanceLoop, cleanChildren, name)

    if (frameMode && !frameLoop.active) {
      frameLoop.start(null)
    }

    const _instResources = new Map()

    function doRender() {
      const state = instanceLoop.get()
      return typeof view === 'function'
        ? view(state, { send: instanceLoop.send }) || ''
        : ''
    }

    function mount(el) {
      function applyMount() {
        const result = doRender()
        if (!result || !el) return

        const baseSnapshot = _exec.hooks?.preReplace?.(el) ?? {}
        let snapshot

        let htmlStr
        if (result && typeof result === 'object') {
          htmlStr = result.toString?.() ?? String(result)
          snapshot = createSnapshot({
            ...baseSnapshot,
            bindings: result.bindings || [],
            send: instanceLoop.send,
            get: instanceLoop.get
          })
        } else {
          htmlStr = String(result)
          snapshot = createSnapshot(baseSnapshot)
        }

        if (_exec.replace) _exec.replace(el, htmlStr); else el.innerHTML = htmlStr

        if (_exec.hooks?.postReplace) {
          _exec.hooks.postReplace(el, snapshot)
        }
      }

      // Find canvas for visual mode: mount element IS the canvas or contains one
      if (frameMode === 'visual' && !frameLoop.active) {
        let canvasEl = null
        if (el.tagName === 'CANVAS') {
          canvasEl = el
        } else {
          canvasEl = el.querySelector?.('canvas')
        }
        if (canvasEl) {
          frameLoop.start(canvasEl)
        } else {
          console.warn(`[Uploop] frameMode "visual" but mount element is not a canvas and contains no canvas. Skipping visual mode.`)
        }
      }

      applyMount()

      // Call mount hook (same as mountTo does)
      let _mountHookCleanup = null
      if (mountHook) {
        _mountHookCleanup = mountHook(el, {
          send: instanceLoop.send,
          get: instanceLoop.get,
          registerResource: (n, h) => _instResources.set(n, h),
          loop: instanceLoop
        })
      }

      const unsub = instanceLoop.subscribe(() => {
        if (!frameMode) applyMount()
      })

      return () => {
        unsub()
        frameLoop.stop()
        if (_mountHookCleanup) _mountHookCleanup()
        _exec.unmount(el)
        _instResources.clear()
      }
    }

    const inst = {
      loop: instanceLoop,
      render: (state) => {
        const s = state || instanceLoop.get()
        if (typeof view === 'function') {
          const r = view(s, { send: instanceLoop.send })
          return r && typeof r === 'object' && typeof r.toString === 'function'
            ? r.toString()
            : String(r)
        }
        return ''
      },
      mount,
      describe: instanceLoop.describe,
      registerResource: (n, h) => _instResources.set(n, h),
      children: cleanChildren,
      get ctx2d() { return frameLoop.ctx2d },
      set ctx2d(v) { frameLoop.ctx2d = v },
      startFrameLoop: frameLoop.start,
      stopFrameLoop: frameLoop.stop
    }

    for (const [key, fn] of Object.entries(lifecycleMethods)) {
      inst[key] = fn
    }

    return inst
  }

  // ─── Callable Descriptor ─────────────────────────────────

  const callable = function(props, ...children) {
    if (children.length > 0) return create(props, ...children)
    if (config._cycleMethods?.composition === 'create') return create(props, ...children)

    // Return template string for composition in parent views
    if (props) loop.set((prev) => ({ ...prev, ...props }))
    const s = loop.get()
    if (typeof view === 'function') {
      const result = view(s, { send: loop.send })
      // Note: Owner send is no longer mutated onto binding objects.
      // Owners are resolved via the ownerSend parameter to applyBindings().
      return result || ''
    }
    return view || ''
  }

  try { Object.defineProperty(callable, 'name', { value: name }) } catch (e) {}
  callable.loop = loop
  callable.view = view                  // expose for SSR
  callable.render = render
  callable.mount = mountTo
  callable.create = create
  callable.describe = loop.describe
  callable.registerNode = loop.registerNode
  callable.registerEdge = loop.registerEdge
  callable.registerResource = resources.register
  callable._updateHandlers = updateHandlers
  callable._initialState = initialState
  if (config._cycleMethods) callable._cycleMethods = config._cycleMethods
  return callable
}

// ─── Custom Component Type Factory ──────────────────────────

/**
 * Create a custom component type with pre-configured defaults.
 *
 * Factory for reusable component archetypes (e.g., Drawable for canvas).
 * Merges type defaults with instance config, chains lifecycle hooks,
 * propagates execution targets, and forwards custom methods.
 *
 * @param {Object} typeDefaults — default config merged into every instance
 * @param {Object} [typeDefaults.execution] — default execution target
 * @returns {Function} Factory: (config) => component descriptor
 */
export function createComponentType(typeDefaults = {}) {
  return function createTyped(config = {}) {
    const merged = {
      ...typeDefaults,
      ...config,
      state: { ...(typeDefaults.state || {}), ...(config.state || {}) },
      update: { ...(typeDefaults.update || {}), ...(config.update || {}) },
      effect: { ...(typeDefaults.effect || {}), ...(config.effect || {}) },
      classes: { ...(typeDefaults.classes || {}), ...(config.classes || {}) },
      ...(config.compose != null ? { compose: config.compose } : {}),
      ...(typeDefaults.compose != null && config.compose == null ? { compose: typeDefaults.compose } : {}),
      ...(config.computeParts != null ? { computeParts: config.computeParts } : {}),
      ...(typeDefaults.computeParts != null && config.computeParts == null ? { computeParts: typeDefaults.computeParts } : {}),
      ...(config.frame != null ? { frame: config.frame } : typeDefaults.frame != null ? { frame: typeDefaults.frame } : {}),
      ...(config.execution != null ? { execution: config.execution } : typeDefaults.execution != null ? { execution: typeDefaults.execution } : {})
    }

    const baseMount = typeDefaults.mount
    const userMount = config.mount
    merged.mount = (el, ctx) => {
      if (baseMount) baseMount(el, ctx)
      if (userMount) userMount(el, ctx)
    }

    const baseUnmount = typeDefaults.unmount
    const userUnmount = config.unmount
    merged.unmount = (el, ctx) => {
      if (userUnmount) userUnmount(el, ctx)
      if (baseUnmount) baseUnmount(el, ctx)
    }

    const baseCycle = typeDefaults.cycleMethods || {}
    const userCycle = config.cycleMethods || {}
    const cycleMethods = {
      composition: userCycle.composition || baseCycle.composition || 'createHtml',
      afterFrame: [...(baseCycle.afterFrame || []), ...(userCycle.afterFrame || [])],
      render: 'render' in userCycle ? userCycle.render : (baseCycle.render ?? null),
      draw: 'draw' in userCycle ? userCycle.draw : (baseCycle.draw ?? null)
    }
    merged._cycleMethods = cycleMethods

    const customMethods = {}
    const reservedKeys = ['state','update','effect','mount','unmount','view','name','classes','compose','computeParts','frame','execution']
    for (const key of Object.keys(config)) {
      if (!reservedKeys.includes(key)) {
        if (typeof config[key] === 'function') {
          customMethods[key] = config[key]
        }
      }
    }

    return component(config.name || typeDefaults.name || 'Custom', merged, customMethods)
  }
}
