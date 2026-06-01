import { html, component, defineElement } from "@uploop/html";

// ════════════════════════════════════════════════════════════
// GridItem — rendered as <u-grid-item> WebComponent
//
// Like the old v0.0.1 GridItem, but using the new API.
// defineElement() registers it as a custom element so it can
// be used declaratively in HTML: <u-grid-item data-title="...">
//
// Composition via WebComponent:
//   html`<u-grid-item data-title="Item" data-content="..."></u-grid-item>`
// ════════════════════════════════════════════════════════════
const GridItem = component("GridItem", {
  state: { title: "Item", content: "", hover: false },
  update: { setHover: (s, h) => ({ ...s, hover: h }) },
  view: (state, { send }) => html`
    <div
      style="padding:1rem;border:1px solid #e0e0e0;border-radius:8px;background:white;
                transition:all 0.2s;cursor:default;box-shadow:0 1px 3px rgba(0,0,0,0.05);
                ${state.hover
        ? "background:#fce4ec;transform:scale(1.03);box-shadow:0 4px 12px rgba(0,0,0,0.1);"
        : ""}"
      @mouseenter=${() => send("setHover", true)}
      @mouseleave=${() => send("setHover", false)}
    >
      <h4 style="margin:0 0 0.4rem;font-size:0.95rem;">${state.title}</h4>
      <p style="margin:0;font-size:0.8rem;color:#666;">${state.content}</p>
    </div>
  `,
});

defineElement("u-grid-item", GridItem);

// ════════════════════════════════════════════════════════════
// GridSearch — rendered inline via `${GridSearch(props)}`
//
// The component is callable: html`${GridSearch(props)}` → renders HTML.
// The onSearch callback is passed so the parent handles search state.
//
// Composition via function call (like old v0.0.1 ${GridSearch(...)}):
//   html`${GridSearch({ query: s, onSearch: (q) => send('search', q) })}`
// ════════════════════════════════════════════════════════════
const GridSearch = component("GridSearch", {
  state: { query: "", onSearch: null },
  view: (state) => html`
    <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
      <input
        .value=${state.query}
        @input=${(e) => {
          const val = e.target.value;
          if (state.onSearch) state.onSearch(val);
        }}
        placeholder="Search items..."
        style="flex:1;padding:0.4rem 0.6rem;border:1px solid #ccc;border-radius:6px;font-size:0.9rem;"
      />
    </div>
  `,
});

// ════════════════════════════════════════════════════════════
// GridExample — root: composes GridSearch + GridItem
//
// Two component composition patterns:
//   Pattern A — Inline function call:  GridSearch(props)
//   Pattern B — WebComponent tag:      GridItem.tag(props)
//
// Both work inside html`...` because:
//   - component() returns a callable descriptor: GridSearch(props) → HTML
//   - defineElement() adds .tag(): GridItem.tag(props) → HTML tag string
//   - html\`...\` embeds string values directly into the template
// ════════════════════════════════════════════════════════════
const GridExample = component("GridExample", {
  state: {
    search: "",
    items: Array.from({ length: 9 }, (_, i) => ({
      id: i,
      title: `Item ${i + 1}`,
      content: `Content cell ${i + 1} — ${Math.random().toString(36).slice(2, 8)}`,
    })),
  },

  update: {
    search: (s, q) => ({ ...s, search: q }),
    refresh: (s) => ({
      search: "",
      items: Array.from({ length: 9 }, (_, i) => ({
        id: i,
        title: `Item ${i + 1}`,
        content: `Content cell ${i + 1} — ${Math.random().toString(36).slice(2, 8)}`,
      })),
    }),
  },

  view: (state, { send }) => {
    const filtered = state.search.trim()
      ? state.items.filter(
          (i) =>
            i.content.toLowerCase().includes(state.search.toLowerCase()) ||
            i.title.toLowerCase().includes(state.search.toLowerCase()),
        )
      : state.items;

    return html`
      <div style="font-family:sans-serif;padding:1rem;">
        <!--
          Pattern A: Component as inline function call.
          GridSearch(props) returns an HTML string via component.render().
          The onSearch callback wires child events back to the parent.
        -->
        <div
          style="border:1px solid #eee;border-radius:8px;padding:0.5rem;margin-bottom:0.5rem;background:#fafafa;"
        >
          <div style="font-size:0.72rem;color:#999;margin-bottom:0.25rem;">
            ▸ GridSearch(props)
          </div>
          ${GridSearch({
            query: state.search,
            onSearch: (q) => send("search", q),
          })}
        </div>

        <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
          <span style="font-size:0.85rem;color:#888;line-height:2rem;">
            ${filtered.length} / ${state.items.length} items
          </span>
          <span style="flex:1;"></span>
          <button
            @click=${() => send("refresh")}
            style="padding:0.3rem 0.8rem;border:1px solid #646cff;border-radius:6px;cursor:pointer;background:white;color:#646cff;font-size:0.82rem;"
          >
            ↻ Refresh
          </button>
        </div>

        <div
          style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;"
        >
          ${filtered.length === 0
            ? html`<div
                style="grid-column:1/-1;text-align:center;padding:2rem;color:#aaa;"
              >
                No items match "${state.search}"
              </div>`
            : filtered.map(
                (item) => html`
                  <!--
                Pattern B: Component as WebComponent tag.
                GridItem.tag(props) returns: <u-grid-item data-title="..." data-content="..."></u-grid-item>
                The WebComponent auto-initializes when connected to the DOM.
              -->
                  <div
                    style="border:1px solid #eee;border-radius:8px;padding:0.25rem;background:#fafafa;"
                  >
                    <div
                      style="font-size:0.65rem;color:#ccc;text-align:right;padding:0 0.25rem 0.15rem;"
                    >
                      &lt;u-grid-item&gt;
                    </div>
                    ${GridItem.tag({
                      title: item.title,
                      content: item.content,
                    })}
                  </div>
                `,
              )}
        </div>

        <p
          style="font-size:0.78rem;color:#aaa;margin-top:0.75rem;text-align:center;"
        >
          Pattern A: <code>GridSearch(props)</code> (callable) &nbsp;·&nbsp;
          Pattern B: <code>&lt;u-grid-item&gt;</code> (WebComponent)
        </p>
      </div>
    `;
  },
});

export { GridExample, GridSearch, GridItem };
export default GridExample;
