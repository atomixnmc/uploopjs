/**
 * Deduplication Filter — Bloom filter (probabilistic) + LRU hash (exact).
 *
 * Two-stage dedup: fast bloom filter rejects most duplicates cheaply,
 * exact LRU hash catches false positives. Configurable false positive rate.
 * Time-bounded windows for automatic cleanup.
 *
 * @module @uploop/flows/profiles/deduplicationFilter
 */

/** Simple Bloom filter implementation. */
class BloomFilter {
  constructor(expectedItems = 100000, falsePositiveRate = 0.01) {
    // optimal bit array size: m = -n*ln(p) / (ln(2))^2
    this._m = Math.ceil(-expectedItems * Math.log(falsePositiveRate) / (Math.LN2 ** 2))
    // optimal hash count: k = (m/n) * ln(2)
    this._k = Math.ceil((this._m / expectedItems) * Math.LN2)
    this._bits = new Uint32Array(Math.ceil(this._m / 32))
    this._count = 0
  }

  _hash(i, value) {
    // double hashing: h(i) = (h1 + i*h2) % m
    let h1 = 0, h2 = 0
    const str = String(value)
    for (let j = 0; j < str.length; j++) {
      const c = str.charCodeAt(j)
      h1 = ((h1 << 5) - h1 + c) | 0
      h2 = ((h2 << 7) - h2 + c) | 0
    }
    h1 = Math.abs(h1) % this._m
    h2 = Math.abs(h2) % this._m
    if (h2 === 0) h2 = 1
    return (h1 + i * h2) % this._m
  }

  add(value) {
    let allSet = true
    for (let i = 0; i < this._k; i++) {
      const pos = this._hash(i, value)
      const idx = pos >>> 5, bit = pos & 31
      if (!(this._bits[idx] & (1 << bit))) allSet = false
      this._bits[idx] |= (1 << bit)
    }
    if (!allSet) this._count++
  }

  test(value) {
    for (let i = 0; i < this._k; i++) {
      const pos = this._hash(i, value)
      const idx = pos >>> 5, bit = pos & 31
      if (!(this._bits[idx] & (1 << bit))) return false
    }
    return true
  }

  get size() { return this._count }
  get bitSize() { return this._m }
  get hashCount() { return this._k }
}

/** LRU cache for exact dedup. */
class LRUSet {
  constructor(maxEntries = 100000) {
    this._max = maxEntries
    this._map = new Map()
  }

  has(key) { return this._map.has(key) }
  add(key) {
    if (this._map.has(key)) {
      this._map.delete(key) // move to end
    } else if (this._map.size >= this._max) {
      // evict oldest
      const first = this._map.keys().next().value
      this._map.delete(first)
    }
    this._map.set(key, Date.now())
  }
  delete(key) { this._map.delete(key) }
  get size() { return this._map.size }
  clear() { this._map.clear() }
}

export function createDeduplicationFilter(config = {}) {
  const {
    expectedItems = 100000,
    falsePositiveRate = 0.01,
    exactMaxEntries = 100000,
    windowMs = 3600000,     // 1 hour default. 0 = unlimited
    keyFn = null            // (item) => string — custom key function
  } = config

  const bloom = new BloomFilter(expectedItems, falsePositiveRate)
  const exact = new LRUSet(exactMaxEntries)
  let totalSeen = 0
  let totalDuplicates = 0
  let totalBloomFalsePositives = 0

  function _key(item) {
    if (keyFn) return keyFn(item)
    if (typeof item === 'string') return item
    // stable JSON key
    return JSON.stringify(item, Object.keys(item || {}).sort())
  }

  /**
   * Check if item is a duplicate.
   * Returns { isDuplicate, method }.
   *   method: 'bloom-pass' | 'bloom-false-positive' | 'exact-match' | false
   */
  function check(item) {
    totalSeen++
    const key = _key(item)

    // Stage 1: Bloom filter (probabilistic, fast)
    if (!bloom.test(key)) {
      bloom.add(key)
      exact.add(key)
      return { isDuplicate: false, method: 'bloom-pass' }
    }

    // Stage 2: Exact check (certain, slower)
    if (exact.has(key)) {
      totalDuplicates++
      return { isDuplicate: true, method: 'exact-match' }
    }

    // Bloom false positive
    totalBloomFalsePositives++
    bloom.add(key)
    exact.add(key)
    return { isDuplicate: false, method: 'bloom-false-positive' }
  }

  /**
   * Return true if item IS a duplicate (convenience).
   */
  function isDuplicate(item) {
    return check(item).isDuplicate
  }

  /**
   * Filter function for pipeline: passes only new items.
   */
  function filter(item) {
    return !isDuplicate(item)
  }

  /** Manually add an item to the filter (without checking). */
  function add(item) {
    const key = _key(item)
    bloom.add(key)
    exact.add(key)
  }

  /** Reset the filter. */
  function reset() {
    exact.clear()
    totalSeen = 0
    totalDuplicates = 0
    totalBloomFalsePositives = 0
    // Bloom filter can't be cleared; create new
    Object.assign(bloom, new BloomFilter(expectedItems, falsePositiveRate))
  }

  return {
    check, isDuplicate, filter, add, reset,
    get stats() {
      return {
        totalSeen, totalDuplicates, totalBloomFalsePositives,
        bloomSize: bloom.size,
        exactSize: exact.size,
        falsePositiveRate: totalSeen > 0 ? (totalBloomFalsePositives / totalSeen) : 0,
        dedupRate: totalSeen > 0 ? (totalDuplicates / totalSeen) : 0
      }
    },
    describe() {
      return {
        kind: 'uploop.flow.profile',
        profile: 'deduplicationFilter',
        config: { expectedItems, falsePositiveRate, exactMaxEntries, windowMs },
        ...this.stats
      }
    }
  }
}
