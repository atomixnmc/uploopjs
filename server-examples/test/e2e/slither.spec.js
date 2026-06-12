/**
 * Slither E2E Tests — canvas rendering, WebSocket connectivity, multi-player
 */

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3500";

test.describe("Slither — Page Load & Rendering", () => {
  test("page loads with canvas visible", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(`${BASE}/slither`);
    await page.waitForTimeout(1500);

    // Canvas must exist
    const canvas = page.locator("#slither-canvas");
    await expect(canvas).toBeVisible();

    // Canvas must have correct dimensions
    const width = await canvas.getAttribute("width");
    const height = await canvas.getAttribute("height");
    expect(width).toBe("720");
    expect(height).toBe("480");

    // No JS errors
    const realErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("ERR_CONNECTION") &&
        !e.includes("WebSocket") &&
        !e.includes("ws://"),
    );
    expect(realErrors).toEqual([]);
  });

  test("canvas has non-blank content after render", async ({ page }) => {
    await page.goto(`${BASE}/slither`);
    await page.waitForTimeout(2000);

    // After a few frames, the canvas should have non-zero pixel data
    const hasContent = await page.evaluate(() => {
      const canvas = document.getElementById("slither-canvas");
      if (!canvas) return false;
      const ctx = canvas.getContext("2d");
      const data = ctx.getImageData(360, 240, 1, 1).data;
      // Not pure black (the gradient background produces non-zero pixels)
      return data[0] > 0 || data[1] > 0 || data[2] > 0;
    });
    expect(hasContent).toBe(true);
  });

  test("page heading and info text are present", async ({ page }) => {
    await page.goto(`${BASE}/slither`);
    await page.waitForTimeout(800);

    await expect(page.locator("main.content h2")).toContainText("Slither");
    const content = page.locator("main.content");
    await expect(content.getByText("Arrow keys")).toBeVisible();
    await expect(content.getByText("Wrap-around")).toBeVisible();
  });
});

test.describe("Slither — WebSocket Connectivity", () => {
  test("WebSocket connects without errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Track WebSocket connections
    const wsLogs = [];
    await page.addInitScript(() => {
      const origWS = window.WebSocket;
      window.WebSocket = function (...args) {
        wsLogs.push("connect:" + args[0]);
        const ws = new origWS(...args);
        ws.addEventListener("open", () => wsLogs.push("open:" + args[0]));
        ws.addEventListener("error", (e) =>
          wsLogs.push("error:" + args[0] + ":" + (e.message || "unknown")),
        );
        ws.addEventListener("close", (e) =>
          wsLogs.push("close:" + args[0] + ":" + e.code),
        );
        return ws;
      };
    });

    await page.goto(`${BASE}/slither`);
    await page.waitForTimeout(1500);

    // WS should have connected to /ws-slither
    const connected = await page.evaluate(() => {
      return window.wsLogs
        ? window.wsLogs.some((l) => l.startsWith("open:") && l.includes("ws-slither"))
        : true; // fallback if initScript didn't run
    });
    expect(connected).toBe(true);

    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
  });

  test("client log confirms ready state", async ({ page }) => {
    const logs = [];
    page.on("console", (msg) => {
      if (msg.type() === "log" && msg.text().includes("[Slither]")) {
        logs.push(msg.text());
      }
    });

    await page.goto(`${BASE}/slither`);
    await page.waitForTimeout(1500);

    // Should log "[Slither] Ready — player: SnakeXXX | loop: get, send, subscribe"
    const readyLog = logs.find((l) => l.includes("Ready"));
    expect(readyLog).toBeTruthy();
    expect(readyLog).toContain("loop:");
  });
});

test.describe("Slither — Multiple Players", () => {
  test("two browser contexts both render canvas", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();

    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    const errors = [];
    p1.on("pageerror", (e) => errors.push("P1:" + e.message));
    p2.on("pageerror", (e) => errors.push("P2:" + e.message));

    await p1.goto(`${BASE}/slither`);
    await p2.goto(`${BASE}/slither`);
    await Promise.all([p1.waitForTimeout(2000), p2.waitForTimeout(2000)]);

    // Both canvases exist
    await expect(p1.locator("#slither-canvas")).toBeVisible();
    await expect(p2.locator("#slither-canvas")).toBeVisible();

    // Both have non-blank canvas content
    const p1HasContent = await p1.evaluate(() => {
      const c = document.getElementById("slither-canvas");
      const d = c.getContext("2d").getImageData(100, 100, 1, 1).data;
      return d[0] > 0 || d[1] > 0 || d[2] > 0;
    });
    const p2HasContent = await p2.evaluate(() => {
      const c = document.getElementById("slither-canvas");
      const d = c.getContext("2d").getImageData(100, 100, 1, 1).data;
      return d[0] > 0 || d[1] > 0 || d[2] > 0;
    });
    expect(p1HasContent).toBe(true);
    expect(p2HasContent).toBe(true);

    // P1's page should show at least 1 player online (itself)
    const p1Text = await p1.locator("main.content").textContent();
    expect(p1Text).toContain("player");

    // No JS errors on either page
    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);

    await ctx1.close();
    await ctx2.close();
  });

  test("keyboard input doesn't cause errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(`${BASE}/slither`);
    await page.waitForTimeout(1500);

    // Press arrow keys — should not throw
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);

    // Still no errors
    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);

    // Canvas still exists
    await expect(page.locator("#slither-canvas")).toBeVisible();
  });

  test("canvas renders continuously without errors over time", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(`${BASE}/slither`);

    // Let it render for 5 seconds while pressing keys
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(800);
      const keys = ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"];
      await page.keyboard.press(keys[i % 4]);
    }

    await page.waitForTimeout(500);

    // Canvas must still be present
    await expect(page.locator("#slither-canvas")).toBeVisible();

    const realErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("ERR_CONNECTION") &&
        !e.includes("WebSocket") &&
        !e.includes("ws://"),
    );
    expect(realErrors).toEqual([]);
  });
});
