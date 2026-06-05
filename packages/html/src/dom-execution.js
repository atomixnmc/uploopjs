/**
 * DOM Execution Target — v0.0.3
 *
 * A DOM-specific execution target that extends createDOMExecution
 * with html template processing: event/prop bindings, attribute
 * scanning, resource preservation, and virtual container hydration.
 *
 * This is what @uploop/html wires into the core component() pipeline.
 *
 * @module @uploop/html/dom-execution
 */

import { createDOMExecution } from '@uploop/core'
import { applyBindings, processUploopAttributes, processVirtualContainers } from './html.js'

/**
 * Create a DOM execution target with full html post-processing.
 *
 * The domCtx object provides component-level state that the
 * hooks need: resource save/restore callbacks, send/get for
 * event binding, and the compound ctx for scope resolution.
 *
 * @param {Object} domCtx
 * @param {Function} domCtx.send — loop.send for event dispatch
 * @param {Function} domCtx.get — loop.get for current state
 * @param {Object} domCtx.ctx — compound context { send, get, registerResource, find, consume, scope }
 * @param {Function} [domCtx.saveResources] — capture persistent resources before render
 * @param {Function} [domCtx.restoreResources] — replay persistent resources after render
 * @returns {Object} ExecutionTarget-compatible object
 */
export function createDOMExecutionFull(domCtx) {
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

        // Save persistent resources (canvas, video) before DOM destruction
        if (domCtx.saveResources) {
          snapshot._resources = domCtx.saveResources()
        }

        return snapshot
      },

      postReplace(target, snapshot = {}) {
        // Restore focus (base DOM execution)
        base.hooks.postReplace(target, snapshot)

        // Wire event/prop bindings from template
        if (snapshot._bindings && snapshot._bindings.length > 0) {
          applyBindings(target, snapshot._bindings, domCtx.send, domCtx.get?.())
        }

        // Scan for scope/context/resource markers
        processUploopAttributes(target, domCtx.ctx)

        // Restore persistent resources (re-insert canvas etc.)
        if (domCtx.restoreResources && snapshot._resources) {
          domCtx.restoreResources(target, snapshot._resources)
        }

        // Hydrate virtual container instances
        processVirtualContainers(target, domCtx.ctx)
      }
    }
  }
}
