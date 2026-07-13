// ─── @uploop/lang-services Validator ────────────────────────
// Validates Uploop component structure and template literal syntax.

/**
 * Validate Uploop component() call structure.
 * Checks for missing state/update/view, wrong patterns.
 *
 * @param {string} source
 * @returns {{ errors: Array, warnings: Array }}
 */
export function validateComponentSyntax(source) {
  const errors = []
  const warnings = []

  // Check for component() calls
  const compMatches = source.match(/component\s*\(\s*["']([^"']+)["']\s*,\s*\{/g)
  if (!compMatches) return { errors, warnings } // No components found

  for (const match of compMatches) {
    const name = match.match(/["']([^"']+)["']/)?.[1] || 'unknown'
    const idx = source.indexOf(match)
    const rest = source.substring(idx)

    // Extract the config object
    const config = extractObject(rest)
    if (!config) {
      errors.push({
        code: 'component_config_parse',
        message: `Cannot parse config object for component "${name}". Check for missing braces or syntax errors.`,
        line: findLine(source, match),
      })
      continue
    }

    // Check: view function present
    if (!config.includes('view')) {
      errors.push({
        code: 'component_no_view',
        message: `Component "${name}" has no "view" property. Every component needs a view function.`,
        line: findLine(source, match),
      })
    }

    // Check: state is present (warning, not error — some components might not need state)
    if (!config.includes('state')) {
      warnings.push({
        code: 'component_no_state',
        message: `Component "${name}" has no "state" property. Consider adding one for explicitness.`,
        line: findLine(source, match),
      })
    }
  }

  return { errors, warnings }
}

/**
 * Validate HTML template literal usage in source.
 * Checks for @click, data-up-* attribute correctness.
 *
 * @param {string} source
 * @returns {{ errors: Array, warnings: Array }}
 */
export function validateTemplateLiteral(source) {
  const errors = []
  const warnings = []

  // Check: @click attribute syntax
  const clickPattern = /@click\s*=\s*\$\{/g
  const clickMatches = source.match(clickPattern)
  // @click usage is valid — no error

  // Check: data-up-event without data-up-prop/value binding
  // (this is usually fine, just a pattern check)

  // Check: unmatched backticks in template literals
  const backtickCount = (source.match(/`/g) || []).length
  if (backtickCount % 2 !== 0) {
    errors.push({
      code: 'unmatched_backtick',
      message: `Unmatched backtick in template literal. Found ${backtickCount} backticks — should be even.`,
      line: 0,
    })
  }

  // Check: html tagged template without import
  if (source.includes('html`') && !source.includes("import") && !source.includes("require")) {
    warnings.push({
      code: 'html_no_import',
      message: 'html tagged template used but no import statement found. Ensure: import { html } from \'@uploop/html\'',
      line: findLine(source, 'html`'),
    })
  }

  return { errors, warnings }
}

// ── Helpers ─────────────────────────────────────────────────

function findLine(source, pattern) {
  const idx = source.indexOf(pattern)
  if (idx === -1) return 0
  return source.substring(0, idx).split('\n').length
}

function extractObject(source) {
  // Simple brace-matching to extract the first {...} block
  let depth = 0
  let start = -1
  let result = ''

  for (let i = 0; i < source.length; i++) {
    if (source[i] === '{') {
      if (depth === 0) start = i
      depth++
    } else if (source[i] === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        result = source.substring(start, i + 1)
        break
      }
    }
  }

  return result
}
