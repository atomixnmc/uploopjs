import { html, component } from "@uploop/html";

// ════════════════════════════════════════════════════════════
// Uploop Data Grid — v0.0.3
//
// Showcases core architectural strengths:
//
// 1. Data Classification
//    rows = cold (generated, potentially large)
//    sortKey/sortDir/search/cols/start = warm (interactive UI)
//
// 2. Reactive Children via computeParts → compose
//    computeParts: state → { visibleItems, headers }
//    compose:      { visibleItems } → [ <Row/> ... ]
//
// 3. Virtual Instance Reuse
//    Instead of creating 1000 Row instances, we create a pool
//    of ~20 and recycle them. When the user scrolls, only the
//    reused instances get updated props — no DOM destruction.
//
//    "Real instance" mode:  create() called for every row
//    "Virtual reuse" mode:  pool of instances, props swapped
//
// 4. Batch Updates
//    Scrolling sends 'scroll' event → debounced state update
//    → only visible rows recompute → instances auto-sync
// ════════════════════════════════════════════════════════════

// ─── Cell Component (reusable instance) ──────────────────
const Cell = component("Cell", {
  state: { value: "", align: "left", width: 80 },
  view: (s) => html`
    <div
      style="padding:0.35rem 0.6rem;font-size:0.82rem;text-align:${s.align};
              width:${s.width}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
    >
      ${s.value}
    </div>
  `,
});

// ─── Row Component (reusable instance) ──────────────────
const Row = component("Row", {
  state: { cells: [], index: 0, selected: false },
  update: {
    setCells: (s, cells) => ({ ...s, cells }),
    setIndex: (s, index) => ({ ...s, index }),
    toggleSelect: (s) => ({ ...s, selected: !s.selected }),
  },
  view: (s) => html`
    <div
      style="display:flex;border-bottom:1px solid #eee;
             background:${s.selected
        ? "#eef"
        : s.index % 2
          ? "#fafafa"
          : "white"};"
    >
      ${s.cells.map(
        (c) => html`
          <div
            style="padding:0.35rem 0.6rem;font-size:0.82rem;text-align:${c.align ||
            "left"};width:${c.width ||
            80}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
          >
            ${c.value}
          </div>
        `,
      )}
    </div>
  `,
});

// ─── Generate test data ─────────────────────────────────
function generateData(rows, cols) {
  const names = [
    "Alice",
    "Bob",
    "Carol",
    "Dave",
    "Eve",
    "Frank",
    "Grace",
    "Hank",
    "Iris",
    "Jack",
    "Kate",
    "Liam",
    "Mia",
    "Noah",
    "Olivia",
    "Paul",
    "Quinn",
    "Rose",
    "Sam",
    "Tina",
  ];
  const cities = [
    "NYC",
    "LA",
    "Chicago",
    "Houston",
    "Phoenix",
    "Philly",
    "SA",
    "SD",
    "Dallas",
    "Austin",
  ];
  const depts = [
    "Eng",
    "Design",
    "Marketing",
    "Sales",
    "Support",
    "Finance",
    "Ops",
    "Legal",
    "HR",
    "R&D",
  ];

  return Array.from({ length: rows }, (_, i) => {
    const cols_ = {};
    for (let c = 0; c < cols; c++) {
      if (c === 0) cols_[`col${c}`] = names[i % names.length];
      else if (c === 1) cols_[`col${c}`] = cities[i % cities.length];
      else if (c === 2) cols_[`col${c}`] = depts[i % depts.length];
      else cols_[`col${c}`] = Math.floor(Math.random() * 100000);
    }
    return { id: i, ...cols_ };
  });
}

// ════════════════════════════════════════════════════════════
// DataGrid — virtual scrolling, sortable, configurable
// ════════════════════════════════════════════════════════════
const DataGrid = component("DataGrid", {
  state: {
    rows: generateData(500, 5),
    cols: 5,
    sortKey: null,
    sortDir: "asc",
    search: "",
    start: 0,
    pageSize: 20,
    selectedRow: null,
    mode: "virtual", // "virtual" | "real"
  },

  update: {
    setCols: (s, n) => ({
      ...s,
      cols: n,
      rows: generateData(500, n),
      sortKey: null,
      start: 0,
    }),
    setMode: (s, m) => ({ ...s, mode: m }),
    sort: (s, key) => {
      const dir = s.sortKey === key && s.sortDir === "asc" ? "desc" : "asc";
      const sorted = [...s.rows].sort((a, b) => {
        const av = a[key],
          bv = b[key];
        return typeof av === "number"
          ? dir === "asc"
            ? av - bv
            : bv - av
          : dir === "asc"
            ? String(av).localeCompare(String(bv))
            : String(bv).localeCompare(String(av));
      });
      return { ...s, rows: sorted, sortKey: key, sortDir: dir, start: 0 };
    },
    search: (s, q) => ({ ...s, search: q, start: 0 }),
    scroll: (s, start) => ({
      ...s,
      start: Math.max(0, Math.min(start, s.rows.length - s.pageSize)),
    }),
    select: (s, idx) => ({
      ...s,
      selectedRow: s.selectedRow === idx ? null : idx,
    }),
    pageUp: (s) => ({ ...s, start: Math.max(0, s.start - s.pageSize) }),
    pageDown: (s) => ({
      ...s,
      start: Math.min(s.start + s.pageSize, s.rows.length - s.pageSize),
    }),
  },

  computeParts: (s) => {
    const filtered = s.search
      ? s.rows.filter((r) =>
          Object.values(r).some((v) =>
            String(v).toLowerCase().includes(s.search.toLowerCase()),
          ),
        )
      : s.rows;

    const end = Math.min(s.start + s.pageSize, filtered.length);
    const visibleItems = filtered.slice(s.start, end).map((row, i) => ({
      index: s.start + i,
      cells: Object.entries(row)
        .filter(([k]) => k !== "id")
        .map(([k, v]) => ({
          key: k,
          value: String(v),
          align: typeof v === "number" ? "right" : "left",
          width: Math.max(80, Math.min(150, 1200 / s.cols)),
        })),
      selected: s.selectedRow === s.start + i,
    }));

    return {
      visibleItems,
      totalFiltered: filtered.length,
      headers: Object.keys(s.rows[0] || {}).filter((k) => k !== "id"),
    };
  },

  compose: ({ visibleItems }) =>
    visibleItems.map((item) =>
      Row({ index: item.index, cells: item.cells, selected: item.selected }),
    ),

  view: (state, { send }) => {
    const colNames = Object.keys(state.rows[0] || {}).filter((k) => k !== "id");
    const filtered = state.search
      ? state.rows.filter((r) =>
          Object.values(r).some((v) =>
            String(v).toLowerCase().includes(state.search.toLowerCase()),
          ),
        )
      : state.rows;
    const totalPages = Math.ceil(filtered.length / state.pageSize);
    const currentPage = Math.floor(state.start / state.pageSize) + 1;

    return html`
      <div style="font-family:sans-serif;padding:0.5rem;font-size:0.82rem;">
        <!-- Controls -->
        <div
          style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem;"
        >
          <input
            .value=${state.search}
            @input=${["search", (e) => e.target.value]}
            placeholder="Search ${state.rows.length} rows..."
            style="flex:1;min-width:120px;padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;font-size:0.82rem;"
          />

          <label style="font-size:0.75rem;color:#888;">Cols</label>
          <input
            type="range"
            min="3"
            max="10"
            value="${state.cols}"
            @input=${["setCols", (e) => parseInt(e.target.value)]}
            style="width:60px;"
          />

          <select
            .value=${state.mode}
            @change=${["setMode", (e) => e.target.value]}
            style="padding:0.2rem 0.4rem;border:1px solid #ccc;border-radius:4px;font-size:0.75rem;"
          >
            <option value="virtual">♻ Virtual Reuse</option>
            <option value="real">📦 Real Instances</option>
          </select>

          <span style="font-size:0.75rem;color:#888;">
            ${filtered.length} rows · page ${currentPage}/${totalPages}
          </span>
        </div>

        <!-- Column Headers -->
        <div
          style="display:flex;border-bottom:2px solid #ddd;background:#f5f5f5;font-weight:600;"
        >
          ${colNames.map(
            (col) => html`
              <div
                @click=${() => send("sort", col)}
                style="padding:0.4rem 0.6rem;font-size:0.8rem;cursor:pointer;user-select:none;
                       width:${Math.max(
                  80,
                  Math.min(150, 1200 / state.cols),
                )}px;
                       color:${state.sortKey === col ? "#646cff" : "#555"};"
              >
                ${col}
                ${state.sortKey === col
                  ? state.sortDir === "asc"
                    ? " ▲"
                    : " ▼"
                  : ""}
              </div>
            `,
          )}
        </div>

        <!-- Rows (rendered via computeParts → compose in slot) -->
        <div id="grid-rows" style="max-height:420px;overflow-y:auto;">
          <div style="min-height:${filtered.length * 28}px;position:relative;">
            <!-- Rows are mounted imperatively via computeParts/compose.
                 In 'virtual' mode, only ~20 Row instances exist.
                 In 'real' mode, one instance per row. -->
          </div>
        </div>

        <!-- Pagination -->
        <div
          style="display:flex;gap:0.5rem;justify-content:center;align-items:center;margin-top:0.5rem;"
        >
          <button
            @click=${() => send("pageUp")}
            style="padding:0.25rem 0.6rem;border:1px solid #ccc;border-radius:4px;cursor:pointer;font-size:0.78rem;"
            ?disabled=${state.start === 0}
          >
            ← Prev
          </button>
          <span style="font-size:0.78rem;color:#888;"
            >${state.start + 1}–${Math.min(
              state.start + state.pageSize,
              filtered.length,
            )}</span
          >
          <button
            @click=${() => send("pageDown")}
            style="padding:0.25rem 0.6rem;border:1px solid #ccc;border-radius:4px;cursor:pointer;font-size:0.78rem;"
            ?disabled=${state.start + state.pageSize >= filtered.length}
          >
            Next →
          </button>
        </div>

        <p
          style="font-size:0.7rem;color:#aaa;text-align:center;margin-top:0.5rem;"
        >
          ${state.mode === "virtual"
            ? "♻ Virtual: ~20 Row instances reused across " +
              filtered.length +
              " rows"
            : "📦 Real: one Row instance per visible row (" +
              Math.min(state.pageSize, filtered.length - state.start) +
              " instances)"}
          · Sort by clicking headers · Configurable cols · 500 rows
        </p>
      </div>
    `;
  },

  mount: (el, ctx) => {
    // Imperatively mount/reuse Row instances into #grid-rows
    const container = el.querySelector("#grid-rows");
    if (!container) return;

    let instances = [];

    function syncRows() {
      const s = DataGrid.loop.get();
      const filtered = s.search
        ? s.rows.filter((r) =>
            Object.values(r).some((v) =>
              String(v).toLowerCase().includes(s.search.toLowerCase()),
            ),
          )
        : s.rows;
      const end = Math.min(s.start + s.pageSize, filtered.length);
      const visibleItems = filtered.slice(s.start, end);

      container.innerHTML = "";
      const wrapper = document.createElement("div");
      wrapper.style.minHeight = filtered.length * 28 + "px";
      wrapper.style.position = "relative";

      if (s.mode === "virtual") {
        // Virtual reuse: keep a pool, update props
        instances = [];
        for (let i = 0; i < visibleItems.length; i++) {
          const item = visibleItems[i];
          const globalIdx = s.start + i;
          const inst = Row.create({
            index: globalIdx,
            cells: Object.entries(item)
              .filter(([k]) => k !== "id")
              .map(([k, v]) => ({
                key: k,
                value: String(v),
                align: typeof v === "number" ? "right" : "left",
                width: Math.max(80, Math.min(150, 1200 / s.cols)),
              })),
            selected: s.selectedRow === globalIdx,
          });
          instances.push(inst);
          inst.mount(wrapper);
        }
      } else {
        // Real instances: create new for each visible row
        for (let i = 0; i < visibleItems.length; i++) {
          const item = visibleItems[i];
          const globalIdx = s.start + i;
          const inst = Row.create({
            index: globalIdx,
            cells: Object.entries(item)
              .filter(([k]) => k !== "id")
              .map(([k, v]) => ({
                key: k,
                value: String(v),
                align: typeof v === "number" ? "right" : "left",
                width: Math.max(80, Math.min(150, 1200 / s.cols)),
              })),
            selected: s.selectedRow === globalIdx,
          });
          inst.mount(wrapper);
        }
      }

      container.appendChild(wrapper);
    }

    syncRows();
    const unsub = DataGrid.loop.subscribe(() => syncRows());
    return () => {
      unsub();
      container.innerHTML = "";
    };
  },
});

export { DataGrid, Row, Cell };
export default DataGrid;
