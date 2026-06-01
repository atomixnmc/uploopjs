/**
 * Create a disposable scope.
 * Allows grouping cleanup operations together.
 *
 * @returns {Object} Scope
 */
export function createScope() {
  const cleanups = []

  function onDispose(fn) {
    cleanups.push(fn)
  }

  function dispose() {
    // Run in reverse order (stack-like)
    for (let i = cleanups.length - 1; i >= 0; i--) {
      try { cleanups[i]() } catch (e) { console.error('Scope cleanup error:', e) }
    }
    cleanups.length = 0
  }

  return { onDispose, dispose }
}
