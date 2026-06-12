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
          ${count} player${count !== 1 ? "s" : ""} online · Arrow keys to move ·
          Wrap-around map · Eat food to grow
        </p>
        <canvas
          id="slither-canvas"
          width="720"
          height="480"
          style="border:2px solid #222;border-radius:8px;background:#0a0a14;display:block;margin:1rem 0;box-shadow:0 4px 24px rgba(0,0,0,0.4)"
        ></canvas>
        <p style="color:#555;font-size:0.75rem">
          Server tick: 15fps · Client render: 60fps with frame interpolation
        </p>
      </div>
    `;
  },
});

/**
 * External client script tag.
 * Loaded as a static file — same pattern as chess-client.js.
 */
export function slitherClientScript() {
  return `<script src="/public/slither-client.js"></script>`;
}
