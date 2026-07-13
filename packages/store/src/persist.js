/**
 * Persist a store to localStorage.
 *
 * @param {Object} store - Store instance
 * @param {Object} config
 * @param {string} config.key - localStorage key
 * @param {string[]} [config.paths] - State paths to persist (all if empty)
 * @param {Function} [config.serialize] - Custom serializer
 * @param {Function} [config.deserialize] - Custom deserializer
 * @returns {Function} Cleanup function
 */
export function persist(store, config = {}) {
  const {
    key = 'uploop:store',
    paths = [],
    serialize = JSON.stringify,
    deserialize = JSON.parse
  } = config

  // Load persisted state
  try {
    const saved = localStorage.getItem(key)
    if (saved) {
      const parsed = deserialize(saved)
      if (paths.length > 0) {
        // Only restore specific paths
        const patch = {}
        for (const p of paths) {
          const val = p.split('.').reduce((o, k) => o?.[k], parsed)
          if (val !== undefined) {
            setPath(patch, p, val)
          }
        }
        store.set(prev => ({ ...prev, ...patch }))
      } else {
        store.set(prev => ({ ...prev, ...parsed }))
      }
    }
  } catch (e) {
    console.warn(`Failed to load persisted store "${key}":`, e)
  }

  // Subscribe to save on changes
  const unsubscribe = store.subscribe((state) => {
    try {
      if (paths.length > 0) {
        const subset = {}
        for (const p of paths) {
          const val = p.split('.').reduce((o, k) => o?.[k], state)
          if (val !== undefined) {
            setPath(subset, p, val)
          }
        }
        localStorage.setItem(key, serialize(subset))
      } else {
        localStorage.setItem(key, serialize(state))
      }
    } catch (e) {
      console.warn(`Failed to persist store "${key}":`, e)
    }
  })

  return unsubscribe
}

function setPath(obj, path, value) {
  const keys = path.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {}
    current = current[keys[i]]
  }
  current[keys[keys.length - 1]] = value
}
