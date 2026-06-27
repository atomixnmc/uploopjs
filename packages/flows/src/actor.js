/**
 * Actor Model — isolated state machines with message-passing mailboxes.
 *
 * Each actor owns private state, processes messages sequentially from its
 * mailbox, and communicates with other actors via async messages — never
 * shared state. Built on HyperGraph: each actor is an isolated subgraph.
 *
 * ## Why Actors in Uploop?
 *
 * HyperGraph edges are ideal for actor communication — an edge IS a message
 * channel. Actors bring fault isolation (one actor crash doesn't kill others),
 * supervision hierarchies, and natural distribution (actors can move to workers).
 *
 * ## Pattern Choice
 *
 * | Pattern        | When to use                          |
 * |----------------|--------------------------------------|
 * | Actor          | Distributed state, fault isolation, supervision |
 * | Reactive       | UI-derived data, computed views, form wiring    |
 * | Pipeline/Queue | Stream processing, ETL, batch work             |
 * | HyperGraph     | Complex relationships, multi-entity graphs     |
 *
 * @module @uploop/flows/actor
 */

/**
 * Create an actor — isolated state + mailbox + message handlers.
 *
 * @param {object} config
 * @param {string} config.name — actor identifier
 * @param {object} config.state — initial state
 * @param {object} config.on — message handlers { messageName: (state, payload, ctx) => newState }
 * @param {function} [config.onError] — (error, message, state) => newState | 'stop' | 'resume'
 * @param {number} [config.mailboxSize] — max queued messages (default: 1000)
 * @param {string} [config.overflow] — 'drop' | 'error' | 'block' (default: 'block')
 */
export function createActor(config = {}) {
  const {
    name = 'anonymous',
    state: initialState = {},
    on = {},
    onError,
    mailboxSize = 1000,
    overflow = 'block'
  } = config

  let _state = { ...initialState }
  let _alive = true
  const mailbox = []
  let processing = false
  let totalProcessed = 0
  let totalErrors = 0

  // lifecycle hooks
  let _onStart = null
  let _onStop = null
  const _children = new Set()

  const _pendingResolvers = [] // for overflow: 'block'

  /** Send a message to this actor. Returns a promise that resolves when processed. */
  function send(type, payload) {
    if (!_alive) return Promise.reject(new Error(`Actor "${name}" is stopped`))

    return new Promise((resolve, reject) => {
      const msg = { type, payload, resolve, reject, ts: Date.now(), _replied: false }

      if (mailbox.length + (processing ? 1 : 0) >= mailboxSize) {
        if (overflow === 'drop') {
          totalErrors++
          reject(new Error(`Actor "${name}" mailbox full, message dropped`))
          return
        }
        if (overflow === 'error') {
          reject(new Error(`Actor "${name}" mailbox full`))
          return
        }
        _pendingResolvers.push({ msg, resolve, reject })
        return
      }

      mailbox.push(msg)
      _process()
    })
  }

  /** Send a message without waiting for response (fire-and-forget). */
  function tell(type, payload) {
    send(type, payload).catch(() => {})
  }

  /** Ask an actor a question and get a response. */
  async function ask(type, payload, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Actor "${name}" ask timeout after ${timeout}ms`)), timeout)
      send(type, payload).then(result => { clearTimeout(timer); resolve(result) }).catch(err => { clearTimeout(timer); reject(err) })
    })
  }

  function _process() {
    if (processing || mailbox.length === 0) return
    processing = true

    const msg = mailbox.shift()
    const handler = on[msg.type]

    try {
      if (!handler) {
        console.warn(`[actor:${name}] No handler for message "${msg.type}"`)
        if (!msg._replied) msg.resolve(_state)
        _next()
        return
      }

      const ctx = {
        actor: { name, state: _state },
        sender: msg.payload?._sender,
        reply: (response) => { msg._replied = true; msg.resolve(response) },
        spawn: (childName, childConfig) => {
          const child = createActor({ ...childConfig, name: `${name}/${childName}` })
          _children.add(child)
          return child
        },
        stop: () => { _stop() },
        state: () => _state
      }

      const result = handler(_state, msg.payload, ctx)

      // Handle both sync and async handlers
      if (result && typeof result.then === 'function') {
        result.then(
          (newState) => _applyState(newState, msg),
          (error) => _handleError(error, msg)
        )
      } else {
        _applyState(result, msg)
      }

    } catch (error) {
      _handleError(error, msg)
    }
  }

  function _applyState(newState, msg) {
    if (newState !== undefined && newState !== _state) {
      _state = typeof newState === 'function' ? newState(_state) : newState
    }
    totalProcessed++
    if (!msg._replied) msg.resolve(_state)
    _next()
    _drainPending()
  }

  function _handleError(error, msg) {
    totalErrors++
    if (onError) {
      const result = onError(error, msg, _state)
      if (result === 'stop') { _stop(); msg.reject(error); return }
      if (result === 'resume') { /* continue */ }
      else { _state = result }
    } else {
      console.error(`[actor:${name}] Unhandled error in "${msg.type}":`, error)
    }
    msg.reject(error)
    _next()
    _drainPending()
  }

  function _next() {
    processing = false
    if (mailbox.length > 0) _process()
  }

  function _drainPending() {
    while (_pendingResolvers.length > 0 && mailbox.length < mailboxSize) {
      const { msg } = _pendingResolvers.shift()
      mailbox.push(msg)
    }
    if (mailbox.length > 0) _next()
  }

  function _stop() {
    _alive = false
    for (const child of _children) {
      try { child.stop() } catch (e) {}
    }
    _children.clear()
    // reject pending messages
    for (const msg of mailbox) msg.reject(new Error(`Actor "${name}" stopped`))
    mailbox.length = 0
    for (const { reject } of _pendingResolvers) reject(new Error(`Actor "${name}" stopped`))
    _pendingResolvers.length = 0
    if (_onStop) _onStop(_state)
  }

  const actor = {
    get name() { return name },
    get state() { return { ..._state } },
    get alive() { return _alive },
    get mailboxSize() { return mailbox.length },
    get mailboxPending() { return mailbox.length + _pendingResolvers.length },
    get totalProcessed() { return totalProcessed },
    get totalErrors() { return totalErrors },

    send, tell, ask,

    /** Get current state snapshot */
    snapshot() { return { ..._state } },

    /** Stop the actor and all children */
    stop() { _stop() },

    /** Lifecycle: called after actor creation */
    onStart(fn) { _onStart = fn; fn?.(_state); return actor },

    /** Lifecycle: called before stop */
    onStop(fn) { _onStop = fn; return actor },

    /** Spawn a child actor (shortcut) */
    spawn(name, childConfig) {
      const child = createActor({ ...childConfig, name: `${this.name}/${name}` })
      _children.add(child)
      return child
    },

    /** List child actors */
    children() { return [..._children] },

    describe() {
      return {
        kind: 'uploop.flow.actor',
        name, alive: _alive,
        mailbox: mailbox.length,
        totalProcessed, totalErrors,
        stateKeys: Object.keys(_state),
        handlers: Object.keys(on),
        children: _children.size
      }
    }
  }

  // auto-start
  if (_onStart) _onStart(_state)

  return actor
}

// ── Actor System (Supervision) ─────────────────────────────

/**
 * Create an actor system — supervision tree with error recovery.
 *
 * Monitors child actors and applies supervision strategies on failure:
 *   'restart' — replace with fresh instance
 *   'stop'    — stop the child
 *   'escalate'— propagate error to parent
 *   'resume'  — continue (default)
 */
export function createActorSystem(config = {}) {
  const {
    name = 'system',
    strategy = 'restart',   // default supervision strategy
    maxRestarts = 5,
    restartWindow = 60000    // 1 minute
  } = config

  const children = new Map()      // name => actor
  const restartCount = new Map()  // name => [{ ts }]
  const eventBus = new Set()      // listener fns
  let _stopped = false

  function _cleanRestarts(actorName) {
    const now = Date.now()
    const timestamps = restartCount.get(actorName)
    if (!timestamps) return
    while (timestamps.length > 0 && now - timestamps[0].ts > restartWindow) {
      timestamps.shift()
    }
  }

  function _emit(event, data) {
    for (const fn of eventBus) {
      try { fn(event, data) } catch (e) {}
    }
  }

  /**
   * Register a supervised actor.
   */
  function supervise(actorConfig) {
    if (_stopped) throw new Error(`Actor system "${name}" is stopped`)

    const actor = createActor({
      ...actorConfig,
      onError: (error, msg, state) => {
        _cleanRestarts(actorConfig.name)
        if (!restartCount.has(actorConfig.name)) restartCount.set(actorConfig.name, [])
        const timestamps = restartCount.get(actorConfig.name)
        timestamps.push({ ts: Date.now() })

        _emit('error', { actor: actorConfig.name, error, message: msg.type })

        if (strategy === 'resume') {
          _emit('resume', { actor: actorConfig.name })
          return 'resume'
        }

        if (timestamps.length > maxRestarts) {
          _emit('escalate', { actor: actorConfig.name, restarts: timestamps.length })
          children.delete(actorConfig.name)
          actor.stop()
          return 'stop'
        }

        if (strategy === 'restart') {
          _emit('restart', { actor: actorConfig.name, attempt: timestamps.length })
          children.delete(actorConfig.name)
          actor.stop()
          // restart
          const fresh = createActor(actorConfig)
          children.set(actorConfig.name, fresh)
          // restart doesn't affect the original message flow
          return 'resume' // let the current message error propagate
        }

        if (strategy === 'stop') {
          _emit('stop', { actor: actorConfig.name })
          children.delete(actorConfig.name)
          actor.stop()
          return 'stop'
        }

        return 'resume'
      }
    })

    children.set(actorConfig.name, actor)
    return actor
  }

  /** Send a message to a named supervised actor. */
  function send(actorName, type, payload) {
    const actor = children.get(actorName)
    if (!actor) throw new Error(`Actor "${actorName}" not found in system "${name}"`)
    return actor.send(type, payload)
  }

  /** Get a supervised actor by name. */
  function get(actorName) {
    return children.get(actorName)
  }

  /** Listen for system events (error, restart, resume, escalate, stop). */
  function on(event, fn) {
    const listener = (e, data) => { if (e === event) fn(data) }
    eventBus.add(listener)
    return () => eventBus.delete(listener)
  }

  /** Stop all supervised actors. */
  function stop() {
    _stopped = true
    for (const [, actor] of children) {
      try { actor.stop() } catch (e) {}
    }
    children.clear()
    eventBus.clear()
  }

  return {
    name,
    supervise, send, get, on, stop,
    list() { return [...children.keys()] },
    describe() {
      return {
        kind: 'uploop.flow.actorSystem',
        name, strategy, maxRestarts,
        children: children.size,
        childrenList: [...children.keys()],
        stopped: _stopped
      }
    }
  }
}
