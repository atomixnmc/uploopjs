/**
 * Resource Manager — v0.0.3
 *
 * Manages persistent DOM resources (canvas, video, etc.) that
 * survive innerHTML replacement: register → save before replace
 * → restore after replace.
 *
 * @module @uploop/core/component-resources
 */

export function createResourceManager() {
  const _resources = new Map()

  return {
    register(name, handlers) {
      if (!_resources.has(name)) _resources.set(name, handlers)
    },

    save() {
      const snap = new Map()
      for (const [name, h] of _resources) {
        if (h.save) {
          try { snap.set(name, h.save()) } catch (e) {}
        }
      }
      return snap
    },

    restore(snap, root) {
      if (!snap) return
      for (const [name, h] of _resources) {
        if (h.restore && snap.has(name)) {
          try { h.restore(snap.get(name), root) } catch (e) {}
        }
      }
    },

    clear() {
      _resources.clear()
    }
  }
}
