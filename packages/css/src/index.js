// ─── Theme Tokens ─────────────────────────────────────────────

export const breakpoints = {
  z: 0, sm: 576, md: 768, lg: 992, xl: 1200,
  xl2: 1536, xl3: 1920, xl4: 2560, xl5: 3840
}

export const spacing = {}
for (let i = 0; i <= 12; i++) {
  spacing[i] = i
  spacing[`${i}_25`] = i + 0.25
  spacing[`${i}_5`] = i + 0.5
  spacing[`${i}_75`] = i + 0.75
}

export const spacingTiny = { t2: -0.05, t1: -0.025, z: 0, normal: 0, w1: 0.025, w2: 0.05, w3: 0.1 }

export const colors = {
  transparent: 'transparent',
  primary: '#646cff', secondary: '#6c757d',
  success: '#28a745', info: '#17a2b8', warning: '#ffc107', danger: '#dc3545',
  light: '#f8f9fa', dark: '#343a40',
  white: '#fff', black: '#000',
  gray: '#6c757d', grayDark: '#343a40',
  yellow: '#ffc107', orange: '#fd7e14', red: '#dc3545',
  pink: '#e83e8c', green: '#28a745', teal: '#20c997',
  cyan: '#17a2b8', blue: '#007bff', navy: '#001f3f',
  purple: '#6f42c1', lime: '#00ff00', olive: '#808000', aqua: '#00ffff', silver: '#c0c0c0'
}

// ─── Core CSS Generator ──────────────────────────────────────

let _globalSheet = null

function getOrCreateSheet() {
  if (_globalSheet) return _globalSheet
  if (typeof document === 'undefined') return null
  const style = document.createElement('style')
  document.head.appendChild(style)
  _globalSheet = style.sheet
  return _globalSheet
}

export function inject(config = {}) {
  const sheet = getOrCreateSheet()
  if (!sheet) return

  const opts = {
    spacing: config.spacing || spacing,
    colors: config.colors || colors,
    ...config
  }

  // Spacing utilities (margin, padding)
  for (const [key, val] of Object.entries(opts.spacing)) {
    const rem = `${val}rem`
    for (const prefix of ['m', 'mt', 'mr', 'mb', 'ml', 'mx', 'my']) {
      insertRule(sheet, `.${prefix}-${key}`, toCss(prefix, rem))
    }
    for (const prefix of ['p', 'pt', 'pr', 'pb', 'pl', 'px', 'py']) {
      insertRule(sheet, `.${prefix}-${key}`, toCss(prefix, rem))
    }
    insertRule(sheet, `.gap-${key}`, `gap: ${rem}`)
    insertRule(sheet, `.rounded-${key}`, `border-radius: ${rem}`)
  }

  // Color utilities
  for (const [name, hex] of Object.entries(opts.colors)) {
    insertRule(sheet, `.text-${name}`, `color: ${hex}`)
    insertRule(sheet, `.bg-${name}`, `background-color: ${hex}`)
    insertRule(sheet, `.border-${name}`, `border-color: ${hex}`)
  }

  // Display
  for (const v of ['block', 'inline-block', 'inline', 'flex', 'grid', 'none', 'contents']) {
    insertRule(sheet, `.d-${v}`, `display: ${v}`)
  }

  // Flex
  for (const v of ['row', 'column', 'row-reverse', 'column-reverse']) {
    insertRule(sheet, `.flex-${v}`, `flex-direction: ${v}`)
  }
  for (const v of ['start', 'end', 'center', 'between', 'around', 'evenly']) {
    insertRule(sheet, `.justify-${v}`, `justify-content: ${v}`)
    insertRule(sheet, `.items-${v}`, `align-items: ${v}`)
  }

  // Grid
  for (let i = 1; i <= 12; i++) {
    insertRule(sheet, `.grid-cols-${i}`, `grid-template-columns: repeat(${i}, 1fr)`)
  }

  // Sizing
  for (const [key, val] of Object.entries(opts.spacing)) {
    const rem = `${val}rem`
    for (const p of ['w', 'h', 'min-w', 'min-h', 'max-w', 'max-h']) {
      insertRule(sheet, `.${p}-${key}`, `${p.replace('-', '-')}: ${rem}`)
    }
  }

  // Typography
  for (const v of ['left', 'center', 'right', 'justify']) {
    insertRule(sheet, `.text-${v}`, `text-align: ${v}`)
  }
  for (const v of ['normal', 'bold', 'bolder', 'lighter']) {
    insertRule(sheet, `.font-${v}`, `font-weight: ${v}`)
  }

  // Box shadow
  for (const [key, val] of Object.entries(opts.spacing)) {
    insertRule(sheet, `.shadow-${key}`, `box-shadow: 0 ${val * 0.25}rem ${val * 0.5}rem rgba(0,0,0,0.15)`)
  }

  // Position
  for (const v of ['static', 'relative', 'absolute', 'fixed', 'sticky']) {
    insertRule(sheet, `.pos-${v}`, `position: ${v}`)
  }

  // Gap pixels
  for (let i = 0; i <= 48; i += 2) {
    insertRule(sheet, `.gap-${i}px`, `gap: ${i}px`)
  }

  // Cursor
  for (const v of ['pointer', 'grab', 'move', 'not-allowed', 'wait', 'help']) {
    insertRule(sheet, `.cursor-${v}`, `cursor: ${v}`)
  }

  // Overflow
  for (const v of ['hidden', 'auto', 'scroll', 'visible']) {
    insertRule(sheet, `.overflow-${v}`, `overflow: ${v}`)
  }
}

function insertRule(sheet, selector, css) {
  try { sheet.insertRule(`${selector} { ${css} }`) } catch (e) { /* ignore dupes */ }
}

function toCss(prefix, value) {
  const map = {
    m: 'margin', mt: 'margin-top', mr: 'margin-right', mb: 'margin-bottom', ml: 'margin-left',
    mx: 'margin-left margin-right', my: 'margin-top margin-bottom',
    p: 'padding', pt: 'padding-top', pr: 'padding-right', pb: 'padding-bottom', pl: 'padding-left',
    px: 'padding-left padding-right', py: 'padding-top padding-bottom'
  }
  const props = (map[prefix] || prefix).split(' ')
  return props.map(p => `${p}: ${value}`).join(';')
}

// ─── Adopted Stylesheet (for Shadow DOM) ─────────────────────

export function createAdoptedSheet(config = {}) {
  if (typeof CSSStyleSheet === 'undefined') return null
  const sheet = new CSSStyleSheet()
  const rules = generateRules(config)
  for (const { selector, css } of rules) {
    try { sheet.insertRule(`${selector} { ${css} }`) } catch (e) {}
  }
  return sheet
}

function generateRules(config) {
  const rules = []
  const sp = config.spacing || spacing
  const cl = config.colors || colors

  for (const [key, val] of Object.entries(sp)) {
    const rem = `${val}rem`
    for (const p of ['m', 'mt', 'mr', 'mb', 'ml', 'mx', 'my', 'p', 'pt', 'pr', 'pb', 'pl', 'px', 'py']) {
      rules.push({ selector: `.${p}-${key}`, css: toCss(p, rem) })
    }
    rules.push({ selector: `.gap-${key}`, css: `gap: ${rem}` })
    rules.push({ selector: `.rounded-${key}`, css: `border-radius: ${rem}` })
  }
  for (const [name, hex] of Object.entries(cl)) {
    rules.push({ selector: `.text-${name}`, css: `color: ${hex}` })
    rules.push({ selector: `.bg-${name}`, css: `background-color: ${hex}` })
    rules.push({ selector: `.border-${name}`, css: `border-color: ${hex}` })
  }
  return rules
}

// ─── Named / Dynamic Styles ──────────────────────────────────

let _uid = 0
function uid() { return ++_uid }

export function createNamedStyle(styleObj, sheet) {
  sheet = sheet || getOrCreateSheet()
  if (!sheet) return { className: '' }
  const className = `up-style-${uid()}`
  const css = Object.entries(styleObj)
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join(';')
  try { sheet.insertRule(`.${className} { ${css} }`) } catch (e) {}
  return { className, css }
}

export function createGradientStyle(config, sheet) {
  sheet = sheet || getOrCreateSheet()
  if (!sheet) return { className: '' }
  const className = `up-grad-${uid()}`
  const dir = config.dir ? config.dir + ',' : ''
  const gradient = `linear-gradient(${dir} ${config.colors.join(',')})`
  try { sheet.insertRule(`.${className} { background-image: ${gradient} }`) } catch (e) {}
  return { className, gradient }
}

export function createEventStyle(config, sheet) {
  sheet = sheet || getOrCreateSheet()
  if (!sheet) return { className: '' }
  const className = `up-ev-${uid()}`
  const ev = config.event || 'hover'
  const css = Object.entries(config)
    .filter(([k]) => k !== 'event' && k !== 'name')
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join(';')
  try { sheet.insertRule(`.${className}:${ev} { ${css} }`) } catch (e) {}
  return { className, css, event: ev }
}

function camelToKebab(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}
