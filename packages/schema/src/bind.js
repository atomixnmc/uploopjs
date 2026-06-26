/**
 * Data Binding Layer — declarative mapping between entities, HyperGraph, and DOM.
 *
 * @module @uploop/schema/bind
 */

export function bind(entitySchema, graph, opts = {}) {
  const fieldMap = opts.map || {}
  const virtuals = opts.virtual || {}
  const desc = typeof entitySchema.describe === 'function' ? entitySchema.describe() : { fields: {} }
  const entityName = desc.entity || entitySchema.entityName || 'Entity'
  const fieldNames = Object.keys(desc.fields || {})

  // Graph node name is always Entity.field (not aliased)
  function nodeName(field) {
    return entityName + '.' + field
  }

  // External key → entity field resolution
  function fieldForKey(externalKey) {
    // Check explicit mappings: map: { name: 'displayName' } means externalKey 'displayName' → field 'name'
    for (const [field, mapping] of Object.entries(fieldMap)) {
      if (typeof mapping === 'string' && mapping === externalKey) return field
      if (mapping && typeof mapping === 'object' && mapping.from === externalKey) return field
    }
    // Direct match
    if (fieldNames.includes(externalKey)) return externalKey
    return null
  }

  // Entity field → external key (for project)
  function externalKey(field) {
    const m = fieldMap[field]
    if (typeof m === 'string') return m
    if (m && typeof m === 'object' && m.to) return m.to
    return field
  }

  function transformPopulate(field, value) {
    const m = fieldMap[field]
    if (m && typeof m === 'object' && typeof m.populate === 'function') return m.populate(value)
    return value
  }

  function transformProject(field, value) {
    const m = fieldMap[field]
    if (m && typeof m === 'object' && typeof m.project === 'function') return m.project(value)
    return value
  }

  const binding = {
    project() {
      const result = {}
      for (const field of fieldNames) {
        result[externalKey(field)] = transformProject(field, graph.getNode(nodeName(field)))
      }
      for (const [vname, vdef] of Object.entries(virtuals)) {
        if (typeof vdef.project === 'function') result[vname] = vdef.project(result)
      }
      return result
    },

    populate(data) {
      const mapped = {}
      for (const key of Object.keys(data)) {
        const field = fieldForKey(key)
        if (field) {
          mapped[field] = transformPopulate(field, data[key])
        }
      }
      for (const [vname, vdef] of Object.entries(virtuals)) {
        if (typeof vdef.populate === 'function' && vname in data) {
          const extra = vdef.populate(data)
          if (extra && typeof extra === 'object') Object.assign(mapped, extra)
        }
      }

      const result = typeof entitySchema.validate === 'function'
        ? entitySchema.validate(mapped)
        : { ok: true, value: mapped, errors: [] }

      if (result.ok) {
        for (const field of fieldNames) {
          if (field in result.value) {
            graph.set(nodeName(field), result.value[field])
          }
        }
      }
      return { ok: result.ok, errors: result.errors || [] }
    },

    patch(partial) {
      return this.populate({ ...this.project(), ...partial })
    },

    subscribe(fn) {
      const unsubs = []
      for (const field of fieldNames) {
        if (typeof graph.onDataChange === 'function') {
          unsubs.push(graph.onDataChange(nodeName(field), () => fn(this.project())))
        }
      }
      return () => unsubs.forEach(u => typeof u === 'function' && u())
    },

    onChange(field, fn) {
      if (typeof graph.onDataChange === 'function') return graph.onDataChange(nodeName(field), fn)
      return () => {}
    },

    reset() {
      for (const field of fieldNames) {
        const fd = desc.fields[field] || {}
        let dv = fd.default
        if (dv === undefined) {
          if (fd.type === 'string') dv = ''
          else if (fd.type === 'number') dv = 0
          else if (fd.type === 'boolean') dv = false
          else if (fd.type === 'array') dv = []
          else dv = null
        }
        if (typeof dv === 'function') dv = dv()
        if (dv === '<fn>') dv = null
        graph.set(nodeName(field), dv)
      }
    },

    snapshot() {
      const snap = {}
      for (const field of fieldNames) snap[field] = graph.getNode(nodeName(field))
      return snap
    },

    restore(snap) {
      for (const [field, value] of Object.entries(snap)) {
        if (fieldNames.includes(field)) graph.set(nodeName(field), value)
      }
    },

    form(formEl, formOpts = {}) {
      return bindForm(entitySchema, graph, formEl, { fieldMap, entityName, externalKey, nodeName, ...formOpts })
    },

    connect(source, connOpts = {}) {
      return bindConnect(this, source, connOpts)
    },

    describe() {
      const edges = []
      for (const field of fieldNames) {
        const nn = nodeName(field)
        edges.push({ type: 'read', from: nn, to: 'consumer' })
        edges.push({ type: 'write', from: 'consumer', to: nn })
      }
      return {
        kind: 'uploop.binding',
        entity: entityName,
        fields: fieldNames,
        edges,
        ports: { read: fieldNames.map(f => nodeName(f)), write: fieldNames.map(f => nodeName(f)) }
      }
    }
  }

  return binding
}

// ── bindForm() ─────────────────────────────────────────────

function bindForm(entitySchema, graph, formEl, opts = {}) {
  const { fieldMap = {}, entityName = 'Entity', externalKey, nodeName } = opts
  const desc = typeof entitySchema.describe === 'function' ? entitySchema.describe() : { fields: {} }
  const fieldNames = Object.keys(desc.fields || {})
  const unsubs = []
  const wired = []

  for (const field of fieldNames) {
    const fd = desc.fields[field] || {}
    if (fd.computed) continue

    const ek = typeof externalKey === 'function' ? externalKey(field) : field
    const input = formEl.querySelector(`[name="${ek}"]`)
    if (!input) continue

    const node = typeof nodeName === 'function' ? nodeName(field) : (entityName + '.' + field)
    const fieldSchema = entitySchema._shape?.[field]
    wired.push({ field, node, input, externalKey: ek })

    // READ EDGE
    if (typeof graph.onDataChange === 'function') {
      unsubs.push(graph.onDataChange(node, (newVal) => {
        if (document.activeElement !== input) setInputValue(input, newVal)
      }))
      const initVal = graph.getNode(node)
      if (initVal !== undefined && initVal !== null) setInputValue(input, initVal)
    }

    // WRITE EDGE
    const handler = () => {
      const value = getInputValue(input)
      const current = {}
      for (const f of fieldNames) current[f] = graph.getNode(typeof nodeName === 'function' ? nodeName(f) : (entityName + '.' + f))
      current[field] = value

      if (typeof entitySchema.validate === 'function') {
        const result = entitySchema.validate(current)
        if (!result.ok && result.errors) {
          const fieldErrors = result.errors.filter(e => e.path === field || e.path.startsWith(field + '.'))
          if (fieldErrors.length > 0 && input.setCustomValidity) {
            input.setCustomValidity(fieldErrors[0].message)
            input.reportValidity?.()
            return
          }
        }
        if (input.setCustomValidity) input.setCustomValidity('')
      }
      graph.set(node, value)
    }

    input.addEventListener('input', handler)
    input.addEventListener('change', handler)
    unsubs.push(() => { input.removeEventListener('input', handler); input.removeEventListener('change', handler) })
  }

  return { fields: wired, dispose() { unsubs.forEach(u => typeof u === 'function' && u()) } }
}

// ── bindConnect() ──────────────────────────────────────────

function bindConnect(binding, source, opts = {}) {
  const { debounce: debounceMs = 0, retry = 0 } = opts
  let _timer = null, _pollTimer = null

  return {
    async load(id) {
      if (!source.fetch) throw new Error('No fetch source configured')
      let attempts = 0
      while (attempts <= retry) {
        try { const data = await source.fetch(id); binding.populate(data); return data }
        catch (e) { attempts++; if (attempts > retry) throw e; await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 100)) }
      }
    },
    async save() {
      const data = binding.project()
      if (source.update) await source.update(data)
      else if (source.save) await source.save(data)
      return { ok: true, errors: [] }
    },
    autoSave() {
      if (debounceMs > 0) binding.subscribe(() => { clearTimeout(_timer); _timer = setTimeout(() => this.save(), debounceMs) })
      else binding.subscribe(() => this.save())
    },
    poll(ms) { _pollTimer = setInterval(() => this.save(), ms); return () => clearInterval(_pollTimer) },
    dispose() { clearTimeout(_timer); clearInterval(_pollTimer) }
  }
}

// ── DOM Helpers ────────────────────────────────────────────

function getInputValue(input) {
  const t = input.type || 'text'
  if (t === 'checkbox') return input.checked
  if (t === 'number' || t === 'range') return input.valueAsNumber
  return input.value
}

function setInputValue(input, value) {
  const t = input.type || 'text'
  if (t === 'checkbox') input.checked = !!value
  else if (t === 'number' || t === 'range') input.value = value != null ? String(value) : ''
  else input.value = value != null ? String(value) : ''
}
