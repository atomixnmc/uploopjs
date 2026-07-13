import {
  html,
  component,
  createComponentType,
  registerScope,
} from "@uploop/html";

// ════════════════════════════════════════════════════════════
// Uploop — Declarative canvas with built-in frame timing
//
// <canvas uploop-containers="virtual" uploop-scope="cars">
//   <scene w={700} h={300} running={state.running} speed={state.speed}/>
// </canvas>
//
// Scene has frame: "visual" — auto-rAF with elapsed/delta.
// Canvas context auto-resolves from parent <canvas>.
// computeParts + reactive children: no _childDx hack.
// ════════════════════════════════════════════════════════════

// ─── Utils ────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ════════════════════════════════════════════════════════════
// Drawable — cycle methods: composition + draw (frame callback)
// ════════════════════════════════════════════════════════════
const Drawable = createComponentType({
  state: { x: 0, y: 0, visible: true },
  cycleMethods: { composition: "create", draw: true },
});

// ════════════════════════════════════════════════════════════
// Wheel
// ════════════════════════════════════════════════════════════
const Wheel = Drawable({
  name: "Wheel",
  state: { radius: 14, color: "#222" },
  draw: (ctx, s, _c, { elapsed }) => {
    const { x, y, radius, color } = s;
    const spin = elapsed * 0.003;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + spin;
      ctx.beginPath();
      ctx.moveTo(
        x + Math.cos(a) * (radius - 3),
        y + Math.sin(a) * (radius - 3),
      );
      ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
      ctx.stroke();
    }
    ctx.fillStyle = "#888";
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * radius * 0.8, Math.sin(a) * radius * 0.8);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#bbb";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  },
});

// ════════════════════════════════════════════════════════════
// Door
// ════════════════════════════════════════════════════════════
const Door = Drawable({
  name: "Door",
  state: { w: 26, h: 28, color: "#c00" },
  draw: (ctx, s, _c, _fi) => {
    const { x, y, w, h, color } = s;
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, h, 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(150,200,255,0.5)";
    roundRect(ctx, x + 2, y + 2, w - 4, h * 0.35, 2);
    ctx.fill();
    ctx.fillStyle = "#ccc";
    ctx.fillRect(x + w - 8, y + h * 0.45, 6, 3);
  },
});

// ════════════════════════════════════════════════════════════
// Car — position updated via send('move', nx). Children
// (Wheels, Doors) react automatically via computeParts.
// No _childDx hack — reactive children do the work.
// ════════════════════════════════════════════════════════════
const Car = Drawable({
  name: "Car",
  state: {
    bodyW: 110,
    bodyH: 38,
    bodyColor: "#e74c3c",
    roofColor: "#c0392b",
    wheelRadius: 14,
    wheelOffsets: [
      { ox: 20, oy: 38 },
      { ox: 90, oy: 38 },
    ],
    doorOffsets: [
      { ox: 24, oy: 4, w: 26, h: 30 },
      { ox: 56, oy: 4, w: 26, h: 30 },
    ],
    x: 100,
    y: 0,
    speed: 0,
    dir: 1,
  },

  // send('move', nx) — like controlled prop from parent
  // reactive children auto-sync Wheel/Door positions
  update: {
    move: (s, nx) => ({ ...s, x: nx }),
  },

  classes: { Wheel, Door },

  computeParts: (s) => ({
    wheels: s.wheelOffsets.map((wo) => ({
      x: s.x + wo.ox,
      y: s.y + wo.oy,
      radius: s.wheelRadius,
    })),
    doors: s.doorOffsets.map((d) => ({
      x: s.x + d.ox,
      y: s.y + d.oy,
      w: d.w,
      h: d.h,
    })),
  }),

  compose: ({ wheels, doors, html: h }) => [
    ...wheels.map((w) => h`<Wheel x=${w.x} y=${w.y} radius=${w.radius}/>`),
    ...doors.map((d) => h`<Door x=${d.x} y=${d.y} w=${d.w} h=${d.h}/>`),
  ],

  draw: (ctx, s, children, { elapsed }) => {
    if (!s.visible) return;
    const { x, y, bodyW, bodyH, bodyColor, roofColor } = s;
    const w = bodyW,
      h = bodyH;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 8, w * 0.4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = bodyColor;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 6);
    ctx.stroke();
    // Roof
    ctx.fillStyle = roofColor;
    const rx = x + w * 0.18,
      rw = w * 0.52,
      rh = h * 0.55;
    roundRect(ctx, rx, y - rh + 6, rw, rh, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(150,200,255,0.4)";
    ctx.fillRect(rx + 4, y - rh + 10, rw - 8, rh * 0.5);
    // Headlight
    ctx.fillStyle = "#ffe066";
    ctx.beginPath();
    ctx.ellipse(x + w - 3, y + h * 0.25, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(
      x + w + 10,
      y + h * 0.25,
      0,
      x + w + 10,
      y + h * 0.25,
      35,
    );
    g.addColorStop(0, "rgba(255,224,102,0.25)");
    g.addColorStop(1, "rgba(255,224,102,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x + w + 10, y + h * 0.25, 35, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Taillight
    ctx.fillStyle = "#ff3333";
    ctx.beginPath();
    ctx.ellipse(x + 2, y + h * 0.25, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bumpers
    ctx.fillStyle = "#444";
    ctx.fillRect(x + 4, y + h - 3, w - 8, 3);
    ctx.fillRect(x + 4, y, w - 8, 2);
    // Children — already positioned correctly via reactive computeParts
    for (const child of children) {
      if (child && child.draw)
        child.draw(ctx, child.loop.get(), child.children, { elapsed });
    }
  },
});

// ════════════════════════════════════════════════════════════
// Car subclasses — wrappers that override Car params
// ════════════════════════════════════════════════════════════
function RegularCar(props = {}) {
  return Car(props);
}

function SUV(props = {}) {
  return Car({
    bodyW: 125,
    bodyH: 44,
    bodyColor: "#2c3e50",
    roofColor: "#1a252f",
    wheelRadius: 17,
    wheelOffsets: [
      { ox: 22, oy: 44 },
      { ox: 100, oy: 44 },
    ],
    doorOffsets: [
      { ox: 28, oy: 6, w: 28, h: 34 },
      { ox: 60, oy: 6, w: 28, h: 34 },
    ],
    ...props,
  });
}

function Truck(props = {}) {
  return Car({
    bodyW: 170,
    bodyH: 42,
    bodyColor: "#f39c12",
    roofColor: "#e67e22",
    wheelRadius: 16,
    wheelOffsets: [
      { ox: 22, oy: 42 },
      { ox: 105, oy: 42 },
      { ox: 135, oy: 42 },
    ],
    doorOffsets: [
      { ox: 28, oy: 4, w: 26, h: 32 },
      { ox: 58, oy: 4, w: 26, h: 32 },
    ],
    ...props,
  });
}

// ════════════════════════════════════════════════════════════
// Road
// ════════════════════════════════════════════════════════════
const Road = Drawable({
  name: "Road",
  state: { w: 700, h: 300 },
  draw: (ctx, s, _c, _fi) => {
    const { w, h } = s;
    ctx.fillStyle = "#7ec850";
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
    ctx.fillStyle = "#555";
    ctx.fillRect(0, h * 0.6, w, h * 0.32);
    ctx.strokeStyle = "#ff0";
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 15]);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.76);
    ctx.lineTo(w, h * 0.76);
    ctx.stroke();
    ctx.setLineDash([]);
  },
});

// ════════════════════════════════════════════════════════════
// Sky
// ════════════════════════════════════════════════════════════
const Sky = Drawable({
  name: "Sky",
  state: { w: 700, h: 300 },
  draw: (ctx, s, _c, _fi) => {
    const { w, h } = s;
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    sky.addColorStop(0, "#87CEEB");
    sky.addColorStop(1, "#d4eef7");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.55);
  },
});

// ════════════════════════════════════════════════════════════
// Scene — composition with built-in frame timing
// frame: "visual" → auto-rAF, elapsed/delta injected.
// Canvas context auto-resolves from parent <canvas>.
// ════════════════════════════════════════════════════════════
const Scene = Drawable({
  name: "Scene",
  frame: "visual",
  state: { w: 700, h: 300, running: false, speed: 1 },

  classes: { Sky, Road },

  computeParts: (_s) => ({
    actors: [
      { Class: RegularCar, x: 50, y: 140, speed: 0.8 },
      { Class: SUV, x: 50, y: 180, speed: 1.2 },
      { Class: Truck, x: 50, y: 220, speed: 0.5 },
    ],
  }),

  compose: ({ actors, html: h }) => [
    h`<Sky w=${700} h=${300}/>`,
    h`<Road w=${700} h=${300}/>`,
    ...actors.map((a) => h`<${a.Class} x=${a.x} y=${a.y} speed=${a.speed}/>`),
  ],

  // draw() called each frame by built-in rAF loop
  draw: (ctx, s, children, { elapsed }) => {
    const { running, speed, w: cw } = s;

    // Phase 1: update car actors (children with .speed)
    for (const child of children) {
      const cs = child.loop?.get();
      if (!cs || cs.speed == null) continue;

      let nx = cs.x,
        dir = cs.dir;
      if (running) {
        nx = cs.x + cs.speed * speed * dir;
        if (nx > cw - (cs.bodyW || 0) - 20) {
          nx = cw - (cs.bodyW || 0) - 20;
          dir = -dir;
        }
        if (nx < 20) {
          nx = 20;
          dir = -dir;
        }
      }

      if (nx !== cs.x) child.loop.send("move", nx);
      if (dir !== cs.dir) child.loop.set({ ...child.loop.get(), dir });
    }

    // Phase 2: draw all children (Sky, Road, Cars)
    for (const child of children) {
      if (child && child.draw)
        child.draw(ctx, child.loop.get(), child.children, { elapsed });
    }
  },
});

// ════════════════════════════════════════════════════════════
// Register scope for canvas virtual children
// ════════════════════════════════════════════════════════════
registerScope("cars", { scene: Scene, sky: Sky, road: Road });

// ════════════════════════════════════════════════════════════
// CarsApp — fully declarative. No mount. No manual rAF.
// Scene receives running/speed as props via template.
// Canvas context auto-resolved via uploop-containers.
// ════════════════════════════════════════════════════════════
const CarsApp = component("CarsApp", {
  state: { running: false, speed: 1 },
  update: {
    start: (s) => ({ ...s, running: true }),
    stop: (s) => ({ ...s, running: false }),
    setSpeed: (s, v) => ({
      ...s,
      speed: Math.max(0.1, Math.min(5, parseFloat(v) || 1)),
    }),
  },
  view: (state, { send }) => html`
    <div style="font-family:sans-serif;padding:1rem;">
      <div
        style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;"
      >
        <button
          @click=${() => send(state.running ? "stop" : "start")}
          style="padding:0.4rem 1rem;border:none;border-radius:8px;cursor:pointer;
                 background:${state.running
            ? "#ff4444"
            : "#646cff"};color:white;font-size:0.85rem;"
        >
          ${state.running ? "Stop" : "Start"}
        </button>
        <label style="font-size:0.82rem;color:#666;">
          Speed:
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value="${state.speed}"
            @input=${["setSpeed", (e) => e.target.value]}
            style="width:80px;"
          />
        </label>
        <span style="font-size:0.75rem;color:#aaa;">
          frame: "visual" · virtual containers · reactive children</span
        >
      </div>
      <div
        id="cars-container"
        style="border:1px solid #ddd;border-radius:12px;overflow:hidden;"
      >
        <canvas
          width="700"
          height="300"
          uploop-containers="virtual"
          uploop-scope="cars"
          style="width:100%;height:auto;display:block;"
        >
          <scene
            w="700"
            h="300"
            running="${state.running}"
            speed="${state.speed}"
          ></scene>
        </canvas>
      </div>
    </div>
  `,
});

export {
  CarsApp,
  Scene,
  Car,
  RegularCar,
  SUV,
  Truck,
  Wheel,
  Door,
  Road,
  Sky,
  Drawable,
  createComponentType,
};
export default CarsApp;
