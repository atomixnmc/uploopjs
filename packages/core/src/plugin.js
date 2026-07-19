/**
 * Uploop Plugin System — v0.9.0
 *
 * Extensible plugin/addon architecture for components, stores,
 * state-machines, schemas, and flows. Plugins hook into the
 * lifecycle of any Uploop primitive.
 *
 * ─── Concepts ──────────────────────────────────────────
 *
 *   Plugin     — { name, version, install(host), uninstall? }
 *   PluginHost — wraps a target (loop, store, component, etc.)
 *                and manages installed plugins with lifecycle.
 *   Hook       — named extension point: onInit, onUpdate,
 *                onStateChange, onDispose, onError.
 *
 * ─── Usage ─────────────────────────────────────────────
 *
 *   const host = createPluginHost(loop)
 *   host.use(loggerPlugin)
 *   host.use(persistPlugin)
 *
 *   // Later:
 *   host.remove('logger')
 *   host.list()           // [{ name, version, enabled }]
 */

/**
 * @typedef {Object} Plugin
 * @property {string} name
 * @property {string} [version]
 * @property {string} [description]
 * @property {Function} install — (host, options?) → void|Object
 * @property {Function} [uninstall] — (host) → void
 */

/**
 * Create a plugin host that wraps a target and manages plugins.
 *
 * @param {Object} target — loop, store, state-machine, component descriptor
 * @param {Object} [options]
 * @param {Object} [options.hooks] — custom hooks object
 * @returns {PluginHost}
 */
export function createPluginHost(target, options = {}) {
  const plugins = new Map()
  const hookFns = { onInit: [], onUpdate: [], onStateChange: [], onDispose: [], onError: [], ...(options.hooks || {}) }
  let _disposed = false

  /** @type {PluginHost} */
  const host = {
    target,

    /**
     * Install a plugin. Returns the plugin's install result.
     */
    use(plugin, opts) {
      if (_disposed) { console.warn('[PluginHost] disposed, cannot install'); return null }
      if (plugins.has(plugin.name)) { console.warn(`[PluginHost] plugin "${plugin.name}" already installed`); return null }

      let result = null
      try {
        if (typeof plugin === 'function') {
          result = plugin(host, opts)
        } else if (plugin && typeof plugin.install === 'function') {
          result = plugin.install(host, opts)
        } else {
          console.warn('[PluginHost] invalid plugin:', plugin)
          return null
        }
      } catch (e) {
        console.error(`[PluginHost] plugin "${plugin.name}" install error:`, e)
        host.emit('onError', { plugin: plugin.name, error: e })
        return null
      }

      plugins.set(plugin.name, {
        ...plugin,
        _result: result,
        _opts: opts,
        _enabled: true
      })

      host.emit('onInit', { plugin: plugin.name })
      return result
    },

    /**
     * Remove an installed plugin by name.
     */
    remove(name) {
      const entry = plugins.get(name)
      if (!entry) return false

      try {
        if (entry.uninstall && typeof entry.uninstall === 'function') {
          entry.uninstall(host)
        }
        if (entry._result?.dispose && typeof entry._result.dispose === 'function') {
          entry._result.dispose()
        }
      } catch (e) {
        console.error(`[PluginHost] plugin "${name}" uninstall error:`, e)
      }

      plugins.delete(name)
      return true
    },

    /**
     * Enable a previously-installed plugin.
     */
    enable(name) {
      const entry = plugins.get(name)
      if (!entry) return false
      entry._enabled = true
      return true
    },

    /**
     * Disable a plugin (keep installed but inactive).
     */
    disable(name) {
      const entry = plugins.get(name)
      if (!entry) return false
      entry._enabled = false
      return true
    },

    /**
     * Check if a plugin is installed and enabled.
     */
    has(name) {
      const entry = plugins.get(name)
      return !!(entry && entry._enabled)
    },

    /**
     * Get a plugin's install result.
     */
    get(name) {
      const entry = plugins.get(name)
      return entry?._result
    },

    /**
     * List all installed plugins.
     */
    list() {
      return [...plugins.values()].map(p => ({
        name: p.name,
        version: p.version || '0.0.0',
        description: p.description || '',
        enabled: p._enabled
      }))
    },

    /**
     * Register a hook listener.
     *   onInit       — after plugin install
     *   onUpdate     — when target state changes
     *   onStateChange — when target state changes (alias)
     *   onDispose    — when host is disposed
     *   onError      — when a plugin errors
     */
    on(hook, fn) {
      if (!hookFns[hook]) { hookFns[hook] = []; }
      hookFns[hook].push(fn)
      return () => {
        const idx = hookFns[hook].indexOf(fn)
        if (idx >= 0) hookFns[hook].splice(idx, 1)
      }
    },

    /**
     * Emit a hook to all listeners.
     */
    emit(hook, payload) {
      const fns = hookFns[hook]
      if (!fns) return
      for (const fn of fns) {
        try { fn(payload, host) } catch (e) { console.error(`[PluginHost] hook "${hook}" error:`, e) }
      }
    },

    /**
     * Dispose all plugins and the host.
     */
    dispose() {
      if (_disposed) return
      _disposed = true
      host.emit('onDispose', {})

      for (const [name] of plugins) {
        host.remove(name)
      }
      plugins.clear()

      if (target?.dispose && typeof target.dispose === 'function') {
        target.dispose()
      }
    },

    get disposed() { return _disposed }
  }

  return host
}

/**
 * Create a plugin definition object.
 *
 * @param {Object} def
 * @param {string} def.name
 * @param {string} [def.version]
 * @param {string} [def.description]
 * @param {Function} def.install — (host, options?) → void|Object
 * @param {Function} [def.uninstall] — (host) → void
 * @returns {Plugin}
 */
export function createPlugin(def) {
  return {
    name: def.name,
    version: def.version || '0.0.0',
    description: def.description || '',
    install: def.install,
    uninstall: def.uninstall
  }
}

/**
 * Compose multiple plugins into a single plugin.
 * Installs all in order, uninstalls in reverse.
 *
 * @param {...Plugin} plugins
 * @returns {Plugin}
 */
export function compose(...plugins) {
  return {
    name: 'composed',
    version: '1.0.0',
    description: `Composed: ${plugins.map(p => p.name).join(', ')}`,
    install(host, opts) {
      const results = []
      for (const p of plugins) {
        results.push(host.use(p, opts))
      }
      return { results }
    },
    uninstall(host) {
      for (const p of [...plugins].reverse()) {
        host.remove(p.name)
      }
    }
  }
}

/**
 * Legacy API — wraps a single plugin call for backward compat.
 * For new code, use createPluginHost instead.
 *
 * @param {Object} loop
 * @param {Plugin|Function} plugin
 * @returns {*}
 */
export function use(loop, plugin) {
  if (typeof plugin === 'function') {
    return plugin(loop)
  }
  if (plugin && typeof plugin.install === 'function') {
    return plugin.install(loop)
  }
  console.warn('[PluginHost] invalid plugin:', plugin)
  return null
}
