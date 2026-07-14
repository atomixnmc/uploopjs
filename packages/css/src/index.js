// ─── @uploop/css — Public API ─────────────────────────────────
// Barrel re-export. All modules are independently importable.

// Design tokens (pure data)
export {
  breakpoints,
  spacing,
  spacingTiny,
  colors,
  fontSize,
  fontWeight,
  relativeScales,
  percentageScales
} from './tokens.js'

// Theme system
export {
  theme,
  extendTheme,
  applyTheme,
  lightTheme,
  darkTheme
} from './theme.js'

// Utility generation
export {
  utilityDefs,
  utility,
  generateUtilities
} from './utility.js'

// Variant engine
export {
  variants,
  registerVariant,
  variant,
  hasVariant,
  variantNames
} from './variant.js'

// CSS injection
export {
  getSheet,
  inject,
  removeSheet,
  createAdoptedSheet
} from './inject.js'

// Dynamic style creation (jQuery-inspired)
export {
  camelToKebab,
  createNamedStyle,
  createGradientStyle,
  createEventStyle
} from './dynamic.js'

// Chainable style builder
export { css, css2, parseCSS } from './chain.js'

// Color utilities
export {
  hexToRgb,
  rgbToHex,
  lighten,
  darken,
  shade,
  shades,
  shadeMap,
  alpha,
  contrast,
  colorShadeVars,
  themeShadeVars
} from './colors.js'

// Animation utilities
export {
  injectAnimations,
  ANIMATIONS
} from './animation.js'

// Runtime optimizer
export {
  markUsed,
  getUsedClasses,
  resetUsed,
  watchDOM,
  unwatchDOM,
  usedRules,
  stats,
  hasTracking
} from './optimizer.js'
