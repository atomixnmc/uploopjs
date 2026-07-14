import { html, component, loop } from "@uploop/html";

const initialItems = [
  { id: "alpha", label: "Alpha", count: 1 },
  { id: "beta", label: "Beta", count: 2 },
  { id: "gamma", label: "Gamma", count: 3 },
];

function bumpItem(items, id) {
  return items.map((item) =>
    item.id === id ? { ...item, count: item.count + 1 } : item,
  );
}

export const LoopGraphDemo = component("LoopGraphDemo", {
  state: {
    items: initialItems,
    reversed: false,
  },

  update: {
    bump: (state, id) => ({ ...state, items: bumpItem(state.items, id) }),
    reverse: (state) => ({ ...state, reversed: !state.reversed }),
    reset: (state) => ({ ...state, items: initialItems, reversed: false }),
  },

  view: (state, { send }) => {
    const rows = state.reversed ? [...state.items].reverse() : state.items;
    const keyedRows = loop(
      rows,
      (item) => item.id,
      (item) => html`
        <li
          style="display:grid;grid-template-columns:1fr auto auto;gap:0.5rem;align-items:center;padding:0.65rem 0.75rem;border:1px solid #e3e6ef;border-radius:8px;background:#fff;"
        >
          <strong>${item.label}</strong>
          <span style="font-variant-numeric:tabular-nums;color:#566;">${item.count}</span>
          <button
            @click=${() => send("bump", item.id)}
            style="padding:0.35rem 0.55rem;border:1px solid #ccd3e0;border-radius:6px;background:#f8faff;cursor:pointer;"
          >
            +1
          </button>
        </li>
      `,
    );

    return html`
      <section style="padding:1.25rem;display:grid;gap:1rem;">
        <div>
          <h2 style="margin:0 0 0.35rem;">Loop Graph</h2>
          <p style="margin:0;color:#667;line-height:1.45;">
            Keyed list rendering through <code>loop(items, keyFn, viewFn)</code>.
            Current rendering remains compatible, while keys are available for
            future graph DOM surgery.
          </p>
        </div>

        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button
            @click=${() => send("reverse")}
            style="padding:0.55rem 0.8rem;border:0;border-radius:8px;background:#646cff;color:white;cursor:pointer;"
          >
            Reverse keyed order
          </button>
          <button
            @click=${() => send("reset")}
            style="padding:0.55rem 0.8rem;border:1px solid #ccd3e0;border-radius:8px;background:white;cursor:pointer;"
          >
            Reset
          </button>
        </div>

        <ul style="list-style:none;margin:0;padding:0;display:grid;gap:0.5rem;">
          ${keyedRows}
        </ul>

        <div style="display:grid;gap:0.35rem;padding:0.75rem;border-radius:8px;background:#f4f6fb;color:#3d4658;font-size:0.86rem;">
          <div><strong>loop kind:</strong> ${keyedRows.kind}</div>
          <div><strong>keys:</strong> ${keyedRows.keys.join(", ")}</div>
          <div><strong>entries:</strong> ${String(keyedRows.entries.length)}</div>
        </div>
      </section>
    `;
  },
});
