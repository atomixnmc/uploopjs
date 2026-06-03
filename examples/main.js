import { html, component } from "@uploop/html";
import { inject } from "@uploop/css";
import { Counter } from "./counter/main.js";
import { CSSDemo } from "./css-demo/main.js";
import { Todo } from "./todo/main.js";
import { Form } from "./form/main.js";
import { DataGrid } from "./grid/main.js";
import { Blog } from "./blog/main.js";
import { ImageCarousel } from "./carousel/main.js";
import { Paint } from "./paint/main.js";
import { AudioPlayer } from "./audioplayer/main.js";
import { Tetris } from "./tetris/main.js";
import { LuckyWheel } from "./luckywheel/main.js";
import { FishesGame } from "./fishes/main.js";
import { CarsApp } from "./cars/main.js";
import { VideoPlayer } from "./videoplayer/main.js";

// Inject CSS utilities once
inject();

const tabGroups = [
  {
    name: "Apps",
    tabs: [
      { id: "counter", label: "Counter", comp: Counter },
      { id: "css", label: "🎨 CSS Utils", comp: CSSDemo },
      { id: "todo", label: "Todos", comp: Todo },
      { id: "form", label: "Form", comp: Form },
      { id: "grid", label: "Grid", comp: DataGrid },
      { id: "blog", label: "Blog", comp: Blog },
    ],
  },
  {
    name: "Media",
    tabs: [
      { id: "carousel", label: "🖼 Carousel", comp: ImageCarousel },
      { id: "paint", label: "🎨 Paint", comp: Paint },
      { id: "audioplayer", label: "🎵 Audio", comp: AudioPlayer },
      { id: "videoplayer", label: "🎬 Video", comp: VideoPlayer },
    ],
  },
  {
    name: "Games",
    tabs: [
      { id: "tetris", label: "🎮 Tetris", comp: Tetris },
      { id: "wheel", label: "🎡 Wheel", comp: LuckyWheel },
      { id: "fishes", label: "🐟 Fishes", comp: FishesGame },
      { id: "cars", label: "🚗 Cars", comp: CarsApp },
    ],
  },
];

const tabs = tabGroups.flatMap((g) => g.tabs);

// Read initial tab from URL hash, default to counter
function getTabFromHash() {
  const h = window.location.hash.replace(/^#/, "");
  return tabs.find((t) => t.id === h) ? h : "counter";
}

const DemoApp = component("DemoApp", {
  state: { tab: getTabFromHash(), debugTab: "", autoRefresh: true },

  update: {
    switch: (s, tab) => {
      window.location.hash = tab;
      return { ...s, tab };
    },
    debugSwitch: (s, debugTab) => ({ ...s, debugTab }),
    toggleAutoRefresh: (s) => ({ ...s, autoRefresh: !s.autoRefresh }),
  },

  view: (state, { send }) => {
    const activeComp = tabs.find((t) => t.id === state.tab)?.comp;
    const graph = activeComp?.describe();

    return html`
      <div
        style="font-family:sans-serif;max-width:860px;margin:0 auto;padding:1.5rem 2rem 2rem;"
      >
        <div style="text-align:center;margin-bottom:1rem;">
          <h1 style="margin:0;font-size:1.6rem;">Uploop</h1>
          <p style="margin:0;color:#888;font-size:0.82rem;">
            Update Loop Architecture · Monorepo v0.1.0
          </p>
        </div>

        ${tabGroups.map(
          (group) => html`
            <div
              style="display:flex;align-items:center;gap:0.35rem;justify-content:center;margin-bottom:0.25rem;"
            >
              <span
                style="font-size:0.65rem;color:#aaa;font-weight:600;min-width:42px;text-align:right;text-transform:uppercase;letter-spacing:0.5px;"
                >${group.name}</span
              >
              ${group.tabs.map(
                (t) => html`
                  <button
                    @click=${() => send("switch", t.id)}
                    style="padding:0.4rem 0.75rem;border:none;border-radius:8px;cursor:pointer;font-size:0.82rem;font-weight:500;
                         background:${state.tab === t.id
                      ? "#646cff"
                      : "#e8e8ed"};
                         color:${state.tab === t.id ? "white" : "#333"};
                         transition:all 0.15s;"
                  >
                    ${t.label}
                  </button>
                `,
              )}
            </div>
          `,
        )}

        <div
          id="demo-slot"
          style="border:1px solid var(--color-border,#e0e0e0);border-radius:12px;background:var(--color-bg,white);box-shadow:0 2px 8px rgba(0,0,0,0.04);min-height:180px;"
        ></div>

        <!-- ========== HyperGraph Debug Panel ========== -->
        <details style="margin-top:1.25rem;" ${state.debugTab ? "open" : ""}>
          <summary
            style="cursor:pointer;font-size:0.88rem;color:#555;font-weight:600;user-select:none;
                         padding:0.4rem 0.6rem;border-radius:6px;background:#f0f0f4;display:flex;align-items:center;gap:0.5rem;"
          >
            <span>⚡ HyperGraph Inspector</span>
            <label
              style="font-size:0.7rem;font-weight:400;color:#888;display:inline-flex;align-items:center;gap:0.2rem;cursor:pointer;"
              @click=${(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                ?checked=${state.autoRefresh}
                @click=${(e) => {
                  e.stopPropagation();
                  send("toggleAutoRefresh");
                }}
                style="cursor:pointer;margin:0;"
              />
              auto-refresh
            </label>
            ${!state.autoRefresh
              ? html`
                  <button
                    @click=${(e) => {
                      e.stopPropagation();
                      send("debugSwitch", state.debugTab);
                    }}
                    style="font-size:0.7rem;padding:0.15rem 0.45rem;border:1px solid #ccc;border-radius:4px;cursor:pointer;background:white;"
                  >
                    🔄 Refresh
                  </button>
                `
              : ""}
          </summary>

          <!-- Debug tabs -->
          <div style="display:flex;gap:2px;margin-top:0.5rem;">
            ${[
              { id: "graph", label: "Graph" },
              { id: "nodes", label: "Nodes" },
              { id: "edges", label: "Edges" },
              { id: "state", label: "State" },
              { id: "events", label: "Events" },
              { id: "signals", label: "Signals" },
              { id: "components", label: "Components" },
              { id: "meta", label: "Metadata" },
            ].map(
              (dt) => html`
                <button
                  @click=${() => send("debugSwitch", dt.id)}
                  style="flex:1;padding:0.3rem 0.2rem;border:none;cursor:pointer;font-size:0.72rem;
                       border-radius:4px 4px 0 0;
                       background:${state.debugTab === dt.id
                    ? "#646cff"
                    : "#e8e8ed"};
                       color:${state.debugTab === dt.id ? "white" : "#555"};
                       font-weight:${state.debugTab === dt.id ? "600" : "400"};"
                >
                  ${dt.label}
                </button>
              `,
            )}
          </div>

          <!-- Debug content -->
          <pre
            style="background:#1e1e2e;color:#cdd6f4;padding:0.8rem 1rem;border-radius:0 0 8px 8px;
                      overflow:auto;font-size:0.72rem;line-height:1.5;max-height:340px;margin:0;
                      font-family:'Cascadia Code','Fira Code','JetBrains Mono',monospace;
                      white-space:pre-wrap;word-break:break-all;"
          >

${state.debugTab === "graph"
              ? renderGraphView(graph, activeComp)
              : state.debugTab === "nodes"
                ? renderNodesView(graph)
                : state.debugTab === "edges"
                  ? renderEdgesView(graph)
                  : state.debugTab === "state"
                    ? renderStateView(activeComp)
                    : state.debugTab === "events"
                      ? renderEventsView(graph)
                      : state.debugTab === "signals"
                        ? renderSignalsView(graph)
                        : state.debugTab === "components"
                          ? renderComponentsView(tabs)
                          : state.debugTab === "meta"
                            ? renderMetaView(graph)
                            : ""}
          </pre
          >
        </details>

        <p
          style="text-align:center;margin-top:1.2rem;font-size:0.75rem;color:#aaa;"
        >
          Pure ESM · No build · No JSX · HyperGraph architecture
        </p>
      </div>
    `;
  },
});

// ─── Debug renderers ─────────────────────────────────────────

function renderGraphView(graph, comp) {
  if (!graph) return noGraph();
  const nodeList = Object.entries(graph.nodes || {});
  const edgeList = graph.edges || [];
  const parts = [`╔══════════════════════════════════════╗`];
  parts.push(`║  ${padRight("HyperGraph: " + (graph.name || "unnamed"), 38)}║`);
  parts.push(`║  ${padRight("Kind: " + graph.kind, 38)}║`);
  parts.push(`╚══════════════════════════════════════╝`);
  parts.push(``);
  // Visual graph: nodes with connections
  parts.push(`  ┌─ Nodes (${nodeList.length})`);
  for (const [name, def] of nodeList) {
    const deps = def.dependsOn ? " ← " + def.dependsOn.join(", ") : "";
    const reads = def.reads ? "  📖 " + def.reads.join(", ") : "";
    const writes = def.writes ? "  ✏️ " + def.writes.join(", ") : "";
    const access = def.access ? "  🔑 " + def.access : "";
    parts.push(`  │`);
    parts.push(`  ├── ${name}`);
    parts.push(`  │    type: ${def.type}${access}${deps}${reads}${writes}`);
  }
  parts.push(`  │`);
  parts.push(`  └─ Edges (${edgeList.length})`);
  for (const [from, to] of edgeList) {
    parts.push(`       ${from} → ${to}`);
  }
  return parts.join("\n");
}

function renderNodesView(graph) {
  if (!graph) return noGraph();
  const nodeList = Object.entries(graph.nodes || {});
  if (nodeList.length === 0) return "  (no nodes)";
  const parts = [];
  for (const [name, def] of nodeList) {
    parts.push(`  [${def.type}] ${name}`);
    const props = [];
    if (def.access) props.push("access:" + def.access);
    if (def.dependsOn) props.push("depends:[" + def.dependsOn.join(",") + "]");
    if (def.reads) props.push("reads:[" + def.reads.join(",") + "]");
    if (def.writes) props.push("writes:[" + def.writes.join(",") + "]");
    if (def.lifetime) props.push("lifetime:" + def.lifetime);
    if (props.length) parts.push(`       ${props.join("  ")}`);
  }
  return parts.join("\n");
}

function renderEdgesView(graph) {
  if (!graph) return noGraph();
  const edges = graph.edges || [];
  if (edges.length === 0) return "  (no edges — wire up your component)";
  const parts = ["  src → dst"];
  for (const [from, to] of edges) {
    parts.push(`  ${from} → ${to}`);
  }
  return parts.join("\n");
}

function renderStateView(comp) {
  if (!comp?.loop) return "  (no active component)";
  const state = comp.loop.get();
  return formatState(state, 2);
}

function renderEventsView(graph) {
  if (!graph) return noGraph();
  const updates = Object.entries(graph.nodes || {}).filter(
    ([_, n]) => n.type === "update",
  );
  if (updates.length === 0) return "  (no event handlers)";
  const parts = ["  Available events (send via click/input or loop.send):"];
  for (const [name] of updates) {
    parts.push(`  • ${name}`);
  }
  return parts.join("\n");
}

function renderComponentsView(tabList) {
  if (!tabList || tabList.length === 0) return "  (no components registered)";
  const parts = [];
  for (const t of tabList) {
    const comp = t.comp;
    const graph = comp?.describe?.();
    const nodeCount = graph ? Object.keys(graph.nodes || {}).length : 0;
    const edgeCount = graph ? (graph.edges || []).length : 0;
    const state = comp?.loop?.get?.();
    const stateKeys = state ? Object.keys(state).length : 0;
    const mounted = comp?.loop ? "✓" : "✗";
    const active = comp?.describe ? graph?.name || t.id : t.id;
    parts.push(
      `  ${mounted} ${t.label.padEnd(14)} nodes:${String(nodeCount).padStart(2)}  edges:${String(edgeCount).padStart(2)}  state:${String(stateKeys).padStart(2)}  name:${active}`,
    );
  }
  return parts.join("\n");
}

function renderSignalsView(graph) {
  if (!graph) return noGraph();
  const dataNodes = Object.entries(graph.nodes || {}).filter(
    ([_, n]) => n.type === "data",
  );
  const viewNodes = Object.entries(graph.nodes || {}).filter(
    ([_, n]) => n.type === "view",
  );
  const effectNodes = Object.entries(graph.nodes || {}).filter(
    ([_, n]) => n.type === "effect",
  );
  const parts = [];
  parts.push(
    `  Data signals: ${dataNodes.map(([n]) => n).join(", ") || "none"}`,
  );
  parts.push(
    `  View signals: ${viewNodes.map(([n]) => n).join(", ") || "none"}`,
  );
  parts.push(
    `  Effect signals: ${effectNodes.map(([n]) => n).join(", ") || "none"}`,
  );
  return parts.join("\n");
}

function renderMetaView(graph) {
  if (!graph) return noGraph();
  return [
    `  kind: ${graph.kind}`,
    `  name: ${graph.name}`,
    `  nodeCount: ${Object.keys(graph.nodes || {}).length}`,
    `  edgeCount: ${(graph.edges || []).length}`,
  ].join("\n");
}

function noGraph() {
  return "  (no graph data — select a demo component)";
}

function padRight(s, n) {
  return s + " ".repeat(Math.max(0, n - s.length));
}

function formatState(obj, indent = 0) {
  const pad = "  ".repeat(indent);
  if (obj === null) return pad + "null";
  if (obj === undefined) return pad + "undefined";
  if (typeof obj !== "object") return pad + String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return pad + "[]";
    const items = obj.map((item) => formatState(item, indent + 1));
    if (items.every((i) => !i.includes("\n")))
      return pad + "[" + obj.map(String).join(", ") + "]";
    return pad + "[\n" + items.join(",\n") + "\n" + pad + "]";
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) return pad + "{}";
  const lines = keys.map((k) => {
    const v = formatState(obj[k], indent + 1);
    if (v.includes("\n")) return pad + "  " + k + ": " + v.trimStart();
    return pad + "  " + k + ": " + v;
  });
  return "{\n" + lines.join("\n") + "\n" + pad + "}";
}

// ─── Mount ────────────────────────────────────────────────────
const root = document.getElementById("app");
if (root) {
  DemoApp.mount(root);

  // Sync browser back/forward with tab state
  window.addEventListener("hashchange", () => {
    const h = window.location.hash.replace(/^#/, "");
    if (tabs.find((t) => t.id === h) && DemoApp.loop.get().tab !== h) {
      DemoApp.loop.send("switch", h);
    }
  });

  requestAnimationFrame(() => {
    const mountMap = {};

    function mountCurrent() {
      for (const key of Object.keys(mountMap)) {
        if (mountMap[key]) {
          mountMap[key]();
          mountMap[key] = null;
        }
      }
      const currentTab = DemoApp.loop.get().tab;
      const activeTab = tabs.find((t) => t.id === currentTab);
      if (!activeTab) return;
      const el = document.getElementById("demo-slot");
      if (el) mountMap[currentTab] = activeTab.comp.mount(el);
    }

    mountCurrent();
    DemoApp.loop.subscribe(() => mountCurrent());
  });
}
