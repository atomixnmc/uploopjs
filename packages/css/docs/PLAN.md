# @uploop/css — Implementation Plan

## Status: v0.2.0 ✅

Currently a single-file monolithic port from the archived `uploop.cssUtil.js`.
Needs modularization, design token system, variant engine, and tree-shaking
to become a real Tailwind-alternative utility CSS engine.

---

## v0.2.0 — Completed

| Feature | Status |
|---|---|
| Modularize into 7+ files | ✅ (11 source files) |
| Design tokens + CSS variables | ✅ |
| Variant engine | ✅ |
| On-demand generation (lazy) | ✅ optimizer + dedup inject |
| Re-add missing utilities | ✅ 14 utility groups (was 12) |
| Chain-style API | ✅ Extended with clone/merge/select/apply/inline/when/export |
| Style composition utilities | ✅ compose, extend, pick, omit, clone, styleToInline, deepMerge |
| CSS optimization utilities | ✅ minifyCSS, dedupDeclarations, normalizeUnits, prefixCSS |
| Batch + keyframes + atMedia | ✅ batch(), keyframes(), atMedia() |
| Tests | ✅ 175 tests (11 files) |
| E2e tests | ✅ Full pipeline, theme+inject, dynamic+batch+chain, optimizer DOM, compose+minify |

## Current State

11 source modules, 11 test files, 175 tests all passing.

## Gap Analysis for Future

### Missing Utility Groups (still)
- `text-decoration`, `text-shadow`, `text-overflow`, `word-break`, `word-spacing`
- `line-style`, `list-style-type`, `list-style-position`
- `bg-attachment`, `bg-blend`
- `align-content`, `align-self` (flex only has items/justify)
