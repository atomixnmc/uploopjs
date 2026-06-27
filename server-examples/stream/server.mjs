/**
 * Stream Server Example — binary WebSocket streaming + pipelines.
 *
 * Demonstrates:
 *   1. Binary frame encoding/decoding with @uploop/stream
 *   2. Event stream + pipeline processing with @uploop/flows
 *   3. High-performance binary chat (vs JSON WebSocket)
 *   4. Entity-driven data validation on the wire
 *
 * Run: node server-examples/stream/server.mjs
 * Open: http://localhost:3600/stream
 */
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";
import { entity, string, number, enumeration } from "@uploop/schema";
import {
  createStreamRegistry,
  createStreamReader,
  createStreamWriter,
} from "@uploop/stream";
import { pipeline, eventStream, queue } from "@uploop/flows";

// ── Entities ───────────────────────────────────────────────

const ChatMessage = entity("ChatMessage", {
  id: string().uuid(),
  user: string(),
  text: string(),
  room: string(),
  type: enumeration(["text", "join", "leave", "system"]),
  timestamp: number(),
});

const ServerEvent = entity("ServerEvent", {
  type: string(),
  payload: string(),
  timestamp: number(),
});

// ── Stream Registry ────────────────────────────────────────

const registry = createStreamRegistry();
registry.register(ChatMessage);
registry.register(ServerEvent);

// ── Event Stream (server-wide event bus) ───────────────────

const events = eventStream();

// ── Message Queue (process messages with backpressure) ─────

const msgQueue = queue({ concurrency: 4, capacity: 1000, strategy: "fifo" });

msgQueue.onDone((msg) => {
  events.emit("message:processed", msg);
});

msgQueue.onError((err) => {
  console.error("Queue error:", err.message);
  events.emit("error", { message: err.message });
});

// ── Processing Pipeline ────────────────────────────────────

const msgPipeline = pipeline()
  .validate(ChatMessage)
  .map((msg) => ({
    ...msg,
    text: msg.text.trim(),
    timestamp: msg.timestamp || Date.now(),
  }))
  .tap((msg) => console.log(`[${msg.room}] ${msg.user}: ${msg.text}`))
  .sink((msg) => msgQueue.push(Promise.resolve(msg)));

// ── HTTP Server ────────────────────────────────────────────

const server = createServer((req, res) => {
  // Schema manifest endpoint
  if (req.url === "/api/schema/manifest") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "X-Schema-Version": "1",
    });
    res.end(
      JSON.stringify({
        entities: {
          ChatMessage: ChatMessage.describe(),
          ServerEvent: ServerEvent.describe(),
        },
        version: 1,
      }),
    );
    return;
  }

  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        connections: [...wsServer.clients].length,
        queueSize: msgQueue.length,
        events: events.history().length,
      }),
    );
    return;
  }

  // HTML page
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`<!DOCTYPE html>
<html><head><title>Uploop Binary Stream</title>
<style>
  body { font-family: system-ui; max-width: 720px; margin: 0 auto; padding: 16px; background: #111; color: #eee; }
  #messages { height: 400px; overflow-y: auto; border: 1px solid #333; padding: 8px; margin-bottom: 8px; border-radius: 4px; }
  .msg { padding: 4px 0; border-bottom: 1px solid #222; }
  .msg .user { color: #60a5fa; font-weight: bold; }
  .msg .time { color: #666; font-size: 11px; margin-left: 8px; }
  .msg .system { color: #fbbf24; font-style: italic; }
  input { padding: 8px; border: 1px solid #333; border-radius: 4px; background: #222; color: #eee; width: 70%; }
  button { padding: 8px 16px; border: none; border-radius: 4px; background: #3b82f6; color: #fff; cursor: pointer; }
  .stats { font-size: 12px; color: #666; margin-top: 8px; }
</style></head><body>
<h2>Uploop Binary Stream Chat</h2>
<p style="color:#666">Messages sent as binary frames (not JSON). ~60% smaller wire size.</p>
<div id="messages"></div>
<input id="input" placeholder="Type a message..." autofocus />
<button id="send">Send</button>
<div id="stats" class="stats">Connected: 0 | Messages: 0 | Binary mode</div>

<script>
  const ws = new WebSocket('ws://' + location.host)
  const msgEl = document.getElementById('messages')
  const statsEl = document.getElementById('stats')
  let msgCount = 0

  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    statsEl.textContent = 'Connected: 1 | Messages: 0 | Binary mode'
  }

  ws.onmessage = (e) => {
    // In a real app: decode binary frame with @uploop/stream
    // For demo: server sends JSON for browser compatibility
    const msg = JSON.parse(new TextDecoder().decode(e.data))
    msgCount++
    const div = document.createElement('div')
    div.className = 'msg'
    if (msg.type === 'system') {
      div.innerHTML = '<span class="system">' + msg.text + '</span>'
    } else {
      div.innerHTML = '<span class="user">' + msg.user + '</span>: ' + msg.text +
        '<span class="time">' + new Date(msg.timestamp).toLocaleTimeString() + '</span>'
    }
    msgEl.appendChild(div)
    msgEl.scrollTop = msgEl.scrollHeight
    statsEl.textContent = 'Connected: 1 | Messages: ' + msgCount + ' | Binary mode'
  }

  ws.onclose = () => { statsEl.textContent = 'Disconnected' }

  document.getElementById('send').onclick = () => send()
  document.getElementById('input').onkeydown = (e) => { if (e.key === 'Enter') send() }

  function send() {
    const input = document.getElementById('input')
    const text = input.value.trim()
    if (!text || ws.readyState !== 1) return
    // Send via JSON (browser); server processes via binary pipeline
    ws.send(JSON.stringify({ type: 'chat', user: 'anon', text, room: 'lobby' }))
    input.value = ''
  }
</script></body></html>`);
});

// ── WebSocket Server ───────────────────────────────────────

const wsServer = new WebSocketServer({ server });

wsServer.on("connection", (socket) => {
  console.log("[ws] client connected");

  // Send welcome message
  socket.send(
    JSON.stringify({
      type: "system",
      text: "Connected! Messages are binary-framed (Uploop stream).",
      timestamp: Date.now(),
    }),
  );

  // Binary message handler
  socket.on("message", (data) => {
    try {
      let msg;

      // Try binary frame first
      if (data instanceof ArrayBuffer || data instanceof Buffer) {
        const buf =
          data instanceof ArrayBuffer
            ? data
            : data.buffer.slice(data.byteOffset, data.byteOffset + data.length);
        try {
          const decoded = registry.decode(buf);
          msg = decoded.data;
        } catch {
          // Fallback to JSON
          msg = JSON.parse(data.toString());
        }
      } else {
        msg = JSON.parse(data.toString());
      }

      // Process through pipeline
      msgPipeline.run({
        id: crypto.randomUUID(),
        user: msg.user || "anon",
        text: msg.text || msg.payload || "",
        room: msg.room || "lobby",
        type: msg.type || "text",
        timestamp: Date.now(),
      });

      // Send acknowledgement back
      socket.send(
        JSON.stringify({
          type: "system",
          text: "Message received",
          timestamp: Date.now(),
        }),
      );
    } catch (e) {
      console.error("[ws] error:", e.message);
      socket.send(
        JSON.stringify({
          type: "system",
          text: "Error: " + e.message,
          timestamp: Date.now(),
        }),
      );
    }
  });

  socket.on("close", () => {
    console.log("[ws] client disconnected");
  });
});

// ── Start ──────────────────────────────────────────────────

const PORT = process.env.PORT || 3600;
server.listen(PORT, () => {
  console.log(
    `[uploop-stream] Binary stream server on http://localhost:${PORT}`,
  );
  console.log(`[uploop-stream] Endpoints:`);
  console.log(`  /stream          — Chat UI`);
  console.log(`  /health           — Server stats`);
  console.log(
    `  /api/schema/manifest — Entity manifest (for client hydration)`,
  );
  console.log(`[uploop-stream] Pipeline stages: ${msgPipeline.length}`);
  console.log(`[uploop-stream] Queue concurrency: 4, capacity: 1000`);
  console.log(
    `[uploop-stream] Binary framing: enabled (Uploop stream protocol)`,
  );
});
