import { html, component } from "@uploop/html";

// ─── Paint Component ────────────────────────────────────────
//
// The canvas lives OUTSIDE the view template. On re-render,
// innerHTML destroys it. The persistent resource system handles
// this via save/restore.
//
// Two key design decisions to avoid bugs:
//
// 1. Size slider uses `value="${state.size}"` (HTML attribute)
//    instead of `.value=${state.size}` (property binding).
//    Reason: innerHTML recreates the input. An HTML attribute
//    sets the correct position on creation. Property bindings
//    run after innerHTML, causing the slider to jump.
//
// 2. Canvas restore sets the container's CSS background-image
//    to the saved dataUrl SYNCHRONOUSLY, before the async
//    Image.onload fires. This prevents a white flash between
//    canvas creation and image decode. On image load, the CSS
//    background is cleared and the canvas takes over.
//
const Paint = component("Paint", {
  state: {
    color: "#646cff",
    size: 8,
    tool: "brush",
  },

  update: {
    setColor: (s, color) => ({ ...s, color }),
    setSize: (s, size) => ({ ...s, size }),
    setTool: (s, tool) => ({ ...s, tool }),
    clear: () => {
      const c = document.getElementById("paint-canvas");
      if (c) {
        const ctx = c.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, c.width, c.height);
      }
      return { color: "#646cff", size: 8, tool: "brush" };
    },
  },

  view: (state, { send }) => html`
    <div style="font-family:sans-serif;padding:1rem;user-select:none;">
      <div
        style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-bottom:0.75rem;"
      >
        <input
          type="color"
          .value=${state.color}
          @input=${["setColor", (e) => e.target.value]}
          style="width:40px;height:40px;border:none;cursor:pointer;padding:0;"
        />
        <!--
          NOTE: value="${state.size}" is an HTML ATTRIBUTE, not a property binding.
          This ensures the slider starts at the correct position after innerHTML
          recreation. Property bindings (.value=) run asynchronously and cause
          the slider to jump when the user is dragging it.
        -->
        <input
          type="range"
          min="2"
          max="30"
          value="${state.size}"
          @input=${["setSize", (e) => parseInt(e.target.value)]}
          style="width:100px;"
        />
        <span style="font-size:0.8rem;color:#666;">${state.size}px</span>
        ${["brush", "eraser"].map(
          (t) => html`
            <button
              @click=${() => send("setTool", t)}
              style="padding:0.3rem 0.7rem;border:2px solid ${state.tool === t
                ? "#646cff"
                : "#ddd"};border-radius:6px;
                   cursor:pointer;background:${state.tool === t
                ? "#eef"
                : "white"};font-size:0.85rem;"
            >
              ${t === "brush" ? "✏️ Brush" : "🧹 Eraser"}
            </button>
          `,
        )}
        <span style="flex:1;"></span>
        <button
          @click=${() => send("clear")}
          style="padding:0.3rem 0.7rem;border:1px solid #ff4444;border-radius:6px;cursor:pointer;background:#fff0f0;color:#cc0000;font-size:0.85rem;"
        >
          🗑 Clear
        </button>
      </div>
      <div
        id="paint-container"
        style="border:1px solid #ccc;border-radius:8px;overflow:hidden;background:white;background-size:cover;touch-action:none;"
      ></div>
    </div>
  `,

  mount: (el, ctx) => {
    let activeListeners = [];

    function createCanvas(container) {
      const canvas = document.createElement("canvas");
      canvas.id = "paint-canvas";
      canvas.width = 600;
      canvas.height = 350;
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.style.display = "block";
      canvas.style.cursor = "crosshair";
      container.appendChild(canvas);

      const ctx2d = canvas.getContext("2d");
      ctx2d.lineCap = "round";
      ctx2d.lineJoin = "round";

      let drawing = false;
      let lastX = 0,
        lastY = 0;

      function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scX = canvas.width / rect.width;
        const scY = canvas.height / rect.height;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (cx - rect.left) * scX, y: (cy - rect.top) * scY };
      }

      function onStart(e) {
        e.preventDefault();
        drawing = true;
        const p = getPos(e);
        lastX = p.x;
        lastY = p.y;
      }
      function onMove(e) {
        e.preventDefault();
        if (!drawing) return;
        const p = getPos(e);
        const s = Paint.loop.get();
        ctx2d.strokeStyle = s.tool === "eraser" ? "white" : s.color;
        ctx2d.lineWidth = s.size;
        ctx2d.beginPath();
        ctx2d.moveTo(lastX, lastY);
        ctx2d.lineTo(p.x, p.y);
        ctx2d.stroke();
        lastX = p.x;
        lastY = p.y;
      }
      function onStop(e) {
        e.preventDefault();
        drawing = false;
      }

      const listeners = [
        ["mousedown", onStart],
        ["mousemove", onMove],
        ["mouseup", onStop],
        ["mouseleave", onStop],
        ["touchstart", onStart, { passive: false }],
        ["touchmove", onMove, { passive: false }],
        ["touchend", onStop, { passive: false }],
      ];
      for (const [ev, fn, opts] of listeners)
        canvas.addEventListener(ev, fn, opts);
      activeListeners = listeners.map(([ev, fn]) => ({ ev, fn }));

      return { canvas, ctx2d };
    }

    // ── Initial mount (reuse canvas if restored by resource mechanism) ──
    const container = el.querySelector("#paint-container");
    if (!container) return;
    let existing = container.querySelector("#paint-canvas");
    if (!existing) {
      const { canvas, ctx2d } = createCanvas(container);
      ctx2d.fillStyle = "white";
      ctx2d.fillRect(0, 0, canvas.width, canvas.height);
    }

    // ── Register persistent resource ──
    ctx.registerResource("paint-canvas", {
      save: () => {
        const c = document.getElementById("paint-canvas");
        return c ? c.toDataURL() : null;
      },
      restore: (dataUrl) => {
        const cont = el.querySelector("#paint-container");
        if (!cont) return;
        const old = cont.querySelector("#paint-canvas");
        if (old) old.remove();

        // Show saved image as container CSS background IMMEDIATELY (sync).
        // This prevents white flash while the Image loads asynchronously.
        if (dataUrl) {
          cont.style.backgroundImage = `url(${dataUrl})`;
          cont.style.backgroundSize = "cover";
        }

        const { canvas: newCanvas, ctx2d: newCtx } = createCanvas(cont);

        if (dataUrl) {
          const img = new Image();
          img.onload = () => {
            newCtx.drawImage(img, 0, 0);
            // Clear CSS background — canvas now shows the image
            cont.style.backgroundImage = "";
          };
          img.src = dataUrl;
        } else {
          newCtx.fillStyle = "white";
          newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);
        }
      },
    });

    return () => {
      for (const { ev, fn } of activeListeners) {
        const c = document.getElementById("paint-canvas");
        if (c) c.removeEventListener(ev, fn);
      }
      activeListeners = [];
    };
  },
});

export { Paint };
export default Paint;
