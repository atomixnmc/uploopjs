/**
 * Create a frame scheduler.
 *
 * Frame types:
 * - sync:    immediate flush, no scheduling (for SSR)
 * - micro:   microtask-based, immediate execution
 * - visual:  requestAnimationFrame
 * - idle:    requestIdleCallback
 * - manual:  explicit flush only
 *
 * @param {'sync'|'micro'|'visual'|'idle'|'manual'} mode
 * @returns {import('./types.js').Frame}
 */
export function createFrame(mode = 'micro') {
  const queue = []
  let isScheduled = false
  let isDisposed = false

  function schedule(fn) {
    if (isDisposed) return
    queue.push(fn)
    if (!isScheduled) {
      isScheduled = true
      scheduleFlush()
    }
  }

  function scheduleFlush() {
    switch (mode) {
      case 'sync':
        flush()  // immediate, no scheduling — for SSR
        break
      case 'micro':
        // Use microtask for instant but non-blocking
        queueMicrotask(flush)
        break
      case 'visual': {
        const id = requestAnimationFrame(() => {
          isScheduled = false
          flush()
        })
        // Store id for potential cancel
        if (typeof _rafId === 'undefined') {
          Object.defineProperty(schedule, '_rafId', { value: id })
        }
        break
      }
      case 'idle': {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => {
            isScheduled = false
            flush()
          }, { timeout: 50 })
        } else {
          // Fallback to microtask
          setTimeout(flush, 0)
        }
        break
      }
      case 'manual':
        isScheduled = false
        break
    }
  }

  function flush() {
    if (isDisposed) return
    isScheduled = false
    const batch = queue.splice(0, queue.length)
    for (const fn of batch) {
      try { fn() } catch (e) { console.error('Frame error:', e) }
    }
  }

  function dispose() {
    isDisposed = true
    queue.length = 0
    isScheduled = false
  }

  return { schedule, flush, dispose }
}
