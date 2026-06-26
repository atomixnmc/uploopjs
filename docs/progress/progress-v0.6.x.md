# v0.6.x — @uploop/schema Beta

> **Status:** In Progress 🚧  
> **Date:** 2026-06-26  
> **Target:** Data shape layer for HyperGraph. AI-first. JavaScript-functional.

## Overview

`@uploop/schema` connects data shapes to the HyperGraph runtime. Entities become graph nodes. Relations become edges. Bindings auto-wire DOM forms. AI reads `describe()` manifests.

## Phase 1 — Core Schema Engine ✅

- [x] Design doc (`design-schema.md`)
- [x] `src/core.js` — `schema()`, `ok()`, `fail()`, `ValidationError`
- [x] `src/primitives.js` — `string()`, `number()`, `boolean()`, `date()`, `literal()`, `enumeration()`
- [x] `src/structural.js` — `object()`, `array()`, `tuple()`, `record()`
- [x] `src/modifiers.js` — `optional()`, `nullable()`, `withDefault()`, `transform()`
- [x] `src/compose.js` — `extend()`, `merge()`, `pick()`, `omit()`, `partial()`, `lazy()`
- [x] `src/index.js` — public API
- [x] `test/primitives.test.js` — 64 tests

## Phase 2 — Entities & Relations ✅

- [x] `src/relational.js` — `entity()`, `ref()`, `computed()`
- [x] `src/hypergraph.js` — `toGraph()`, `fromSchema()`
- [x] `test/relational.test.js` — 27 tests

## Phase 2.5 — Data Binding ✅

- [x] Design doc (`design-bind.md`) — ports & channels, two one-way edges, convention over configuration
- [x] `src/bind.js` — `bind()`, `bind.form()`, field aliases, transforms, virtuals, connect()
- [x] `test/bind.test.js` — 18 tests (populate, project, patch, subscribe, onChange, reset, snapshot/restore, form wiring, aliases, transforms, virtuals, checkbox, dispose)

## Full Suite

**173 tests (109 schema + 64 core) — zero regressions**

## Phase 3 — Intent Schema & AI Communication

- [ ] `src/intent.js` — `intent()`, `resolveIntent()`, `suggestIntent()`, `intentToken()`
- [ ] `src/wire.js` — client/server schema contract, version negotiation

## Phase 4 — Integration & Export

- [ ] `src/infer.js` — `toJSONSchema()`, `toTypeScript()`
- [ ] `@uploop/store` — `store.fromEntity()`
- [ ] `@uploop/sst` — `createService(entity)`

## Phase 5 — Polish

- [ ] `src/utils.js` — `isSchema()`, `isEntity()`, `diff()`, `coerce()`, `fromJSON()`
- [ ] `lazy()`, `union()`, `intersection()`
- [ ] Async validation
- [ ] `entity.fromIntent()`
- [ ] Docs & README

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `schema()` not `s()` | AI-disambiguity |
| `withDefault()` not `default()` | JS keyword collision |
| Closure-based, not class-based | No prototypes. Functional. |
| `describe()` returns plain object | AI-readable, JSON-safe |
| `entity()` wraps `object()` | Single truth for shape + graph |
| Binding = two one-way edges | Traceable. Debggable. No magic. |
| Alias maps external keys → entity fields | Graph nodes stay `Entity.field` |
