// ─── @uploop/lang-services Checker ──────────────────────────
// Scans Uploop/Vibe source files for common mistakes.
// Catches issues BEFORE they reach the browser.
// Implements detection for all aiDataExpert integration issues.

import { validateComponentSyntax, validateTemplateLiteral } from './validator.js'
import { formatErrors } from './reporter.js'
import { checkSchemaRules, checkBuildRules, checkGraphRules, checkComponentRules, checkImportRules } from './rules.js'

export function checkFile(filePath, source) {
  const errors = []
  const warnings = []

  const htmlResult = validateTemplateLiteral(source)
  errors.push(...htmlResult.errors)
  warnings.push(...htmlResult.warnings)

  const compResult = validateComponentSyntax(source)
  errors.push(...compResult.errors)
  warnings.push(...compResult.warnings)

  checkCommonMistakes(source, errors, warnings, filePath)

  // Build-time rules (schema, Vite, SST, graph, component)
  checkSchemaRules(source, errors, warnings)
  checkBuildRules(source, errors, warnings)
  checkGraphRules(source, errors, warnings)
  checkComponentRules(source, errors, warnings)
  checkImportRules(source, errors, warnings, filePath)

  for (const e of errors) e.file = filePath
  for (const w of warnings) w.file = filePath

  return { ok: errors.length === 0, errors, warnings }
}

export function checkString(source) {
  return checkFile('<string>', source)
}

export async function checkProject(dir) {
  return { ok: true, message: 'Project scanning not yet implemented.' }
}

// ── Common Mistake Detection ────────────────────────────────

function checkCommonMistakes(source, errors, warnings, filePath) {

  // 1. @click outside html template literal
  if (source.includes('@click') && !source.includes('html`')) {
    warnings.push({
      code: 'click_outside_html',
      message: '@click attribute found outside html template literal. @click only works inside html`...` tagged templates.',
      line: findLine(source, '@click'),
    })
  }

  // 2. Re-export without local binding (ESM gotcha)
  var reExportMatch = source.match(/export\s*\{\s*(\w+)\s*\}\s*from\s*['"][^'"]+['"]/g)
  if (reExportMatch) {
    for (var i = 0; i < reExportMatch.length; i++) {
      var match = reExportMatch[i]
      var name = (match.match(/\{\s*(\w+)\s*\}/) || [])[1]
      if (name) {
        var rest = source.replace(match, '')
        if (new RegExp('\\b' + name + '\\b(?![\\s]*[,\\}])').test(rest)) {
          errors.push({
            code: 're_export_no_local_binding',
            message: '"' + name + '" is re-exported but also used as a local variable. ESM re-exports do NOT create local bindings. Use: import { ' + name + ' } from "..."; export { ' + name + ' };',
            line: findLine(source, match),
          })
        }
      }
    }
  }

  // 3. View function without return
  var viewFnMatch = source.match(/view\s*:\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{/g)
  if (viewFnMatch) {
    for (var j = 0; j < viewFnMatch.length; j++) {
      var vm = viewFnMatch[j]
      var idx = source.indexOf(vm) + vm.length
      var depth = 1, body = ''
      for (var k = idx; k < source.length && depth > 0; k++) {
        if (source[k] === '{') depth++
        else if (source[k] === '}') depth--
        if (depth > 0) body += source[k]
      }
      if (body.indexOf('return ') === -1 && body.indexOf('return(') === -1) {
        warnings.push({
          code: 'view_no_return',
          message: 'view function uses block body { ... } without a return statement. The view will render nothing.',
          line: findLine(source, vm),
        })
      }
    }
  }

  // 4. require() in ESM
  if (source.includes('require(')) {
    errors.push({
      code: 'cjs_in_esm',
      message: 'require() found in ESM module. Use import instead.',
      line: findLine(source, 'require('),
    })
  }


  // 4b. node:fs / node:path in browser-targeted code (Issue 4 from aiDataExpert)
  if (source.includes('node:fs') || source.includes('node:path') || source.includes('node:url')) {
    warnings.push({
      code: 'node_import_in_browser',
      message: 'node:fs, node:path, or node:url imported. These will fail in browser builds. Use Vite import.meta.glob or @uploop/fs for isomorphic file access.',
      line: findLine(source, 'node:'),
    })
  }

  // 5. html([...]) anti-pattern
  if (source.includes('html([')) {
    warnings.push({
      code: 'html_array_call',
      message: 'html([...]) passes a plain string to html(). @click bindings will NOT work. Use html`...` tagged template instead.',
      line: findLine(source, 'html(['),
    })
  }

  // 6. data-up-event without handler
  var eventMatches = source.match(/data-up-event\s*=\s*["']click:(\w+)["']/g)
  if (eventMatches) {
    for (var ei = 0; ei < eventMatches.length; ei++) {
      var em = eventMatches[ei]
      var eventName = (em.match(/click:(\w+)/) || [])[1]
      if (eventName && source.indexOf(eventName + ':') === -1 && source.indexOf(eventName + '(') === -1) {
        warnings.push({
          code: 'unhandled_event',
          message: 'data-up-event="click:' + eventName + '" found but no "' + eventName + '" update handler detected.',
          line: findLine(source, em),
        })
      }
    }
  }

  // 7. Template quote escaping issues
  var tlContent = extractTemplateLiterals(source)
  for (var ti = 0; ti < tlContent.length; ti++) {
    var tc = tlContent[ti]
    var exprMatches = tc.content.match(/\$\{[^}]*\}/g)
    if (exprMatches) {
      for (var ei2 = 0; ei2 < exprMatches.length; ei2++) {
        var expr = exprMatches[ei2]
        var sqCount = (expr.match(/'/g) || []).length
        if (sqCount > 2 && expr.indexOf('\\\\') > -1) {
          warnings.push({
            code: 'template_quote_escape',
            message: 'Potentially problematic quote escaping in template literal. Consider String.fromCharCode(39).',
            line: tc.line,
          })
        }
      }
    }
  }

  // ── NEW: aiDataExpert Issue Detection ─────────────────────

  // 8. on* HTML attributes (Issue 6 from aiDataExpert)
  // Uploop only supports @event syntax. onmouseover, onchange render as text.
  var onEventRe = /\bon(mouseover|mouseout|mouseenter|mouseleave|change|focus|blur|keyup|keydown|submit|input|click|dblclick|scroll|resize|load|error)\s*=\s*\$/g
  var onM
  while ((onM = onEventRe.exec(source)) !== null) {
    errors.push({
      code: 'on_attr_not_supported',
      message: 'on' + onM[1] + ' attribute found. Uploop does NOT support DOM on* attributes — they render as visible text. Use @' + onM[1] + ' instead.',
      line: findLine(source, onM[0]),
    })
  }

  // 9. React hooks in Uploop code
  if (/\buseState\b/.test(source) || /\buseEffect\b/.test(source) || /\buseRef\b/.test(source)) {
    warnings.push({
      code: 'react_hooks_in_uploop',
      message: 'React hooks (useState, useEffect, useRef) detected. Uploop uses component({ state, update, view }) instead.',
      line: findLine(source, 'useState') || findLine(source, 'useEffect') || 0,
    })
  }

  // 10. JSX-like <${Component} /> (Issue 1 from aiDataExpert)
  var dollarBrace = String.fromCharCode(36) + String.fromCharCode(123) // ${
  if (source.indexOf(dollarBrace) > -1 && source.indexOf('/>') > source.indexOf(dollarBrace)) {
    warnings.push({
      code: 'jsx_component_pattern',
      message: 'JSX-like <${Component} /> pattern detected. Uploop does NOT compose components via template interpolation. Use .mount(el) instead.',
      line: findLine(source, dollarBrace),
    })
  }
}

// ── Helpers ─────────────────────────────────────────────────

function findLine(source, pattern) {
  var idx = typeof pattern === 'string' ? source.indexOf(pattern) : -1
  if (idx === -1 && typeof pattern === 'number') idx = pattern
  if (idx === -1) return 0
  return source.substring(0, idx).split('\n').length
}

function extractTemplateLiterals(source) {
  var literals = []
  var inBacktick = false, start = 0, line = 1
  for (var i = 0; i < source.length; i++) {
    if (source[i] === '\n') line++
    if (source[i] === '`' && (i === 0 || source[i - 1] !== '\\')) {
      if (!inBacktick) { start = i + 1; inBacktick = true }
      else { literals.push({ content: source.substring(start, i), line: line }); inBacktick = false }
    }
  }
  return literals
}
