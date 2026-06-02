// ─── Runtime Style Optimizer ──────────────────────────────────
// Tracks which utility classes are actually used in the DOM
// and allows pruning unused rules from injected stylesheets.
//
// Strategy:
//   1. inject({ lazy: true }) — injects only CSS variables + base reset
//   2. As classes appear in DOM, they're added to the "used" set
//   3. On next re-inject, only used classes are generated
//   4. MutationObserver watches for class changes automatically
//
// This gives ≈Tailwind JIT behavior without a build step:
// only the classes you actually write get injected.

import { utility } from './utility.js'

/** @type {Set<string>} */
const _used = new Set()
let _observer = null
let _lazyMode = false

/**
 * Mark a class (or list of classes) as "used".
 * Call this from view templates or DOM mutations.
 *
 * @param {string|string[]} classes - Class name(s) to register
 *
 * @example
 *   // In a component view:
 *   markUsed('bg-primary text-white p-4 rounded-2')
 */
export function markUsed(classes) {
  if (typeof classes === 'string') {
    for (const c of classes.split(/\s+/)) {
      if (c && c.startsWith('.')) _used.add(c.slice(1))
      else if (c) _used.add(c)
    }
  } else if (Array.isArray(classes)) {
    for (const c of classes) markUsed(c)
  }
}

/**
 * Get all used class names collected so far.
 * @returns {string[]}
 */
export function getUsedClasses() {
  return [..._used]
}

/**
 * Clear the used-class registry.
 */
export function resetUsed() {
  _used.clear()
}

/**
 * Start watching the DOM for class usage.
 * Any class that appears on an element is automatically
 * added to the used set.
 *
 * @param {HTMLElement} [root=document.body] - Root to observe
 * @returns {MutationObserver}
 */
export function watchDOM(root) {
  if (_observer) _observer.disconnect()
  if (typeof MutationObserver === 'undefined') return null

  const el = root || (typeof document !== 'undefined' ? document.body : null)
  if (!el) return null

  _observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        const cls = m.target.getAttribute('class')
        if (cls) markUsed(cls)
      }
      if (m.type === 'childList') {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            const cls = node.getAttribute?.('class')
            if (cls) markUsed(cls)
            // Also scan children
            for (const child of node.querySelectorAll?.('*') || []) {
              const ccls = child.getAttribute?.('class')
              if (ccls) markUsed(ccls)
            }
          }
        }
      }
    }
  })

  _observer.observe(el, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true,
  })

  // Scan existing DOM
  for (const el of (root || document).querySelectorAll('[class]')) {
    const cls = el.getAttribute('class')
    if (cls) markUsed(cls)
  }

  return _observer
}

/**
 * Stop watching the DOM.
 */
export function unwatchDOM() {
  if (_observer) {
    _observer.disconnect()
    _observer = null
  }
}

/**
 * Generate only the utility rules for classes that have been
 * marked as "used". Falls back to all rules if no tracking.
 *
 * @param {Object} [opts]
 * @param {Object} [opts.tokens] - Token overrides
 * @returns {{ selector: string, css: string }[]}
 */
export function usedRules(opts = {}) {
  if (_used.size === 0) return utility(opts)
  const all = utility(opts)
  // Filter: keep rules whose selector (minus leading dot) matches a used class
  return all.filter((r) => {
    const cls = r.selector.replace(/^\./, '').replace(/\\:/g, ':')
    // Exact match or starts-with for pseudo-classes
    return _used.has(cls) ||
      [..._used].some(u => cls.startsWith(u + ':') || cls.startsWith(u + ' '))
  })
}

/**
 * Get statistics about used vs total rules.
 * @param {Object} [opts] - Token overrides
 * @returns {{ used: number, total: number, savings: string }}
 */
export function stats(opts = {}) {
  const all = utility(opts)
  const used = usedRules(opts)
  const pct = all.length > 0
    ? Math.round((1 - used.length / all.length) * 100)
    : 0
  return {
    used: used.length,
    total: all.length,
    savings: `${pct}% (${all.length - used.length} rules pruned)`
  }
}

/** @returns {boolean} Whether the used-class set has entries. */
export function hasTracking() {
  return _used.size > 0
}
