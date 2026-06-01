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
          applyBindings(target, snapshot._bindings, loop.send, loop.get())
        }

        processUploopAttributes(target, ctx)

        if (resources.restore && snapshot._resources) {
          resources.restore(target, snapshot._resources)
        }

        processVirtualContainers(target, ctx)
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
      if (!snap) return
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

  // Inject html into the view context
  const origView = config.view
  const origCompose = config.compose
  const wrappedConfig = {
    ...config,
    execution: execFactory,
    view: origView && typeof origView === 'function'
      ? (state, ctx) => origView(state, { ...ctx, html })
      : origView,
    // Inject componentTag as 'html' into compose context
    compose: origCompose && typeof origCompose === 'function'
      ? (ctx) => origCompose({ ...ctx, html: componentTag(config.classes || {}) })
      : origCompose
  }

  const desc = coreComponent(name, wrappedConfig, lifecycleMethods)
  desc._originalView = origView

  // componentTag support for compose()
  desc._html = componentTag(config.classes || {})

  return desc
}

// Re-export core's createComponentType, wrapped through html's component()
export function createComponentType(typeDefaults = {}) {
  const coreFactory = coreCreateComponentType(typeDefaults)
  return function createTyped(config = {}) {
    // Delegate to html's component() so compose injection + dom execution apply
    return component(config.name || typeDefaults.name || 'Custom', { ...typeDefaults, ...config })
  }
}

// Keep core factory accessible for edge cases
createComponentType._core = coreCreateComponentType
