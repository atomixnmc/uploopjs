import { createLoop } from '@uploop/core'
import { html, isHtmlTemplate, applyBindings, componentTag, processUploopAttributes, processVirtualContainers, consumeContext, resolveScope } from './html.js'

/**
 * Define an Uploop HyperGraph component.
 *
 * A component embeds a core `createLoop` and wraps it with:
 *  - view rendering (via html\`...\` or string)
 *  - DOM mount/unmount lifecycle
 *  - focus preservation across re-renders
 *  - persistent resource management (canvas, video, etc.)
 *
 * Persistent resources are registered with `registerResource()`.
 * Before every innerHTML re-render, `save()` captures state.
 * After re-render + bindings, `restore()` replays it.
 * This prevents canvas drawings, scroll positions, etc. from
 * being destroyed by DOM replacement.
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
    computeParts: computePartsFn,
    render: renderFn,
    draw: drawFn,
    frame: frameMode
  } = config

  const loop = createLoop({
    name,
    state: { ...initialState },
    update: { ...updateHandlers },
    effect: { ...effectHandlers }
  })

  loop.registerNode('view', { type: 'view', dependsOn: ['state'] })
  if (view) loop.registerEdge('state', 'view')
  for (const key of Object.keys(updateHandlers)) {
    loop.registerEdge(key, 'state')
    loop.registerEdge(key, 'view')
  }

  // ─── Persistent Resources ───────────────────────────────
  const _resources = new Map()
  let _snapshots = null

  function registerResource(name, handlers) {
    // Idempotent — first registration wins (canvas from initial render)
    if (!_resources.has(name)) _resources.set(name, handlers)
  }

  function saveResources() {
    _snapshots = new Map()
    for (const [name, h] of _resources) {
      if (h.save) {
        try { _snapshots.set(name, h.save()) } catch (e) {}
      }
    }
  }

  function restoreResources(root) {
    if (!_snapshots) return
    for (const [name, h] of _resources) {
      if (h.restore && _snapshots.has(name)) {
        try { h.restore(_snapshots.get(name), root) } catch (e) {}
      }
    }
    _snapshots = null
  }

  // ─── Render & Mount ─────────────────────────────────────

  function renderView(props) {
    if (props) loop.set((prev) => ({ ...prev, ...props }))
    const s = loop.get()
    if (typeof view === 'function') return view(s, { send: loop.send, html }) || ''
    if (isHtmlTemplate(view)) return view
    return ''
  }

  function render(props) {
    const result = renderView(props)
    return isHtmlTemplate(result) ? result.toString() : String(result)
  }

  // Returns raw html template object (with bindings) when called
  // inside a parent html\`...\`. The parent's html tag merges bindings
  // so events/props from child components are properly wired.
  function renderTemplate(props) {
    if (props) loop.set((prev) => ({ ...prev, ...props }))
    const s = loop.get()
    if (typeof view === 'function') {
      const result = view(s, { send: loop.send, html })
      // Tag bindings that came from THIS component (not nested children)
      // with this component's send. Nested children already have _ownerSend
      // set by their own renderTemplate call — we must not overwrite it.
      if (result && result.bindings) {
        for (const b of result.bindings) {
          if (!b._ownerSend) b._ownerSend = loop.send
        }
      }
      return result || ''
    }
    return view || ''
  }

  function mountTo(element, props) {
    if (!element) return () => {}

    const ctx = { send: loop.send, get: loop.get, registerResource, find: (sel) => element.querySelector(sel), consume: (name) => consumeContext(element, name), scope: (name, tag) => resolveScope(name, tag) }

    function apply() {
      const result = renderView()
      if (!result) return

      // Save persistent resources before DOM replacement
      saveResources()

      const focusState = saveFocus(element)

      let htmlStr, bindings = []
      if (isHtmlTemplate(result)) {
        htmlStr = result.toString()
        bindings = result.bindings || []
      } else {
        htmlStr = String(result)
      }

      element.innerHTML = htmlStr
      applyBindings(element, bindings, loop.send, loop.get())

      // Process scope/context/resource markers (pre-restore)
      processUploopAttributes(element, ctx)

      // Restore persistent resources — re-inserts canvas etc.
      restoreResources(element)

      // Second pass: process virtual containers on restored elements.
      // The canvas element may now be the restored one (with existing
      // instances). New placeholder DOM children carry updated props.
      processVirtualContainers(element, ctx)

      restoreFocus(element, focusState)
      if (focusState) requestAnimationFrame(() => restoreFocus(element, focusState))
    }

    if (props) loop.set((prev) => ({ ...prev, ...props }))
    apply()

    const unsubscribe = loop.subscribe(() => { apply() })

    if (mountHook) mountHook(element, ctx)
    element.setAttribute('data-up-component', name)

    return () => {
      unsubscribe()
      if (unmountHook) unmountHook(element, ctx)
      element.removeAttribute('data-up-component')
      element.innerHTML = ''
      _resources.clear()
    }
  }

  function create(props = {}, ...children) {
    const mergedState = { ...initialState, ...props }
    const instanceLoop = createLoop({
      name: `${name}-instance`,
      state: mergedState,
      update: updateHandlers,
      effect: effectHandlers
    })

    // Auto-compose children via composeFn if provided and no explicit children
    const composeHtml = componentTag(componentClasses)
    const hasCompose = typeof composeFn === 'function'
    const hasComputeParts = typeof computePartsFn === 'function'

    if (hasCompose && children.length === 0) {
      // Pre-compute parts if computePartsFn is provided
      const parts = hasComputeParts ? computePartsFn(mergedState) : {}
      const composeCtx = { ...mergedState, ...parts, html: composeHtml }
      const result = composeFn(composeCtx, composeHtml)
      if (Array.isArray(result)) {
        children = result.filter(Boolean)
      } else if (result != null) {
        children = [result].filter(Boolean)
      }
    }
    const cleanChildren = children.filter(Boolean)

    // ─── Reactive Children ───────────────────────────────────
    // When parent state changes, recompute parts and push as
    // props to children. Only active when computeParts output
    // count matches children count (e.g. Car→Wheels: 4=4, not
    // Scene→Actors: 3≠5).
    if (hasComputeParts && hasCompose && cleanChildren.length > 0) {
      const _partsUnsub = instanceLoop.subscribe(() => {
        const s = instanceLoop.get()
        const newParts = computePartsFn(s)

        // Flatten all part arrays into a flat list matching compose order.
        const flatParts = []
        for (const key of Object.keys(newParts)) {
          const val = newParts[key]
          if (Array.isArray(val)) flatParts.push(...val)
        }

        // Only push if parts exactly match children count.
        // Scene's actors (3) ≠ its children (5). Car's wheels+doors (4) = children (4).
        if (flatParts.length !== cleanChildren.length) return

        // Push updated props to children (only if changed)
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

    // ─── Frame Timing (rAF) ──────────────────────────────────
      let _animId = null
      let _startTime = 0
      let _lastTime = 0
      let _ctx2d = null

      function startFrameLoop(el) {
        if (frameMode === 'visual') {
          // Auto-resolve canvas context if not already set
          if (!_ctx2d && el) {
            let canvas = el?.closest?.('canvas') || el?.parentElement?.closest?.('canvas')
            if (!canvas && el?.ownerDocument) {
              canvas = el.ownerDocument.querySelector('canvas')
            }
            if (canvas) {
              _ctx2d = canvas.getContext('2d')
              instanceLoop._canvasEl = canvas
            }
          }

          _startTime = performance.now()
          _lastTime = _startTime

          let _frameCount = 0
          function tick() {
            const now = performance.now()
            const elapsed = now - _startTime
            const delta = now - _lastTime
            _lastTime = now

            // Inject timing into state for reactive subscribers
            instanceLoop.set({ elapsed, delta })

            // Call draw cycle method if defined (deferred until ctx available)
            const drawHandler = lifecycleMethods.draw || drawFn || renderFn
            if (typeof drawHandler === 'function' && _ctx2d) {
              try {
                drawHandler(_ctx2d, instanceLoop.get(), cleanChildren, { elapsed, delta })
              } catch (e) { console.error(`[Uploop] draw error in "${name}":`, e) }
            }

          _animId = requestAnimationFrame(tick)
        }
        _animId = requestAnimationFrame(tick)
      }
    }

    function stopFrameLoop() {
      if (_animId != null) {
        cancelAnimationFrame(_animId)
        _animId = null
      }
    }

    // Auto-start frame loop on creation (not only on mount).
    // draw() is deferred until ctx2d is available.
    // For DOM-mounted components, el is the mount element.
    // For imperatively-created components, ctx2d is injected later.
    if (frameMode && !_animId) {
      startFrameLoop(null)
    }

    const _instResources = new Map()

    function doRender() {
      const state = instanceLoop.get()
      return typeof view === 'function'
        ? view(state, { send: instanceLoop.send, html }) || ''
        : ''
    }

    function saveInstResources() {
      const snap = new Map()
      for (const [name, h] of _instResources) {
        if (h.save) try { snap.set(name, h.save()) } catch (e) {}
      }
      return snap
    }

    function restoreInstResources(snap) {
      if (!snap) return
      for (const [name, h] of _instResources) {
        if (h.restore && snap.has(name)) try { h.restore(snap.get(name)) } catch (e) {}
      }
    }

    function mount(el) {
      // Auto-resolve canvas context when mounted inside a <canvas>
      if (frameMode === 'visual' && !_ctx2d) {
        let canvas = el?.closest?.('canvas') || el?.parentElement?.closest?.('canvas')
        if (!canvas && el?.ownerDocument) {
          canvas = el.ownerDocument.querySelector('canvas')
        }
        if (canvas) {
          _ctx2d = canvas.getContext('2d')
          instanceLoop._canvasEl = canvas
        }
      }

      function applyMount() {
        const result = doRender()
        if (!result || !el) return
        const saved = saveInstResources()
        const focusState = saveFocus(el)
        if (isHtmlTemplate(result)) {
          el.innerHTML = result.toString()
          bindEvents(el, result.bindings || [], instanceLoop.send, instanceLoop.get())
        } else {
          el.innerHTML = String(result)
        }
        restoreInstResources(saved)
        restoreFocus(el, focusState)
        if (focusState) requestAnimationFrame(() => restoreFocus(el, focusState))
      }

      // Don't fire frame loop on mount — the parent canvas component
      // drives the render chain through its own frame loop
      if (frameMode && !_animId) {
        startFrameLoop(el)
      }

      applyMount()
      const unsub = instanceLoop.subscribe(() => {
        // For standard (non-frame) components, re-render view on state change.
        // Frame components are driven by rAF, not by subscribe.
        if (!frameMode) applyMount()
      })

      return () => {
        unsub()
        stopFrameLoop()
        el.innerHTML = ''
        _instResources.clear()
      }
    }

    const inst = {
      loop: instanceLoop,
      render: (state) => {
        const s = state || instanceLoop.get()
        if (typeof view === 'function') {
          const r = view(s, { send: instanceLoop.send, html })
          return isHtmlTemplate(r) ? r.toString() : String(r)
        }
        return ''
      },
      mount,
      describe: instanceLoop.describe,
      registerResource: (name, h) => _instResources.set(name, h),
      children: cleanChildren,
      // Allow parent to inject canvas context for frame-driven components
      set ctx2d(v) { _ctx2d = v },
      get ctx2d() { return _ctx2d },
      startFrameLoop,
      stopFrameLoop
    }

    // Attach custom lifecycle methods (from createComponentType)
    for (const [key, fn] of Object.entries(lifecycleMethods)) {
      inst[key] = fn
    }

    return inst
  }

  // Return a callable descriptor.
  // Usage:
  //   GridSearch(props)       → renders to string (like old $view)
  //   GridSearch.render(props) → same
  //   GridSearch.describe()    → HyperGraph manifest
  //   GridSearch.mount(el)     → mount to DOM
  //
  // When called as a function (e.g. ${GridSearch(props)} inside html\`...\`),
  // return the raw html template object so parent's html tag merges bindings.
  // This ensures events (@input, @click) and props (.value) from child
  // components are properly wired by the parent's applyBindings().
  const callable = function(props, ...children) {
    // composition: 'create' → always return instance (canvas/Drawable)
    // composition: 'createHtml' (default) → return html template when no children
    if (children.length > 0) return create(props, ...children)
    if (config._cycleMethods && config._cycleMethods.composition === 'create') return create(props, ...children)
    return renderTemplate(props || undefined)
  }
  try { Object.defineProperty(callable, 'name', { value: name }) } catch (e) {}
  callable.loop = loop
  callable.render = render
  callable.mount = mountTo
  callable.create = create
  callable.describe = loop.describe
  callable.registerNode = loop.registerNode
  callable.registerEdge = loop.registerEdge
  callable.registerResource = registerResource
  callable._updateHandlers = updateHandlers
  callable._initialState = initialState
  if (config._cycleMethods) callable._cycleMethods = config._cycleMethods
  return callable
}

// ─── Focus Preservation ─────────────────────────────────────

function saveFocus(root) {
  const active = document.activeElement
  if (!active || !root.contains(active)) return null
  const tag = active.tagName
  const type = active.type || ''
  const placeholder = active.getAttribute('placeholder') || ''
  const name = active.getAttribute('name') || ''
  let selectionStart = -1, selectionEnd = -1
  if ((tag === 'INPUT' || tag === 'TEXTAREA') && typeof active.selectionStart === 'number') {
    selectionStart = active.selectionStart
    selectionEnd = active.selectionEnd
  }
  const tagL = tag.toLowerCase()
  const parts = [tagL]
  if (type && type !== 'text') parts.push(`[type="${type}"]`)
  if (placeholder) parts.push(`[placeholder="${placeholder.replace(/"/g, '\\"')}"]`)
  if (name) parts.push(`[name="${name}"]`)
  const selector = parts.join('')
  let index = -1
  if (!placeholder && !name) {
    const parent = active.parentElement
    if (parent) {
      const siblings = parent.querySelectorAll(tagL)
      index = Array.from(siblings).indexOf(active)
    }
  }
  return { selector, tag: tagL, selectionStart, selectionEnd, index }
}

function restoreFocus(root, state) {
  if (!state) return
  let target = null
  if (state.selector) target = root.querySelector(state.selector)
  if (!target && state.index >= 0) {
    const siblings = root.querySelectorAll(state.tag)
    target = siblings[state.index] || null
  }
  if (!target) return
  target.focus()
  if (state.selectionStart >= 0 && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
    target.setSelectionRange(state.selectionStart, state.selectionEnd)
  }
}

function bindEvents(el, bindings, send, state) {
  try { applyBindings(el, bindings, send, state) } catch (e) {}
}

// ─── Custom Component Type Factory ──────────────────────────

/**
 * Create a custom component type with pre-configured hooks.
 *
 * This lets you define reusable component archetypes without
 * depending on the low-level `component()` contract each time.
 *
 * Example — a "Drawable" component type with auto-rAF loop:
 *
 * ```js
 * const Drawable = createComponentType({
 *   // mount() auto-creates canvas + starts rAF calling draw()
 *   setup: (ctx) => {
 *     ctx.startDrawLoop()
 *   }
 * })
 *
 * const MyCanvas = Drawable({
 *   state: { x: 0 },
 *   draw: (ctx, delta) => { /* render * / }
 * })
 * ```
 *
 * @param {Object} typeDefaults - Default hooks merged into every instance
 * @returns {Function} Factory: (config) => component descriptor
 */
export function createComponentType(typeDefaults = {}) {
  return function createTyped(config = {}) {
    // Merge state, update, effect, classes
    const merged = {
      ...typeDefaults,
      ...config,
      state: { ...(typeDefaults.state || {}), ...(config.state || {}) },
      update: { ...(typeDefaults.update || {}), ...(config.update || {}) },
      effect: { ...(typeDefaults.effect || {}), ...(config.effect || {}) },
      classes: { ...(typeDefaults.classes || {}), ...(config.classes || {}) },
      // compose / computeParts: user's overrides type default
      ...(config.compose != null ? { compose: config.compose } : {}),
      ...(typeDefaults.compose != null && config.compose == null ? { compose: typeDefaults.compose } : {}),
      ...(config.computeParts != null ? { computeParts: config.computeParts } : {}),
      ...(typeDefaults.computeParts != null && config.computeParts == null ? { computeParts: typeDefaults.computeParts } : {}),
      // frame: rAF scheduling mode (null | "visual" | "micro" | "idle" | "manual")
      ...(config.frame != null ? { frame: config.frame } : typeDefaults.frame != null ? { frame: typeDefaults.frame } : {})
    }

    // Chain mount hooks
    const baseMount = typeDefaults.mount
    const userMount = config.mount
    merged.mount = (el, ctx) => {
      if (baseMount) baseMount(el, ctx)
      if (userMount) userMount(el, ctx)
    }

    // Chain unmount hooks
    const baseUnmount = typeDefaults.unmount
    const userUnmount = config.unmount
    merged.unmount = (el, ctx) => {
      if (userUnmount) userUnmount(el, ctx)
      if (baseUnmount) baseUnmount(el, ctx)
    }

    // Merge cycle methods (declarative lifecycle)
    const baseCycle = typeDefaults.cycleMethods || {}
    const userCycle = config.cycleMethods || {}
    const cycleMethods = {
      composition: userCycle.composition || baseCycle.composition || 'createHtml',
      afterFrame: [...(baseCycle.afterFrame || []), ...(userCycle.afterFrame || [])],
      // render/draw is a first-class cycle method — the Drawable's frame pass
      render: 'render' in userCycle ? userCycle.render : (baseCycle.render ?? null),
      // draw cycle: called each frame with (ctx, state, children, { elapsed, delta })
      draw: 'draw' in userCycle ? userCycle.draw : (baseCycle.draw ?? null)
    }
    merged._cycleMethods = cycleMethods

    // Extract custom methods (draw, render, etc.)
    const customMethods = {}
    const reservedKeys = ['state','update','effect','mount','unmount','view','name','classes','compose','computeParts','frame']
    for (const key of Object.keys(config)) {
      if (!reservedKeys.includes(key)) {
        if (typeof config[key] === 'function') {
          customMethods[key] = config[key]
        }
      }
    }

    const desc = component(config.name || typeDefaults.name || 'Custom', merged, customMethods)
    return desc
  }
}
