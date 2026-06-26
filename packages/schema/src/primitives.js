/** Primitive type schemas. @module @uploop/schema/primitives */
import { schema, ok, fail, failAt, wrapSchema } from './core.js'

export function string(preset) {
  function validate(value) { if (typeof value !== 'string') return failAt('', 'must be a string', 'type.string'); return ok(value) }
  const base = schema('string', { type: 'string', validate })
  function makeString(prev) {
    return wrapSchema(prev || base, 'string', 'string', {
      min(n) { const c = makeString(this); c._meta = { ...c._meta, min: n }; const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (r.value.length < n) return failAt('', `must be at least ${n} characters`, 'string.too_short'); return r }; return c },
      max(n) { const c = makeString(this); c._meta = { ...c._meta, max: n }; const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (r.value.length > n) return failAt('', `must be at most ${n} characters`, 'string.too_long'); return r }; return c },
      length(n) { const c = makeString(this); c._meta = { ...c._meta, length: n }; const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (r.value.length !== n) return failAt('', `must be exactly ${n} characters`, 'string.length'); return r }; return c },
      regex(pattern, msg = 'invalid format') { const c = makeString(this); c._meta = { ...c._meta, regex: pattern }; const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (!pattern.test(r.value)) return failAt('', msg, 'string.regex'); return r }; return c },
      email() { const c = makeString(this); c._meta = { ...c._meta, format: 'email' }; const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.value)) return failAt('', 'must be a valid email', 'string.email'); return r }; return c },
      url() { const c = makeString(this); c._meta = { ...c._meta, format: 'url' }; const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; try { new URL(r.value) } catch { return failAt('', 'must be a valid URL', 'string.url') }; return r }; return c },
      uuid() { const c = makeString(this); c._meta = { ...c._meta, format: 'uuid' }; const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.value)) return failAt('', 'must be a valid UUID', 'string.uuid'); return r }; return c },
      trim() { const c = makeString(this); const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; return ok(r.value.trim()) }; return c },
      lowercase() { const c = makeString(this); const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; return ok(r.value.toLowerCase()) }; return c },
      uppercase() { const c = makeString(this); const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; return ok(r.value.toUpperCase()) }; return c }
    })
  }
  const r = makeString()
  if (preset === 'email') return r.email()
  if (preset === 'url') return r.url()
  if (preset === 'uuid') return r.uuid()
  return r
}

export function number() {
  function validate(value) { if (typeof value !== 'number' || Number.isNaN(value)) return failAt('', 'must be a number', 'type.number'); return ok(value) }
  const base = schema('number', { type: 'number', validate })
  function makeNumber(prev) {
    return wrapSchema(prev || base, 'number', 'number', {
      min(n) { const c = makeNumber(this); c._meta = { ...c._meta, min: n }; const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (r.value < n) return failAt('', `must be >= ${n}`, 'number.too_small'); return r }; return c },
      max(n) { const c = makeNumber(this); c._meta = { ...c._meta, max: n }; const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (r.value > n) return failAt('', `must be <= ${n}`, 'number.too_large'); return r }; return c },
      integer() { const c = makeNumber(this); c._meta = { ...c._meta, integer: true }; const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (!Number.isInteger(r.value)) return failAt('', 'must be an integer', 'number.integer'); return r }; return c },
      positive() { const c = makeNumber(this); const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (r.value <= 0) return failAt('', 'must be positive', 'number.positive'); return r }; return c },
      negative() { const c = makeNumber(this); const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (r.value >= 0) return failAt('', 'must be negative', 'number.negative'); return r }; return c },
      finite() { const c = makeNumber(this); const pf = c._validateFn; c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (!Number.isFinite(r.value)) return failAt('', 'must be finite', 'number.finite'); return r }; return c }
    })
  }
  return makeNumber()
}

export function boolean() {
  return schema('boolean', { type: 'boolean', validate(v) { if (typeof v !== 'boolean') return failAt('', 'must be a boolean', 'type.boolean'); return ok(v) } })
}

export function date() {
  function validate(value) { if (value instanceof Date) { if (isNaN(value.getTime())) return failAt('', 'must be a valid date', 'type.date'); return ok(value) }; if (typeof value === 'string' || typeof value === 'number') { const d = new Date(value); if (isNaN(d.getTime())) return failAt('', 'must be a valid date', 'type.date'); return ok(d) }; return failAt('', 'must be a valid date', 'type.date') }
  const base = schema('date', { type: 'date', validate })
  function makeDate(prev) {
    return wrapSchema(prev || base, 'date', 'date', {
      min(d) { const c = makeDate(this); const pf = c._validateFn; const minDate = d instanceof Date ? d : new Date(d); c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (r.value < minDate) return failAt('', `must be on or after ${minDate.toISOString()}`, 'date.too_early'); return r }; return c },
      max(d) { const c = makeDate(this); const pf = c._validateFn; const maxDate = d instanceof Date ? d : new Date(d); c._validateFn = (v) => { const r = pf(v); if (!r.ok) return r; if (r.value > maxDate) return failAt('', `must be on or before ${maxDate.toISOString()}`, 'date.too_late'); return r }; return c },
      past() { return this.max(new Date()) },
      future() { return this.min(new Date()) }
    })
  }
  return makeDate()
}

export function literal(value) {
  return schema('literal(' + JSON.stringify(value) + ')', { type: 'literal', validate(v) { if (v !== value) return failAt('', `must be ${JSON.stringify(value)}`, 'literal.mismatch'); return ok(v) }, meta: { example: value } })
}

export function enumeration(values) {
  return schema('enum', { type: 'enum', validate(v) { if (!values.includes(v)) return failAt('', `must be one of: ${values.join(', ')}`, 'enum.invalid'); return ok(v) }, meta: { values } })
}
