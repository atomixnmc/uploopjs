/**
 * Entity Component — auto-generate Uploop components from entity schemas.
 * @module @uploop/schema/component
 */

function fieldMeta(fieldName, fieldDef) {
  const type = fieldDef.type || 'string'
  const fmt = fieldDef.meta?.format || fieldDef.format
  const meta = {
    name: fieldName, type,
    inputType: 'text', inputAttrs: '',
    label: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
    required: !fieldDef.optional && !fieldDef.nullable
  }

  if (type === 'string') {
    if (fmt === 'email') meta.inputType = 'email'
    else if (fmt === 'url') meta.inputType = 'url'
    else if (fmt === 'uuid') { meta.inputType = 'text'; meta.inputAttrs = 'readonly' }
  } else if (type === 'number') {
    meta.inputType = 'number'
    if (fieldDef.integer) meta.inputAttrs += ' step="1"'
  } else if (type === 'boolean') {
    meta.inputType = 'checkbox'
  } else if (type === 'date') {
    meta.inputType = 'date'
  } else if (type === 'enum') {
    meta.inputType = 'select'
    meta.options = fieldDef.values || fieldDef.meta?.values || []
  } else if (type === 'ref') {
    meta.inputType = 'text'; meta.label += ' ID'
  } else if (type === 'computed') {
    meta.computed = true; meta.inputType = 'text'; meta.inputAttrs = 'readonly'
  }
  return meta
}

function generateFormView(entityName, fieldMetas) {
  return function view(state) {
    let html = `<form class="up-entity-form" data-entity="${entityName}">`
    for (const m of fieldMetas) {
      if (m.computed) continue
      const v = state[m.name] != null ? state[m.name] : ''
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
      html += `<div class="up-field"><label for="f-${m.name}">${m.label}</label>`
      if (m.inputType === 'select') {
        html += `<select name="${m.name}" id="f-${m.name}" data-up-prop="value:${m.name}">`
        for (const o of (m.options || [])) html += `<option${v === o ? ' selected' : ''}>${esc(o)}</option>`
        html += `</select>`
      } else if (m.inputType === 'checkbox') {
        html += `<input type="checkbox" name="${m.name}" data-up-bool="checked:${m.name}" ${v ? 'checked' : ''} />`
      } else {
        html += `<input type="${m.inputType}" name="${m.name}" data-up-prop="value:${m.name}" value="${esc(v)}" ${m.inputAttrs} />`
      }
      html += `</div>`
    }
    html += `<div class="up-actions"><button type="button" data-up-event="click:save">Save</button> <button type="button" data-up-event="click:reset">Reset</button></div></form>`
    return html
  }
}

function generateDisplayView(entityName, fieldMetas) {
  return function view(state) {
    let html = `<div class="up-entity-display" data-entity="${entityName}">`
    for (const m of fieldMetas) {
      const v = state[m.name] != null ? String(state[m.name]) : ''
      html += `<div class="up-field"><span class="up-label">${m.label}</span> <span class="up-value">${v.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span></div>`
    }
    return html + `</div>`
  }
}

function generateUpdateHandlers(entityName, fields, entitySchema) {
  const handlers = {}
  for (const fn of Object.keys(fields)) {
    const cap = fn.charAt(0).toUpperCase() + fn.slice(1)
    handlers['set' + cap] = (s, v) => ({ ...s, [fn]: v })
  }
  handlers.set = (s, p) => ({ ...s, ...p })
  handlers.save = (s) => {
    const r = typeof entitySchema.validate === 'function' ? entitySchema.validate(s) : { ok: true, errors: [] }
    if (!r.ok) { console.warn(`[Uploop] ${entityName} validation failed:`, r.errors); return s }
    return r.value
  }
  handlers.reset = () => {
    const d = {}
    for (const [fn, fd] of Object.entries(fields)) {
      if (fd.computed) continue
      let dv = fd.default
      if (dv === undefined) {
        if (fd.type === 'string') dv = ''; else if (fd.type === 'number') dv = 0
        else if (fd.type === 'boolean') dv = false; else if (fd.type === 'array') dv = []
        else dv = null
      }
      if (typeof dv === 'function') dv = dv()
      if (dv === '<fn>') dv = null
      d[fn] = dv
    }
    return d
  }
  return handlers
}

function generateInitialState(fields) {
  const state = {}
  for (const [fn, fd] of Object.entries(fields)) {
    if (fd.computed) continue
    if (fd.optional || fd.nullable) {
      if (fd.default !== undefined) {
        let dv = fd.default; if (typeof dv === 'function') dv = dv(); if (dv !== '<fn>') state[fn] = dv
      }
      continue
    }
    let dv = fd.default
    if (dv === undefined) {
      if (fd.type === 'string') dv = ''; else if (fd.type === 'number') dv = 0
      else if (fd.type === 'boolean') dv = false; else if (fd.type === 'array') dv = []
      else dv = null
    }
    if (typeof dv === 'function') dv = dv()
    if (dv === '<fn>') dv = null
    state[fn] = dv
  }
  return state
}

export function entityComponent(entitySchema, opts = {}) {
  const desc = typeof entitySchema.describe === 'function' ? entitySchema.describe() : { fields: {} }
  const entityName = desc.entity || entitySchema.entityName || 'Entity'
  const fields = desc.fields || {}
  const mode = opts.mode || 'form'

  const fieldMetas = Object.entries(fields).map(([n, d]) => fieldMeta(n, d))
  const state = generateInitialState(fields)
  const update = generateUpdateHandlers(entityName, fields, entitySchema)
  if (opts.update) Object.assign(update, opts.update)

  let view
  if (typeof opts.view === 'function') {
    view = opts.view
  } else if (mode === 'display') {
    view = generateDisplayView(entityName, fieldMetas)
  } else if (mode === 'table') {
    view = function (state) {
      const items = Array.isArray(state.items) ? state.items : []
      if (!items.length) return '<div class="up-entity-table"><p>No data</p></div>'
      const metas = fieldMetas.filter(m => !m.computed)
      let h = '<div class="up-entity-table"><table><thead><tr>'
      for (const m of metas) h += `<th>${m.label}</th>`
      h += '</tr></thead><tbody>'
      for (const item of items) {
        h += '<tr>'
        for (const m of metas) h += `<td>${String(item[m.name] || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>`
        h += '</tr>'
      }
      return h + '</tbody></table></div>'
    }
  } else {
    view = generateFormView(entityName, fieldMetas)
  }

  const config = { state, update, view }
  if (opts.effect) config.effect = opts.effect
  if (opts.mount) config.mount = opts.mount
  if (opts.unmount) config.unmount = opts.unmount
  config._entityName = entityName
  config._entityFields = fieldMetas
  config._entityMode = mode
  return config
}

export function entityFields(entitySchema) {
  const desc = typeof entitySchema.describe === 'function' ? entitySchema.describe() : { fields: {} }
  return Object.entries(desc.fields || {}).map(([n, d]) => fieldMeta(n, d))
}
