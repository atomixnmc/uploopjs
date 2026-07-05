#!/usr/bin/env node
// ─── uploop-check CLI ───────────────────────────────────────
// Usage: uploop-check <file> [--fix] [--watch]

import { checkFile, checkString } from './checker.js'
import { formatErrors } from './reporter.js'
import { readFileSync } from 'fs'

const args = process.argv.slice(2)

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
🔍 Uploop Language Services — Code Quality Checker

Usage: uploop-check <file> [options]

Options:
  --fix        Auto-fix common issues (not yet implemented)
  --watch      Watch for changes and re-check

Examples:
  uploop-check src/components/button.js
  uploop-check examples/showcase/main.js
  uploop-check --stdin < my-file.js
`)
  process.exit(0)
}

const filePath = args[0]
const fix = args.includes('--fix')

try {
  if (filePath === '--stdin') {
    // Read from stdin
    let source = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => source += chunk)
    process.stdin.on('end', () => {
      const result = checkString(source)
      console.log(formatErrors(result.errors, result.warnings, '<stdin>'))
      process.exit(result.ok ? 0 : 1)
    })
    return
  }

  const source = readFileSync(filePath, 'utf8')
  const result = checkFile(filePath, source)
  console.log(formatErrors(result.errors, result.warnings, filePath))

  if (!result.ok) {
    console.log('Run with --fix to attempt automatic fixes (coming soon).')
  }

  process.exit(result.ok ? 0 : 1)
} catch (e) {
  if (e.code === 'ENOENT') {
    console.error(`❌ File not found: ${filePath}`)
    process.exit(1)
  }
  console.error(`❌ Error reading file: ${e.message}`)
  process.exit(1)
}
