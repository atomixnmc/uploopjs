import { html, component } from "@uploop/html";

// ════════════════════════════════════════════════════════════
// Uploop Component Graph for the Fishes Game
//
// This demonstrates that Uploop components are NOT limited to
// WebComponents or DOM rendering. A component is just a
// self-contained state machine (+ optional view/mount).
//
// Component Tree (Graph):
//
//   FishesGame (root)
//   ├── owns canvas, rAF loop, DOM controls
//   ├── creates sub-components via .create()
//   │
//   ├── SwarmLogic
//   │   └── state: fishes[], running, sheet
//   │   └── updates: start, stop, tick, remove
//   │   └── NO view (pure canvas logic)
//   │
//   ├── BasketLogic
//   │   └── state: score
//   │   └── updates: increment, reset
//   │   └── NO view (pure logic)
//   │
//   └── ConfettiLogic
//       └── state: particles[], active
//       └── updates: trigger, tick
//       └── NO view (pure canvas particles)
//
// The root reads child state each frame via child.loop.get()
// and calls render helpers with the shared canvas ctx2d.
// Events flow: UI → root.send() → root updates children.
// ════════════════════════════════════════════════════════════

// ─── Constants ────────────────────────────────────────────
const FISH_COLORS = [
  "#ff6b6b",
  "#feca57",
  "#48dbfb",
  "#ff9ff3",
  "#54a0ff",
  "#5f27cd",
  "#01a3a4",
  "#f368e0",
  "#0abde3",
  "#10ac84",
];
const FISH_TYPES = ["normal", "fat", "long", "tiny"];
const CONFETTI_COLORS = [
  "#ff6b6b",
  "#feca57",
  "#48dbfb",
  "#ff9ff3",
  "#54a0ff",
  "#5f27cd",
  "#01a3a4",
  "#f368e0",
  "#0abde3",
];
const BASKET_X = 740,
  BASKET_Y = 365,
  BASKET_W = 60,
  BASKET_H = 35;

// ─── Pure helpers ─────────────────────────────────────────
function rand(a, b) {
  return a + Math.random() * (b - a);
}

function hitTestFish(f, cx, cy) {
  if (!f.alive) return false;
  const rx = 20 * f.size,
    ry = 10 * f.size;
  return ((cx - f.x) / rx) ** 2 + ((cy - f.y) / ry) ** 2 <= 1;
}

function shadeColor(color, percent) {
  const n = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (n >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((n >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (n & 0x0000ff) + amt));
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// ════════════════════════════════════════════════════════════
// Sub-component 1: SwarmLogic — fish entity management
// ════════════════════════════════════════════════════════════
// No `view` function — this component only has state + updates.
// It is a "logic component": no DOM output, pure data management.
// The parent reads its state and renders via canvas helpers.
const SwarmLogic = component("SwarmLogic", {
  state: { fishes: [], running: false, sheet: null, cw: 800, ch: 400 },

  update: {
    start: (s, cw, ch) => {
      const sheet = createSpriteSheet();
      const fishes = Array.from({ length: 20 }, () => createFish(cw, ch));
      return { ...s, fishes, running: true, sheet, cw, ch };
    },
    stop: (s) => ({ ...s, running: false }),
    tick: (s) => ({
      ...s,
      fishes: s.fishes.map((f) => updateFish(f, s.cw, s.ch)),
    }),
    remove: (s, id) => ({
      ...s,
      fishes: s.fishes.map((f) => (f.id === id ? { ...f, alive: false } : f)),
    }),
    setCount: (s, n, cw, ch) => {
      const fishes = [...s.fishes];
      while (fishes.length < n) fishes.push(createFish(cw, ch));
      return { ...s, fishes, cw, ch };
    },
  },
});

// ─── Fish helpers (used by SwarmLogic) ────────────────────
function createSpriteSheet() {
  const sprites = {};
  for (const type of FISH_TYPES) {
    sprites[type] = {};
    for (const color of FISH_COLORS) {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 32;
      drawFish(c.getContext("2d"), type, color);
      sprites[type][color] = c;
    }
  }
  return sprites;
}

function drawFish(ctx, type, color) {
  const w = 64,
    h = 32;
  ctx.clearRect(0, 0, w, h);
  const bw =
    type === "fat" ? 36 : type === "long" ? 48 : type === "tiny" ? 20 : 30;
  const bh =
    type === "fat" ? 18 : type === "long" ? 10 : type === "tiny" ? 10 : 14;
  const bx = (w - bw) / 2,
    by = (h - bh) / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(bx - 8, h / 2 - 8);
  ctx.lineTo(bx - 20, h / 2);
  ctx.lineTo(bx - 8, h / 2 + 8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.3, by);
  ctx.lineTo(bx + bw * 0.5, by - 8);
  ctx.lineTo(bx + bw * 0.7, by);
  ctx.closePath();
  ctx.fillStyle = shadeColor(color, -20);
  ctx.fill();
  const ex = bx + bw * 0.7,
    ey = by + bh * 0.35;
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(ex, ey, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(ex + 0.5, ey, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.3, by + bh * 0.2);
  ctx.lineTo(bx + bw * 0.3, by + bh * 0.8);
  ctx.stroke();
}

function createFish(cw, ch) {
  const type = FISH_TYPES[Math.floor(Math.random() * FISH_TYPES.length)];
  const color = FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)];
  const dir = Math.random() > 0.5 ? 1 : -1;
  return {
    id: Math.random().toString(36).slice(2, 8),
    type,
    color,
    x: Math.random() * cw,
    y: 30 + Math.random() * (ch - 80),
    vx: (0.5 + Math.random() * 1.5) * dir,
    vy: rand(-0.15, 0.15),
    size:
      type === "fat" ? 1.3 : type === "long" ? 1.5 : type === "tiny" ? 0.7 : 1,
    flip: dir === -1,
    wobblePhase: rand(0, Math.PI * 2),
    wobbleSpeed: rand(0.02, 0.05),
    wobbleAmp: rand(0.2, 0.5),
    opacity: rand(0.8, 1),
    alive: true,
  };
}

function updateFish(f, cw, ch) {
  if (!f.alive) return f;
  let x = f.x + f.vx,
    y = f.y + f.vy + Math.sin(f.wobblePhase) * f.wobbleAmp;
  let flip = f.flip,
    vx = f.vx;
  const wp = f.wobblePhase + f.wobbleSpeed;
  if (x < -30) {
    x = -30;
    vx = Math.abs(vx);
    flip = false;
  }
  if (x > cw + 30) {
    x = cw + 30;
    vx = -Math.abs(vx);
    flip = true;
  }
  y = Math.max(20, Math.min(ch - 30, y));
  return { ...f, x, y, vx, flip, wobblePhase: wp };
}

// ════════════════════════════════════════════════════════════
// Sub-component 2: BasketLogic — score tracking
// ════════════════════════════════════════════════════════════
// Minimal component: just state + update. No view, no mount.
const BasketLogic = component("BasketLogic", {
  state: { score: 0 },
  update: {
    increment: (s) => ({ score: s.score + 1 }),
    reset: () => ({ score: 0 }),
  },
});

// ════════════════════════════════════════════════════════════
// Sub-component 3: ConfettiLogic — particle system
// ════════════════════════════════════════════════════════════
const ConfettiLogic = component("ConfettiLogic", {
  state: { particles: [], active: false, cw: 800, ch: 400 },

  update: {
    start: (s, cw, ch) => ({
      particles: Array.from({ length: 80 }, () => ({
        x: Math.random() * cw,
        y: -20,
        vx: rand(-2, 2),
        vy: rand(2, 6),
        color:
          CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: rand(4, 10),
        rot: rand(0, 360),
        rv: rand(-8, 8),
      })),
      active: true,
      cw,
      ch,
    }),
    tick: (s) => {
      const particles = s.particles.map((p) => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.05,
        rot: p.rot + p.rv,
      }));
      const active = particles.some((p) => p.y < s.ch + 20);
      return { ...s, particles, active };
    },
  },
});

// ════════════════════════════════════════════════════════════
// Root Component: FishesGame — orchestrates all sub-components
// ════════════════════════════════════════════════════════════
// This component:
// 1. Creates child instances in mount hook
// 2. Renders DOM controls via `view`
// 3. Runs the rAF loop — reads child state, calls render helpers
// 4. Sends events to children when UI buttons are clicked
// 5. Handles canvas click → hit-test → remove fish → increment score
//
const FishesGame = component("FishesGame", {
  state: {
    running: false,
    score: 0,
    fishCount: 20,
    spritesGenerated: false,
    showWinner: false,
  },

  update: {
    start: (s) =>
      s.running
        ? s
        : {
            ...s,
            running: true,
            spritesGenerated: true,
            score: 0,
            showWinner: false,
          },
    stop: (s) => ({ ...s, running: false }),
    setCount: (s, n) => ({
      ...s,
      fishCount: Math.max(1, Math.min(100, parseInt(n) || 20)),
    }),
    catchFish: (s) => {
      const score = s.score + 1;
      const won = score >= 10;
      return { ...s, score, running: won ? false : s.running, showWinner: won };
    },
  },

  view: (state, { send }) => html`
    <div style="font-family:sans-serif;padding:1rem;position:relative;">
      <div
        style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem;"
      >
        <button
          @click=${() => send(state.running ? "stop" : "start")}
          style="padding:0.4rem 1rem;border:none;border-radius:8px;cursor:pointer;
                 background:${state.running ? "#ff4444" : "#646cff"};
                 color:white;font-size:0.85rem;font-weight:500;"
        >
          ${state.running ? "⏹ Stop" : "▶ Start"}
        </button>
        <label
          style="font-size:0.82rem;color:#666;display:flex;align-items:center;gap:0.25rem;"
        >
          Fish:
          <input
            type="range"
            min="5"
            max="100"
            value="${state.fishCount}"
            @input=${["setCount", (e) => parseInt(e.target.value)]}
            style="width:70px;"
          />
          <span style="min-width:1.5rem;">${state.fishCount}</span>
        </label>
        <span style="flex:1;"></span>
        <span style="font-size:0.9rem;font-weight:600;color:#333;"
          >🧺 ${state.score} / 10</span
        >
      </div>

      <div
        id="fishes-container"
        style="border:1px solid #ddd;border-radius:12px;overflow:hidden;position:relative;cursor:crosshair;"
      ></div>

      ${!state.spritesGenerated
        ? html`
            <p
              style="text-align:center;font-size:0.85rem;color:#888;margin-top:0.75rem;"
            >
              🐟 Click <strong>Start</strong> then click fish to catch them!
            </p>
          `
        : ""}
      ${state.showWinner
        ? html`
            <div
              style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:20;
                    background:rgba(0,0,0,0.35);border-radius:12px;margin:1rem;"
            >
              <div
                style="background:white;padding:2rem 2.5rem;border-radius:16px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.15);"
              >
                <div style="font-size:3rem;margin-bottom:0.5rem;">🏆</div>
                <h2 style="margin:0 0 0.25rem;">You Won!</h2>
                <p style="margin:0 0 1rem;color:#666;">
                  Caught 10 fish! Amazing!
                </p>
                <p style="margin:0 0 1rem;font-size:0.78rem;color:#aaa;">
                  Components used: SwarmLogic · BasketLogic · ConfettiLogic
                </p>
                <button
                  @click=${() => send("start")}
                  style="padding:0.5rem 1.5rem;background:#646cff;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;"
                >
                  🎮 Play Again
                </button>
              </div>
            </div>
          `
        : ""}
    </div>
  `,

  mount: (el, ctx) => {
    // ── Create sub-component instances ──
    const swarm = SwarmLogic.create();
    const basket = BasketLogic.create();
    const confetti = ConfettiLogic.create();

    // ── Create canvas ──
    const container = el.querySelector("#fishes-container");
    if (!container) return;
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 400;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.display = "block";
    container.appendChild(canvas);
    const ctx2d = canvas.getContext("2d");

    // ── Register persistent resource ──
    ctx.registerResource("fishes-canvas", {
      save: () => null,
      restore: () => {
        const cont = el.querySelector("#fishes-container");
        if (!cont) return;
        const old = cont.querySelector("canvas");
        if (old) old.remove();
        cont.appendChild(canvas);
      },
    });

    // ── Fly-to-basket animation state ──
    let flyFish = null;

    // ── Canvas click handler ──
    canvas.addEventListener("click", (e) => {
      const gs = FishesGame.loop.get();
      if (!gs.running) return;
      const ss = swarm.loop.get();
      const rect = canvas.getBoundingClientRect();
      const scX = canvas.width / rect.width,
        scY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scX,
        cy = (e.clientY - rect.top) * scY;

      for (let i = ss.fishes.length - 1; i >= 0; i--) {
        if (hitTestFish(ss.fishes[i], cx, cy)) {
          const f = ss.fishes[i];
          swarm.loop.send("remove", f.id);
          basket.loop.send("increment");
          flyFish = {
            x: f.x,
            y: f.y,
            tx: BASKET_X + BASKET_W / 2,
            ty: BASKET_Y + BASKET_H / 2,
            progress: 0,
            type: f.type,
            color: f.color,
            size: f.size,
            flip: f.flip,
          };
          FishesGame.loop.send("catchFish");
          break;
        }
      }
    });

    // ── Hover cursor ──
    canvas.addEventListener("mousemove", (e) => {
      const gs = FishesGame.loop.get();
      if (!gs.running) {
        canvas.style.cursor = "default";
        return;
      }
      const ss = swarm.loop.get();
      const rect = canvas.getBoundingClientRect();
      const scX = canvas.width / rect.width,
        scY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scX,
        cy = (e.clientY - rect.top) * scY;
      canvas.style.cursor = ss.fishes.some((f) => hitTestFish(f, cx, cy))
        ? "pointer"
        : "crosshair";
    });

    // ── rAF Loop ──
    let animId = null;

    function drawScene() {
      const gs = FishesGame.loop.get();
      const ss = swarm.loop.get();
      const bs = basket.loop.get();
      const cs = confetti.loop.get();

      // Start game
      if (gs.running && !ss.running) {
        swarm.loop.send("start", canvas.width, canvas.height);
        basket.loop.send("reset");
        flyFish = null;
        confetti.loop.send("start", canvas.width, canvas.height);
      }

      // Stop game
      if (!gs.running && ss.running) {
        swarm.loop.send("stop");
      }

      // Sync fish count
      if (gs.running && ss.fishes.length !== gs.fishCount) {
        swarm.loop.send("setCount", gs.fishCount, canvas.width, canvas.height);
      }

      // Tick sub-components
      if (ss.running) swarm.loop.send("tick");
      if (cs.active) confetti.loop.send("tick");

      // ── Draw on canvas ──
      drawBackground(ctx2d, canvas);
      for (const fish of ss.fishes) {
        if (fish.alive) drawFishSprite(ctx2d, fish, ss.sheet);
      }
      drawBasket(ctx2d, BASKET_X, BASKET_Y, BASKET_W, BASKET_H, bs.score);
      if (cs.active) drawConfetti(ctx2d, cs.particles);
      drawFlyFish(ctx2d, flyFish, ss.sheet);
      if (flyFish) {
        flyFish.progress += 0.04;
        if (flyFish.progress >= 1) flyFish = null;
      }

      animId = requestAnimationFrame(drawScene);
    }

    animId = requestAnimationFrame(drawScene);

    return () => {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    };
  },
});

// ════════════════════════════════════════════════════════════
// Canvas Render Helpers
// ════════════════════════════════════════════════════════════

function drawBackground(ctx, canvas) {
  const w = canvas.width,
    h = canvas.height;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#e8f4fd");
  grad.addColorStop(0.5, "#b8d4e8");
  grad.addColorStop(1, "#8ab8d4");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#d4c4a0";
  ctx.fillRect(0, h - 30, w, 30);
  ctx.fillStyle = "#c4b490";
  ctx.fillRect(0, h - 30, w, 2);
  for (let i = 0; i < 12; i++) {
    const bx = (i * 63 + 13) % w,
      by = h - 38 - ((i * 19) % (h - 50)),
      br = 2 + (i % 3);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFishSprite(ctx, fish, sheet) {
  const sprite = sheet?.[fish.type]?.[fish.color];
  if (!sprite) return;
  ctx.save();
  ctx.globalAlpha = fish.opacity;
  ctx.translate(fish.x, fish.y);
  if (fish.flip) ctx.scale(-1, 1);
  ctx.drawImage(
    sprite,
    -32 * fish.size,
    -16 * fish.size,
    64 * fish.size,
    32 * fish.size,
  );
  ctx.restore();
}

function drawBasket(ctx, x, y, w, h, score) {
  ctx.fillStyle = "#8B4513";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = "#A0522D";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const lx = x + (w / 5) * i;
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx, y + h);
    ctx.stroke();
  }
  ctx.strokeStyle = "#654321";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - 2, y - 4, w + 4, 8, 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w / 2, y - 4, w * 0.35, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = "white";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`🐟 ${score}`, x + w / 2, y + h / 2);
}

function drawFlyFish(ctx, fly, sheet) {
  if (!fly) return;
  const sprite = sheet?.[fly.type]?.[fly.color];
  if (!sprite) return;
  const t = fly.progress;
  const ease = 1 - Math.pow(1 - t, 3);
  const x = fly.x + (fly.tx - fly.x) * ease,
    y = fly.y + (fly.ty - fly.y) * ease;
  const s = fly.size * (1 - t * 0.6);
  ctx.save();
  ctx.globalAlpha = 1 - t * 0.5;
  ctx.translate(x, y);
  if (fly.flip) ctx.scale(-1, 1);
  ctx.drawImage(sprite, -32 * s, -16 * s, 64 * s, 32 * s);
  ctx.restore();
}

function drawConfetti(ctx, particles) {
  for (const p of particles) {
    if (p.y < -10) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rot * Math.PI) / 180);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  }
}

export { FishesGame, SwarmLogic, BasketLogic, ConfettiLogic };
export default FishesGame;
