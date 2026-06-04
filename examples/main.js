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
  state: { tab: getTabFromHash() },

  update: {
    switch: (s, tab) => {
      window.location.hash = tab;
      return { ...s, tab };
    },
  },

  view: (state, { send }) => {
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
    const activeComp = _activeInstance;
    if (activeComp) {
      inspector.loop.send("setActiveComp", activeComp);
      inspector.loop.send(
        "setComponents",
        tabs.map((t) => ({ id: t.id, label: t.label, comp: t.comp })),
      );
    }
  });

  // Sync browser back/forward with tab state
  window.addEventListener("hashchange", () => {
    const h = window.location.hash.replace(/^#/, "");
    if (tabs.find((t) => t.id === h) && DemoApp.loop.get().tab !== h) {
      DemoApp.loop.send("switch", h);
    }
  });

  requestAnimationFrame(() => {
    const mountMap = {};
    let lastTab = null;

    function mountCurrent() {
      const currentTab = DemoApp.loop.get().tab;
      if (currentTab === lastTab) return; // skip — tab didn't change
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
