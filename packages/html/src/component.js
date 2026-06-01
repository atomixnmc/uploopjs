/**
 * @uploop/html Component — v0.0.3
 *
 * Thin wrapper around @uploop/core component().
 * Wires the DOM execution target with html-specific
 * post-processing (bindings, attributes, resources, virtual containers).
 *
 * Re-exports core's component() and createComponentType()
 * for backward compatibility with v0.0.2 consumers.
 */

import { component as coreComponent, createComponentType as coreCreateComponentType } from '@uploop/core'
import { html, isHtmlTemplate, applyBindings, componentTag, processUploopAttributes, processVirtualContainers, consumeContext, resolveScope } from './html.js'
import { createDOMExecution } from '@uploop/core'

/**
 * Create a DOM execution target wired with component-specific context.
 * @param {Object} loop — the component's createLoop instance
 * @param {Object} ctx — compound context with registerResource, scope, consume, etc.
 * @param {Object} resources — { save, restore } for persistent resources
 * @returns {Object} ExecutionTarget-compatible
 */
function createWiredDOMExecution(loop, ctx, resources) {
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

        // Save persistent resources before DOM destruction
        if (resources.save) {
          snapshot._resources = resources.save()
        }

        return snapshot
      },

      postReplace(target, snapshot = {}) {
        // Restore focus (base DOM execution)
        base.hooks.postReplace(target, snapshot)

        // Wire event/prop bindings from template
        if (snapshot._bindings && snapshot._bindings.length > 0) {
          applyBindings(target, snapshot._bindings, loop.send, loop.get())
        }

        // Scan for scope/context/resource markers
        processUploopAttributes(target, ctx)

        // Restore persistent resources (re-insert canvas etc.)
        if (resources.restore && snapshot._resources) {
          resources.restore(target, snapshot._resources)
        }

        // Hydrate virtual container instances
        processVirtualContainers(target, ctx)
      }
    }
  }
}

/**
 * Define an Uploop component with DOM execution.
 *
 * Same API as core component() but automatically wires
 * the DOM execution target with html template processing.
 *
 * @param {string} name
 * @param {Object} config
 * @param {Object} [lifecycleMethods]
 * @returns {Function} callable component descriptor
 */
export function component(name, config = {}, lifecycleMethods = {}) {
  // Defer execution target creation to mount time so we capture
  // the right element for ctx.scope / ctx.consume
  const userExec = config.execution

  // Wrap in a lazy execution target that creates the DOM execution
  // on first mount, when we have access to the DOM element
  let _wiredExec = null

  const lazyExec = {
    get strategy() { return (_wiredExec || userExec).strategy },
    get render() { return (_wiredExec || userExec).render },
    get replace() { return (_wiredExec || userExec).replace },
    get mount() { return (_wiredExec || userExec).mount },
    get unmount() { return (_wiredExec || userExec).unmount },
    get hooks() { return (_wiredExec || userExec).hooks },

    // Called by component()'s mountTo when the element is known
    _wire(element, loop) {
      if (_wiredExec) return
      const ctx = {
        send: loop.send, get: loop.get,
        find: (sel) => element.querySelector(sel),
        consume: (n) => consumeContext(element, n),
        scope: (n, tag) => resolveScope(n, tag)
      }

      // Capture resources from the component's scope (set by mountTo)
      const resources = {
        _map: new Map(),
        register(name, handlers) {
          if (!this._map.has(name)) this._map.set(name, handlers)
        },
        save() {
          const snap = new Map()
          for (const [name, h] of this._map) {
            if (h.save) try { snap.set(name, h.save()) } catch (e) {}
          }
          return snap
        },
        restore(snap, root) {
          if (!snap) return
          for (const [name, h] of this._map) {
            if (h.restore && snap.has(name)) try { h.restore(snap.get(name), root) } catch (e) {}
          }
        }
      }

      // Wire registerResource to the execution's resource map
      ctx.registerResource = (name, handlers) => resources.register(name, handlers)

      _wiredExec = createWiredDOMExecution(loop, ctx, resources)
    }
  }

  // If user provided an explicit execution target, use it directly
  // Otherwise use our lazy DOM execution
  const finalExec = userExec || lazyExec

  // Create the core component with the execution target.
  // Inject html into the view context for template literal support.
  const origView = config.view
  const wrappedConfig = {
    ...config,
    execution: finalExec,
    view: origView && typeof origView === 'function'
      ? (state, ctx) => origView(state, { ...ctx, html })
      : origView
  }

  const desc = coreComponent(name, wrappedConfig, lifecycleMethods)

  // Restore original view for describe() and direct render calls
  desc._originalView = origView

  // Wrap mount/mountTo to wire the lazy execution target on first mount
  if (!userExec) {
    const origMount = desc.mount
    desc.mount = function(element, props) {
      finalExec._wire(element, desc.loop)
      return origMount.call(this, element, props)
    }

    // Also wrap create()'s mount for instances
    const origCreate = desc.create
    desc.create = function(createProps, ...children) {
      const inst = origCreate.call(this, createProps, ...children)
      const origInstMount = inst.mount
      inst.mount = function(el) {
        finalExec._wire(el, inst.loop)
        return origInstMount.call(this, el)
      }
      return inst
    }
  }

  // Re-attach componentTag support for compose()
  const composeHtml = componentTag(config.classes || {})
  desc._html = composeHtml

  return desc
}

// Re-export core's createComponentType (no DOM wrapping needed —
// it just merges configs and delegates to component())
export { coreCreateComponentType as createComponentType }
