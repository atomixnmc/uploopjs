import { html, component } from "@uploop/html";

const SEGMENTS = [
  { label: "🎉 Prize 1", color: "#ff6b6b", weight: 1 },
  { label: "⭐ Prize 2", color: "#feca57", weight: 2 },
  { label: "🎁 Prize 3", color: "#48dbfb", weight: 3 },
  { label: "💎 Prize 4", color: "#ff9ff3", weight: 1 },
  { label: "🍀 Prize 5", color: "#54a0ff", weight: 2 },
  { label: "🏆 Prize 6", color: "#5f27cd", weight: 1 },
  { label: "🎯 Prize 7", color: "#01a3a4", weight: 3 },
  { label: "🌟 Prize 8", color: "#f368e0", weight: 2 },
];

// ─── LuckyWheel Component ───────────────────────────────────
//
// Animation design: The wheel SVG is painted ONCE on mount.
// During spin, we animate the SVG element's style.transform
// DIRECTLY via requestAnimationFrame — no state changes, no
// re-renders, no DOM replacement. Only the final result is
// committed to state. This avoids:
//   • Stack overflow from send() → event → send() loops
//   • 60fps innerHTML replacement destroying the SVG each frame
//
// State only tracks: spinning flag, final result, history.
const LuckyWheel = component("LuckyWheel", {
  state: {
    spinning: false,
    result: null,
    history: [],
  },

  update: {
    // Called ONCE when user clicks Spin.
    // Returns new state (triggers one re-render for the button).
    spin: (s) => (s.spinning ? s : { ...s, spinning: true, result: null }),

    // Called ONCE when animation completes.
    // Computes which segment was landed on, stores result.
    done: (s) => {
      const angle = s._finalAngle || 0;
      const normalized = ((angle % 360) + 360) % 360;
      const segAngle = 360 / SEGMENTS.length;
      const idx = Math.floor(normalized / segAngle);
      const result = SEGMENTS[SEGMENTS.length - 1 - idx];
      return {
        ...s,
        spinning: false,
        result: result?.label || "Try again!",
        _finalAngle: undefined,
        history: [result?.label || "?", ...s.history].slice(0, 10),
      };
    },

    // Stores the final angle so `done` can compute the result.
    _finalize: (s, angle) => ({ ...s, _finalAngle: angle }),
  },

  view: (state, { send }) => html`
    <div style="font-family:sans-serif;padding:1.5rem;text-align:center;">
      <div style="position:relative;display:inline-block;margin-bottom:1rem;">
        <!-- Pointer (triangle at top) -->
        <div
          style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);
                    width:0;height:0;border-left:15px solid transparent;
                    border-right:15px solid transparent;border-top:25px solid #333;z-index:10;"
        ></div>

        <!-- Wheel container — we animate the SVG's transform directly in mount hook -->
        <div
          id="lucky-wheel-container"
          style="border-radius:50%;overflow:hidden;"
        >
          <svg
            id="lucky-wheel-svg"
            width="280"
            height="280"
            viewBox="0 0 280 280"
            style="transform:rotate(0deg);display:block;transition:none;"
          >
            <circle cx="140" cy="140" r="130" fill="#333" />
            ${SEGMENTS.map((seg, i) => {
              const startAngle = (i / SEGMENTS.length) * 360;
              const endAngle = ((i + 1) / SEGMENTS.length) * 360;
              const midAngle = (((startAngle + endAngle) / 2) * Math.PI) / 180;
              const x1 = 140 + 130 * Math.cos((startAngle * Math.PI) / 180);
              const y1 = 140 + 130 * Math.sin((startAngle * Math.PI) / 180);
              const x2 = 140 + 130 * Math.cos((endAngle * Math.PI) / 180);
              const y2 = 140 + 130 * Math.sin((endAngle * Math.PI) / 180);
              const largeArc = endAngle - startAngle > 180 ? 1 : 0;
              const tx = 140 + 85 * Math.cos(midAngle);
              const ty = 140 + 85 * Math.sin(midAngle);
              return html`
                <path
                  d="M140,140 L${x1},${y1} A130,130 0 ${largeArc},1 ${x2},${y2} Z"
                  fill="${seg.color}"
                  stroke="#222"
                  stroke-width="1"
                />
                <text
                  x="${tx}"
                  y="${ty}"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  fill="white"
                  font-size="11"
                  font-weight="bold"
                  transform="rotate(${(startAngle + endAngle) /
                  2}, ${tx}, ${ty})"
                >
                  ${seg.label}
                </text>
              `;
            })}
            <circle cx="140" cy="140" r="20" fill="#222" />
            <circle cx="140" cy="140" r="12" fill="#666" />
          </svg>
        </div>
      </div>

      <div style="margin-bottom:1rem;">
        <button
          @click=${() => send("spin")}
          style="padding:0.8rem 2.5rem;font-size:1.2rem;font-weight:bold;
                 border:none;border-radius:12px;cursor:pointer;
                 background:${state.spinning ? "#ccc" : "#646cff"};
                 color:${state.spinning ? "#888" : "white"};
                 ${state.spinning ? "cursor:not-allowed;" : ""}
                 box-shadow:0 4px 6px rgba(0,0,0,0.1);
                 transition:all 0.2s;"
        >
          ${state.spinning ? "Spinning..." : "🎡 Spin!"}
        </button>
      </div>

      ${state.result
        ? html`
            <div
              style="font-size:1.3rem;font-weight:bold;color:#333;padding:0.5rem 1rem;background:#f0f8ff;border-radius:8px;display:inline-block;"
            >
              ${state.result}
            </div>
          `
        : html`
            <div style="font-size:0.9rem;color:#aaa;">
              Click Spin to try your luck!
            </div>
          `}
      ${state.history.length > 0
        ? html`
            <div
              style="margin-top:1rem;max-width:300px;margin-left:auto;margin-right:auto;"
            >
              <div style="font-size:0.8rem;color:#888;margin-bottom:0.3rem;">
                History
              </div>
              ${state.history.map(
                (h) => html`
                  <div
                    style="font-size:0.85rem;padding:0.15rem 0;border-bottom:1px solid #f0f0f0;"
                  >
                    ${h}
                  </div>
                `,
              )}
            </div>
          `
        : ""}
    </div>
  `,

  mount: (el) => {
    let animId = null;

    // Subscribe to state changes → when spinning becomes true, start animation
    const unsub = LuckyWheel.loop.subscribe((state) => {
      if (state.spinning && !animId) {
        startSpin(el);
      }
    });

    function startSpin(root) {
      const svg = root.querySelector("#lucky-wheel-svg");
      if (!svg) return;

      const DURATION = 3000;
      const TOTAL_SPIN = 1800 + Math.random() * 720; // 5–7 full rotations
      const startTime = performance.now();
      const startAngle = 0;

      function animate(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / DURATION, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const angle = startAngle + TOTAL_SPIN * eased;

        // Direct DOM update — no re-render, no state change
        svg.style.transform = `rotate(${angle}deg)`;

        if (progress < 1) {
          animId = requestAnimationFrame(animate);
        } else {
          animId = null;
          // Store final angle, then call done
          LuckyWheel.loop.send("_finalize", angle);
          LuckyWheel.loop.send("done");
          // On completion, reset SVG to 0deg (state holds the result angle)
          svg.style.transform = "rotate(0deg)";
        }
      }

      animId = requestAnimationFrame(animate);
    }

    return () => {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      unsub();
    };
  },
});

export { LuckyWheel };
export default LuckyWheel;
