/**
 * Integration test: Full tab switching simulation
 *
 * Mirrors the exact flow from main.js: DemoApp → mount → switch tabs → verify content.
 * Tests that each tab click mounts the correct component, not always the same one.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { component } from "@uploop/html";

// Mock tabs mirroring main.js structure with real components
const tabDefs = {};

beforeAll(async () => {
  const counter = await import("./counter/main.js");
  const todo = await import("./todo/main.js");
  const router = await import("./router/main.js");
  const store = await import("./store/main.js");

  Object.assign(tabDefs, {
    counter: counter.Counter,
    todo: todo.Todo,
    router: router.RouterDemo,
    store: store.StoreDemo,
  });
});

describe("tab switching simulation", () => {
  it("Counter component has unique identity", () => {
    expect(tabDefs.counter).toBeDefined();
    expect(tabDefs.counter).not.toBe(tabDefs.todo);
    expect(tabDefs.counter).not.toBe(tabDefs.router);
    expect(tabDefs.counter).not.toBe(tabDefs.store);
  });

  it("Todo component has unique identity", () => {
    expect(tabDefs.todo).toBeDefined();
    expect(tabDefs.todo).not.toBe(tabDefs.counter);
    expect(tabDefs.todo).not.toBe(tabDefs.router);
  });

  it("each tab mounts and renders different content", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const tabs = ["counter", "todo", "router", "store"];
    let lastContent = "";

    for (const tabId of tabs) {
      const Comp = tabDefs[tabId];
      expect(Comp).toBeDefined();

      // Mount the component (like mountCurrent does)
      Comp.mount(el);

      // Wait for async rendering
      await new Promise((r) => setTimeout(r, 50));

      const content = el.textContent;
      expect(content).toBeTruthy();
      // Content should differ from previous tab
      if (lastContent) {
        expect(content).not.toBe(lastContent);
      }
      lastContent = content;
    }

    document.body.removeChild(el);
  });

  it("Counter renders count-related content", async () => {
    const el = document.createElement("div");
    tabDefs.counter.mount(el);
    await new Promise((r) => setTimeout(r, 50));
    expect(el.textContent).toMatch(/count1|Sum|Reset/);
  });

  it("RouterDemo renders navigation content", async () => {
    const el = document.createElement("div");
    tabDefs.router.mount(el);
    await new Promise((r) => setTimeout(r, 50));
    expect(el.textContent).toContain("Router Demo");
  });

  it("StoreDemo renders cart content", async () => {
    const el = document.createElement("div");
    tabDefs.store.mount(el);
    await new Promise((r) => setTimeout(r, 50));
    expect(el.textContent).toContain("Store Demo");
  });

  it("Todo renders todo-related content", async () => {
    const el = document.createElement("div");
    tabDefs.todo.mount(el);
    await new Promise((r) => setTimeout(r, 50));
    expect(el.textContent).toContain("Uploop Todos");
  });
});
