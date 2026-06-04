import { html, component } from "@uploop/html";
import { inject } from "@uploop/css";
import { DEBUG_TABS, renderDebugContent } from "@uploop/devutils";
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
    refresh: (s) => s,
  },

  view: (state, { send }) => {
    const activeComp = tabs.find((t) => t.id === state.tab)?.comp;

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
          register-resource="demo-slot"
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
            ${
              !state.autoRefresh
                ? html`
                    <button
                      @click=${(e) => {
                        e.stopPropagation();
                        send("refresh");
                      }}
                      style="font-size:0.7rem;padding:0.15rem 0.45rem;border:1px solid #ccc;border-radius:4px;cursor:pointer;background:white;"
                    >
                      🔄 Refresh
                    </button>
                  `
                : ""
            }
          </summary>

          <!-- Debug tabs -->
          <div style="display:flex;gap:2px;margin-top:0.5rem;">
            ${DEBUG_TABS.map(
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
            id="debug-panel-pre"
            style="background:#1e1e2e;color:#cdd6f4;padding:0.8rem 1rem;border-radius:0 0 8px 8px;
                      overflow:auto;font-size:0.72rem;line-height:1.5;max-height:340px;margin:0;
                      font-family:'Cascadia Code','Fira Code','JetBrains Mono',monospace;
                      white-space:pre-wrap;word-break:break-all;"
          >
${renderDebugContent(state.debugTab, activeComp, tabs)}
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

  mount: (el, ctx) => {
    // Preserve scroll position of debug panel across renders
    let _scrollTop = 0;
    const unsub = DemoApp.loop.subscribe(() => {
      // Wait for DOM to update (innerHTML is synchronous)
      queueMicrotask(() => {
        const pre = el.querySelector("#debug-panel-pre");
        if (pre) {
          pre.scrollTop = _scrollTop;
        }
      });
    });
    // Track scroll position from scroll events
    el.addEventListener(
      "scroll",
      (e) => {
        const pre = e.target.closest?.("#debug-panel-pre");
        if (pre) _scrollTop = pre.scrollTop;
      },
      true,
    ); // use capture to catch scroll on child elements
    ctx.registerResource("debug-scroll", {
      save: () => _scrollTop,
      restore: (val) => {
        _scrollTop = val;
      },
    });
  },
});

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

  // Auto-refresh: re-render debug panel every 500ms when enabled
  let autoRefreshTimer = null;

  function manageAutoRefresh() {
    const { debugTab, autoRefresh } = DemoApp.loop.get();
    if (autoRefresh && debugTab) {
      if (!autoRefreshTimer) {
        autoRefreshTimer = setInterval(() => DemoApp.loop.send("refresh"), 500);
      }
    } else {
      if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
      }
    }
  }

  manageAutoRefresh();
  DemoApp.loop.subscribe(() => manageAutoRefresh());

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
