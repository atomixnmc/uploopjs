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

function nodeCtor(node) {
  return node?.ownerDocument?.defaultView?.Node || globalThis.Node
}

function canMorph(from, to) {
  if (!from || !to) return false
  if (from.nodeType !== to.nodeType) return false
  const NodeRef = nodeCtor(from)
  if (from.nodeType === NodeRef.ELEMENT_NODE) return from.tagName === to.tagName
  return true
}

function syncAttributes(from, to) {
  for (const attr of Array.from(from.attributes)) {
    if (!to.hasAttribute(attr.name)) from.removeAttribute(attr.name)
  }
  for (const attr of Array.from(to.attributes)) {
    if (from.getAttribute(attr.name) !== attr.value) from.setAttribute(attr.name, attr.value)
  }
}


function isWhitespaceOnly(node) {
  const NodeRef = nodeCtor(node)
  for (const child of Array.from(node.childNodes || [])) {
    if (child.nodeType === NodeRef.TEXT_NODE && child.nodeValue.trim() === '') continue
    if (child.nodeType === NodeRef.COMMENT_NODE) continue
    return false
  }
  return true
}
function syncFormState(from, to) {
  const tag = from.tagName
  if (tag === 'INPUT') {
    const type = (from.type || '').toLowerCase()
    if (type === 'checkbox' || type === 'radio') {
      from.checked = to.checked
    } else if (from !== from.ownerDocument.activeElement) {
      from.value = to.value
    }
  } else if (tag === 'TEXTAREA') {
    if (from !== from.ownerDocument.activeElement) from.value = to.value
  } else if (tag === 'SELECT') {
    from.value = to.value
  }
}

function morphNode(from, to) {
  if (!canMorph(from, to)) {
    from.replaceWith(to.cloneNode(true))
    return
  }

  const NodeRef = nodeCtor(from)
  if (from.nodeType === NodeRef.TEXT_NODE || from.nodeType === NodeRef.COMMENT_NODE) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue
    return
  }

  if (from.nodeType !== NodeRef.ELEMENT_NODE) return

  syncAttributes(from, to)
  syncFormState(from, to)

  if (to.hasAttribute?.('register-resource') && isWhitespaceOnly(to)) return

  let oldChild = from.firstChild
  let newChild = to.firstChild

  while (oldChild || newChild) {
    if (!oldChild && newChild) {
      targetAppendClone(from, newChild)
      newChild = newChild.nextSibling
      continue
    }

    if (oldChild && !newChild) {
      const nextOld = oldChild.nextSibling
      oldChild.remove()
      oldChild = nextOld
      continue
    }

    const nextOld = oldChild.nextSibling
    const nextNew = newChild.nextSibling
    morphNode(oldChild, newChild)
    oldChild = nextOld
    newChild = nextNew
  }
}

function targetAppendClone(parent, child) {
  parent.appendChild(child.cloneNode(true))
}

export function morphHTML(target, html) {
  const template = target.ownerDocument.createElement('template')
  template.innerHTML = String(html ?? '')

  let oldChild = target.firstChild
  let newChild = template.content.firstChild

  while (oldChild || newChild) {
    if (!oldChild && newChild) {
      targetAppendClone(target, newChild)
      newChild = newChild.nextSibling
      continue
    }

    if (oldChild && !newChild) {
      const nextOld = oldChild.nextSibling
      oldChild.remove()
      oldChild = nextOld
      continue
    }

    const nextOld = oldChild.nextSibling
    const nextNew = newChild.nextSibling
    morphNode(oldChild, newChild)
    oldChild = nextOld
    newChild = nextNew
  }
}

/**
 * Find a comment node within root whose textContent matches the
 * given marker id: `<!-- up:${id} -->`.
 *
 * @param {Node} root
 * @param {string} id
 * @returns {Comment|null}
 */
function findCommentNode(root, id) {
  const SHOW_COMMENT = typeof NodeFilter !== 'undefined' ? NodeFilter.SHOW_COMMENT : 128
  const walker = document.createTreeWalker(root, SHOW_COMMENT)
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
    replace: morphHTML,
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
 * Uses core's computeDelta for structural diffing and the
 * upgraded patch method for marker-based DOM node resolution.
 *
 * @param {Object} domCtx — same domCtx as createDOMExecutionFull
 * @returns {Object} ExecutionTarget-compatible object
 */
export function createDOMPatchExecution(domCtx) {
  const base = createDOMExecution()
  const full = createDOMExecutionFull(domCtx)

  return {
    ...full,
    strategy: base.strategy, // 'patch' from core v0.9

    // Core's patch method uses compact graph for O(1) DOM node resolution
    patch: base.patch,

    // Keep full hooks — the replace path (first render) still needs
    // event binding, attribute scanning, and resource restoration.
    // The patch path (subsequent renders) doesn't touch hooks at all.
    hooks: full.hooks
  }
}
