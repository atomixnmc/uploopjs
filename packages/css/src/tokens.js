// ─── Design Tokens ─────────────────────────────────────────────
// Pure data — no DOM, no side effects.
// Consumers import only what they need (tree-shakeable).

/** Viewport breakpoints (px). Matches common responsive tiers. */
export const breakpoints = {
  z: 0, sm: 576, md: 768, lg: 992, xl: 1200,
  xl2: 1536, xl3: 1920, xl4: 2560, xl5: 3840
}

/**
 * Spacing scale in rem units.
 * Keys: 0, 0_25, 0_5, 0_75, 1, 1_25, ..., 12, 12_25, 12_5, 12_75
 * Value = key parsed as rem (e.g. "2_5" → 2.5rem)
 */
export const spacing = {}
for (let i = 0; i <= 12; i++) {
  spacing[i] = i
  spacing[`${i}_25`] = i + 0.25
  spacing[`${i}_5`] = i + 0.5
  spacing[`${i}_75`] = i + 0.75
}

/** Tiny spacing adjustments (letter-spacing, fine-tuning). */
export const spacingTiny = {
  t2: -0.05, t1: -0.025, z: 0, normal: 0, w1: 0.025, w2: 0.05, w3: 0.1
}

/** Named color palette. Flat hex values — theme layer adds CSS variables. */
export const colors = {
  transparent: 'transparent',
  primary:   '#646cff',
  secondary: '#6c757d',
  success:   '#28a745',
  info:      '#17a2b8',
  warning:   '#ffc107',
  danger:    '#dc3545',
  light:     '#f8f9fa',
  dark:      '#343a40',
  white:     '#fff',
  black:     '#000',
  gray:      '#6c757d',
  grayDark:  '#343a40',
  yellow:    '#ffc107',
  orange:    '#fd7e14',
  red:       '#dc3545',
  pink:      '#e83e8c',
  green:     '#28a745',
  teal:      '#20c997',
  cyan:      '#17a2b8',
  blue:      '#007bff',
  navy:      '#001f3f',
  purple:    '#6f42c1',
  lime:      '#00ff00',
  olive:     '#808000',
  aqua:      '#00ffff',
  silver:    '#c0c0c0'
}

/** Font size scale in rem. */
export const fontSize = {}
for (let i = 0; i <= 12; i++) {
  fontSize[i] = i
  fontSize[`${i}_25`] = i + 0.25
  fontSize[`${i}_5`] = i + 0.5
  fontSize[`${i}_75`] = i + 0.75
}

/** Font weight values. */
export const fontWeight = { thin: 100, extralight: 200, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 }

/** Typography scales (relative). */
export const relativeScales = {
  none: 0, xs: 0.75, sm: 0.875, base: 1, md: 1.25, lg: 1.5,
  xl: 2, xl2: 2.5, xl3: 3, xl4: 4, xl5: 5, xl6: 6,
  full: '100%', auto: 'auto', fit: 'fit-content', min: 'min-content', max: 'max-content'
}

/** Percentage scales 0–99. */
export const percentageScales = {}
for (let i = 0; i < 100; i++) {
  percentageScales[`pc${i}`] = i
}
