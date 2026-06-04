import { html, component } from "@uploop/html";
import { inject } from "@uploop/css";
import {
  InspectorPanel,
  startEventCapture,
  bindInspectorSend,
} from "@uploop/devutils";
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
import { RouterDemo } from "./router/main.js";
import { StoreDemo } from "./store/main.js";
import { StateMachineDemo } from "./statemachine/main.js";
import { AnimationDemo } from "./animation/main.js";
import { AsyncDemo } from "./async-data/main.js";

// Inject CSS utilities once
inject();

const tabGroups = [
  {
    name: "Apps",
    tabs: [
      { id: "counter", label: "Counter", comp: Counter },
      { id: "css", label: "🎨 CSS", comp: CSSDemo },
      { id: "todo", label: "Todos", comp: Todo },
      { id: "form", label: "Form", comp: Form },
      { id: "grid", label: "Grid", comp: DataGrid },
      { id: "blog", label: "Blog", comp: Blog },
    ],
  },
  {
    name: "Pkgs",
    tabs: [
      { id: "router", label: "🧭 Router", comp: RouterDemo },
      { id: "store", label: "🛍 Store", comp: StoreDemo },
      { id: "statemachine", label: "🚦 StateMachine", comp: StateMachineDemo },
      { id: "animation", label: "🎨 Anim", comp: AnimationDemo },
      { id: "async", label: "⚡ Async", comp: AsyncDemo },
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

// Read initial tab from URL query param (?tab=xxx), default to landing
function getTabFromQuery() {
  const p = new URLSearchParams(window.location.search);
  const t = p.get("tab") || "";
  return tabs.find((tab) => tab.id === t) ? t : "landing";
}

// ── Landing/Hero section (plain function, receives DemoApp's send) ──

function Landing({ send }) {
  return html`
    <div style="text-align:center;padding:3rem 1rem 2rem;">
      <div style="font-size:4rem;margin-bottom:0.5rem;">⚡</div>
      <h1 style="font-size:2.5rem;margin:0 0 0.5rem;font-weight:800;">
        Uploop
      </h1>
      <p
        style="font-size:1.1rem;color:#555;max-width:600px;margin:0 auto 1.5rem;line-height:1.6;"
      >
        A <strong>HyperGraph</strong> UI framework — components are inspectable
        graphs of typed nodes connected by edges. No build step, no JSX, no
        virtual DOM. Pure ESM that runs in the browser as-is.
      </p>

      <div
        style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;margin-bottom:2.5rem;"
      >
        <button
          @click=${() => send("switch", "counter")}
          style="padding:0.7rem 1.5rem;background:#646cff;color:#fff;border:none;border-radius:8px;
            font-size:1rem;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(100,108,255,0.3);"
        >
          Get Started →
        </button>
        <a
          href="https://github.com/atomixnmc/uploopjs"
          target="_blank"
          rel="noopener"
          style="padding:0.7rem 1.5rem;border:2px solid #ddd;border-radius:8px;text-decoration:none;
            color:#333;font-size:1rem;font-weight:600;display:inline-flex;align-items:center;gap:0.4rem;"
        >
          <span style="font-size:1.2rem;">⋮</span> GitHub
        </a>
      </div>

      <!-- Feature grid -->
      <div
        style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;max-width:780px;margin:0 auto;text-align:left;"
      >
        <div style="padding:1rem;border:1px solid #e8e8ed;border-radius:12px;">
          <div style="font-size:1.5rem;margin-bottom:0.25rem;">🔄</div>
          <strong>Reactive State</strong>
          <p style="font-size:0.82rem;color:#666;margin:0.25rem 0 0;">
            One-way data flow: events → state → view. Predictable and
            debuggable.
          </p>
        </div>
        <div style="padding:1rem;border:1px solid #e8e8ed;border-radius:12px;">
          <div style="font-size:1.5rem;margin-bottom:0.25rem;">🔍</div>
          <strong>HyperGraph Inspector</strong>
          <p style="font-size:0.82rem;color:#666;margin:0.25rem 0 0;">
            Every component exports a <code>describe()</code> manifest. Debug
            with the built-in inspector.
          </p>
        </div>
        <div style="padding:1rem;border:1px solid #e8e8ed;border-radius:12px;">
          <div style="font-size:1.5rem;margin-bottom:0.25rem;">⚡</div>
          <strong>Async Metadata</strong>
          <p style="font-size:0.82rem;color:#666;margin:0.25rem 0 0;">
            Declare <code>debounce</code>, <code>error</code>,
            <code>cache</code>, <code>interruptible</code> on handlers — zero
            boilerplate.
          </p>
        </div>
        <div style="padding:1rem;border:1px solid #e8e8ed;border-radius:12px;">
          <div style="font-size:1.5rem;margin-bottom:0.25rem;">🛡️</div>
          <strong>CSP-Safe</strong>
          <p style="font-size:0.82rem;color:#666;margin:0.25rem 0 0;">
            No <code>eval</code>, no inline event handlers.
            <code>@click</code> uses <code>addEventListener</code>.
          </p>
        </div>
        <div style="padding:1rem;border:1px solid #e8e8ed;border-radius:12px;">
          <div style="font-size:1.5rem;margin-bottom:0.25rem;">📦</div>
          <strong>~26 KB gzip</strong>
          <p style="font-size:0.82rem;color:#666;margin:0.25rem 0 0;">
            ~40% smaller than React + Tailwind + Zustand + Router + XState
            combined.
          </p>
        </div>
        <div style="padding:1rem;border:1px solid #e8e8ed;border-radius:12px;">
          <div style="font-size:1.5rem;margin-bottom:0.25rem;">🎯</div>
          <strong>7 Packages</strong>
          <p style="font-size:0.82rem;color:#666;margin:0.25rem 0 0;">
            core, html, store, router, css, state-machine, devutils — all
            sharing the same update loop.
          </p>
        </div>
      </div>

      <p style="margin-top:2rem;font-size:0.78rem;color:#aaa;">
        Pure ESM · No build · No JSX · HyperGraph architecture · 19 examples ·
        181 tests
      </p>
    </div>
  `;
}

// ── Main demo app ───────────────────────────────────────────

const DemoApp = component("DemoApp", {
  state: { tab: getTabFromQuery() },

  update: {
    switch: (s, tab) => {
      const url = new URL(window.location);
      url.searchParams.set("tab", tab);
      url.hash = ""; // clear any hash left by router examples
      window.history.pushState({}, "", url);
      return { ...s, tab };
    },
  },

  view: (state, { send }) => {
    return html`
      <div
        style="font-family:sans-serif;max-width:860px;margin:0 auto;padding:1.5rem 2rem 2rem;"
      >
        <div style="text-align:center;margin-bottom:0.5rem;">
          <h1 style="margin:0;font-size:1.6rem;">Uploop</h1>
          ${state.tab !== "landing"
            ? html`
                <button
                  @click=${() => send("switch", "landing")}
                  style="margin-top:0.5rem;padding:0.25rem 0.75rem;background:none;border:1px solid #ccc;border-radius:4px;cursor:pointer;font-size:0.78rem;color:#888;"
                >
                  ← Home
                </button>
              `
            : ""}
        </div>

        ${state.tab === "landing"
          ? Landing({ send })
          : html`
              ${tabGroups.map(
                (group) => html`
                  <div
                    style="display:flex;align-items:center;gap:0.35rem;justify-content:center;margin-bottom:0.25rem;flex-wrap:wrap;"
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
            `}

        <p
          style="text-align:center;margin-top:1.2rem;font-size:0.75rem;color:#aaa;"
        >
          Pure ESM · No build · No JSX · HyperGraph architecture
        </p>
      </div>
    `;
  },
});

// ─── Mount ────────────────────────────────────────────────────
const root = document.getElementById("app");
if (root) {
  DemoApp.mount(root);

  let _activeInstance = null;

  // HyperGraph Inspector — mounted outside DemoApp's render cycle
  const inspectorRoot = document.getElementById("inspector-panel");
  const toggleBtn = document.getElementById("inspector-toggle");
  const inspector = InspectorPanel.create();
  inspector.mount(inspectorRoot);
  bindInspectorSend(inspector.loop.send);

  // Toggle button
  toggleBtn.addEventListener("click", () => {
    inspectorRoot.classList.toggle("open");
  });

  // Feed component data to inspector on tab changes
  DemoApp.loop.subscribe(() => {
    const currentTab = DemoApp.loop.get().tab;
    if (currentTab === "landing") return;
    const activeComp = _activeInstance;
    if (activeComp) {
      inspector.loop.send("setActiveComp", activeComp);
      inspector.loop.send(
        "setComponents",
        tabs.map((t) => ({ id: t.id, label: t.label, comp: t.comp })),
      );
    }
  });

  // Sync browser back/forward with tab state (query param based)
  window.addEventListener("popstate", () => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("tab") || "";
    if (tabs.find((tab) => tab.id === t) && DemoApp.loop.get().tab !== t) {
      DemoApp.loop.send("switch", t);
    }
  });

  requestAnimationFrame(() => {
    const mountMap = {};
    let lastTab = null;

    function mountCurrent() {
      const currentTab = DemoApp.loop.get().tab;
      if (currentTab === lastTab) return;
      if (currentTab === "landing") {
        // Unmount any active example
        for (const key of Object.keys(mountMap)) {
          if (mountMap[key]) {
            mountMap[key]();
            mountMap[key] = null;
          }
        }
        lastTab = "landing";
        _activeInstance = null;
        return;
      }
      lastTab = currentTab;

      for (const key of Object.keys(mountMap)) {
        if (mountMap[key]) {
          mountMap[key]();
          mountMap[key] = null;
        }
      }
      const activeTab = tabs.find((t) => t.id === currentTab);
      if (!activeTab) return;
      const el = document.getElementById("demo-slot");
      if (!el) return;

      mountMap[currentTab] = activeTab.comp.mount(el);
      _activeInstance = activeTab.comp;

      if (inspector && inspector.loop) {
        inspector.loop.send("setActiveComp", activeTab.comp);
      }
    }

    mountCurrent();
    DemoApp.loop.subscribe(() => mountCurrent());
  });
}
