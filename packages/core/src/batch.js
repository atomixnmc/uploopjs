/**
 * Batch multiple state updates into a single notification.
 * Prevents cascading re-renders when multiple updates happen together.
 *
 * @param {Function} fn - Function that performs batched updates
 * @param {Object} options
 * @param {Function} options.notify - Notification function to call after batch
 */
export function batch(fn, { notify } = {}) {
  if (batch._depth === undefined) batch._depth = 0
  if (batch._pendingNotify === undefined) batch._pendingNotify = null

  batch._depth++

  try {
    fn()
  } finally {
    batch._depth--
  }

  if (notify) {
    batch._pendingNotify = notify
  }

  if (batch._depth === 0 && batch._pendingNotify) {
    const n = batch._pendingNotify
    batch._pendingNotify = null
    n()
  }
}
