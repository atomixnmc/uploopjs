/**
 * Fan-Out / Fan-In — scatter-gather pattern for parallel execution.
 *
 * Distributes work across N concurrent workers, collects results,
 * and aggregates them. Supports timeout, partial results policy,
 * and error collection.
 *
 * @module @uploop/flows/profiles/fanOutFanIn
 */

export class FanOutTimeoutError extends Error {
  constructor(completed, total) {
    super(`Fan-out timeout: ${completed}/${total} completed`)
    this.name = 'FanOutTimeoutError'
    this.completed = completed
    this.total = total
  }
}

export function createFanOutFanIn(config = {}) {
  const {
    concurrency = 10,
    timeout = 30000,
    partialPolicy = 'require-all', // require-all | require-majority | best-effort
    collectErrors = true,
    aggregate = null              // (results[]) => aggregated result
  } = config

  /**
   * Execute tasks in parallel with concurrency control.
   *
   * @param {Array} tasks — array of inputs or { fn, args } objects
   * @param {function} [worker] — async (task, index) => result (if tasks are values)
   * @returns {{ results, errors, completed, total, success }}
   */
  async function execute(tasks, worker) {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { results: [], errors: [], completed: 0, total: 0, success: true }
    }

    const total = tasks.length
    const results = new Array(total)
    const errors = new Array(total).fill(null)
    let completed = 0
    let running = 0
    let nextIndex = 0
    let _timedOut = false
    let _resolve, _reject

    const promise = new Promise((resolve, reject) => {
      _resolve = resolve; _reject = reject
    })

    const timer = timeout > 0 ? setTimeout(() => {
      _timedOut = true
      _finish()
    }, timeout) : null

    function _finish() {
      if (completed === total || _timedOut) {
        if (timer) clearTimeout(timer)
        const successCount = results.filter(r => r !== undefined && r !== null).length
        const failCount = errors.filter(e => e !== null).length

        let success = false
        switch (partialPolicy) {
          case 'best-effort':
            success = true
            break
          case 'require-majority':
            success = successCount > total / 2
            break
          case 'require-all':
          default:
            success = completed === total && failCount === 0
        }

        const finalResults = aggregate && success
          ? aggregate(results.filter(r => r !== undefined))
          : results

        _resolve({
          results: finalResults,
          errors: collectErrors ? errors : errors.filter(e => e !== null),
          completed,
          total,
          success,
          timedOut: _timedOut
        })
      }
    }

    async function _run(index) {
      try {
        const task = tasks[index]
        const fn = typeof task?.fn === 'function' ? task.fn : worker
        const args = task?.args !== undefined ? task.args : [task, index]
        results[index] = await fn(...args)
      } catch (err) {
        errors[index] = err
        results[index] = undefined
        if (partialPolicy === 'require-all' && !_timedOut) {
          _timedOut = true // force finish on first error in strict mode
        }
      } finally {
        running--
        completed++
        _trySchedule()
        _finish()
      }
    }

    function _trySchedule() {
      while (running < concurrency && nextIndex < total && !_timedOut) {
        const idx = nextIndex++
        running++
        _run(idx)
      }
    }

    _trySchedule()

    return promise
  }

  /**
   * Simple fan-out: run the same function with different args.
   * @param {function} fn — async (arg) => result
   * @param {Array} argsArray — array of arguments
   */
  async function map(fn, argsArray) {
    return execute(argsArray, async (arg) => fn(arg))
  }

  /**
   * Fan-out to multiple different functions, fan-in to aggregate.
   * @param {Array<{ fn, args? }>} fns
   */
  async function all(fns) {
    return execute(fns)
  }

  return {
    execute, map, all,
    describe() {
      return {
        kind: 'uploop.flow.profile',
        profile: 'fanOutFanIn',
        config: { concurrency, timeout, partialPolicy, collectErrors }
      }
    }
  }
}
