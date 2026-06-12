/**
 * Batch multiple state updates into a single notification.
 * Prevents cascading re-renders when multiple updates happen together.
 *
 * @returns {Function} batcher function with its own isolated state
 */
export function createBatcher() {
  let _depth = 0;
  let _pendingNotify = null;

  return function batch(fn, { notify } = {}) {
    _depth++;

    try {
      fn();
    } finally {
      _depth--;
    }

    if (notify) {
      _pendingNotify = notify;
    }

    if (_depth === 0 && _pendingNotify) {
      const n = _pendingNotify;
      _pendingNotify = null;
      n();
    }
  };
}

/** Default singleton batcher for backward compatibility */
export const batch = createBatcher();
