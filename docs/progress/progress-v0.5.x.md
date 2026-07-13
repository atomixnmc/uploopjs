# v0.5.1–v0.5.5 — Server-Examples & Multiplayer Chess

> **Status:** Complete ✅  
> **Date:** 2026-06-12  

## What Was Built

The `server-examples/` directory evolved from a simple SSR demo into a **full-featured SST showcase** with HTTP, WebSocket, SQLite, and multiplayer games — all wired through the same `createLoop` model.

### v0.5.1 — SST Server Framework (Foundation)

| File | Description |
|------|-------------|
| `server.mjs` | Entry point — 10 lines, `node --watch` hot-reloadable |
| `app.mjs` | App factory — HTTP server + WebSocket routing, testable |
| `routes.mjs` | SSR pages + REST API endpoints |
| `layout.mjs` | Shared HTML shell with sidebar navigation, 404/error pages |
| `logger.mjs` | Color-coded structured logging (HTTP/WS/Game/State/Error) |

**Pages shipped:**
- `/` — Landing page with feature cards
- `/counter` — SSR + hydration demo
- `/blog` — SSR + SQLite-backed blog
- `/todos` — Service pattern with CRUD API
- `/chat` — Real-time WebSocket chat
- `/css-demo` — Server-side CSS theming
- `/chess` — Multiplayer chess (SSR + WebSocket)
- `/slither` — Multiplayer snake game
- `/api-docs` — Interactive API tester
- `/hypergraph` — Live loop diagnostics dashboard

### v0.5.2 — Slither Multiplayer Game

Canvas-based snake game at 15fps:
- 60×40 wrap-around grid, 10 unique colors
- Self/other collision detection, food spawning
- 20-player limit, arrow-key controls
- Server-side game loop with WebSocket broadcast

### v0.5.3 — Hot Reload + Layout System

| Feature | Description |
|---------|-------------|
| Hot reload | `/ws-hotreload` WebSocket endpoint + inline client script in `layout.mjs` — browser auto-refreshes on server restart |
| Sidebar nav | Consistent 12-link navigation across all pages with active-state highlighting |
| Mobile responsive | CSS media queries collapse sidebar to top bar |

### v0.5.4 — Chess: Game Loop + Client

Pure chess logic (360 lines, zero dependencies):
- Complete move generation (pawns, knights, bishops, rooks, queens, kings)
- Pin detection, check/checkmate/stalemate
- Pawn promotion (auto-queen)
- ASCII board rendering for debugging

| File | Lines | Description |
|------|-------|-------------|
| `chess-logic.mjs` | 200 | Pure chess rules engine |
| `chess-server.mjs` | 290 | Game loop: PvP + PvE modes, turn enforcement |
| `chess-page.mjs` | 155 | SSR component with board + chat UI |
| `public/chess-client.js` | 150 | Vanilla JS WebSocket client (no framework) |

### v0.5.5 — Chess AI + Full Test Suite

**AI Engine** (`chess-ai.mjs`):
- Uses `chess.js` for correct rule enforcement (en passant, castling, promotions)
- PeSTO-style piece-square tables for positional evaluation
- Depth-3 minimax with alpha-beta pruning
- MVV-LVA move ordering, endgame king table switching
- Finds fool's mate and scholar's mate in ~1-4s

**Async handler fix** (`chess-server.mjs`):
- Converted `aiMove` to `{ run: async fn }` metadata format — required for Uploop's async-aware execution path
- Added `chessGame.subscribe()` broadcast hook for async state push to WebSocket clients

| File | Tests | Coverage |
|------|-------|----------|
| `test/chess-logic.test.js` | 24 | Board creation, move gen, check/checkmate, game flow |
| `test/chess-ai.test.js` | 16 | AI move gen, depth, mate detection, edge cases, determinism |
| `test/chess-server.test.js` | 22 | Game loop: join, select, turn enforcement, checkmate, reset, chat, PvE |
| `test/chess-page.test.js` | 11 | SSR rendering: all states, board pieces, highlights, chat |
| `test/e2e/chess-gameflow.spec.js` | 12 | PvE E2E: turns, AI response, board changes, multi-move games |
| `test/e2e/chess-pve.spec.js` | 5 | PvE E2E: board validation, piece selection, AI response |
| `test/e2e/chess-pvp.spec.js` | 8 | PvP E2E: two-browser matches, chat, turn enforcement, fool's mate |
| `test/e2e/server.spec.js` | 18 | All pages + API + WebSocket endpoints |
| `test/app.test.js` | 15 | HTTP route integration tests |
| `test/components.test.js` | 17 | SSR component rendering tests |
| `test/services.test.js` | 7 | Todo CRUD service tests |

**Total: 118 unit tests + 43 E2E tests across 7+4 test files**

## Architecture

```
server-examples/
├── server.mjs              Entry point (10 lines)
├── app.mjs                 App factory (testable)
├── routes.mjs              Path → page mapping + API endpoints
├── layout.mjs              HTML wrapper + hot reload + sidebar
├── logger.mjs              Structured logging
├── components/             UI components (Counter, Blog, Todos, Chat, CSS, Landing)
├── services/               Backing services (Todos with Loop → Service pattern)
├── db/                     SQLite + in-memory stores (blog, chat)
├── games/
│   ├── chess/              Multiplayer chess (logic, AI, page, server loop)
│   └── slither/            Multiplayer snake (server loop, canvas client)
├── public/                 Static files (chess-client.js)
└── test/
    ├── e2e/                Playwright E2E tests (4 spec files)
    ├── app.test.js         15 HTTP route integration tests
    ├── components.test.js  17 SSR component tests
    ├── services.test.js    7 CRUD service tests
    ├── chess-logic.test.js 24 chess rules tests
    ├── chess-ai.test.js    16 AI engine tests
    ├── chess-server.test.js 22 game loop tests
    └── chess-page.test.js  11 SSR rendering tests
```

## Key Design Decisions

1. **Everything is a loop** — HTTP handlers, WebSocket chat, game servers, CRUD services all use `createLoop`
2. **AI is dynamically loaded** — `import(aiModulePath)` in the handler body; module can be a CDN URL
3. **Chess logic is pure** — zero dependencies, can be swapped for any rules engine
4. **Client is vanilla JS** — 150-line WebSocket bridge, no framework, no bundler
5. **Hot reload works everywhere** — `/ws-hotreload` endpoint + layout script = instant refresh
6. **One port** — HTTP, REST API, chat WS, chess WS, slither WS, hot-reload WS all on port 3500
