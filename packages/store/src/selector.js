/**
 * Create a memoized selector.
 * Selectors derive data from store state and only recompute
 * when their dependencies change.
 *
 * @param {Function} selectFn - Selection function
 * @param {Function} [equalityFn] - Optional equality check (default: ===)
 * @returns {Function} Selector function
 */
export function createSelector(selectFn, equalityFn = (a, b) => a === b) {
  let lastArgs = []
  let lastResult = undefined
  let initialized = false

  return function selector(state) {
    const result = selectFn(state)

    if (!initialized || !equalityFn(result, lastResult)) {
      lastResult = result
      lastArgs = [state]
      initialized = true
    }

    return lastResult
  }
}

/**
 * Create a selector that depends on other selectors
 * @param {Array<Function>} selectors - Dependency selectors
 * @param {Function} combiner - Combiner function
 * @returns {Function} Composed selector
 */
export function createComposedSelector(selectors, combiner) {
  return function composedSelector(state) {
    const values = selectors.map(s => s(state))
    return combiner(...values)
  }
}
