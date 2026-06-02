// ─── Dynamic Style Creation ───────────────────────────────────
// jQuery-inspired API: createNamedStyle, createGradientStyle, createEventStyle.

let _uid = 0
function uid() { return ++_uid }

/** Convert camelCase to kebab-case. */
export function camelToKebab(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Create a single CSS class from a plain JS style object.
 *
 * @param {Object} styleObj - e.g. { color: 'red', fontSize: '1rem' }
 * @param {CSSStyleSheet} [sheet] - Target sheet (defaults to global)
 * @returns {{ className: string, css: string }}
 */
export function createNamedStyle(styleObj, sheet) {
  sheet = sheet || _globalSheet()
  const className = `up-style-${uid()}`
  const css = Object.entries(styleObj)
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join('; ')
  _insert(sheet, `.${className}`, css)
  return { className, css }
}

/**
 * Create a linear-gradient background CSS class.
 *
 * @param {Object} config
 * @param {string[]} config.colors - Gradient color stops
 * @param {string} [config.dir] - Direction (e.g. 'to bottom', '45deg')
 * @param {CSSStyleSheet} [sheet]
 * @returns {{ className: string, gradient: string }}
 */
export function createGradientStyle(config, sheet) {
  sheet = sheet || _globalSheet()
  const className = `up-grad-${uid()}`
  const dir = config.dir ? config.dir + ', ' : ''
  const gradient = `linear-gradient(${dir}${config.colors.join(', ')})`
  _insert(sheet, `.${className}`, `background-image: ${gradient}`)
  return { className, gradient }
}

/**
 * Create a pseudo-class CSS rule (hover, focus, etc.).
 *
 * @param {Object} config
 * @param {string} [config.event='hover'] - CSS pseudo-class
 * @param {CSSStyleSheet} [sheet]
 * @returns {{ className: string, css: string, event: string }}
 */
export function createEventStyle(config, sheet) {
  sheet = sheet || _globalSheet()
  const className = `up-ev-${uid()}`
  const ev = config.event || 'hover'
  const css = Object.entries(config)
    .filter(([k]) => k !== 'event' && k !== 'name')
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join('; ')
  _insert(sheet, `.${className}:${ev}`, css)
  return { className, css, event: ev }
}

// ─── Internal ─────────────────────────────────────────────────

let _globalSheetRef = null

function _globalSheet() {
  if (_globalSheetRef) return _globalSheetRef
  if (typeof document === 'undefined') return null
  const style = document.createElement('style')
  style.setAttribute('data-uploop', 'dynamic')
  document.head.appendChild(style)
  _globalSheetRef = style.sheet
  return _globalSheetRef
}

function _insert(sheet, selector, css) {
  if (!sheet) return
  try { sheet.insertRule(`${selector} { ${css} }`) } catch (e) { /* ignore dupes */ }
}
