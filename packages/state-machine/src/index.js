import { createLoop } from '@uploop/core'

/**
 * Create a finite state machine as an Uploop loop.
 *
 * @param {Object} config
 * @param {string} config.initial - Initial state (e.g. 'idle')
 * @param {Object} config.states - State definitions
 *   { name: { on: { EVENT: 'target'|fn|{target,guard} }, entry?, exit?, transition? } }
 * @param {Array} [config.cycles] - Named cycles that auto-advance through states
 *   [{ name: 'water', states: ['ice','water','steam'], repeat: true, guard: fn }]
 * @param {Object} [config.data] - Additional state data
 * @param {Function} [config.onChange] - Called on every state change (value, prev, data)
 * @returns {Object} State machine (+ loop API)
 */
export function createStateMachine(config) {
  const { initial = 'idle', states = {}, data = {}, cycles = [], onChange } = config

  // Normalize transitions: 'target' → { target, guard: null }
  const transitions = {}
  const stateMeta = {}

  for (const [name, def] of Object.entries(states)) {
    stateMeta[name] = def
    if (def.on) {
      const normalized = {}
      for (const [event, target] of Object.entries(def.on)) {
        if (typeof target === 'object' && target !== null && 'target' in target) {
          normalized[event] = target
        } else {
          normalized[event] = { target, guard: null }
        }
      }
      transitions[name] = normalized
    }
  }

  // Index cycles by name for quick lookup
  const cycleMap = {}
  for (const c of cycles) {
    cycleMap[c.name] = { ...c, _step: 0, _timer: null }
  }

  const store = createLoop({
    name: config.name || 'stateMachine',
    state: {
      value: initial,
      prev: null,
      data: { ...data },
      ...(config.state || {})
    },
    update: {
      /** Transition to a new state */
      transition: (s, event, ...args) => {
        const current = s.value
        const validTransitions = transitions[current]

        if (!validTransitions) {
          console.warn(`State "${current}" has no transitions defined`)
          return s
        }

        // Handle wildcard: '*' matches any event
        let spec = validTransitions[event]
        if (!spec) {
          // Check for wildcard transition
          const star = Object.keys(validTransitions).find(k => k === '*' || k.startsWith('*:'))
          if (star) {
            const starSpec = validTransitions[star]
            spec = { target: typeof starSpec.target === 'function' ? starSpec.target(s, event, ...args) : starSpec.target, guard: starSpec.guard }
          }
        }

        if (!spec) {
          console.warn(`No transition "${event}" from state "${current}"`)
          return s
        }

        // Run guard if present
        if (spec.guard && typeof spec.guard === 'function') {
          if (!spec.guard(s, event, ...args)) {
            return s // Guard blocked the transition
          }
        }

        // Resolve target (can be string or function)
        const nextState = typeof spec.target === 'function' ? spec.target(s, ...args) : spec.target
        if (!nextState || nextState === current) return s

        // Transition hook (runs during transition, before entry/exit)
        const transitionFn = stateMeta[current]?.transition
        if (transitionFn) transitionFn(s, event, nextState)

        // Entry/exit hooks
        const exitFn = stateMeta[current]?.exit
        const entryFn = stateMeta[nextState]?.entry

        if (exitFn) exitFn(s)
        const updatedData = entryFn ? entryFn(s) : {}

        const next = {
          value: nextState,
          prev: current,
          data: { ...s.data, ...updatedData }
        }

        if (onChange) onChange(nextState, current, next.data)

        return next
      },

      /** Directly set data (without changing state) */
      setData: (s, patch) => ({
        data: { ...s.data, ...patch }
      }),

      /** Reset to initial state */
      reset: () => ({
        value: initial,
        prev: null,
        data: { ...data }
      })
    }
  })

  /**
   * Send an event to trigger a transition
   */
  function send(event, ...args) {
    store.send('transition', event, ...args)
  }

  /**
   * Check if currently in a given state
   */
  function is(state) {
    return store.get().value === state
  }

  /**
   * Check if a transition is valid from current state
   */
  function can(event) {
    const current = store.get().value
    const validTransitions = transitions[current]
    return validTransitions ? !!validTransitions[event] : false
  }

  /**
   * Get current state value
   */
  function value() {
    return store.get().value
  }

  /**
   * Get all valid transitions from current state
   */
  function available() {
    const current = store.get().value
    const t = transitions[current]
    return t ? Object.keys(t).filter(k => k !== '*') : []
  }

  /**
   * Step forward one position in a named cycle.
   * Advances to the next state in the cycle and sends the associated event.
   */
  function step(cycleName) {
    const cycle = cycleMap[cycleName]
    if (!cycle) {
      console.warn(`Cycle "${cycleName}" not found`)
      return
    }
    const current = store.get().value
    const idx = cycle.states.indexOf(current)

    if (idx === -1) {
      // Not in this cycle — start from first state
      const first = cycle.states[0]
      if (first && first !== current) {
        send('__cycle_' + cycleName, first)
      }
      return
    }

    // Check guard
    if (cycle.guard && !cycle.guard(store.get(), idx)) return

    const nextIdx = idx + 1
    if (nextIdx >= cycle.states.length) {
      if (cycle.repeat) {
        // Wrap around to first
        const first = cycle.states[0]
        if (first !== current) send('__cycle_' + cycleName, first)
      }
      // else: cycle complete, stay at last state
      return
    }

    const next = cycle.states[nextIdx]
    if (next !== current) send('__cycle_' + cycleName, next)
  }

  /**
   * Start auto-cycling through a named cycle at the given interval (ms).
   * Returns a stop function. Only one auto-cycle can run per cycle name.
   */
  function autoCycle(cycleName, intervalMs = 1000) {
    const cycle = cycleMap[cycleName]
    if (!cycle) {
      console.warn(`Cycle "${cycleName}" not found`)
      return () => {}
    }
    if (cycle._timer) clearInterval(cycle._timer)
    cycle._timer = setInterval(() => step(cycleName), intervalMs)
    return () => {
      if (cycle._timer) { clearInterval(cycle._timer); cycle._timer = null }
    }
  }

  /**
   * Subscribe to state changes. Returns unsubscribe function.
   */
  function subscribe(fn) {
    return store.subscribe(() => {
      const s = store.get()
      fn(s.value, s.prev, s.data)
    })
  }

  /**
   * Visualize the state machine as ASCII
   */
  function visualize() {
    const lines = [`State Machine: ${config.name || 'unnamed'}`]
    lines.push(`Initial: ${initial}`)
    for (const [name, def] of Object.entries(states)) {
      const targets = def.on
        ? Object.entries(def.on).map(([ev, to]) => {
            const t = typeof to === 'object' && to ? to.target : to
            const g = typeof to === 'object' && to?.guard ? ' [G]' : ''
            return `--${ev}--> ${t}${g}`
          }).join(', ')
        : ''
      lines.push(`  [${name}]${targets ? ' ' + targets : ''}`)
    }
    if (cycles.length > 0) {
      lines.push(`---`)
      for (const c of cycles) {
        lines.push(`  Cycle "${c.name}": ${c.states.join(' → ')}${c.repeat ? ' (repeat)' : ''}`)
      }
    }
    lines.push(`---`)
    lines.push(`Current: ${store.get().value}`)
    return lines.join('\n')
  }

  // Cleanup auto-cycles on dispose
  const _dispose = () => {
    for (const c of Object.values(cycleMap)) {
      if (c._timer) clearInterval(c._timer)
    }
  }

  return {
    ...store,
    send,
    is,
    can,
    value,
    available,
    step,
    autoCycle,
    subscribe,
    visualize,
    reset: () => store.send('reset'),
    setData: (patch) => store.send('setData', patch),
    getState: store.get,
    dispose: () => { _dispose(); store.dispose?.() },
    get value() { return store.get().value },
    get data() { return store.get().data },
    cycles: () => Object.keys(cycleMap)
  }
}
