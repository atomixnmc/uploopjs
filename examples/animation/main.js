/**
 * Animation Example — State-driven CSS animations
 *
 * Demonstrates:
 *   • CSS transitions driven by component state changes
 *   • Keyframe animations triggered by events
 *   • Spring-like easing with state interpolation
 *   • Canvas-based animation (particles)
 *   • Frame-scheduled draw loop
 */

import { html, component } from "@uploop/html";
import { createLoop } from "@uploop/core";

// ── Bouncing ball (Canvas) ───────────────────────────────

export const BouncingBall = component("BouncingBall", {
  state: {
    x: 150,
    y: 100,
    vx: 2,
    vy: 1.5,
    color: "#646cff",
    size: 20,
    paused: false,
  },

  update: {
    togglePause: (s) => ({ paused: !s.paused }),

    changeColor: (s) => {
      const colors = ["#646cff", "#ff4444", "#44cc44", "#ffaa00", "#ff44aa"];
      const idx = colors.indexOf(s.color);
      return { color: colors[(idx + 1) % colors.length] };
    },

    bigger: (s) => ({ size: Math.min(s.size + 10, 80) }),
    smaller: (s) => ({ size: Math.max(s.size - 10, 10) }),
  },

  view: (state, { send }) => html`
    <div
      style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:1rem;text-align:center;"
    >
      <h2>🏀 Bouncing Ball</h2>
      <p style="color:#888;font-size:0.85rem;">
        Canvas-based animation with frame-scheduled draw loop
      </p>

      <canvas
        id="ball-canvas"
        width="300"
        height="250"
        style="border:2px solid #eee;border-radius:8px;background:#fafafa;display:block;margin:0 auto;"
      >
      </canvas>

      <div
        style="display:flex;gap:0.5rem;justify-content:center;margin-top:0.75rem;flex-wrap:wrap;"
      >
        <button
          @click=${() => send("togglePause")}
          style="padding:0.3rem 0.75rem;background:${state.paused
            ? "#4caf50"
            : "#f44336"};color:#fff;border:none;border-radius:4px;cursor:pointer;"
        >
          ${state.paused ? "▶ Play" : "⏸ Pause"}
        </button>
        <button
          @click=${() => send("changeColor")}
          style="padding:0.3rem 0.75rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer;"
        >
          🎨 Color
        </button>
        <button
          @click=${() => send("bigger")}
          style="padding:0.3rem 0.75rem;background:#4caf50;color:#fff;border:none;border-radius:4px;cursor:pointer;"
        >
          + Size
        </button>
        <button
          @click=${() => send("smaller")}
          style="padding:0.3rem 0.75rem;background:#ff9800;color:#fff;border:none;border-radius:4px;cursor:pointer;"
        >
          − Size
        </button>
      </div>
    </div>
  `,

  // Canvas draw loop
  draw: (ctx, state) => {
    if (state.paused) {
      // Draw paused state
      ctx.clearRect(0, 0, 300, 250);
      ctx.fillStyle = state.color;
      ctx.beginPath();
      ctx.arc(state.x, state.y, state.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#888";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⏸ Paused", 150, 230);
      return;
    }

    // Physics update
    let { x, y, vx, vy, size } = state;
    x += vx;
    y += vy;

    // Bounce off walls
    if (x - size < 0 || x + size > 300) {
      vx = -vx;
      x = Math.max(size, Math.min(300 - size, x));
    }
    if (y - size < 0 || y + size > 220) {
      vy = -vy;
      y = Math.max(size, Math.min(220 - size, y));
    }

    // Write back
    state.x = x;
    state.y = y;
    state.vx = vx;
    state.vy = vy;

    // Draw
    ctx.clearRect(0, 0, 300, 250);

    // Trail
    ctx.fillStyle = state.color + "20";
    ctx.beginPath();
    ctx.arc(x, y, size + 5, 0, Math.PI * 2);
    ctx.fill();

    // Ball
    ctx.fillStyle = state.color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = "#ffffff44";
    ctx.beginPath();
    ctx.arc(x - size * 0.25, y - size * 0.25, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  },

  frame: "visual", // Use rAF for smooth animation
});

// ── CSS Transition demo (scale + fade) ───────────────────

export const TransitionDemo = component("TransitionDemo", {
  state: { scale: 1, opacity: 1, x: 0, rotation: 0 },
  frame: "visual", // prevent innerHTML on state change — we update DOM manually

  update: {
    grow: (s) => ({ scale: Math.min(s.scale + 0.3, 2.5) }),
    shrink: (s) => ({ scale: Math.max(s.scale - 0.3, 0.5) }),
    fadeOut: (s) => ({ opacity: Math.max(s.opacity - 0.2, 0.1) }),
    fadeIn: (s) => ({ opacity: Math.min(s.opacity + 0.2, 1) }),
    moveRight: (s) => ({ x: s.x + 50 }),
    moveLeft: (s) => ({ x: s.x - 50 }),
    spin: (s) => ({ rotation: s.rotation + 90 }),
    reset: () => ({ scale: 1, opacity: 1, x: 0, rotation: 0 }),
  },

  // Static view — no state-dependent attrs (styles applied via mount hook)
  view: () => html`
    <div
      style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:1rem;text-align:center;"
    >
      <h2>✨ CSS Transitions</h2>
      <p style="color:#888;font-size:0.85rem;">
        State-driven CSS transitions — DOM element persists across renders
      </p>
      <div
        style="display:flex;justify-content:center;align-items:center;height:200px;margin:1rem 0;"
      >
        <div
          id="trans-box"
          style="width:80px;height:80px;background:#646cff;border-radius:12px;transition:all 0.4s cubic-bezier(0.25,0.8,0.25,1.2);"
        ></div>
      </div>
      <div
        id="trans-btns"
        style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin:1rem 0;"
      >
        <button
          data-action="grow"
          style="padding:0.3rem;background:#4caf50;color:#fff;border:none;border-radius:4px;cursor:pointer;"
        >
          Grow
        </button>
        <button
          data-action="shrink"
          style="padding:0.3rem;background:#f44336;color:#fff;border:none;border-radius:4px;cursor:pointer;"
        >
          Shrink
        </button>
        <button
          data-action="spin"
          style="padding:0.3rem;background:#ff9800;color:#fff;border:none;border-radius:4px;cursor:pointer;"
        >
          Spin
        </button>
        <button
          data-action="fadeIn"
          style="padding:0.3rem;background:#2196f3;color:#fff;border:none;border-radius:4px;cursor:pointer;"
        >
          Fade In
        </button>
        <button
          data-action="fadeOut"
          style="padding:0.3rem;background:#9c27b0;color:#fff;border:none;border-radius:4px;cursor:pointer;"
        >
          Fade Out
        </button>
        <button
          data-action="moveRight"
          style="padding:0.3rem;background:#00bcd4;color:#fff;border:none;border-radius:4px;cursor:pointer;"
        >
          → Move
        </button>
        <button
          data-action="moveLeft"
          style="padding:0.3rem;background:#00bcd4;color:#fff;border:none;border-radius:4px;cursor:pointer;"
        >
          ← Move
        </button>
        <button
          data-action="reset"
          style="padding:0.3rem;background:#607d8b;color:#fff;border:none;border-radius:4px;cursor:pointer;grid-column:span 2;"
        >
          Reset
        </button>
      </div>
      <div id="trans-debug" style="font-size:0.75rem;color:#888;"></div>
    </div>
  `,

  mount: (el, ctx) => {
    const box = el.querySelector("#trans-box");
    const debug = el.querySelector("#trans-debug");
    if (!box) return;

    const update = (s) => {
      box.style.transform = `scale(${s.scale}) translateX(${s.x}px) rotate(${s.rotation}deg)`;
      box.style.opacity = s.opacity;
      if (debug)
        debug.textContent = `scale: ${s.scale.toFixed(1)} · opacity: ${s.opacity.toFixed(1)} · x: ${s.x}px · rot: ${s.rotation}°`;
    };
    update(ctx.get());

    // Event delegation on buttons — survives innerHTML replacement
    const btns = el.querySelector("#trans-btns");
    if (btns) {
      btns.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (btn) ctx.send(btn.dataset.action);
      });
    }

    // Subscribe to state changes, update styles directly (DOM persists)
    return ctx.loop.subscribe((s) => update(s));
  },
});

// ── Keyframe animation demo ──────────────────────────────

export const KeyframeDemo = component("KeyframeDemo", {
  state: {
    animating: false,
    animationName: "bounce",
  },

  update: {
    bounce: (s) => ({ animating: true, animationName: "bounce" }),
    shake: (s) => ({ animating: true, animationName: "shake" }),
    pulse: (s) => ({ animating: true, animationName: "pulse" }),
    flip: (s) => ({ animating: true, animationName: "flip" }),
    stop: (s) => ({ animating: false }),
  },

  view: (state, { send }) => {
    // Generate keyframes dynamically
    const keyframes = {
      bounce: `
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-30px); }
        }
      `,
      shake: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
      `,
      pulse: `
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }
      `,
      flip: `
        @keyframes flip {
          0% { transform: perspective(200px) rotateY(0); }
          100% { transform: perspective(200px) rotateY(360deg); }
        }
      `,
    };

    const animStyle = state.animating
      ? `animation: ${state.animationName} 0.6s ease infinite;`
      : "";

    return html`
      <div
        style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:1rem;text-align:center;"
      >
        <h2>🎬 Keyframe Animations</h2>
        <p style="color:#888;font-size:0.85rem;">
          Dynamic @keyframes injected via style tag
        </p>

        <!-- Injected style -->
        <style>
          ${keyframes[state.animationName] || ""}
        </style>

        <!-- Animated element -->
        <div
          style="display:flex;justify-content:center;align-items:center;height:120px;"
        >
          <div
            style="
            width:60px;height:60px;background:linear-gradient(135deg,#646cff,#ff44aa);border-radius:12px;
            ${animStyle}
          "
          ></div>
        </div>

        <!-- Controls -->
        <div
          style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;"
        >
          <button
            @click=${() => send("bounce")}
            style="padding:0.3rem 0.75rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer;"
          >
            Bounce
          </button>
          <button
            @click=${() => send("shake")}
            style="padding:0.3rem 0.75rem;background:#ff4444;color:#fff;border:none;border-radius:4px;cursor:pointer;"
          >
            Shake
          </button>
          <button
            @click=${() => send("pulse")}
            style="padding:0.3rem 0.75rem;background:#44cc44;color:#fff;border:none;border-radius:4px;cursor:pointer;"
          >
            Pulse
          </button>
          <button
            @click=${() => send("flip")}
            style="padding:0.3rem 0.75rem;background:#ffaa00;color:#fff;border:none;border-radius:4px;cursor:pointer;"
          >
            Flip
          </button>
          <button
            @click=${() => send("stop")}
            style="padding:0.3rem 0.75rem;background:#607d8b;color:#fff;border:none;border-radius:4px;cursor:pointer;"
          >
            Stop
          </button>
        </div>
      </div>
    `;
  },
});

// ── Combined Animation Demo ──────────────────────────────

export const AnimationDemo = component("AnimationDemo", {
  state: { tab: "ball" },

  update: {
    switch: (s, tab) => ({ ...s, tab }),
  },

  view: (state, { send }) => html`
    <div
      style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:1rem;"
    >
      <h2>🎨 Uploop Animation Demo</h2>

      <div
        style="display:flex;gap:0.5rem;margin:1rem 0;border-bottom:2px solid #eee;padding-bottom:0.5rem;"
      >
        <button
          @click=${() => send("switch", "ball")}
          style="padding:0.3rem 0.75rem;border:1px solid #ccc;border-radius:4px;cursor:pointer;
            background:${state.tab === "ball" ? "#646cff" : "transparent"};
            color:${state.tab === "ball" ? "white" : "inherit"};"
        >
          🏀 Canvas
        </button>
        <button
          @click=${() => send("switch", "transition")}
          style="padding:0.3rem 0.75rem;border:1px solid #ccc;border-radius:4px;cursor:pointer;
            background:${state.tab === "transition"
            ? "#646cff"
            : "transparent"};
            color:${state.tab === "transition" ? "white" : "inherit"};"
        >
          ✨ Transitions
        </button>
        <button
          @click=${() => send("switch", "keyframe")}
          style="padding:0.3rem 0.75rem;border:1px solid #ccc;border-radius:4px;cursor:pointer;
            background:${state.tab === "keyframe" ? "#646cff" : "transparent"};
            color:${state.tab === "keyframe" ? "white" : "inherit"};"
        >
          🎬 Keyframes
        </button>
      </div>

      <div id="anim-sub-container"></div>
    </div>
  `,

  mount: (el, ctx) => {
    let inst = null,
      unmountFn = null,
      lastTab = null;

    function applyTab() {
      const s = ctx.get();
      console.log("[anim applyTab]", s.tab, "loop", !!ctx.loop);
      if (s.tab === lastTab) return;
      lastTab = s.tab;
      if (unmountFn) {
        unmountFn();
        unmountFn = null;
        inst = null;
      }
      const container = el.querySelector("#anim-sub-container");
      if (!container) return;
      container.innerHTML = "";
      if (s.tab === "ball") {
        inst = BouncingBall.create();
        unmountFn = inst.mount(container);
      } else if (s.tab === "transition") {
        inst = TransitionDemo.create();
        unmountFn = inst.mount(container);
      } else if (s.tab === "keyframe") {
        inst = KeyframeDemo.create();
        unmountFn = inst.mount(container);
      }
    }

    applyTab();
    const unsub = ctx.loop?.subscribe(() => applyTab());
    const onTabClick = (e) => {
      if (e.target.closest("button")) setTimeout(() => applyTab(), 0);
    };
    el.addEventListener("click", onTabClick);
    const observer = new MutationObserver(() => {
      lastTab = null; // fallback for external container replacement
      applyTab();
    });
    observer.observe(el, { childList: true, subtree: false });
    return () => {
      unsub?.();
      el.removeEventListener("click", onTabClick);
      observer.disconnect();
      if (unmountFn) unmountFn();
    };
  },
});

export default AnimationDemo;
