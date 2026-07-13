/**
 * Intent Schema — fuzzy, token-efficient AI communication.
 * @module @uploop/schema/intent
 */

const SHORTHAND = {
  s: 'string', str: 'string', string: 'string',
  n: 'number', num: 'number', number: 'number',
  i: 'integer', int: 'integer', integer: 'integer',
  b: 'boolean', bool: 'boolean', boolean: 'boolean',
  d: 'date', date: 'date',
  e: 'email', email: 'email',
  u: 'url', url: 'url',
  uid: 'uuid', uuid: 'uuid'
}

function resolveType(val) {
  if (typeof val !== 'string') return null
  let optional = false, v = val
  if (v.endsWith('?')) { optional = true; v = v.slice(0, -1) }
  let isArray = false
  if (v.startsWith('[') && v.endsWith(']')) { isArray = true; v = v.slice(1, -1) }
  if (v.includes('|') && !v.includes('[')) {
    return { type: 'enum', values: v.split('|').map(s => s.trim()), optional, array: isArray }
  }
  const resolved = SHORTHAND[v.toLowerCase()]
  if (resolved) {
    let type = resolved, subtype, format
    if (resolved === 'integer') { type = 'number'; subtype = 'integer' }
    if (resolved === 'email') { type = 'string'; format = 'email' }
    if (resolved === 'url') { type = 'string'; format = 'url' }
    if (resolved === 'uuid') { type = 'string'; format = 'uuid' }
    const r = { type, optional, array: isArray }
    if (subtype) r.subtype = subtype
    if (format) r.format = format
    return r
  }
  if (/^[A-Z]/.test(v)) return { type: 'ref', ref: v, optional, array: isArray }
  return { type: 'string', optional, array: isArray }
}

// ── intent() ───────────────────────────────────────────────

export function intent(shape = {}) {
  const fields = {}
  for (const [key, val] of Object.entries(shape)) {
    if (Array.isArray(val)) {
      fields[key] = { type: 'enum', values: val }
    } else if (val !== null && typeof val === 'object') {
      const nested = intent(val)
      fields[key] = { type: 'object', fields: nested._fields }
    } else {
      fields[key] = resolveType(String(val)) || { type: 'string' }
    }
  }
  return {
    kind: 'uploop.intent', _fields: fields, shape: fields,
    describe() { return { kind: 'uploop.intent', fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { ...v }])) } },
    toTokens() { return intentToken(this) }
  }
}

// ── resolveIntent() ────────────────────────────────────────

export function resolveIntent(intentObj, schemaDescribe) {
  const intentFields = intentObj._fields || intentObj.shape || {}
  const schemaFields = schemaDescribe.fields || {}
  const schemaName = schemaDescribe.entity || 'Entity'
  const matched = [], partial = [], missing = [], extra = [], suggestions = []

  for (const [field, sd] of Object.entries(schemaFields)) {
    const id = intentFields[field]
    if (!id) {
      missing.push({ field, type: sd.type, required: !sd.optional })
      if (!sd.optional && !sd.computed) suggestions.push({ field, type: sd.type, reason: 'required' })
      continue
    }
    const st = sd.type
    const it = id.type
    const sfmt = sd.meta?.format || sd.format
    const ifmt = id.format
    if (it === st || (it === 'number' && st === 'number')) {
      if (sfmt && ifmt !== sfmt) partial.push({ field, intent: it, schema: st, detail: 'format mismatch: expected ' + sfmt })
      else matched.push(field)
    } else if (st === 'ref' && it === 'string') {
      partial.push({ field, intent: it, schema: st, detail: 'string accepted, expecting ref' })
    } else {
      partial.push({ field, intent: it, schema: st, detail: 'type mismatch' })
    }
  }

  for (const field of Object.keys(intentFields)) {
    if (!schemaFields[field]) extra.push({ field, type: intentFields[field].type })
  }

  const totalSchema = Object.keys(schemaFields).filter(k => !schemaFields[k].computed).length
  const exact = matched.length
  const partOk = partial.filter(p => p.detail !== 'type mismatch').length
  const score = totalSchema > 0 ? Math.round(((exact * 1.0 + partOk * 0.5) / totalSchema) * 100) / 100 : 1

  let match
  if (score >= 0.9 || (exact === totalSchema && extra.length === 0)) match = 'exact'
  else if (exact > 0 || partOk > 0) match = 'partial'
  else if (extra.length > 0 || missing.length > 0) match = 'mismatch'
  else match = 'unknown'

  return { match, matched, partial, missingInIntent: missing, extraInIntent: extra, score, suggestions, entity: schemaName }
}

// ── suggestIntent() ────────────────────────────────────────

export function suggestIntent(intentObj, schemaDescribe) {
  const r = resolveIntent(intentObj, schemaDescribe)
  const adds = r.missingInIntent.filter(m => m.required).map(m => ({ field: m.field, type: m.type, reason: 'required by ' + schemaDescribe.entity }))
  return { hint: adds.length ? `${schemaDescribe.entity} requires: ${adds.map(a => a.field + ' (' + a.type + ')').join(', ')}` : 'Intent fully covers the schema', suggestedAdditions: adds }
}

// ── intentToken() ──────────────────────────────────────────

export function intentToken(intentObj) {
  const fields = intentObj._fields || intentObj.shape || {}
  const parts = []
  for (const [key, def] of Object.entries(fields)) {
    let token = ''
    if (def.type === 'enum' && def.values) token = def.values.join('|')
    else if (def.type === 'object' && def.fields) token = '{' + intentToken({ _fields: def.fields }) + '}'
    else if (def.type === 'ref') token = def.ref
    else {
      if (def.subtype === 'integer') token = 'i'
      else if (def.format === 'email') token = 'e'
      else if (def.format === 'url') token = 'u'
      else if (def.format === 'uuid') token = 'uid'
      else token = ({ string: 's', number: 'n', boolean: 'b', date: 'd' })[def.type] || def.type.charAt(0)
    }
    if (def.optional) token += '?'
    if (def.array) token = '[' + token + ']'
    parts.push(key + ':' + token)
  }
  return parts.join(',')
}

intentToken.parse = function (token) {
  const shape = {}
  if (!token || !token.trim()) return intent(shape)
  const parts = splitToken(token)
  for (const part of parts) {
    const ci = part.indexOf(':')
    if (ci === -1) continue
    const key = part.slice(0, ci).trim()
    let val = part.slice(ci + 1).trim()
    if (val.startsWith('{') && val.endsWith('}')) { shape[key] = intentToken.parse(val.slice(1, -1))._fields; continue }
    shape[key] = val
  }
  return intent(shape)
}

function splitToken(token) {
  const parts = []; let depth = 0, current = ''
  for (const ch of token) {
    if (ch === '{') depth++; else if (ch === '}') depth--
    if (ch === ',' && depth === 0) { parts.push(current); current = '' }
    else current += ch
  }
  if (current.trim()) parts.push(current)
  return parts
}
