# Uploop Examples

This document explains each example, the Uploop techniques it demonstrates, and the architectural patterns used.

---

## 1. Counter (`examples/counter/`)

**Files:** `main.js`

**What it shows:** Two counters — a basic single counter and a multi-counter with two independent values and a derived sum.

| Technique | How |
|-----------|-----|
| **Basic component** | `component('Counter', { state, update, view })` |
| **One-way data flow** | Click → `send('inc')` → update handler → state patch → re-render |
| **State-driven view** | `view(state, { send })` renders from state snapshot |
| **Event binding** | `@click=${() => send('inc')}` — CSP-safe via `data-up-event` |
| **Derived value** | `state.count1 + state.count2` computed in view (not stored) |

**HyperGraph:** 5 nodes, 7 edges

---

## 2. Multi Counter (`examples/counter/` — exported as `MultiCounter`)

**Files:** `counter/main.js`

**What it shows:** Two counters incremented by different amounts + derived sum. Mirrors the original v0.0.1 `counter.js` example.

| Technique | How |
|-----------|-----|
| **Multiple state keys** | `state.count1`, `state.count2` updated independently |
| **View computation** | Sum computed inline: `${state.count1 + state.count2}` |
| **Conditional styles** | Button colors depend on state |

---

## 3. Todos (`examples/todo/`)

**Files:** `main.js`

**What it shows:** Full CRUD todo list with persistent input, filtering, and completion toggling.

| Technique | How |
|-----------|-----|
| **Input binding** | `.value=${state.text}` — property binding syncs state → DOM |
| **Input events** | `@input=${['input', e => e.target.value]}` — event with transform |
| **Focus preservation** | Framework saves/restores cursor position across re-renders |
| **Array state** | `todos: []` — full CRUD via immutable updates |
| **List rendering** | `filtered.map(todo => html\`<li>\${todo.text}</li>\`)` |
| **Filtered view** | `state.filter` controls which items are rendered |
| **Conditional rendering** | `state.todos.some(t => t.done) ? html\`...\` : ''` |
| **Event ↔ Data store** | See inline comment: every interaction flows through `send()` → handler → state → view |

**Data flow:** `@input` → `send('input', value)` → `state.text = value` → re-render → `.value` binding updates DOM

**HyperGraph:** 8 nodes, 13 edges

---

## 4. Form (`examples/form/`)

**Files:** `main.js`

**What it shows:** Contact form with two-way binding via `.value` and `@input`, plus submit handling.

| Technique | How |
|-----------|-----|
| **Two-way binding** | `.value=${state.formData.name}` + `@input=${['setName', e => e.target.value]}` |
| **Nested state** | `state.formData.name` — updates via spread: `{ ...s.formData, name }` |
| **Form submit** | `form @submit=${(e) => { e.preventDefault(); send('submit') }}` |
| **Conditional display** | Submitted data shown/hidden based on `state.submitted` |

**HyperGraph:** 6 nodes, 9 edges

---

## 5. Grid (`examples/grid/`)

**Files:** `main.js`

**What it shows:** Searchable 3×3 grid with mouse hover effects and refresh.

| Technique | How |
|-----------|-----|
| **Dynamic grid** | CSS Grid via `grid-template-columns: repeat(3, 1fr)` |
| **Live filtering** | `items.filter(i => i.content.includes(state.search))` |
| **Mouse events** | `@mouseenter=${e => e.currentTarget.style...}` — direct DOM manipulation |
| **Random data** | `Math.random().toString(36).slice(2, 8)` — unique content per render |
| **Input with transform** | `@input=${['search', e => e.target.value]}` |

**HyperGraph:** 4 nodes, 5 edges

---

## 6. Blog (`examples/blog/`)

**Files:** `main.js`

**What it shows:** Blog with list/detail/edit views, search filtering, and CSS utility classes.

| Technique | How |
|-----------|-----|
| **CSS utilities** | `@uploop/css` injects classes: `p-2`, `m-0`, `mb-1`, `w-100`, `flex-row` |
| **Router integration** | `createRouter()` with parametric routes: `blog/:id`, `blog/:id/edit` |
| **Nested views** | `ListView`, `DetailView`, `EditView` — functions returning `html\`...\`` |
| **Conditional routing** | Component's `view()` inspects `state.path` and delegates to the correct view |
| **Edit form** | `.value=${title}` + `@input=${['setEditTitle', e => e.target.value]}` |
| **Save/Cancel** | Two-way binding + state reset on save |
| **Search** | Filters `POSTS` array by title/excerpt match |
| **Hover cards** | `@mouseenter` + `@mouseleave` for shadow effect |

**Router routes:**
| Path | View |
|------|------|
| `blog` | ListView |
| `blog/:id` | DetailView |
| `blog/:id/edit` | EditView |

**HyperGraph:** 7 nodes, 11 edges

---

## 7. Paint (`examples/paint/`)

**Files:** `main.js`

**What it shows:** Canvas drawing app with color/size/tool controls. Demonstrates persistent resources and canvas outside the re-render cycle.

| Technique | How |
|-----------|-----|
| **Persistent resource** | Canvas registered via `ctx.registerResource()` — drawings survive re-renders |
| **Out-of-DOM rendering** | Canvas created in mount hook, NOT in view template |
| **Canvas API** | `getContext('2d')`, `lineTo`, `stroke`, `toDataURL()` |
| **Touch support** | `touchstart`, `touchmove`, `touchend` with `{ passive: false }` |
| **Real-time state** | `Paint.loop.get()` called in `mousemove` handler for current color/size/tool |
| **Resource lifecycle** | `save()` → `canvas.toDataURL()`, `restore()` → `ctx.drawImage(img, 0, 0)` |
| **Eraser** | Draws with `white` stroke color (no separate clear) |

**Data flow:**
```
Button click → send('setTool') → state change → innerHTML triggers
  → saveResources() captures canvas.toDataURL()
  → innerHTML replaces controls (canvas container preserved)
  → restoreResources() draws the saved image back onto canvas
```

**HyperGraph:** 5 nodes, 7 edges

---

## 8. Tetris (`examples/tetris/`)

**Files:** `main.js`

**What it shows:** Classic Tetris game with keyboard controls, game loop via `requestAnimationFrame`, and score tracking.

| Technique | How |
|-----------|-----|
| **Game loop** | `requestAnimationFrame(gameLoop)` in mount hook |
| **Frame-based ticks** | `send('tick')` called from rAF at intervals based on level |
| **Keyboard input** | `window.addEventListener('keydown', onKey)` in mount hook |
| **Grid rendering** | `display.map(row => html\`<div>\${row.map(cell => ...)}\</div>\`)` |
| **Collision detection** | `collides(board, piece, px, py)` checks board boundaries |
| **Line clearing** | `filter + unshift` — remove full rows, add empty rows at top |
| **Level scaling** | Drop speed = `Math.max(100, 500 - level * 50)` |
| **7-bag randomizer** | `SHAPES[Math.floor(Math.random() * 7)]` |
| **Piece rotation** | Matrix transpose + reverse for 90° rotation |
| **Hard drop** | `py++` while no collision |

**Controls:** ← → Move, ↑ Rotate, ↓ Soft drop, Space Hard drop, P Pause

**HyperGraph:** 8 nodes, 13 edges

---

## 9. Lucky Wheel (`examples/luckywheel/`)

**Files:** `main.js`

**What it shows:** Prize wheel with SVG rendering and smooth CSS ease-out animation. Animation updates SVG `transform` directly — no re-renders during spin.

| Technique | How |
|-----------|-----|
| **SVG rendering** | Segments rendered as SVG `<path>` arcs in view template |
| **Direct DOM animation** | `svg.style.transform = rotate(Xdeg)` — bypasses innerHTML entirely |
| **Ease-out cubic** | `1 - Math.pow(1 - progress, 3)` — smooth deceleration |
| **Avoids stack overflow** | No `send()` override; animation state is local, not in the loop |
| **One-time state commit** | `send('done')` called once when animation completes |
| **Resource-free animation** | rAF loop reads `performance.now()` — no frame scheduler needed |
| **Prize computation** | `Math.floor(normalizedAngle / segmentAngle)` → which segment is at pointer |

**Key architectural decision:** The 3-second spin animation runs entirely outside the Uploop state machine. No `send('tick')` calls. Only the final result is committed to state via `send('done')`. This prevents 60fps innerHTML thrashing.

**HyperGraph:** 5 nodes, 7 edges

---

## 10. Fishes (`examples/fishes/`)

**Files:** `main.js`

**What it shows:** Interactive fishing game — click fish to catch them, score points, trigger confetti at 10. Demonstrates Uploop's **component composition** — the game is built from 4 smaller components that form a graph, NOT a single monolithic component.

### Component Graph

```
FishesGame (root) — owns canvas, rAF loop, DOM controls
  ├── .create(SwarmLogic) → swarm  — fish entities (create, update, hit-test)
  ├── .create(BasketLogic) → basket — score tracking (increment, reset)
  └── .create(ConfettiLogic) → conf — confetti particles (trigger, tick)
```

Each sub-component:
- Is a full `component()` — has `state` + `update` handlers
- Has **NO `view` function** — no DOM output, pure logic
- Is instantiated via `.create()` — gets its own independent loop
- Parent reads child state each frame via `child.loop.get()`
- Parent sends events to children via `child.loop.send('event', ...)`

### Sub-component Definitions

| Component | State | Updates | Purpose |
|-----------|-------|---------|---------|
| `SwarmLogic` | `fishes[]`, `running`, `sheet` | `start`, `stop`, `tick`, `remove`, `setCount` | Fish entity manager |
| `BasketLogic` | `score` | `increment`, `reset` | Score tracker |
| `ConfettiLogic` | `particles[]`, `active` | `start`, `tick` | Particle system |
| `FishesGame` | `running`, `score`, `fishCount`, `showWinner` | `start`, `stop`, `setCount`, `catchFish` | Root orchestrator |

### Communication Pattern

```
UI button click → FishesGame.send('start')
  → root sets running: true
  → rAF loop detects: swarm.loop.send('start', cw, ch)
  → rAF loop detects: basket.loop.send('reset')
  → rAF loop detects: confetti.loop.send('start', cw, ch)

Canvas click → hitTestFish on swarm state
  → swarm.loop.send('remove', fishId)         ← marks fish dead
  → basket.loop.send('increment')             ← score +1
  → FishesGame.loop.send('catchFish')         ← checks if won
```

### Key Architectural Insights

1. **Components are not just WebComponents.** `SwarmLogic`, `BasketLogic`, and `ConfettiLogic` are fully valid Uploop components with zero DOM output. They only manage state and respond to events.

2. **Component composition uses `.create()`.** The root calls `SwarmLogic.create()` to get an independent instance. Each instance has its own `loop`, state, and event handlers.

3. **Parent reads children's state.** The root's rAF loop reads `swarm.loop.get()`, `basket.loop.get()`, `confetti.loop.get()` every frame — no need for a global store.

4. **Events flow between components.** When a fish is clicked: `swarm.remove(id)` + `basket.increment()` + `root.catchFish()`. Three components react to one user action.

5. **No re-renders during gameplay.** The rAF loop at 60fps never triggers `innerHTML`. Only button clicks and fish catches trigger state changes → re-renders.

### Techniques Used

| Technique | How |
|-----------|-----|
| **Component composition** | Root creates sub-components via `.create()` |
| **Logic components** | Components without `view` — pure state + updates |
| **Parent→child communication** | Root reads `child.loop.get()`, sends `child.loop.send()` |
| **Canvas rendering** | Fish drawn on `<canvas>` via `drawImage()` from pre-rendered sprites |
| **Sprite generation** | `createSpriteSheet()` — 40 sprites (10 colors × 4 types) on offscreen canvases |
| **Entity system** | `SwarmLogic` manages fish array with position, velocity, alive flag |
| **Hit-testing** | `hitTestFish(f, cx, cy)` — ellipse intersection test |
| **Game loop** | `requestAnimationFrame(drawScene)` in mount hook |
| **Fly-to-basket animation** | Caught fish animates via ease-out cubic, shrinking + fading |
| **Basket rendering** | `drawBasket()` — wooden weave with `roundRect`, score badge |
| **Confetti particles** | 80 particles with gravity, rotation — managed by `ConfettiLogic` |
| **Winner dialog** | DOM overlay via `FishesGame.view` — `state.showWinner` |
| **Hover cursor** | Canvas `mousemove` → hit-test → cursor toggle |
| **Persistent resource** | `registerResource` re-attaches canvas element after innerHTML |
| **Play Again** | Winner dialog button calls `send('start')` — resets all children |

**HyperGraph:** 6 nodes, 9 edges (FishesGame root)

---

## Summary: Techniques by Example

| Technique | Counter | Todos | Form | Grid | Blog | Paint | Tetris | Wheel | Fishes |
|-----------|---------|-------|------|------|------|-------|--------|-------|--------|
| component() | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| @click binding | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| @input binding | | ✅ | ✅ | ✅ | ✅ | | | | |
| .value prop binding | | ✅ | ✅ | ✅ | ✅ | ✅ | | | |
| ?checked bool binding | | ✅ | | | | | | | |
| Focus preservation | | ✅ | | | | | | | |
| CSS utilities | | | | | ✅ | | | | |
| Router | | | | | ✅ | | | | |
| Persistent resources | | | | | | ✅ | | | |
| Mount hook lifecycle | | | | | | ✅ | ✅ | ✅ | ✅ |
| requestAnimationFrame | | | | | | | ✅ | ✅ | ✅ |
| Canvas rendering | | | | | | ✅ | | | ✅ |
| SVG rendering | | | | | | | | ✅ | |
| Keyboard events | | | | | | | ✅ | | |
| Touch events | | | | | | ✅ | | | |
| Direct DOM animation | | | | | | | | ✅ | |
| Sprite sheets | | | | | | | | | ✅ |
