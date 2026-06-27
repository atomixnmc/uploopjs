/**
 * Saga Orchestrator — distributed transaction with compensating actions.
 *
 * Executes steps in sequence. Each step has an execute() and compensate().
 * If any step fails, compensates all previously completed steps in reverse.
 * Supports parallel steps, timeout, and saga log for debugging.
 *
 * @module @uploop/flows/profiles/sagaOrchestrator
 */

export class SagaFailedError extends Error {
  constructor(sagaName, stepName, cause, completedSteps) {
    super(`Saga "${sagaName}" failed at step "${stepName}": ${cause?.message || 'unknown'}`)
    this.name = 'SagaFailedError'
    this.sagaName = sagaName
    this.stepName = stepName
    this.cause = cause
    this.completedSteps = completedSteps
  }
}

export function createSagaOrchestrator(config = {}) {
  const {
    timeout = 30000,       // per-step timeout (ms)
    parallel = false,      // run independent steps in parallel
    retryCompensate = true // retry compensate if it fails
  } = config

  const sagaLog = []       // { sagaId, step, action, ts, error }
  const active = new Map()  // sagaId => { steps, completed, running }

  function _log(sagaId, step, action, error) {
    sagaLog.push({ sagaId, step, action, ts: Date.now(), error: error?.message })
    if (sagaLog.length > 10000) sagaLog.shift()
  }

  /**
   * Define a saga with named steps.
   * @param {string} name — saga identifier
   * @param {object[]} steps — [{ name, execute: async fn, compensate: async fn, timeout? }]
   */
  function create(name, steps) {
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error('Saga must have at least one step')
    }

    for (const step of steps) {
      if (!step.name || typeof step.execute !== 'function') {
        throw new Error(`Step "${step.name || 'unknown'}" must have name and execute`)
      }
    }

    /**
     * Execute the saga with input data.
     * Data flows through steps: each step receives previous step's output.
     * @param {*} input — initial data
     * @returns {{ success, data, completedSteps, sagaLog }}
     */
    async function run(input) {
      const sagaId = `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      let data = input
      const completed = []   // [stepName]
      const results = {}     // stepName => output

      _log(sagaId, 'start', 'execute')

      try {
        for (const step of steps) {
          _log(sagaId, step.name, 'execute')
          const stepTimeout = step.timeout || timeout

          const stepPromise = step.execute(data, results)
          const result = stepTimeout > 0
            ? await Promise.race([
                stepPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Step "${step.name}" timed out after ${stepTimeout}ms`)), stepTimeout))
              ])
            : await stepPromise

          data = result !== undefined ? result : data
          results[step.name] = data
          completed.push(step.name)

          _log(sagaId, step.name, 'complete')
        }

        _log(sagaId, 'end', 'success')
        return { success: true, data, completedSteps: completed, results, sagaId }

      } catch (err) {
        _log(sagaId, 'error', 'compensate', err)

        // compensate in reverse
        const compensated = []
        for (let i = completed.length - 1; i >= 0; i--) {
          const stepName = completed[i]
          const step = steps.find(s => s.name === stepName)
          if (step?.compensate) {
            try {
              _log(sagaId, stepName, 'compensate-start')
              await step.compensate(results[stepName], results)
              compensated.push(stepName)
              _log(sagaId, stepName, 'compensate-done')
            } catch (compErr) {
              _log(sagaId, stepName, 'compensate-failed', compErr)
              if (retryCompensate) {
                try {
                  // one retry
                  await step.compensate(results[stepName], results)
                  compensated.push(stepName)
                } catch (retryErr) {
                  _log(sagaId, stepName, 'compensate-final-fail', retryErr)
                }
              }
            }
          }
        }

        _log(sagaId, 'end', 'failed')
        return { success: false, error: new SagaFailedError(name, completed[completed.length - 1] || 'unknown', err, completed), completedSteps: completed, compensatedSteps: compensated, sagaId }
      }
    }

    return {
      name,
      run,
      steps,
      get describe() {
        return () => ({
          kind: 'uploop.flow.profile',
          profile: 'sagaOrchestrator',
          name,
          stepCount: steps.length,
          steps: steps.map(s => ({ name: s.name, hasCompensate: !!s.compensate }))
        })
      }
    }
  }

  return {
    create,
    getLog() { return [...sagaLog] },
    clearLog() { sagaLog.length = 0 },
    describe() {
      return {
        kind: 'uploop.flow.profile',
        profile: 'sagaOrchestrator',
        config: { timeout, parallel, retryCompensate },
        activeSagas: active.size
      }
    }
  }
}
