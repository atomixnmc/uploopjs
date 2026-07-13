# AI Guideline — Uploop

Rules for AI agents and human contributors. Read before writing any code.

---

## 0. Complete SDLC

Every change follows this cycle. No shortcuts.

### Plan
- Check `docs/PLAN.md` — which version/phase is active?
- Check `docs/TODO.md` — what's the highest-priority incomplete item?
- If the task changes scope, update PLAN.md or TODO.md first
- Major designs go in `docs/plan/Plan_uploop-<topic>-v<version>.md`

### Design
- New package? Follow existing package conventions (`packages/<name>/src/index.js` + `package.json`)
- New data structure? Add `describe()` for AI-readability + serialization
- HyperGraph integration? Add `describe()` manifest, `toGraph()` if entity
- Breaking API change? Bump version in the package's `package.json`

### Implement
- Follow code style (§6)
- JavaScript ESM — no CommonJS `require()`, no IIFEs, no global state
- Functional style — closures over classes, pure functions over methods with side effects
- Every schema exports `describe()` returning a JSON-safe plain object
- Add JSDoc types for public API

### Test
- **Unit**: every new module, schema, or utility → `packages/<name>/test/`
- Tests run with vitest: `npx vitest run packages/<name>/test/`
- All tests must pass before push — no regressions
- Full suite: `npx vitest run packages/core/test packages/schema/test packages/flows/test`
- Test file naming: `<feature>.test.js`

### Document
- Update the doc that matches your change (see §7)
- Update `docs/progress/progress-v<major>.<minor>.x.md` with completed/in-progress items
- Update `docs/TODO.md` status when a feature moves to Done
- Update `docs/PLAN.md` when a phase completes

### Review
- Self-review: re-read the diff before committing
- All tests pass (`npx vitest run`)
- One approval required before merge

### Commit
- Use Conventional Commits format (see §1)
- Commit message subject ≤50 chars, imperative mood
- Body only when *why* isn't obvious. Wrap at 72 chars.

---

## 1. Git Conventions

### Commits

- **Format**: [Conventional Commits](https://www.conventionalcommits.org/)
  ```
  type(scope): short description
  ```
- **Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`
- **Scope**: package or module name (e.g., `schema`, `core`, `flows`, `html`, `store`)
- **Subject**: ≤50 chars, imperative mood, no period at end
- **Body**: only when *why* isn't obvious. Wrap at 72 chars.

Examples:
```
feat(schema): add entity() with ref() relations and toGraph()
fix(core): describe() uses this._meta instead of closure variable
docs: add plan for v0.9 store, gql, and storage
test(schema): add 64 tests for primitives, structural, compose
```

### Branches

```
<type>/<short-description>
```

Examples: `feat/schema-entity-binding`, `fix/graph-closure-bug`

---

## 2. Code Review Requirements

- [ ] Branch is up-to-date with `main`
- [ ] All tests pass: `npx vitest run`
- [ ] New code follows functional/closure patterns (no classes, no prototypes)
- [ ] New schemas export `describe()` returning JSON-safe object
- [ ] New code has test coverage in `packages/<name>/test/`
- [ ] Relevant docs updated (see §7)
- [ ] TODO.md and progress file updated if feature status changed
- [ ] Commit messages follow Conventional Commits

---

## 3. Testing

### Test tiers

| Tier | Location | Requires | When to add |
|------|----------|----------|-------------|
| Unit | `packages/<name>/test/` | Nothing | Every new module/function |
| Integration | `packages/<name>/test/` | jsdom (for DOM tests) | Cross-package workflows |
| E2E | `e2e/` (Playwright) | Browser | Full UI flows |

### Minimum bar

- All tests must pass before committing
- New schemas: add validation round-trip test (validate good + bad input)
- New entities: add describe() test (verify JSON-safe, no functions leaked)
- New HyperGraph features: add smoke test (create graph, send event, verify state)
- Bug fixes: add regression test that fails before fix
- New feature: at least one happy-path test + one error-path test

### Running tests

```bash
# All tests
npx vitest run

# Single package
npx vitest run packages/schema/test/

# Single file
npx vitest run packages/schema/test/primitives.test.js

# With watch mode (during development)
npx vitest
```

---

## 4. Versioning & Progress

### Versioning

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (x.0.0): breaking API changes, architecture overhauls
- **MINOR** (0.x.0): new packages, new major features
- **PATCH** (0.0.x): bug fixes, doc updates, refactors

Current versions are in each package's `package.json`. Bump when a phase completes.

**Sub-package versioning rule:** All `packages/*/package.json` versions MUST stay equal to the root `uploopjs` `package.json` version. When bumping the root, bump every sub-package to match. This simplifies the version scheme — the ecosystem ships as one unit.

### Progress tracking

Files in `docs/progress/`:

| Pattern | Purpose |
|---------|---------|
| `progress-v<major>.<minor>.x.md` | Phase tracking — completed/in-progress items with checkboxes |
| `report-v<major>.<minor>-<topic>.md` | Topic-specific report (e.g., `report-v0.5-planning.md`) |

Update the progress file when completing items. Check off `[x]` for done, leave `[ ]` for pending.

### PLAN.md

`docs/PLAN.md` is the source of truth for what to work on next. Before starting any significant work:

1. Check which version/phase is active
2. Pick the highest-priority incomplete item in that phase
3. Update PLAN.md status when done

### TODO.md

`docs/TODO.md` is the living task list. Each phase has a checklist of concrete tasks.

---

## 5. AI Agent Rules

### Do not assume

- Verify paths, imports, and exports exist before using them
- Read the file before editing it — never guess its contents
- If a function/schema/export isn't documented, search the codebase first (`grep`)
- When uncertain, ask or search — don't fabricate

### Do not waste tokens

- Read only the lines you need (`start_line`/`end_line`)
- Don't re-read files after a successful write (the tool confirms)
- Don't repeat information the user already has
- Make edits minimal and surgical — one focused `edit_file` over a full `write_file` when possible
- Skip preamble for trivial reads; explain only when adding value

### Code changes

- Root-cause fixes, not surface patches
- Don't fix unrelated bugs or reformat code you didn't touch
- Match existing style — closures, not classes. ESM, not CJS. `this._meta`, not closure variables.
- Don't add comments that restate the code
- All public API returns or uses `describe()` for AI-readability

### When blocked

- If a test fails and you didn't cause it, note it and move on
- If you need information not available in the codebase, ask once — don't guess
- If the `edit_file` tool fails to match, read the exact lines and retry with precise context

---

## 6. Code Style

### JavaScript
- ESM only: `import`/`export`, no `require()`, no `module.exports`
- Functional style: closures over classes. Return plain objects with methods
- No prototype manipulation. No `class` unless wrapping a native (like `ValidationError extends Error`)
- JSDoc types for public API parameters and returns
- Single quotes for strings (unless the string contains single quotes)
- Semicolons: none (follow existing codebase style)

### Naming
- `camelCase` for functions, variables, methods
- `PascalCase` for factory functions that create objects (`createGraph`, `createSignal`)
- `snake_case` or `_prefix` for internal/private properties (`_modifiers`, `_meta`, `_validateFn`)
- Schema primitives are lowercase factory functions: `string()`, `number()`, `entity()`

### Package structure
```
packages/<name>/
├── src/
│   ├── index.js          # Public API exports
│   ├── <module>.js       # One concern per file
│   └── ...
├── test/
│   ├── <feature>.test.js
│   └── ...
└── package.json
```

### Schema rules
- Every schema exports `describe()` → `{ kind: 'uploop.schema', ... }` (JSON-safe, no functions)
- Every entity exports `describe()` → `{ kind: 'uploop.entity', fields, relations, edges, meta }`
- Modifiers use `this._modifiers` / `this._meta`, NOT closure variables (they get stale on clone)
- Chainable methods use `this` pattern: `min(n) { const c = makeType(this); c._meta = {...}; return c }`

---

## 7. Documentation Conventions

| Change | Doc to update |
|--------|--------------|
| New package | `docs/design/design-<name>.md` + `README.md` |
| New feature in existing package | `docs/design/design-<name>.md` + `docs/progress/progress-v<X>.x.md` |
| Architecture change | `docs/ARCHITECTURE.md` + `docs/plan/Plan_uploop-<topic>.md` |
| Bug fix | `docs/TODO.md` (remove if tracked) or progress file |
| New convention / rule | This file (`AI_GUIDELINE.md`) |
| New tests | Progress file (count update) |
| v0.x plan | `docs/plan/Plan_uploop-<topic>-v<version>.md` |

### Doc files reference

| File | Purpose |
|------|---------|
| `docs/ARCHITECTURE.md` | Full architecture — graph engine, event pipeline, protocols |
| `docs/HOWTO.md` | Developer guide — syntax, patterns, comparisons |
| `docs/PLAN.md` | Rework plan — phases, tasks, ROI |
| `docs/TODO.md` | Living task list — phases, checkboxes, status |
| `docs/design/design-<module>.md` | Per-module design doc |
| `docs/progress/progress-v<X>.<Y>.x.md` | Version progress tracking (checkboxes) |
| `docs/reports/report-v<X>.<Y>-<topic>.md` | Cross-framework comparison, architecture analysis, benchmarks |
| `docs/plan/Plan_uploop-<topic>-v<version>.md` | Major version design plan |
| `README.md` | Project overview, quick start, package table |

### Doc style

- Headers: `##` for sections, `###` for sub-sections
- Code blocks: triple backticks with `js` or `bash` language tag
- Tables: prefer over long lists for structured data
- Keep docs concise — if a doc grows >200 lines, consider splitting
