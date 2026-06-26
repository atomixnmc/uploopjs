/**
 * uploop-schema core — atomic schema factory.
 * @module @uploop/schema/core
 */

export function ok(value) { return { ok: true, value, errors: [] } }
export function fail(message, code = 'invalid') { return { ok: false, value: undefined, errors: [{ path: '', message, code }] } }
export function failAt(path, message, code = 'invalid') { return { ok: false, value: undefined, errors: [{ path, message, code }] } }

export function mergeResults(...results) {
  const allErrors = []; let mergedValue = {}; let allOk = true
  for (const r of results) { if (!r) continue; if (!r.ok) allOk = false; if (r.errors) allErrors.push(...r.errors); if (r.value && typeof r.value === 'object' && !Array.isArray(r.value)) Object.assign(mergedValue, r.value) }
  return { ok: allOk, value: mergedValue, errors: allErrors }
}

export class ValidationError extends Error {
  constructor(result) { const msgs = (result.errors || []).map(e => `${e.path ? e.path + ': ' : ''}${e.message}`); super(msgs.join('; ') || 'Validation failed'); this.name = 'ValidationError'; this.errors = result.errors || []; this.value = result.value }
}

export function schema(name, config = {}) {
  const { type = 'any', validate: validateFn, meta = {} } = config
  const _modifiers = []
  function _baseValidate(value) { return typeof validateFn === 'function' ? validateFn(value) : ok(value) }

  const inst = {
    kind: 'uploop.schema', name, type,
    _meta: { ...meta },
    _modifiers,
    _validateFn: _baseValidate,

    validate(value) {
      const mods = this._modifiers
      for (const mod of mods) { if (mod.type === 'optional' && value === undefined) return ok(undefined); if (mod.type === 'nullable' && value === null) return ok(null) }
      let v = value
      for (const mod of mods) { if (mod.type === 'transform') { try { v = mod.fn(v) } catch (e) { return failAt('', e.message || 'Transform failed', 'transform_error') } }; if (mod.type === 'default' && (v === undefined || v === null)) v = typeof mod.value === 'function' ? mod.value() : mod.value }
      return this._validateFn(v)
    },

    safeParse(value) { return this.validate(value) },
    assert(value) { const r = this.validate(value); if (!r.ok) throw new ValidationError(r); return r.value },
    coerce(value) { return this.validate(value) },

    optional() { const c = cloneSchema(this, this.name + '?'); c._modifiers.push({ type: 'optional' }); return c },
    nullable() { const c = cloneSchema(this, this.name + '|null'); c._modifiers.push({ type: 'nullable' }); return c },
    withDefault(value) { const c = cloneSchema(this, this.name); c._modifiers.push({ type: 'default', value }); return c },
    transform(fn) { const c = cloneSchema(this, this.name); c._modifiers.push({ type: 'transform', fn }); return c },
    pipe(other) { const self = this; return schema(this.name + '|>' + other.name, { type: other.type, validate(v) { const r = self.validate(v); if (!r.ok) return r; return typeof other.validate === 'function' ? other.validate(r.value) : ok(r.value) }, meta: { ...self._meta } }) },

    describe() {
      const d = { kind: 'uploop.schema', name, type, meta: { ...this._meta } }
      for (const mod of this._modifiers) { if (mod.type === 'optional') d.optional = true; if (mod.type === 'nullable') d.nullable = true; if (mod.type === 'default') d.default = typeof mod.value === 'function' ? '<fn>' : mod.value; if (mod.type === 'transform') d.transformed = true }
      return d
    }
  }
  return inst
}

function cloneSchema(source, newName) {
  const copy = schema(newName || source.name, { type: source.type, validate: source._validateFn, meta: { ...source._meta } })
  copy._modifiers = [...source._modifiers]
  const coreKeys = ['validate', 'safeParse', 'assert', 'coerce', 'optional', 'nullable', 'withDefault', 'transform', 'pipe', 'describe']
  for (const key of Object.keys(source)) {
    if (coreKeys.includes(key)) continue
    if (typeof source[key] === 'function') copy[key] = source[key]
    else if (key.startsWith('_') && key !== '_meta' && key !== '_modifiers' && key !== '_validateFn' && copy[key] === undefined) copy[key] = source[key]
    else if (key !== 'kind' && key !== 'name' && key !== 'type' && key !== '_meta' && key !== '_modifiers' && key !== '_validateFn' && copy[key] === undefined) copy[key] = source[key]
  }
  return copy
}

export function wrapSchema(base, name, type, extra = {}) {
  const inst = schema(name, { type, validate(v) { return base.validate(v) }, meta: { ...base._meta } })
  inst._modifiers = [...base._modifiers]
  const coreKeys = ['validate', 'safeParse', 'assert', 'coerce', 'optional', 'nullable', 'withDefault', 'transform', 'pipe', 'describe']
  for (const key of Object.keys(base)) {
    if (coreKeys.includes(key)) continue
    if (typeof base[key] === 'function') inst[key] = base[key]
    else if (key.startsWith('_') && key !== '_meta' && key !== '_modifiers' && key !== '_validateFn') inst[key] = base[key]
  }
  Object.assign(inst, extra)
  return inst
}
