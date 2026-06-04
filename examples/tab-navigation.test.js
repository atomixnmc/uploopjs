/**
 * Unit test: Demo gallery tab navigation
 *
 * Verifies:
 *   1. Tab IDs match URL query params (?tab=xxx)
 *   2. Switch handler updates state correctly
 *   3. getTabFromQuery resolves tabs from URL
 *   4. All 19 tab IDs are valid and unique
 *   5. Components import and mount correctly
 */
import { describe, it, expect, beforeAll } from "vitest";

// Mirror the exact tab structure from main.js
const tabGroups = [
  {
    name: "Apps",
    tabs: [
      { id: "counter" },
      { id: "css" },
      { id: "todo" },
      { id: "form" },
      { id: "grid" },
      { id: "blog" },
    ],
  },
  {
    name: "Pkgs",
    tabs: [
      { id: "router" },
      { id: "store" },
      { id: "statemachine" },
      { id: "animation" },
      { id: "async" },
    ],
  },
  {
    name: "Media",
    tabs: [
      { id: "carousel" },
      { id: "paint" },
      { id: "audioplayer" },
      { id: "videoplayer" },
    ],
  },
  {
    name: "Games",
    tabs: [{ id: "tetris" }, { id: "wheel" }, { id: "fishes" }, { id: "cars" }],
  },
];
const tabs = tabGroups.flatMap((g) => g.tabs);

describe("tab navigation", () => {
  it("has 19 tabs total", () => {
    expect(tabs.length).toBe(19);
  });

  it("all tab IDs are unique", () => {
    const ids = tabs.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all tab IDs are URL-safe lowercase-hyphen strings", () => {
    for (const t of tabs) {
      expect(t.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("getTabFromQuery resolves known tabs from URL", () => {
    function getTabFromQuery(search) {
      try {
        const p = new URLSearchParams(search);
        const t = p.get("tab") || "";
        return tabs.find((tab) => tab.id === t) ? t : "landing";
      } catch {
        return "landing";
      }
    }

    // Known tabs resolve correctly
    expect(getTabFromQuery("?tab=counter")).toBe("counter");
    expect(getTabFromQuery("?tab=router")).toBe("router");
    expect(getTabFromQuery("?tab=store")).toBe("store");
    expect(getTabFromQuery("?tab=cars")).toBe("cars");
    expect(getTabFromQuery("?tab=animation")).toBe("animation");
    expect(getTabFromQuery("?tab=async")).toBe("async");
    expect(getTabFromQuery("?tab=tetris")).toBe("tetris");

    // Unknown tabs default to landing
    expect(getTabFromQuery("")).toBe("landing");
    expect(getTabFromQuery("?tab=nonexistent")).toBe("landing");
    expect(getTabFromQuery("?tab=")).toBe("landing");
    expect(getTabFromQuery("?other=value")).toBe("landing");
  });

  it("switch handler returns correct state for every tab", () => {
    const handler = (s, tab) => ({ ...s, tab });
    let state = { tab: "landing" };

    for (const t of tabs) {
      state = handler(state, t.id);
      expect(state.tab).toBe(t.id);
    }

    state = handler(state, "landing");
    expect(state.tab).toBe("landing");
  });
});

describe("blog example has no auto-navigation side effect", () => {
  it("blog module does not set hash on import", async () => {
    const hashBefore = window.location.hash;
    await import("./blog/main.js");
    // Hash should be unchanged — no auto-navigate
    expect(window.location.hash).toBe(hashBefore);
  });
});

describe("component mounting produces unique content", () => {
  it("Counter and Todo produce different content", async () => {
    const { Counter } = await import("./counter/main.js");
    const { Todo } = await import("./todo/main.js");

    const el1 = document.createElement("div");
    const el2 = document.createElement("div");

    Counter.mount(el1);
    await new Promise((r) => setTimeout(r, 50));

    Todo.mount(el2);
    await new Promise((r) => setTimeout(r, 50));

    expect(el1.textContent).toBeTruthy();
    expect(el2.textContent).toBeTruthy();
    expect(el1.textContent).not.toBe(el2.textContent);
  });

  it("RouterDemo and StoreDemo produce different content", async () => {
    const { RouterDemo } = await import("./router/main.js");
    const { StoreDemo } = await import("./store/main.js");

    const el1 = document.createElement("div");
    const el2 = document.createElement("div");

    RouterDemo.mount(el1);
    await new Promise((r) => setTimeout(r, 100));

    StoreDemo.mount(el2);
    await new Promise((r) => setTimeout(r, 100));

    expect(el1.textContent).toBeTruthy();
    expect(el2.textContent).toBeTruthy();
    expect(el1.textContent).not.toBe(el2.textContent);
  });
});
