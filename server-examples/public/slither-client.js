/**
 * Slither Client — loaded as <script type="module" src="/public/slither-client.js">
 *
 * Architecture:
 *   Server pushes state at 15fps via WebSocket → local createLoop
 *   receives it and triggers canvas renders. Rendering runs at
 *   60fps via requestAnimationFrame with frame interpolation.
 *
 *   import { createLoop } from '@uploop/core'    ← real package
 *   ┌─────────┐   WS 15fps    ┌──────────────┐   rAF 60fps   ┌────────┐
 *   │ Server  │ ────────────→ │ Client Loop  │ ────────────→ │ Canvas │
 *   │ (loop)  │               │ state+update │               │ render │
 *   └─────────┘               └──────────────┘               └────────┘
 */

import { createLoop } from "@uploop/core";

const CELL = 12;
const COLS = 60,
  ROWS = 40;
const W = COLS * CELL,
  H = ROWS * CELL;

// ── App state loop ─────────────────────────────────────────

const loop = createLoop({
  state: {
    snakes: {},
    food: [],
    tick: 0,
    particles: [], // [{x, y, vx, vy, life, color}]
    mouseX: W / 2, // mouse position for snake control
    mouseY: H / 2,
    lastDir: null, // last sent direction (dedup optimization)
  },

  update: {
    serverState(s, data) {
      return {
        snakes: data.snakes || {},
        food: data.food || [],
        tick: data.tick || 0,
      };
    },

    burst(s, { x, y, color }) {
      const p = [];
      for (let i = 0; i < 6; i++) {
        p.push({
          x: x * CELL + CELL / 2 + (Math.random() - 0.5) * CELL,
          y: y * CELL + CELL / 2 + (Math.random() - 0.5) * CELL,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          life: 1,
          color,
        });
      }
      return { particles: [...s.particles, ...p] };
    },

    tickParticles(s) {
      return {
        particles: s.particles
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            life: p.life - 0.03,
          }))
          .filter((p) => p.life > 0),
      };
    },

    setMouse(s, { x, y }) {
      return { mouseX: x, mouseY: y };
    },

    setLastDir(s, dir) {
      return { lastDir: dir };
    },
  },
});

// ── WebSocket connection ───────────────────────────────────

const playerId = "p" + Math.random().toString(36).slice(2, 8);
const name = "Snake" + Math.floor(Math.random() * 1000);
const ws = new WebSocket("ws://" + location.host + "/ws-slither");

ws.onopen = () => ws.send(JSON.stringify({ type: "join", id: playerId, name }));

let prevFood = 0;
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);

  // Detect food eaten → burst particles
  const currentFood = (data.food || []).length;
  const s = loop.get();
  if (currentFood < prevFood && s.food.length > 0) {
    const eaten = s.food.find(
      (f) => !(data.food || []).some((nf) => nf.x === f.x && nf.y === f.y),
    );
    if (eaten) {
      const eater = Object.values(data.snakes || {}).find((sn) => {
        const h = sn.body ? sn.body[0] : null;
        return h && h.x === eaten.x && h.y === eaten.y;
      });
      if (eater)
        loop.send("burst", { x: eaten.x, y: eaten.y, color: eater.color });
    }
  }
  prevFood = currentFood;

  loop.send("serverState", data);
};

// ── Mouse-follow input (replaces keyboard) ──────────────────

const canvas = document.getElementById("slither-canvas");
const ctx = canvas.getContext("2d");

// Track mouse on canvas
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width; // canvas may be CSS-scaled
  const scaleY = H / rect.height;
  loop.send("setMouse", {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  });
});

// Also support touch for mobile
canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    loop.send("setMouse", {
      x: (touch.clientX - rect.left) * (W / rect.width),
      y: (touch.clientY - rect.top) * (H / rect.height),
    });
  },
  { passive: false },
);

// Keep keyboard as fallback
const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};
document.addEventListener("keydown", (e) => {
  const dir = DIRS[e.key];
  if (dir) {
    e.preventDefault();
    ws.send(JSON.stringify({ type: "turn", playerId, dir }));
  }
});

// Fullscreen toggle
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    canvas.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}
canvas.addEventListener("dblclick", toggleFullscreen);

// ── Canvas drawing (60fps with interpolation) ──────────────

// Color helpers
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 255, g: 255, b: 255 };
}
function lighten(hex, a) {
  const c = hexToRgb(hex);
  return `rgb(${[c.r, c.g, c.b].map((v) => Math.min(255, Math.round(v + (255 - v) * a))).join(",")})`;
}
function darken(hex, a) {
  const c = hexToRgb(hex);
  return `rgb(${[c.r, c.g, c.b].map((v) => Math.max(0, Math.round(v * (1 - a)))).join(",")})`;
}

// Rounded rect path
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// Radial gradient per snake segment — with NaN guard
function segGradient(x, y, size, color) {
  if (!isFinite(x) || !isFinite(y) || !isFinite(size) || size <= 0) {
    return color;
  }
  const g = ctx.createRadialGradient(
    x + size / 2,
    y + size / 2,
    size * 0.1,
    x + size / 2,
    y + size / 2,
    size * 0.65,
  );
  g.addColorStop(0, lighten(color, 0.5));
  g.addColorStop(0.6, color);
  g.addColorStop(1, darken(color, 0.4));
  return g;
}

// Smooth movement: interpolate between two server ticks
let prevState = null;
let currentState = null;
let lerpT = 0;

function lerpPos(a, b, t) {
  if (!a || !b) return b || a;
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  if (!isFinite(x) || !isFinite(y)) return b;
  return { x, y };
}

function draw() {
  try {
    const s = loop.get();

    // ── Mouse-follow: compute direction and send to server ──
    // Uploop optimization: only send when direction changes (dedup)
    const mySnake = s.snakes[playerId];
    if (mySnake && mySnake.alive && mySnake.body) {
      const head = mySnake.body[0];
      const hx = head.x * CELL + CELL / 2;
      const hy = head.y * CELL + CELL / 2;
      const dx = s.mouseX - hx;
      const dy = s.mouseY - hy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Only follow if mouse is reasonably far from head (avoid jitter)
      if (dist > CELL * 1.5) {
        // Snap to closest cardinal direction
        let dir;
        if (Math.abs(dx) > Math.abs(dy)) {
          dir = { x: dx > 0 ? 1 : -1, y: 0 };
        } else {
          dir = { x: 0, y: dy > 0 ? 1 : -1 };
        }
        // Dedup: only send if direction changed
        if (!s.lastDir || s.lastDir.x !== dir.x || s.lastDir.y !== dir.y) {
          ws.send(JSON.stringify({ type: "turn", playerId, dir }));
          loop.send("setLastDir", dir);
        }
      }
    }

    // Track tick changes for interpolation
    if (currentState && currentState.tick !== s.tick) {
      prevState = currentState;
      lerpT = 0;
    }
    currentState = { ...s };
    lerpT = Math.min(1, lerpT + 0.09);

    // ── Background gradient ──────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a0a14");
    bg.addColorStop(1, "#111122");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, H);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(W, y * CELL);
      ctx.stroke();
    }

    // ── Food — glowing pulsing dots ─────────────────────
    const pulse = 1 + Math.sin(Date.now() / 300) * 0.2;
    for (const f of s.food || []) {
      const fx = f.x * CELL + CELL / 2;
      const fy = f.y * CELL + CELL / 2;
      const r = 4 * pulse;

      const glow = ctx.createRadialGradient(fx, fy, r * 0.2, fx, fy, r * 1.8);
      glow.addColorStop(0, "rgba(255,255,100,0.8)");
      glow.addColorStop(0.5, "rgba(255,200,50,0.3)");
      glow.addColorStop(1, "rgba(255,200,50,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(fx, fy, r * 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffee44";
      ctx.beginPath();
      ctx.arc(fx, fy, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Snakes — gradient bodies + eyes ─────────────────
    for (const snake of Object.values(s.snakes || {})) {
      if (!snake.alive) continue;

      const prevSnake = prevState ? (prevState.snakes || {})[snake.id] : null;
      const body = snake.body || [];

      for (let i = body.length - 1; i >= 0; i--) {
        const seg = body[i];
        const prevSeg = prevSnake && prevSnake.body ? prevSnake.body[i] : null;
        const pos = lerpPos(prevSeg, seg, lerpT);
        if (!pos) continue;

        const sx = pos.x * CELL + 1;
        const sy = pos.y * CELL + 1;
        const size = CELL - 2;

        // Taper toward tail
        const taper =
          i === 0
            ? 1
            : Math.max(0.1, 0.85 - (i / Math.max(1, body.length)) * 0.3);
        const segSize = Math.max(3, size * taper);
        const off = (size - segSize) / 2;

        // Gradient body
        ctx.fillStyle = segGradient(
          ctx,
          sx + off,
          sy + off,
          segSize,
          snake.color,
        );
        roundRect(sx + off, sy + off, segSize, segSize, segSize * 0.35);
        ctx.fill();

        ctx.strokeStyle = darken(snake.color, 0.3);
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // ── Head: eyes ─────────────────────────────────
        if (i === 0) {
          const eyeR = segSize * 0.18;
          const dir = snake.dir || { x: 1, y: 0 };
          const cx = sx + off + segSize / 2;
          const cy = sy + off + segSize / 2;

          let e1x, e1y, e2x, e2y;
          if (dir.x !== 0) {
            e1x = cx + dir.x * segSize * 0.25;
            e1y = cy - segSize * 0.22;
            e2x = cx + dir.x * segSize * 0.25;
            e2y = cy + segSize * 0.22;
          } else {
            e1x = cx - segSize * 0.22;
            e1y = cy + dir.y * segSize * 0.25;
            e2x = cx + segSize * 0.22;
            e2y = cy + dir.y * segSize * 0.25;
          }

          // Whites
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(e1x, e1y, eyeR * 1.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(e2x, e2y, eyeR * 1.3, 0, Math.PI * 2);
          ctx.fill();

          // Pupils
          const px = dir.x * eyeR * 0.4,
            py = dir.y * eyeR * 0.4;
          ctx.fillStyle = "#111";
          ctx.beginPath();
          ctx.arc(e1x + px, e1y + py, eyeR * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(e2x + px, e2y + py, eyeR * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Name label
      const head = body[0];
      if (head) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowBlur = 2;
        ctx.fillText(
          snake.name || "?",
          head.x * CELL + CELL / 2,
          head.y * CELL - 4,
        );
        ctx.shadowBlur = 0;
        ctx.textAlign = "start";
      }
    }

    // ── Particles ───────────────────────────────────────
    for (const p of s.particles || []) {
      ctx.fillStyle = p.color
        .replace(")", `,${p.life})`)
        .replace("rgb", "rgba");
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    loop.send("tickParticles");

    requestAnimationFrame(draw);
  } catch (e) {
    console.error("[Slither] draw error:", e.message, e.stack);
    requestAnimationFrame(draw);
  }
}

// ── Start ──────────────────────────────────────────────────
draw();
console.log(
  "[Slither] Ready — player:",
  name,
  "| using @uploop/core createLoop",
);
