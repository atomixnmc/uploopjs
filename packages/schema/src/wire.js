/**
 * Schema Wire Protocol — client/server manifest exchange & version negotiation.
 *
 * Enables:
 *   - Server sends schema manifest as JSON
 *   - Client hydrates executable schemas via fromJSON()
 *   - Version negotiation: diff(old, new) detects breaking changes
 *   - Client requests compatible version
 *
 * @module @uploop/schema/wire
 */
import { diff as schemaDiff, fromJSON } from './utils.js'
import { listEntities, getEntity } from './relational.js'

// ── Schema Manifest ────────────────────────────────────────

/**
 * Build a schema manifest from registered entities.
 * This is what the server sends to the client.
 *
 * @param {Object} [opts]
 * @param {number} [opts.version=1] — manifest version
 * @param {string[]} [opts.entities] — specific entity names (default: all registered)
 * @returns {Object} wire-ready manifest
 */
export function buildManifest(opts = {}) {
  const version = opts.version || 1
  const entities = opts.entities
    ? opts.entities.map(n => getEntity(n)).filter(Boolean)
    : listEntities()

  const entityDefs = {}
  for (const ent of entities) {
    const desc = typeof ent.describe === 'function' ? ent.describe() : ent
    entityDefs[desc.entity] = desc
  }

  return {
    kind: 'uploop.manifest',
    version,
    timestamp: Date.now(),
    entities: entityDefs,
    entityNames: Object.keys(entityDefs)
  }
}

/**
 * Hydrate client-side schemas from a server manifest.
 *
 * @param {Object} manifest — from buildManifest() or server response
 * @returns {Object} { entities: { [name]: schema }, version }
 */
export function hydrateManifest(manifest) {
  const entities = {}
  for (const [name, desc] of Object.entries(manifest.entities || {})) {
    entities[name] = fromJSON(desc)
  }
  return { entities, version: manifest.version }
}

// ── Version Negotiation ────────────────────────────────────

/**
 * Check if a schema version change is breaking.
 * Breaking = required field removed, type changed, required field added.
 *
 * @param {Object} oldManifest — previous manifest
 * @param {Object} newManifest — new manifest
 * @returns {Object} { compatible, changes, warnings }
 */
export function checkCompatibility(oldManifest, newManifest) {
  const changes = []
  const warnings = []
  let breaking = false

  const oldEntities = oldManifest.entities || {}
  const newEntities = newManifest.entities || {}

  for (const [name, newEnt] of Object.entries(newEntities)) {
    const oldEnt = oldEntities[name]
    if (!oldEnt) {
      changes.push({ entity: name, type: 'added' })
      continue
    }

    const d = schemaDiff(
      { describe: () => oldEnt },
      { describe: () => newEnt }
    )

    // Removed required fields = breaking
    for (const r of d.removed) {
      if (r.wasRequired) {
        breaking = true
        warnings.push({
          entity: name,
          field: r.path,
          issue: `required field "${r.path}" removed`,
          breaking: true
        })
      }
      changes.push({ entity: name, field: r.path, type: 'removed' })
    }

    // Type changes = breaking
    for (const c of d.changed) {
      if (c.breaking) {
        breaking = true
        warnings.push({
          entity: name,
          field: c.path,
          issue: `type changed from ${c.from} to ${c.to}`,
          breaking: true
        })
      }
      changes.push({ entity: name, field: c.path, type: 'changed', from: c.from, to: c.to })
    }

    // Added required fields = breaking (client won't have them)
    for (const a of d.added) {
      if (!a.optional) {
        breaking = true
        warnings.push({
          entity: name,
          field: a.path,
          issue: `required field "${a.path}" added`,
          breaking: true
        })
      }
      changes.push({ entity: name, field: a.path, type: 'added', required: !a.optional })
    }
  }

  // Removed entities
  for (const name of Object.keys(oldEntities)) {
    if (!newEntities[name]) {
      changes.push({ entity: name, type: 'removed' })
      breaking = true
      warnings.push({ entity: name, issue: 'entity removed', breaking: true })
    }
  }

  return {
    compatible: !breaking,
    breaking,
    changes,
    warnings,
    oldVersion: oldManifest.version,
    newVersion: newManifest.version
  }
}

/**
 * Generate a diff summary between two manifests (for server → client upgrade hint).
 *
 * @param {Object} oldManifest
 * @param {Object} newManifest
 * @returns {Object} { breaking, diff: { added, removed, changed } }
 */
export function manifestDiff(oldManifest, newManifest) {
  const compat = checkCompatibility(oldManifest, newManifest)
  return {
    breaking: compat.breaking,
    compatible: compat.compatible,
    oldVersion: compat.oldVersion,
    newVersion: compat.newVersion,
    changes: compat.changes,
    warnings: compat.warnings
  }
}

// ── HTTP Helpers ───────────────────────────────────────────

/**
 * Express-style middleware to serve schema manifest.
 *
 * @param {Object} [opts]
 * @returns {Function} (req, res) middleware
 */
export function manifestEndpoint(opts = {}) {
  const version = opts.version || 1
  let currentManifest = null

  return function (req, res) {
    if (!currentManifest || opts.noCache) {
      currentManifest = buildManifest({ version, entities: opts.entities })
    }

    const clientVersion = parseInt(req.headers?.['x-schema-version'] || '0', 10)

    if (clientVersion >= version && !opts.forceResend) {
      res.statusCode = 304
      res.end()
      return
    }

    const body = {
      ...currentManifest,
      clientVersion,
      upgrade: clientVersion > 0 && clientVersion < version
    }

    if (opts.previousManifest && clientVersion > 0) {
      body.diff = manifestDiff(opts.previousManifest, currentManifest)
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('X-Schema-Version', String(version))
    res.end(JSON.stringify(body))
  }
}
