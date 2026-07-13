import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3500";
const CONTENT = "main.content";

test.describe("SST Server — Pages", () => {
  test("GET / returns landing page with all links", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator(CONTENT + " h1")).toContainText("Uploop SST");
    // Landing page cards are in the content area
    const content = page.locator(CONTENT);
    await expect(content.locator("text=Counter")).toBeVisible();
    await expect(content.locator("text=Blog")).toBeVisible();
    await expect(content.locator("text=Todos")).toBeVisible();
    await expect(content.locator("text=Chat")).toBeVisible();
    await expect(content.locator("text=CSS")).toBeVisible();
    await expect(content.locator("text=Slither")).toBeVisible();
  });

  test("GET /counter renders SSR counter", async ({ page }) => {
    await page.goto(`${BASE}/counter`);
    await expect(page.locator(CONTENT + " h2")).toContainText("SSR Counter");
    await expect(page.locator("#btn-inc")).toBeVisible();
    await expect(page.locator("#btn-dec")).toBeVisible();
  });

  test("GET /blog renders blog list from SQLite", async ({ page }) => {
    await page.goto(`${BASE}/blog`);
    await expect(page.locator(CONTENT + " h2")).toContainText("Blog");
    const content = page.locator(CONTENT);
    await expect(content.getByText("Introducing Uploop SST")).toBeVisible();
    await expect(content.getByText("Remote Loops")).toBeVisible();
    await expect(content.getByText("Service Pattern")).toBeVisible();
  });

  test("GET /blog/1 renders post detail", async ({ page }) => {
    await page.goto(`${BASE}/blog/1`);
    await expect(page.locator(CONTENT + " h2")).toContainText(
      "Introducing Uploop SST",
    );
  });

  test("GET /blog/999 shows not found", async ({ page }) => {
    await page.goto(`${BASE}/blog/999`);
    await expect(page.locator(CONTENT).getByText("Not found")).toBeVisible();
  });

  test("GET /todos renders todo list", async ({ page }) => {
    await page.goto(`${BASE}/todos`);
    await expect(page.locator(CONTENT + " h2")).toContainText("Todos");
    const content = page.locator(CONTENT);
    await expect(content.getByText("Learn Uploop SSR")).toBeVisible();
    await expect(content.getByText("Build a demo")).toBeVisible();
  });

  test("GET /chat renders chat page", async ({ page }) => {
    await page.goto(`${BASE}/chat`);
    await expect(page.locator(CONTENT + " h2")).toContainText("Chat");
    await expect(page.locator("#chat-input")).toBeVisible();
    await expect(page.locator("#chat-send")).toBeVisible();
  });

  test("GET /css-demo renders theme colors", async ({ page }) => {
    await page.goto(`${BASE}/css-demo`);
    await expect(page.locator(CONTENT + " h2")).toContainText("CSS");
    await expect(page.locator(CONTENT).getByText("#4f46e5")).toBeVisible();
  });

  test("GET /chess renders chess board", async ({ page }) => {
    await page.goto(`${BASE}/chess`);
    await expect(page.locator(CONTENT + " h2")).toContainText(
      "Multiplayer Chess",
    );
    await expect(page.locator("#chess-board")).toBeVisible();
  });

  test("GET /slither renders game canvas", async ({ page }) => {
    await page.goto(`${BASE}/slither`);
    await expect(page.locator(CONTENT + " h2")).toContainText("Slither");
    await expect(page.locator("#slither-canvas")).toBeVisible();
  });

  test("sidebar navigation works", async ({ page }) => {
    await page.goto(BASE);
    await page.click('nav.sidebar a:has-text("Blog")');
    await expect(page).toHaveURL(`${BASE}/blog`);
    await page.click('nav.sidebar a:has-text("Home")');
    await expect(page).toHaveURL(BASE);
    await page.click('nav.sidebar a:has-text("Todos")');
    await expect(page).toHaveURL(`${BASE}/todos`);
  });
});

test.describe("SST Server — API", () => {
  test("GET /api/todos returns JSON array", async ({ request }) => {
    const res = await request.get(`${BASE}/api/todos`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(3);
  });

  test("POST /api/todos creates a todo", async ({ request }) => {
    const res = await request.post(`${BASE}/api/todos`, {
      data: { text: "E2E test todo" },
    });
    expect(res.status()).toBe(201);
  });

  test("GET /api/blog returns posts from SQLite", async ({ request }) => {
    const res = await request.get(`${BASE}/api/blog`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(3);
  });

  test("GET /api/state returns state snapshot", async ({ request }) => {
    const res = await request.get(`${BASE}/api/state`);
    expect(res.status()).toBe(200);
  });

  test("GET /nonexistent returns 404 page", async ({ page }) => {
    await page.goto(`${BASE}/nonexistent`);
    await expect(page.locator(CONTENT).getByText("404")).toBeVisible();
  });

  test("all pages load without console errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    const routes = [
      "/",
      "/counter",
      "/blog",
      "/todos",
      "/chat",
      "/css-demo",
      "/chess",
      "/slither",
    ];
    for (const route of routes) {
      await page.goto(`${BASE}${route}`);
      await page.waitForTimeout(300);
    }

    expect(errors).toEqual([]);
  });
});

test.describe("SST Server — WebSocket", () => {
  test("chat WebSocket connects and receives messages", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto(`${BASE}/chat`);
    await page.waitForTimeout(1000);
    await expect(page.locator("#chat-input")).toBeVisible();
    const wsRelated = errors.filter(
      (e) => e.includes("ws") || e.includes("WebSocket") || e.includes("500"),
    );
    expect(wsRelated).toEqual([]);
  });

  test("chess WebSocket connects and receives state", async ({ page }) => {
    const errors = [];
    const wsErrors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    // Track WebSocket errors via injected script
    await page.addInitScript(() => {
      const origWS = window.WebSocket;
      window.WebSocket = function (...args) {
        const ws = new origWS(...args);
        ws.addEventListener("error", (e) => {
          console.error(
            "[WS-ERROR] " + args[0] + ": " + (e.message || "connection failed"),
          );
        });
        return ws;
      };
    });
    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(1500);
    await expect(page.locator("#chess-board")).toBeVisible();
    const wsRelated = errors.filter(
      (e) =>
        e.includes("ws") ||
        e.includes("WS") ||
        e.includes("WebSocket") ||
        e.includes("500") ||
        e.includes("ERR"),
    );
    expect(wsRelated).toEqual([]);
  });

  test("slither WebSocket connects and renders canvas", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto(`${BASE}/slither`);
    await page.waitForTimeout(1000);
    await expect(page.locator("#slither-canvas")).toBeVisible();
    const wsRelated = errors.filter(
      (e) => e.includes("ws") || e.includes("WebSocket") || e.includes("500"),
    );
    expect(wsRelated).toEqual([]);
  });
});
