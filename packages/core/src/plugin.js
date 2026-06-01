/**
 * Simple plugin protocol for Uploop.
 * Plugins receive the loop instance and can extend it.
 *
 * @param {Object} loop - The loop instance
 * @param {Object} plugin - Plugin object with install method
 * @param {Function} plugin.install - Install hook
 * @returns {Object} Plugin result
 */
export function use(loop, plugin) {
  if (typeof plugin === 'function') {
    return plugin(loop)
  }
  if (plugin && typeof plugin.install === 'function') {
    return plugin.install(loop)
  }
  console.warn('Invalid plugin:', plugin)
  return null
}
