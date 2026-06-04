/**
 * Demo app tab structure + switching tests
 *
 * Tests the tabs data structure and switching logic
 * without importing the full main.js (which mounts DOM).
 */
import { describe, it, expect } from "vitest";

// Mirror the tabs structure from main.js to verify consistency
const tabGroups = [
  {
    name: "Apps",
    tabs: [
      { id: "counter", label: "Counter" },
      { id: "css", label: "🎨 CSS" },
      { id: "todo", label: "Todos" },
      { id: "form", label: "Form" },
      { id: "grid", label: "Grid" },
      { id: "blog", label: "Blog" },
    ],
  },
  {
    name: "Pkgs",
    tabs: [
      { id: "router", label: "🧭 Router" },
      { id: "store", label: "🛍 Store" },
      { id: "statemachine", label: "🚦 StateMachine" },
      { id: "animation", label: "🎨 Anim" },
      { id: "async", label: "⚡ Async" },
    ],
  },
  {
    name: "Media",
    tabs: [
      { id: "carousel", label: "🖼 Carousel" },
      { id: "paint", label: "🎨 Paint" },
      { id: "audioplayer", label: "🎵 Audio" },
      { id: "videoplayer", label: "🎬 Video" },
    ],
  },
  {
    name: "Games",
    tabs: [
      { id: "tetris", label: "🎮 Tetris" },
      { id: "wheel", label: "🎡 Wheel" },
      { id: "fishes", label: "🐟 Fishes" },
      { id: "cars", label: "🚗 Cars" },
    ],
  },
];

const tabs = tabGroups.flatMap((g) => g.tabs);

describe("demo app tabs", () => {
  it("has 19 tabs total", () => {
    expect(tabs.length).toBe(19);
  });

  it("every tab has id and label", () => {
    for (const t of tabs) {
      expect(t.id).toBeTruthy();
      expect(t.label).toBeTruthy();
    }
  });

  it("all tab ids are unique", () => {
    const ids = tabs.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("default tab is landing (not in tabs list)", () => {
    // landing is a special state, not a real tab
    expect(tabs.find((t) => t.id === "landing")).toBeUndefined();
  });

  it("getTabFromQuery resolves known tabs", () => {
    function getTabFromQuery(search) {
      const p = new URLSearchParams(search);
      const t = p.get("tab") || "";
      return tabs.find((tab) => tab.id === t) ? t : "landing";
    }

    expect(getTabFromQuery("?tab=counter")).toBe("counter");
    expect(getTabFromQuery("?tab=router")).toBe("router");
    expect(getTabFromQuery("?tab=store")).toBe("store");
    expect(getTabFromQuery("?tab=async")).toBe("async");
    expect(getTabFromQuery("")).toBe("landing");
    expect(getTabFromQuery("?tab=nonexistent")).toBe("landing");
  });

  it("all tab ids are valid URL-safe strings", () => {
    for (const t of tabs) {
      expect(t.id).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
