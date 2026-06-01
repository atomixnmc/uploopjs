import { createLoop } from '@uploop/core'

/**
 * Create a finite state machine as an Uploop loop.
 *
 * A state machine is just a loop with constrained state transitions:
 * - `state` holds the current machine state (string)
 * - `update` handlers are the transitions
 * - Guards can prevent invalid transitions
 *
 * @param {Object} config
 * @param {string} config.initial - Initial state (e.g. 'idle')
 * @param {Object} config.states - State definitions
 * @param {Object} [config.data] - Additional state data
 * @returns {Object} State machine (+ loop API)
 */
export function createStateMachine(config) {
  const { initial = 'idle', states = {}, data = {} } = config

  // Build valid transitions map { from: { event: to } }
  const transitions = {}
  const stateMeta = {}

  for (const [name, def] of Object.entries(states)) {
    stateMeta[name] = def
    if (def.on) {
      transitions[name] = def.on
    }
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

        const target = validTransitions[event]
        if (!target) {
          console.warn(`No transition "${event}" from state "${current}"`)
          return s
        }

        // Resolve target (can be string or function)
        const nextState = typeof target === 'function' ? target(s, ...args) : target
        if (!nextState || nextState === current) return s

        // Entry/exit hooks
        const exitFn = stateMeta[current]?.exit
        const entryFn = stateMeta[nextState]?.entry

        if (exitFn) exitFn(s)
        const updatedData = entryFn ? entryFn(s) : {}

        return {
          value: nextState,
          prev: current,
          data: { ...s.data, ...updatedData }
        }
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
    return transitions[current] ? Object.keys(transitions[current]) : []
  }

  /**
   * Visualize the state machine as ASCII
   */
  function visualize() {
    const lines = [`State Machine: ${config.name || 'unnamed'}`]
    lines.push(`Initial: ${initial}`)
    for (const [name, def] of Object.entries(states)) {
      const targets = def.on ? Object.entries(def.on).map(([ev, to]) => `--${ev}--> ${to}`).join(', ') : ''
      lines.push(`  [${name}]${targets ? ' ' + targets : ''}`)
    }
    lines.push(`---`)
    lines.push(`Current: ${store.get().value}`)
    return lines.join('\n')
  }

  return {
    ...store,
    send,
    is,
    can,
    value,
    available,
    visualize,
    getState: store.get,
    get value() { return store.get().value },
    get data() { return store.get().data }
  }
}
