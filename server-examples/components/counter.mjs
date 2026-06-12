import { component } from "@uploop/core";
import { html } from "@uploop/html";

export const Counter = component("Counter", {
  state: { count: 0 },
  update: {
    inc: (s) => ({ count: s.count + 1 }),
    dec: (s) => ({ count: s.count - 1 }),
    reset: () => ({ count: 0 }),
  },
  view: (s) => html`
    <div style="text-align:center;padding:2rem">
      <h2>SSR Counter</h2>
      <div
        id="count-display"
        style="font-size:4rem;font-weight:bold;margin:1rem 0;color:#646cff"
      >
        ${s.count}
      </div>
      <div style="display:flex;gap:0.5rem;justify-content:center">
        <button
          id="btn-dec"
          style="padding:0.5rem 1.5rem;font-size:1.2rem;cursor:pointer;border:1px solid #ccc;border-radius:8px"
        >
          -1
        </button>
        <button
          id="btn-inc"
          style="padding:0.5rem 1.5rem;font-size:1.2rem;cursor:pointer;background:#646cff;color:white;border:none;border-radius:8px"
        >
          +1
        </button>
      </div>
      <button
        id="btn-reset"
        style="margin-top:0.5rem;padding:0.3rem 1rem;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:transparent"
      >
        Reset
      </button>
      <p style="color:#888;font-size:0.75rem;margin-top:1rem">
        Rendered on server · Hot reload enabled
      </p>
    </div>
  `,
});

export function counterClientScript(initialCount = 0) {
  return `<script>
let count = ${initialCount}
function update() { document.getElementById('count-display').textContent = count }
document.getElementById('btn-inc').onclick = () => { count++; update() }
document.getElementById('btn-dec').onclick = () => { count--; update() }
document.getElementById('btn-reset').onclick = () => { count = 0; update() }
</script>`;
}
