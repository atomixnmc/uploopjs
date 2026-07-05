// ─── @uploop/lang-services Reporter ─────────────────────────
// Formats errors and warnings for terminal, IDE, and CI output.

/**
 * Format errors and warnings for terminal output.
 *
 * @param {Array} errors
 * @param {Array} warnings
 * @param {string} [filePath]
 * @returns {string}
 */
export function formatErrors(errors, warnings = [], filePath = '') {
  let out = ''

  if (errors.length > 0) {
    out += `\n❌ ${errors.length} error(s) found`
    if (filePath) out += ` in ${filePath}`
    out += '\n' + '━'.repeat(60) + '\n'

    for (const error of errors) {
      out += `\n  [${error.code}] ${error.message}`
      if (error.line) out += `\n       at line ${error.line}`
      if (error.file) out += `\n       in ${error.file}`
      out += '\n'
    }
  }

  if (warnings.length > 0) {
    if (errors.length === 0) {
      out += `\n⚠️  ${warnings.length} warning(s) found`
      if (filePath) out += ` in ${filePath}`
    } else {
      out += `\n⚠️  ${warnings.length} warning(s) also found`
    }
    out += '\n' + '━'.repeat(60) + '\n'

    for (const warning of warnings) {
      out += `\n  [${warning.code}] ${warning.message}`
      if (warning.line) out += `\n       at line ${warning.line}`
      out += '\n'
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    out += `\n✅ No issues found`
    if (filePath) out += ` in ${filePath}`
    out += '\n'
  }

  return out
}

/**
 * Format warnings only (for lighter output).
 *
 * @param {Array} warnings
 * @returns {string}
 */
export function formatWarnings(warnings) {
  return formatErrors([], warnings)
}
