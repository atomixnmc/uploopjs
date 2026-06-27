/**
 * Composable Pipelines — chain operations on data streams.
 *
 * Pipelines connect sources, transforms, validators, and sinks
 * in a declarative, composable way. Each stage is a function.
 *
 * @module @uploop/flows/pipeline
 */

/**
 * Create a pipeline that processes data through stages.
 *
 * @param {*} initial — initial value (optional)
 * @returns {Object} pipeline with chainable stages
 */
export function pipeline(initial) {
  const stages = []
  let _value = initial
  let _running = false
  let _done = false

  function run(input) {
    if (_done) return _value
    let v = input !== undefined ? input : _value
    for (const stage of stages) {
      try {
        v = stage.fn(v)
      } catch (e) {
        if (stage.onError) {
          stage.onError(e, v)
          continue
        }
        throw e
      }
      if (v === PIPELINE_SKIP) return _value
      if (v === PIPELINE_STOP) { _done = true; return _value }
    }
    _value = v
    return _value
  }

  const pipe = {
    /** Transform the value */
    map(fn) { stages.push({ fn }); return pipe },

    /** Filter: skip if returns false */
    filter(fn) { stages.push({ fn: v => fn(v) ? v : PIPELINE_SKIP }); return pipe },

    /** Tap: side effect without changing value */
    tap(fn) { stages.push({ fn: v => { fn(v); return v } }); return pipe },

    /** Validate: throws on invalid */
    validate(schema) {
      stages.push({
        fn: v => {
          const r = typeof schema.validate === 'function' ? schema.validate(v) : { ok: true }
          if (!r.ok) throw new Error('Validation failed: ' + JSON.stringify(r.errors))
          return r.value !== undefined ? r.value : v
        }
      })
      return pipe
    },

    /** Debounce: collect values, emit latest after ms */
    debounce(ms) {
      let timer = null
      let latest = undefined
      stages.push({
        fn: v => {
          latest = v
          return new Promise(resolve => {
            clearTimeout(timer)
            timer = setTimeout(() => resolve(latest), ms)
          })
        }
      })
      return pipe
    },

    /** Error handler for the previous stage */
    catch(fn) {
      if (stages.length > 0) stages[stages.length - 1].onError = fn
      return pipe
    },

    /** Sink: send value to external target */
    sink(fn) {
      stages.push({ fn: v => { fn(v); return v } })
      return pipe
    },

    /** Into: write to another store/graph */
    into(target, key) {
      stages.push({
        fn: v => {
          if (typeof target.set === 'function') target.set(key, v)
          else if (typeof target.send === 'function') target.send(key, v)
          return v
        }
      })
      return pipe
    },

    /** Run the pipeline with input */
    run(input) { return run(input) },

    /** Get current value */
    value() { return _value },

    /** Reset pipeline state */
    reset() { _value = initial; _done = false; return pipe },

    /** Number of stages */
    get length() { return stages.length }
  }

  return pipe
}

const PIPELINE_SKIP = Symbol('skip')
const PIPELINE_STOP = Symbol('stop')

// ── Queue ──────────────────────────────────────────────────

/**
 * Create a processing queue with concurrency control.
 *
 * @param {Object} [opts]
 * @param {number} [opts.concurrency=1] — max concurrent operations
 * @param {number} [opts.capacity=Infinity] — max queue size
 * @param {string} [opts.strategy='fifo'] — 'fifo' | 'lifo' | 'priority'
 * @returns {Object} queue API
 */
export function queue(opts = {}) {
  const concurrency = opts.concurrency || 1
  const capacity = opts.capacity || Infinity
  const strategy = opts.strategy || 'fifo'
  const items = []
  let running = 0
  let _drained = null
  const handlers = { done: [], error: [], drain: [] }

  function enqueue(item, priority = 0) {
    if (items.length >= capacity) throw new Error('Queue full')
    items.push({ item, priority, ts: Date.now() })
    process()
  }

  function process() {
    while (running < concurrency && items.length > 0) {
      let idx = 0
      if (strategy === 'lifo') idx = items.length - 1
      if (strategy === 'priority') {
        idx = items.reduce((best, cur, i) => cur.priority > items[best].priority ? i : best, 0)
      }

      const task = items.splice(idx, 1)[0]
      running++
      Promise.resolve(task.item)
        .then(result => { running--; handlers.done.forEach(fn => fn(result)); process(); checkDrain() })
        .catch(err => { running--; handlers.error.forEach(fn => fn(err)); process(); checkDrain() })
    }
  }

  function checkDrain() {
    if (items.length === 0 && running === 0 && _drained) {
      _drained(); _drained = null
    }
  }

  return {
    push(item, priority) { enqueue(item, priority) },
    unshift(item) { items.unshift({ item, priority: 0, ts: Date.now() }); process() },
    get length() { return items.length },
    get pending() { return items.length + running },
    onDone(fn) { handlers.done.push(fn) },
    onError(fn) { handlers.error.push(fn) },
    drain() { return new Promise(resolve => {
      if (items.length === 0 && running === 0) resolve()
      else _drained = resolve
    })}
  }
}

// ── Event Stream ───────────────────────────────────────────

/**
 * Create an event stream that multiple pipelines can subscribe to.
 * Events flow through declared pipelines in order.
 *
 * @returns {Object} stream API
 */
export function eventStream() {
  const subscribers = []
  const history = []
  const maxHistory = 1000

  function emit(event, payload) {
    const envelope = { event, payload, ts: Date.now(), id: history.length }
    history.push(envelope)
    if (history.length > maxHistory) history.shift()

    for (const sub of subscribers) {
      try {
        if (!sub.filter || sub.filter(event, payload)) {
          sub.handler(envelope)
        }
      } catch (e) {
        console.error('Event stream handler error:', e)
      }
    }
  }

  return {
    emit,

    /** Subscribe with optional filter */
    on(filterOrHandler, handler) {
      const sub = typeof filterOrHandler === 'function' && !handler
        ? { handler: filterOrHandler, filter: null }
        : { handler, filter: filterOrHandler }
      subscribers.push(sub)
      return () => {
        const idx = subscribers.indexOf(sub)
        if (idx >= 0) subscribers.splice(idx, 1)
      }
    },

    /** Create a pipeline that receives events matching filter */
    pipe(filter) {
      const p = pipeline()
      this.on(filter, envelope => p.run(envelope))
      return p
    },

    /** Replay history to a new subscriber */
    replay(handler, filter) {
      for (const env of history) {
        if (!filter || filter(env.event, env.payload)) {
          try { handler(env) } catch (e) {}
        }
      }
      return this.on(filter, handler)
    },

    /** Get event history */
    history() { return [...history] },

    /** Clear history */
    clear() { history.length = 0 }
  }
}
