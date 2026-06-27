/**
 * Priority Queue — multi-level job scheduling with aging and starvation prevention.
 *
 * Binary heap per level. Low-priority items gain priority over time (aging).
 * Per-level concurrency limits. Background items never starve.
 *
 * @module @uploop/flows/profiles/priorityQueue
 */

// Binary min-heap (smallest priority value = highest priority)
class MinHeap {
  constructor() { this._data = [] }
  get size() { return this._data.length }

  _parent(i) { return (i - 1) >> 1 }
  _left(i) { return (i << 1) + 1 }
  _right(i) { return (i << 1) + 2 }

  _swap(i, j) { [this._data[i], this._data[j]] = [this._data[j], this._data[i]] }

  _siftUp(i) {
    while (i > 0) {
      const p = this._parent(i)
      if (this._data[i].priority >= this._data[p].priority) break
      this._swap(i, p)
      i = p
    }
  }

  _siftDown(i) {
    const n = this._data.length
    while (true) {
      let smallest = i
      const l = this._left(i), r = this._right(i)
      if (l < n && this._data[l].priority < this._data[smallest].priority) smallest = l
      if (r < n && this._data[r].priority < this._data[smallest].priority) smallest = r
      if (smallest === i) break
      this._swap(i, smallest)
      i = smallest
    }
  }

  push(item, priority) {
    this._data.push({ item, priority })
    this._siftUp(this._data.length - 1)
  }

  pop() {
    if (this._data.length === 0) return null
    const top = this._data[0]
    const last = this._data.pop()
    if (this._data.length > 0) {
      this._data[0] = last
      this._siftDown(0)
    }
    return top
  }

  peek() { return this._data[0] || null }

  /** Remove and return all items matching predicate. */
  drain(filter) {
    const result = []
    const remaining = []
    while (this._data.length > 0) {
      const entry = this.pop()
      if (filter(entry)) result.push(entry)
      else remaining.push(entry)
    }
    for (const entry of remaining) {
      this.push(entry.item, entry.priority)
    }
    return result
  }
}

export function createPriorityQueue(config = {}) {
  const {
    levels = ['critical', 'high', 'normal', 'low', 'background'],
    levelPriority = { critical: 0, high: 100, normal: 500, low: 1000, background: 5000 },
    aging = true,
    agingRate = 1,      // priority points gained per second of waiting
    starvationPrevention = true,
    perLevelConcurrency = {}, // { critical: 5, high: 10, ... }
    concurrency = 10          // total concurrency
  } = config

  const heaps = {}
  const enqueuedAt = new Map() // itemId => { level, timestamp }
  const running = new Map()    // itemId => true
  let totalEnqueued = 0
  let totalDequeued = 0
  let totalDropped = 0
  let _paused = false

  for (const level of levels) {
    heaps[level] = new MinHeap()
  }

  let _idCounter = 0

  /** Get effective priority including aging. */
  function _effectivePriority(level, itemId) {
    const base = levelPriority[level]
    if (!aging || !enqueuedAt.has(itemId)) return base
    const age = (Date.now() - enqueuedAt.get(itemId).timestamp) / 1000
    const reduction = Math.floor(age * agingRate)
    return Math.max(0, base - reduction)
  }

  function _countRunning(level) {
    let count = 0
    for (const [id, meta] of enqueuedAt) {
      if (running.has(id) && meta.level === level) count++
    }
    return count
  }

  /**
   * Enqueue a task at a priority level.
   * Returns an id that can be used for cancellation.
   */
  function enqueue(task, level = 'normal') {
    if (!heaps[level]) throw new Error(`Unknown priority level: ${level}`)
    const id = ++_idCounter
    enqueuedAt.set(id, { level, timestamp: Date.now() })
    const pri = _effectivePriority(level, id)
    heaps[level].push({ id, task, level }, pri)
    totalEnqueued++
    return id
  }

  /**
   * Dequeue the highest priority task across all levels.
   * Respects per-level concurrency limits.
   * Returns { id, task, level } or null if empty/paused.
   */
  function dequeue() {
    if (_paused) return null

    // check per-level concurrency
    const availableLevels = levels.filter(lvl => {
      const max = perLevelConcurrency[lvl] || concurrency
      return _countRunning(lvl) < max
    })

    if (availableLevels.length === 0) return null

    // find highest priority task across available levels
    let bestEntry = null
    let bestLevel = null

    for (const lvl of availableLevels) {
      const heap = heaps[lvl]
      if (heap.size === 0) continue
      const peek = heap.peek()
      if (!peek || !peek.item) continue

      // update priority with aging for comparison
      const pri = _effectivePriority(lvl, peek.item.id)
      if (bestEntry === null || pri < bestEntry.priority) {
        bestEntry = { ...peek.item, priority: pri }
        bestLevel = lvl
      }
    }

    if (!bestEntry) return null

    // pop from the winning heap
    const popped = heaps[bestLevel].pop()
    running.set(popped.item.id, true)
    totalDequeued++
    return { id: popped.item.id, task: popped.item.task, level: bestLevel }
  }

  /** Mark a task as complete. */
  function complete(id) {
    running.delete(id)
    enqueuedAt.delete(id)
  }

  /** Cancel a queued task (not yet dequeued). */
  function cancel(id) {
    const meta = enqueuedAt.get(id)
    if (!meta || running.has(id)) return false
    const heap = heaps[meta.level]
    const drained = heap.drain(entry => entry.item && entry.item.id === id)
    if (drained.length > 0) {
      enqueuedAt.delete(id)
      totalDropped++
      return true
    }
    return false
  }

  /** Retry a failed task (re-enqueue with same level). */
  function retry(id) {
    const meta = enqueuedAt.get(id)
    if (!meta) return
    running.delete(id)
    const task = { retry: id }
    enqueue(task, meta.level)
  }

  /** Pause dequeuing. Enqueue still works. */
  function pause() { _paused = true }
  function resume() { _paused = false }

  function getStats() {
    const levelStats = {}
    for (const lvl of levels) {
      levelStats[lvl] = { queued: heaps[lvl].size, running: _countRunning(lvl) }
    }
    return {
      totalEnqueued, totalDequeued, totalDropped,
      running: running.size,
      paused: _paused,
      levels: levelStats
    }
  }

  return {
    enqueue,
    dequeue,
    complete,
    cancel,
    retry,
    pause,
    resume,
    getStats,
    get size() { return Object.values(heaps).reduce((s, h) => s + h.size, 0) },
    get levels() { return levels },
    describe() {
      return {
        kind: 'uploop.flow.profile',
        profile: 'priorityQueue',
        config: { levels, aging, agingRate, starvationPrevention, concurrency },
        ...getStats()
      }
    }
  }
}
