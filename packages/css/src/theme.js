// ─── Theme System ──────────────────────────────────────────────
// Define, extend, and apply themes via CSS custom properties.

import { colors as defaultColors, spacing as defaultSpacing, fontSize as defaultFontSize } from './tokens.js'
import { themeShadeVars, contrast as contrastColor } from './colors.js'

/** Default surface tokens used when theme doesn't specify them. */
const defaultSurface = {
  bg: '#ffffff',
  fg: '#222222',
  surface: '#f8f9fa',
  border: '#e0e0e0',
}

/**
 * Create a theme object from token overrides.
 *
 * @param {Object} config
 * @param {Object} [config.colors] - Color token map (name → hex)
 * @param {Object} [config.spacing] - Spacing scale
 * @param {Object} [config.fontSize] - Font size scale
 * @param {Object} [config.surface] - Surface tokens { bg, fg, surface, border }
 * @param {'light'|'dark'} [config.mode='light'] - Color scheme mode
 * @param {string} [config.name] - Theme identifier
 * @returns {Theme}
 */
export function theme(config = {}) {
  const t = {
    name: config.name || 'default',
    mode: config.mode || 'light',
    colors: { ...defaultColors, ...config.colors },
    spacing: { ...defaultSpacing, ...config.spacing },
    fontSize: { ...defaultFontSize, ...config.fontSize },
    surface: { ...defaultSurface, ...config.surface },
  }
  t.cssVars = buildCSSVars(t)
  t.cssVarsString = cssVarsToString(t.cssVars)
  return t
}

/**
 * Extend an existing theme with overrides.
 * Returns a new theme object (immutable).
 */
export function extendTheme(base, overrides = {}) {
  return theme({
    name: overrides.name || base.name + '-extended',
    mode: overrides.mode || base.mode,
    colors: { ...base.colors, ...overrides.colors },
    spacing: { ...base.spacing, ...overrides.spacing },
    fontSize: { ...base.fontSize, ...overrides.fontSize },
    surface: { ...base.surface, ...overrides.surface },
  })
}

/**
 * Apply a theme by setting CSS custom properties on a root element.
 * Default target: `document.documentElement` (`:root`).
 *
 * Also sets the element's background and text color directly
 * via style so the page surface changes immediately.
 *
 * @param {Theme} t - Theme from theme()
 * @param {HTMLElement} [root=document.documentElement] - Target element
 */
export function applyTheme(t, root) {
  if (typeof document === 'undefined') return
  const el = root || document.documentElement
  el.setAttribute('data-theme', t.name)
  el.setAttribute('data-color-scheme', t.mode)
  for (const [prop, value] of Object.entries(t.cssVars)) {
    el.style.setProperty(prop, value)
  }
  // Apply surface directly to the element
  el.style.setProperty('background-color', t.surface.bg)
  el.style.setProperty('color', t.surface.fg)
}

// ─── CSS Variable Builders ────────────────────────────────────

function buildCSSVars(t) {
  const vars = {}
  // Color shade variants (primary-50, primary-100, ..., primary-900)
  Object.assign(vars, themeShadeVars(t.colors, 10))
  // Spacing scale
  for (const [key, val] of Object.entries(t.spacing)) {
    vars[`--spacing-${key}`] = `${val}rem`
  }
  // Font size scale
  for (const [key, val] of Object.entries(t.fontSize)) {
    vars[`--fontSize-${key}`] = `${val}rem`
  }
  // Surface tokens
  for (const [key, val] of Object.entries(t.surface)) {
    vars[`--color-${key}`] = val
  }
  return vars
}

function cssVarsToString(vars) {
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ')
}

// ─── Pre-built Themes ─────────────────────────────────────────

export const lightTheme = theme({
  name: 'light',
  mode: 'light',
  surface: { bg: '#ffffff', fg: '#1a1a2e', surface: '#f8f9fa', border: '#e0e0e0' },
})

export const darkTheme = theme({
  name: 'dark',
  mode: 'dark',
  colors: {
    light: '#1e1e2e',
    dark: '#e8e8ed',
    white: '#1e1e2e',
    black: '#f0f0f5',
    gray: '#8888a0',
    grayDark: '#c0c0d0',
  },
  surface: {
    bg: '#121220',
    fg: '#e0e0e8',
    surface: '#1e1e30',
    border: '#2a2a40',
  },
})

/**
 * @typedef {Object} Theme
 * @property {string} name
 * @property {'light'|'dark'} mode
 * @property {Object<string, string>} colors
 * @property {Object<string, number>} spacing
 * @property {Object<string, number>} fontSize
 * @property {{ bg: string, fg: string, surface: string, border: string }} surface
 * @property {Object<string, string>} cssVars
 * @property {string} cssVarsString
 */
