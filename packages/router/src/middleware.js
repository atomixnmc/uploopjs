/**
 * Middleware pipeline — composable async chain for request processing.
 *
 * Middleware signature: (ctx, next) => ctx | Promise<ctx>
 *   - next() calls the next middleware / final handler
 *   - returning ctx short-circuits the pipeline
 *
 *   import { createPipeline, composeMiddleware } from '@uploop/router'
 *
 *   const pipe = createPipeline([authMiddleware, logMiddleware])
 *   const ctx = await pipe.run(initialCtx)
 */

/**
 * Create a middleware pipeline from an ordered array of middleware functions.
 *
 * @param {Function[]} middleware — array of (ctx, next) => ctx functions
 * @returns {Object} pipeline with run(ctx)
 */
export function createPipeline(middleware = []) {
  const stack = [...middleware]

  /**
   * Run the pipeline against a context.
   *
   * @param {Object} ctx — request context
   * @returns {Promise<Object>} final ctx
   */
  async function run(ctx) {
    let index = -1

    async function dispatch(i) {
      if (i <= index) {
        throw new Error('[Pipeline] next() called multiple times')
      }
      index = i

      if (i >= stack.length) {
        // End of pipeline — return ctx as-is
        return ctx
      }

      const fn = stack[i]
      if (typeof fn !== 'function') {
        return dispatch(i + 1)
      }

      try {
        const result = await fn(ctx, () => dispatch(i + 1))
        // If middleware returns a value, use it as the new ctx
        return result !== undefined ? result : ctx
      } catch (e) {
        ctx._error = e
        ctx._status = ctx._status || 500
        throw e
      }
    }

    return dispatch(0)
  }

  /**
   * Add middleware to the end of the pipeline.
   * Returns a new pipeline (immutable).
   */
  function use(...fns) {
    return createPipeline([...stack, ...fns])
  }

  /**
   * Add middleware to the beginning of the pipeline.
   * Returns a new pipeline (immutable).
   */
  function prepend(...fns) {
    return createPipeline([...fns, ...stack])
  }

  /**
   * Get the current middleware stack length.
   */
  function length() {
    return stack.length
  }

  return { run, use, prepend, length, get stack() { return [...stack] } }
}

/**
 * Compose multiple middleware functions into one.
 * Useful for creating named middleware bundles.
 *
 *   const authBundle = composeMiddleware(auth, roleCheck, permissionCheck)
 *   pipeline.use(authBundle)
 *
 * @param {...Function} fns
 * @returns {Function} composed middleware
 */
export function composeMiddleware(...fns) {
  return async (ctx, next) => {
    const pipe = createPipeline([...fns, next])
    return pipe.run(ctx)
  }
}

// ── Built-in middleware factories ──────────────────────────────

/**
 * Log each request with timing.
 *
 *   pipeline.use(loggerMiddleware({ level: 'info' }))
 */
export function loggerMiddleware(opts = {}) {
  const { level = 'info', prefix = '[uploop/router]' } = opts

  return async (ctx, next) => {
    const start = Date.now()
    const result = await next()
    const ms = Date.now() - start

    const log = level === 'error' ? console.error
      : level === 'warn' ? console.warn
      : console.log

    log(`${prefix} ${ctx._status || 200} ${ctx.path || ctx.fullPath} (${ms}ms)`)
    return result
  }
}

/**
 * Attach error handling to the pipeline.
 * Catches errors from downstream middleware/handlers.
 *
 *   pipeline.use(errorMiddleware((err, ctx) => {
 *     ctx._status = 500
 *     ctx._body = { error: err.message }
 *     return ctx
 *   }))
 */
export function errorMiddleware(handler) {
  return async (ctx, next) => {
    try {
      return await next()
    } catch (e) {
      if (typeof handler === 'function') {
        return handler(e, ctx)
      }
      ctx._error = e
      ctx._status = 500
      return ctx
    }
  }
}

/**
 * Timeout middleware — abort if handler takes too long.
 *
 *   pipeline.use(timeoutMiddleware(5000))  // 5 seconds
 */
export function timeoutMiddleware(ms = 30000) {
  return async (ctx, next) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ms)

    try {
      ctx._signal = controller.signal
      return await next()
    } finally {
      clearTimeout(timer)
    }
  }
}
