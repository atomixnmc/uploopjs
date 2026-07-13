import { html, component } from "@uploop/html";
import { injectAnimations, ANIMATIONS } from "@uploop/css";

// ─── Test data ──────────────────────────────────────────
const NAMES = [
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
const CITIES = [
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
const DEPTS = [
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
const STATUSES = ["Active", "Inactive", "Pending", "On Leave"];

function generateData(rows, cols) {
  return Array.from({ length: rows }, (_, i) => {
    const r = { id: i };
    for (let c = 0; c < cols; c++) {
      if (c === 0)
        r[`col${c}`] =
          `${NAMES[i % NAMES.length]} ${Math.floor(i / NAMES.length) + 1}`;
      else if (c === 1)
        r[`col${c}`] =
          `${CITIES[i % CITIES.length]} #${Math.floor(i / CITIES.length) + 1}`;
      else if (c === 2) r[`col${c}`] = DEPTS[i % DEPTS.length];
      else if (c === 3) r[`col${c}`] = STATUSES[i % STATUSES.length];
      else r[`col${c}`] = Math.floor(Math.random() * 100000);
    }
    return r;
  });
}

const DataGrid = component("DataGrid", {
  state: {
    rows: generateData(100, 5),
    cols: 5,
    sortKey: null,
    sortDir: "asc",
    search: "",
    start: 0,
    pageSize: 20,
    selectedRow: null,
  },

  update: {
    setCols: (s, n) => ({
      ...s,
      cols: n,
      rows: generateData(100, n),
      sortKey: null,
      start: 0,
    }),
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
    pageUp: (s) => ({ ...s, start: Math.max(0, s.start - s.pageSize) }),
    pageDown: (s) => ({
      ...s,
      start: Math.min(s.start + s.pageSize, s.rows.length - s.pageSize),
    }),
    select: (s, idx) => ({
      ...s,
      selectedRow: s.selectedRow === idx ? null : idx,
    }),
  },

  view: (state, { send }) => {
    const colNames = Object.keys(state.rows[0] || {}).filter((k) => k !== "id");
    const filtered = state.search
      ? state.rows.filter((r) =>
          Object.values(r).some((v) =>
            String(v).toLowerCase().includes(state.search.toLowerCase()),
          ),
        )
      : state.rows;
    const end = Math.min(state.start + state.pageSize, filtered.length);
    const visible = filtered.slice(state.start, end);
    const totalPages = Math.ceil(filtered.length / state.pageSize);
    const currentPage = Math.floor(state.start / state.pageSize) + 1;
    const colW = Math.max(80, Math.min(150, 1200 / state.cols));

    return html` <div
      style="font-family:sans-serif;padding:0.5rem;font-size:0.82rem;"
    >
      <!-- Toolbar -->
      <div
        style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-bottom:0.75rem;"
      >
        <input
          .value=${state.search}
          @input=${["search", (e) => e.target.value]}
          placeholder="Search ${state.rows.length} rows..."
          style="flex:1;min-width:120px;padding:0.35rem 0.5rem;border:1px solid #d0d0d0;border-radius:6px;font-size:0.82rem;outline:none;"
        />
        <label style="font-size:0.72rem;opacity:0.6;">Cols</label>
        <input
          type="range"
          min="3"
          max="10"
          value="${state.cols}"
          @input=${["setCols", (e) => parseInt(e.target.value)]}
          style="width:50px;"
        />
        <span style="font-size:0.72rem;opacity:0.5;"
          >${filtered.length} rows · ${currentPage}/${totalPages}</span
        >
      </div>

      <!-- Table -->
      <div style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <div
          style="display:flex;background:#f5f5f7;border-bottom:2px solid #e0e0e0;font-weight:600;font-size:0.78rem;"
        >
          ${colNames.map(
            (col) =>
              html` <div
                @click=${() => send("sort", col)}
                style="padding:0.5rem 0.6rem;cursor:pointer;user-select:none;width:${colW}px;
                 color:${state.sortKey === col
                  ? "#646cff"
                  : "#444"};transition:color 0.15s;"
                onmouseover="this.style.background='#eee'"
                onmouseout="this.style.background=''"
              >
                ${col}${state.sortKey === col
                  ? state.sortDir === "asc"
                    ? " ▲"
                    : " ▼"
                  : ""}
              </div>`,
          )}
        </div>

        <!-- Rows -->
        <div style="max-height:400px;overflow-y:auto;">
          ${visible.length === 0
            ? html`
                <div style="padding:2rem;text-align:center;opacity:0.4;">
                  No matching rows
                </div>
              `
            : visible.map((row, i) => {
                const globalIdx = state.start + i;
                const isEven = globalIdx % 2 === 0;
                const isSelected = state.selectedRow === globalIdx;
                return html` <div
                  @click=${() => send("select", globalIdx)}
                  style="display:flex;cursor:pointer;transition:background 0.12s;
                   background:${isSelected
                    ? "#e8e8ff"
                    : isEven
                      ? "#fafbfc"
                      : "white"};
                   border-bottom:1px solid #eee;"
                  onmouseover="this.style.background='${isSelected
                    ? "#dddfff"
                    : "#f0f0f5"}'"
                  onmouseout="this.style.background='${isSelected
                    ? "#e8e8ff"
                    : isEven
                      ? "#fafbfc"
                      : "white"}'"
                >
                  ${Object.entries(row)
                    .filter(([k]) => k !== "id")
                    .map(([k, v]) => {
                      const isNum = typeof v === "number";
                      const isStatus = k === "col3" && state.cols >= 4;
                      let statusColor = "";
                      if (isStatus) {
                        if (v === "Active")
                          statusColor = "background:#e6f9ed;color:#1a7d3a;";
                        else if (v === "Inactive")
                          statusColor = "background:#fce4e4;color:#c0392b;";
                        else if (v === "Pending")
                          statusColor = "background:#fff8e1;color:#b8860b;";
                        else statusColor = "background:#e8e8f0;color:#555;";
                      }
                      return html` <div
                        style="padding:0.45rem 0.6rem;font-size:0.8rem;width:${colW}px;
                            text-align:${isNum ? "right" : "left"};
                            overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                      >
                        ${isStatus
                          ? html`<span
                              style="padding:0.1rem 0.5rem;border-radius:999px;font-size:0.7rem;font-weight:600;${statusColor}"
                              >${v}</span
                            >`
                          : String(v)}
                      </div>`;
                    })}
                </div>`;
              })}
        </div>
      </div>

      <!-- Pagination -->
      <div
        style="display:flex;gap:0.5rem;justify-content:center;align-items:center;margin-top:0.75rem;"
      >
        <button
          @click=${() => send("pageUp")}
          style="padding:0.3rem 0.8rem;border:1px solid #d0d0d0;border-radius:6px;cursor:pointer;font-size:0.78rem;background:white;transition:all 0.15s;"
          ?disabled=${state.start === 0}
        >
          ← Prev
        </button>
        <span style="font-size:0.78rem;opacity:0.5;"
          >${state.start + 1}–${end} of ${filtered.length}</span
        >
        <button
          @click=${() => send("pageDown")}
          style="padding:0.3rem 0.8rem;border:1px solid #d0d0d0;border-radius:6px;cursor:pointer;font-size:0.78rem;background:white;transition:all 0.15s;"
          ?disabled=${end >= filtered.length}
        >
          Next →
        </button>
      </div>

      <p
        style="font-size:0.7rem;opacity:0.4;text-align:center;margin-top:0.5rem;"
      >
        ${state.rows.length} rows · ${state.cols} cols · sort by clicking
        headers · search · paginate
      </p>
    </div>`;
  },

  mount: () => {
    injectAnimations();
  },
});

export { DataGrid };
export default DataGrid;
