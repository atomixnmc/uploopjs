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
 * Find a comment node within root whose textContent matches the
 * given marker id: `<!-- up:${id} -->`.
 *
 * @param {Node} root
 * @param {string} id
 * @returns {Comment|null}
 */
function findCommentNode(root, id) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  const target = `up:${id}`
  let node
  while ((node = walker.nextNode())) {
    if (node.textContent?.trim() === target) return node
  }
  return null
}

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
    patch: base.patch,
    mount: base.mount,
    unmount: base.unmount,

    hooks: {
      preReplace(target) {
        const snapshot = base.hooks.preReplace(target)

        // Save persistent resources (canvas, video) before DOM destruction
        if (domCtx.saveResources) {
          snapshot.resources = domCtx.saveResources()
        }

        return snapshot
      },

      postReplace(target, snapshot = {}) {
        // Restore focus (base DOM execution)
        base.hooks.postReplace(target, snapshot)

        // Wire event/prop bindings from template
        if (snapshot.bindings && snapshot.bindings.length > 0) {
          applyBindings(target, snapshot.bindings, domCtx.send, domCtx.get?.(), domCtx.send)
        }

        // Scan for scope/context/resource markers, collect pending VC
        const pendingVC = processUploopAttributes(target, domCtx.ctx)

        // Restore persistent resources (re-insert canvas etc.)
        if (domCtx.restoreResources && snapshot.resources) {
          domCtx.restoreResources(target, snapshot.resources)
        }

        // Hydrate virtual container instances
        processVirtualContainers(target, domCtx.ctx, pendingVC)
      }
    }
  }
}

/**
 * Create a DOM execution target with strategy: 'patch'.
 *
 * Uses comment markers (`<!-- up:id -->`) and data attributes
 * (`data-up-prop`, `data-up-bool`) for surgical DOM updates.
 * DOM nodes survive updates — events, focus, and scroll are
 * naturally preserved without save/restore hooks.
 *
 * @param {Object} domCtx — same domCtx as createDOMExecutionFull
 * @returns {Object} ExecutionTarget-compatible object
 */
export function createDOMPatchExecution(domCtx) {
  const base = createDOMExecution()
  const full = createDOMExecutionFull(domCtx)

  return {
    ...full,
    strategy: 'patch',

    patch(target, prevOutput, nextOutput, delta) {
      // Use the html-level patchTemplate for DOM updates
      if (delta?.parts) {
        for (const part of delta.parts) {
          if (part.type === 'text') {
            // No markers — text patches need DOM tree walking.
            // Prop and bool bindings use data attributes for targeting.
          } else if (part.type === 'prop') {
            const el = target.querySelector(`[data-up-prop="${part.name}:${part.id}"]`)
            if (el) el[part.name] = part.value
          } else if (part.type === 'bool') {
            const el = target.querySelector(`[data-up-bool="${part.name}:${part.id}"]`)
            if (el) {
              if (part.value) el.setAttribute(part.name, '')
              else el.removeAttribute(part.name)
            }
          }
        }
      }
    },

    hooks: {
      ...full.hooks,
      // Patch strategy: no pre/post replace needed — DOM survives
      preReplace() { return {} },
      postReplace() {}
    }
  }
}
