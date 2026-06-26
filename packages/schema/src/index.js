/**
 * @uploop/schema — Public API
 *
 * The data shape layer for Uploop HyperGraph.
 * JavaScript-functional. AI-readable. Runtime-dynamic.
 *
 * @module @uploop/schema
 */

// Core
export {
  schema,
  ok,
  fail,
  failAt,
  mergeResults,
  ValidationError,
  wrapSchema
} from './core.js'

// Primitives
export {
  string,
  number,
  boolean,
  date,
  literal,
  enumeration
} from './primitives.js'

// Structural
export {
  object,
  array,
  tuple,
  record
} from './structural.js'

// Modifiers
export {
  optional,
  nullable,
  withDefault,
  transform,
  pipe
} from './modifiers.js'

// Composition
export {
  extend,
  merge,
  pick,
  omit,
  partial,
  required,
  lazy
} from './compose.js'

// Relational (Phase 2)
export {
  entity,
  ref,
  computed,
  registerEntity,
  getEntity,
  listEntities,
  clearRegistry
} from './relational.js'

// HyperGraph Integration (Phase 2)
export {
  toGraph,
  fromSchema
} from './hypergraph.js'

// Data Binding (Phase 2.5)
export {
  bind
} from './bind.js'

// Entity Component (Phase 2.5)
export {
  entityComponent,
  entityFields
} from './component.js'

// Intent Schema (Phase 3)
export {
  intent,
  resolveIntent,
  suggestIntent,
  intentToken
} from './intent.js'

// Inference & Export (Phase 4)
export {
  toJSONSchema,
  toTypeScript,
  toGraphQL,
  toFormSchema
} from './infer.js'

// Utilities (Phase 4)
export {
  isSchema,
  isEntity,
  isIntent,
  diff,
  coerceValue,
  coerceEntity,
  fromJSON
} from './utils.js'

// Wire Protocol (Phase 5)
export {
  buildManifest,
  hydrateManifest,
  checkCompatibility,
  manifestDiff,
  manifestEndpoint
} from './wire.js'
