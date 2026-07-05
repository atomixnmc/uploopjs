// ─── @uploop/lang-services — Public API ─────────────────────
// Syntax checker, validator, and code quality tools for Uploop/Vibe code.

export { checkFile, checkString, checkProject } from './checker.js'
export { validateComponentSyntax, validateTemplateLiteral } from './validator.js'
export { formatErrors, formatWarnings } from './reporter.js'
export { checkSchemaRules, checkBuildRules, checkGraphRules, checkComponentRules, checkImportRules } from './rules.js'
