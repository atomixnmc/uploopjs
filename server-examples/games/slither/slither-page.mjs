import { component } from "@uploop/core";
import { html } from "@uploop/html";

export const SlitherPage = component("SlitherPage", {
  state: { snakes: {}, food: [], tick: 0, players: 0 },
  view: (s) => {
    const count = Object.values(s.snakes).filter((sn) => sn.alive).length;
    return html`
      <div
        style="max-width:740px;margin:0 auto;padding:1rem;font-family:system-ui"
      >
        <h2>🐍 Slither (Multiplayer)</h2>
        <p style="color:#888;font-size:0.9rem">
          ${count} player${count !== 1 ? "s" : ""} online · Mouse to steer ·
          Double-click fullscreen · Wrap-around map · Eat food to grow
        </p>
        <canvas
          id="slither-canvas"
          width="720"
          height="480"
          style="border:2px solid #222;border-radius:8px;background:#0a0a14;display:block;margin:1rem 0;box-shadow:0 4px 24px rgba(0,0,0,0.4)"
        ></canvas>
        <div
          style="display:flex;gap:0.5rem;align-items:center;margin-top:0.25rem"
        >
          <button
            id="slither-fs-btn"
            onclick="document.getElementById('slither-canvas').requestFullscreen().catch(()=>{})"
            style="padding:0.3rem 0.8rem;background:#333;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:0.75rem"
          >
            ⛶ Fullscreen
          </button>
          <span style="color:#555;font-size:0.7rem"
            >Server 15fps · Client 60fps · Mouse-follow + Arrow keys</span
          >
        </div>
      </div>
    `;
  },
});

/**
 * External client script tag.
 * Loaded as a static file — same pattern as chess-client.js.
 */
export function slitherClientScript() {
  return `<script type="module" src="/public/slither-client.js"></script>`;
}
