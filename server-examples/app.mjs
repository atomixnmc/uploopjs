import http from "node:http";
import { WebSocketServer } from "ws";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setupRoutes } from "./routes.mjs";
import { log } from "./logger.mjs";
import { createTodoService } from "./services/todos.mjs";
import { createChatLoop } from "./components/chat.mjs";
import { createSlitherGame } from "./games/slither/slither-server.mjs";
import { createChessGame } from "./games/chess/chess-server.mjs";

export function createApp(options = {}) {
  const todoService = createTodoService();
  const chatLoop = createChatLoop();
  const slitherGame = createSlitherGame();
  const chessGame = createChessGame();

  const routeHandler = setupRoutes({
    todoService,
    chatLoop,
    slitherGame,
    chessGame,
  });
  const server = http.createServer((req, res) => {
    // Static file serving for /public/*
    const url = new URL(req.url, "http://localhost:3500");
    if (url.pathname.startsWith("/public/")) {
      return serveStatic(res, url.pathname);
    }
    if (url.pathname.startsWith("/examples/")) {
      return serveFile(res, join(__dirname, "..", url.pathname));
    }
    if (url.pathname.startsWith("/packages/")) {
      return serveFile(res, join(__dirname, "..", url.pathname));
    }
    return routeHandler(req, res);
  });

  // ── Single WebSocket server with path-based routing ───
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const path = (req.url || "").split("?")[0];
    log.ws("connect", path);
    ws._path = path;

    if (path === "/ws") handleChat(ws);
    else if (path === "/ws-chess") handleChess(ws);
    else if (path === "/ws-slither") handleSlither(ws);
    else if (path === "/ws-hotreload") {
      /* keep-alive only — client detects reconnect */
    } else ws.close(4000, "Unknown path: " + path);
  });

  // ── Chat ──────────────────────────────────────────────
  function handleChat(ws) {
    let user = "Anonymous";
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "join") {
          user = msg.user || "Anonymous";
          chatLoop.send("join");
          sendTo(wss, "/ws", { type: "online", count: chatLoop.get().online });
        } else if (msg.type === "message") {
          chatLoop.send("message", { user, text: msg.text });
          sendTo(wss, "/ws", {
            type: "message",
            user,
            text: msg.text,
            time: new Date().toLocaleTimeString(),
          });
        }
      } catch (e) {
        console.error("chat error:", e.message);
      }
    });
    ws.on("close", () => {
      chatLoop.send("leave");
      sendTo(wss, "/ws", { type: "online", count: chatLoop.get().online });
    });
  }

  // ── Chess ─────────────────────────────────────────────
  function handleChess(ws) {
    let playerId = null;
    log.ws("chess-connected", "");
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        log.ws("chess-msg", "", msg.type);
        if (msg.type === "join") {
          playerId = msg.id || "p" + Math.random().toString(36).slice(2, 8);
          chessGame.send("join", { id: playerId, name: msg.name });
          sendChessState();
        } else if (msg.type === "setMode") {
          chessGame.send("setMode", msg.mode || "pvp");
          sendChessState();
        } else if (msg.type === "reset") {
          chessGame.send("reset");
          sendChessState();
        } else if (msg.type === "select") {
          chessGame.send("select", { row: msg.row, col: msg.col, playerId });
          sendChessState();
        } else if (msg.type === "chat") {
          chessGame.send("chat", { user: msg.user, text: msg.text });
          sendTo(wss, "/ws-chess", {
            type: "chat",
            user: msg.user,
            text: msg.text,
          });
        }
      } catch (e) {
        console.error("chess error:", e.message);
      }
    });
    ws.on("close", () => {
      if (playerId) {
        chessGame.send("leave", playerId);
        sendChessState();
      }
    });
  }

  // ── Slither ───────────────────────────────────────────
  function handleSlither(ws) {
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "join")
          slitherGame.send("join", { id: msg.id, name: msg.name });
        else if (msg.type === "turn")
          slitherGame.send("turn", { playerId: msg.playerId, dir: msg.dir });
      } catch (e) {
        console.error("slither error:", e.message);
      }
    });
  }

  // ── Chess state broadcast (AI moves are async, need push) ──
  function sendChessState() {
    const state = chessGame.get();
    sendTo(wss, "/ws-chess", { type: "state", ...state });
  }

  // Subscribe to ALL chess state changes so async AI moves
  // and other server-side state transitions get broadcast
  chessGame.subscribe(() => {
    sendChessState();
  });

  // ── Helpers ───────────────────────────────────────────
  function sendTo(wss, path, data) {
    const payload = JSON.stringify(data);
    for (const c of wss.clients) {
      if (c.readyState === 1 && c._path === path) c.send(payload);
    }
  }

  // Broadcast slither state at 15fps
  setInterval(() => {
    sendTo(wss, "/ws-slither", slitherGame.get());
  }, 1000 / 15);

  return server;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const MIME = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function serveStatic(res, pathname) {
  return serveFile(res, join(PUBLIC_DIR, pathname.replace("/public/", "")));
}

function serveFile(res, filePath) {
  if (!existsSync(filePath)) {
    res.writeHead(404);
    return res.end("Not found");
  }
  const ext = filePath.slice(filePath.lastIndexOf("."));
  const contentType = MIME[ext] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache",
  });
  res.end(readFileSync(filePath));
}
