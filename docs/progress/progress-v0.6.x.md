# v0.6.x — @uploop/schema ✅

> **Status:** Complete ✅  
> **Date:** 2026-06-26  
> **Tests:** 164 (schema) + 64 (core) = 228 total — zero regressions

## Overview

`@uploop/schema` is the data shape layer for HyperGraph. Entity-driven schema engine with AI-readable manifests, declarative bindings, intent-based AI communication, and client/server wire protocol.

## Phase 1 — Core Schema Engine ✅

- [x] `src/core.js` — `schema()`, `ok()`, `fail()`, `failAt()`, `mergeResults()`, `ValidationError`, `cloneSchema()`, `wrapSchema()`
- [x] `src/primitives.js` — `string()`, `number()`, `boolean()`, `date()`, `literal()`, `enumeration()` with constraint metadata (min/max/format/integer)
- [x] `src/structural.js` — `object()`, `array()`, `tuple()`, `record()` with chainable modifiers
- [x] `src/modifiers.js` — `optional()`, `nullable()`, `withDefault()`, `transform()`, `pipe()`
- [x] `src/compose.js` — `extend()`, `merge()`, `pick()`, `omit()`, `partial()`, `required()`, `lazy()`
- [x] `test/primitives.test.js` — 64 tests

## Phase 2 — Entities & Relations ✅

- [x] `src/relational.js` — `entity()`, `ref()`, `computed()`, `registerEntity()`, `getEntity()`, `listEntities()`, `entity.fromIntent()`
- [x] `src/hypergraph.js` — `toGraph()` → `createGraph()` config, `fromSchema()` → `createLoop()` config
- [x] `test/relational.test.js` — 27 tests (entity, ref, computed, toGraph, fromSchema, AI-readability)

## Phase 2.5 — Data Binding & Components ✅

- [x] Design doc: `docs/design/design-bind.md`
- [x] `src/bind.js` — `bind()` (project, populate, patch, subscribe, onChange, reset, snapshot, restore, form, connect, describe)
- [x] `src/component.js` — `entityComponent()` (form/display/table modes), `entityFields()`
- [x] `test/bind.test.js` — 18 tests (DOM form wiring, aliases, transforms, virtuals, checkbox)
- [x] `test/component.test.js` — 15 tests (all modes, custom views, field metadata)

## Phase 3 — Intent Schema & AI Communication ✅

- [x] `src/intent.js` — `intent()`, `resolveIntent()`, `suggestIntent()`, `intentToken()`, `intentToken.parse()`
- [x] Token shorthand: 12 types (str/num/bool/int/date/email/url/uuid + arrays + optionals + enums)
- [x] `test/intent.test.js` — 24 tests

## Phase 4 — Integration & Export ✅

- [x] `src/infer.js` — `toJSONSchema()`, `toTypeScript()`, `toGraphQL()`, `toFormSchema()`
- [x] `src/utils.js` — `isSchema()`, `isEntity()`, `isIntent()`, `diff()`, `coerceValue()`, `coerceEntity()`, `fromJSON()`
- [x] `packages/store/src/store-entity.js` — `storeFromEntity()` (auto state + handlers + validation)
- [x] `test/phase4.test.js` — 16 tests

## Phase 5 — Wire Protocol & Polish ✅

- [x] `src/wire.js` — `buildManifest()`, `hydrateManifest()`, `checkCompatibility()`, `manifestDiff()`, `manifestEndpoint()`
- [x] `entity.fromIntent()` — materialize entity from AI intent at runtime
- [x] `examples/schema/main.js` — Demo with form, table, describe viewer
- [x] `docs/design/design-schema.md`
- [x] `docs/design/design-bind.md`

## Package Files

```
packages/schema/src/
├── index.js        # 40+ exports
├── core.js         # Atomic schema factory
├── primitives.js   # Type constraints with metadata
├── structural.js   # Object, array, tuple, record
├── modifiers.js    # Optional, nullable, withDefault, transform, pipe
├── compose.js      # Extend, merge, pick, omit, partial, lazy
├── relational.js   # Entity, ref, computed, registry
├── hypergraph.js   # toGraph, fromSchema
├── bind.js         # Declarative data binding
├── component.js    # entityComponent, entityFields
├── intent.js       # AI intent schema
├── infer.js        # JSON Schema, TypeScript, GraphQL exports
├── utils.js        # Diff, coerce, fromJSON, type guards
└── wire.js         # Manifest protocol, version negotiation
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `schema()` not `s()` | AI-disambiguity |
| `withDefault()` not `default()` | JS keyword collision |
| Closure-based, not class-based | No prototypes, JSON-serializable |
| `describe()` uses `this._meta` not closure variable | Modifier metadata persists across clones |
| Binding = two one-way edges | Traceable, debuggable, no magic `v-model` |
| Alias maps external keys → entity fields | Graph nodes stay `Entity.field` |
| `entity()` wraps `object()` + HyperGraph registration | Single source of truth |
| `intent()` shorthand table | 12 token types, 93% smaller than full entity |
