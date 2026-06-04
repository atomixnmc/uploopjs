/**
 * Event Capture — intercept and record events sent through a
 * component's loop for the HyperGraph Inspector.
 *
 * @module @uploop/devutils/event-capture
 */

const _histories = new WeakMap() // loop → [{ event, timestamp, args }]
const MAX_EVENTS = 100

/**
 * Start capturing events on a component's loop.
 * Wraps `loop.send` to record event names, timestamps, and arguments.
 *
 * @param {Object} comp — component descriptor with a `.loop` property
 * @returns {Function} stop function — restores original `send` and clears history
 */
export function startEventCapture(comp) {
  if (!comp?.loop?.send) return () => {}

  const loop = comp.loop
  const history = []
  _histories.set(loop, history)

  const originalSend = loop.send
  loop.send = function (event, ...args) {
    history.push({
      event,
      timestamp: Date.now(),
      args: args
        .map((a) => (typeof a === 'object' && a !== null ? '[object]' : String(a)))
        .join(', ')
        .slice(0, 50),
    })
    if (history.length > MAX_EVENTS) history.shift()
    return originalSend.call(loop, event, ...args)
  }

  return () => {
    loop.send = originalSend
    _histories.delete(loop)
  }
}

/**
 * Get the event history for a component.
 *
 * @param {Object} comp — component descriptor with a `.loop` property
 * @returns {Array<{event: string, timestamp: number, args: string}>}
 */
export function getEventHistory(comp) {
  if (!comp?.loop) return []
  return _histories.get(comp.loop) || []
}
