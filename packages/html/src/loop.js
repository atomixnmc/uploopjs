/**
 * Uploop html list primitive.
 *
 * Today this renders through the existing html string/binding path. It also
 * preserves item keys so a future graph DOM execution can patch list items
 * directly instead of replacing the surrounding subtree.
 */
export function loop(items, keyOrView, view) {
  const list = Array.from(items || [])
  const keyed = typeof view === 'function'
  const keyFn = keyed ? keyOrView : (_item, index) => index
  const viewFn = keyed ? view : keyOrView

  if (typeof viewFn !== 'function') {
    throw new TypeError('loop(items, keyFn?, viewFn) requires a view function')
  }

  const entries = list.map((item, index) => {
    const key = keyFn(item, index)
    return { key, item, index, view: viewFn(item, index) }
  })

  return {
    kind: 'uploop.html.loop',
    __uploopLoop: true,
    keyed,
    items: list,
    entries,
    keys: entries.map(entry => entry.key),
    toString() {
      return entries.map(entry => String(entry.view ?? '')).join('')
    },
    toJSON() {
      return this.toString()
    }
  }
}

export function isLoop(value) {
  return !!(value && typeof value === 'object' && value.__uploopLoop === true)
}
