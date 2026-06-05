/**
 * @uploop/html Component — v0.0.3
 *
 * Thin wrapper around @uploop/core component().
 * Wires the DOM execution target with html-specific
 * post-processing (bindings, attributes, resources, virtual containers).
 */

import { component as coreComponent, createComponentType as coreCreateComponentType } from '@uploop/core'
import { html, applyBindings, componentTag, processUploopAttributes, processVirtualContainers, consumeContext, resolveScope } from './html.js'
import { createDOMExecution } from '@uploop/core'

/**
 * Create a DOM execution target wired with component-specific context.
 * Context (scope, consume, find) is rebuilt each render from the target element.
 */
function createWiredDOMExecution(loop, resources) {
  const base = createDOMExecution()

  return {
    strategy: base.strategy,
    render: base.render,
    replace: base.replace,
    mount: base.mount,
    unmount: base.unmount,

    hooks: {
      preReplace(target) {
        const snapshot = base.hooks.preReplace(target)
        if (resources.save) {
          snapshot._resources = resources.save()
        }
        return snapshot
      },

      postReplace(target, snapshot = {}) {
        base.hooks.postReplace(target, snapshot)

        // Build DOM context from the current target element (survives innerHTML)
        const ctx = {
          send: loop.send, get: loop.get,
          registerResource: (name, handlers) => resources.register(name, handlers),
          find: (sel) => target.querySelector(sel),
          consume: (n) => consumeContext(target, n),
          scope: (n, tag) => resolveScope(n, tag)
        }

        if (snapshot._bindings && snapshot._bindings.length > 0) {
          const send = snapshot._send || loop.send
          const get = snapshot._get || (() => loop.get())
          applyBindings(target, snapshot._bindings, send, get())
        }

        const pendingVC = processUploopAttributes(target, ctx)

        if (resources.restore && snapshot._resources) {
          resources.restore(snapshot._resources, target)
        }

        processVirtualContainers(target, ctx, pendingVC)
      }
    }
  }
}

/**
 * Define an Uploop component with DOM execution.
 *
 * @param {string} name
 * @param {Object} config
 * @param {Object} [lifecycleMethods]
 * @returns {Function} callable component descriptor
 */
export function component(name, config = {}, lifecycleMethods = {}) {
  const userExec = config.execution

  // Resource registry shared across all mounts of this component
  const resources = {
    _map: new Map(),
    register(name, handlers) {
      if (!this._map.has(name)) this._map.set(name, handlers)
    },
    save() {
      const snap = new Map()
      for (const [n, h] of this._map) {
        if (h.save) try { snap.set(n, h.save()) } catch (e) {}
      }
      return snap
    },
    restore(snap, root) {
      if (!snap || typeof snap.has !== 'function') return
      for (const [n, h] of this._map) {
        if (h.restore && snap.has(n)) try { h.restore(snap.get(n), root) } catch (e) {}
      }
    }
  }

  // Execution factory: core calls this with the loop after creating it
  const execFactory = (loop) => {
    if (userExec) return typeof userExec === 'function' ? userExec(loop) : userExec
    return createWiredDOMExecution(loop, resources)
  }

  // Inject html into the view context, and wire mount hooks to
  // the wrapper's resource registry (not core's separate _resources).
  const origView = config.view
  const origCompose = config.compose
  const wrappedConfig = {
    ...config,
    execution: execFactory,
    view: origView && typeof origView === 'function'
      ? (state, ctx) => origView(state, { ...ctx, html })
      : origView,
    compose: origCompose && typeof origCompose === 'function'
      ? (ctx) => origCompose({ ...ctx, html: componentTag(config.classes || {}) })
      : origCompose,
    // Rewire mount/unmount to use wrapper's resources.register
    // (core has its own _resources; preReplace/postReplace use wrapper's)
    mount: config.mount
      ? (el, ctx) => config.mount(el, { ...ctx, registerResource: (n, h) => resources.register(n, h) })
      : undefined,
    unmount: config.unmount
      ? (el, ctx) => config.unmount(el, { ...ctx, registerResource: (n, h) => resources.register(n, h) })
      : undefined
  }

  const desc = coreComponent(name, wrappedConfig, lifecycleMethods)

  // Override instance mount to wire resources through wrapper's registry
  const _origCreate = desc.create
  desc.create = function(props, ...children) {
    const inst = _origCreate.call(this, props, ...children)
    if (inst && inst.mount) {
      const _origMount = inst.mount
      inst.mount = function(el) {
        // Call mount hook FIRST so user resource registrations take priority
        // over auto-registration from processUploopAttributes
        if (config.mount) {
          config.mount(el, {
            send: inst.loop.send,
            get: inst.loop.get,
            registerResource: (name, handlers) => resources.register(name, handlers)
          })
        }
        const result = _origMount.call(this, el)
        return result
      }
    }
    return inst
  }

  desc._originalView = origView
  desc._html = componentTag(config.classes || {})
  return desc
}

// Wrap core's createComponentType through html's component()
// so compose injection + dom execution apply to typed components.
export function createComponentType(typeDefaults = {}) {
  const coreFactory = coreCreateComponentType(typeDefaults)
  return function createTyped(config = {}) {
    // Use core's deep merge for state/update/effect/classes,
    // then pass through html's component() for DOM wiring.
    // Replicate core's merge logic here:
    const merged = {
      ...typeDefaults,
      ...config,
      state: { ...(typeDefaults.state || {}), ...(config.state || {}) },
      update: { ...(typeDefaults.update || {}), ...(config.update || {}) },
      effect: { ...(typeDefaults.effect || {}), ...(config.effect || {}) },
      classes: { ...(typeDefaults.classes || {}), ...(config.classes || {}) },
      ...(config.compose != null ? { compose: config.compose } : typeDefaults.compose != null ? { compose: typeDefaults.compose } : {}),
      ...(config.computeParts != null ? { computeParts: config.computeParts } : typeDefaults.computeParts != null ? { computeParts: typeDefaults.computeParts } : {}),
      ...(config.frame != null ? { frame: config.frame } : typeDefaults.frame != null ? { frame: typeDefaults.frame } : {}),
      ...(config.execution != null ? { execution: config.execution } : typeDefaults.execution != null ? { execution: typeDefaults.execution } : {})
    }
    // Chain mount/unmount hooks
    if (typeDefaults.mount || config.mount) {
      const base = typeDefaults.mount, user = config.mount
      merged.mount = (el, ctx) => { if (base) base(el, ctx); if (user) user(el, ctx) }
    }
    if (typeDefaults.unmount || config.unmount) {
      const base = typeDefaults.unmount, user = config.unmount
      merged.unmount = (el, ctx) => { if (user) user(el, ctx); if (base) base(el, ctx) }
    }
    // Merge cycle methods
    const baseCycle = typeDefaults.cycleMethods || {}
    const userCycle = config.cycleMethods || {}
    merged._cycleMethods = {
      composition: userCycle.composition || baseCycle.composition || 'createHtml',
      afterFrame: [...(baseCycle.afterFrame || []), ...(userCycle.afterFrame || [])],
      render: 'render' in userCycle ? userCycle.render : (baseCycle.render ?? null),
      draw: 'draw' in userCycle ? userCycle.draw : (baseCycle.draw ?? null)
    }
    // Extract custom methods
    const customMethods = {}
    const reservedKeys = ['state','update','effect','mount','unmount','view','name','classes','compose','computeParts','frame','execution']
    for (const key of Object.keys(config)) {
      if (!reservedKeys.includes(key) && typeof config[key] === 'function') {
        customMethods[key] = config[key]
      }
    }
    return component(config.name || typeDefaults.name || 'Custom', merged, customMethods)
  }
}
