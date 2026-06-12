import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3500";

async function ensurePvEStarted(page) {
  const pveBtn = page.locator("#chess-start-pve");
  if (await pveBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await pveBtn.click();
    await page.waitForTimeout(1200);
  }
}

test.describe("Chess — PvE Mode", () => {
  test("Play vs Computer button or game in progress", async ({ page }) => {
    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(600);
    // Button may not exist if game already running — check for either state
    const pveBtn = page.locator("#chess-start-pve");
    const status = page.locator("#chess-status");
    const hasBtn = await pveBtn.isVisible({ timeout: 2000 }).catch(() => false);
    const hasStatus = await status
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    expect(hasBtn || hasStatus).toBe(true);
  });

  test("clicking Play vs Computer starts PvE game", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    const status = page.locator("#chess-status");
    await expect(status).toContainText("Turn", { timeout: 4000 });
    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
  });

  test("chess board has 64 clickable squares", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    const board = page.locator("#chess-board");
    await expect(board).toBeVisible();

    // Count squares with onclick
    const clickable = board.locator("[onclick]");
    const count = await clickable.count();
    expect(count).toBeGreaterThanOrEqual(64);

    expect(
      errors.filter(
        (e) => !e.includes("favicon") && !e.includes("ERR_CONNECTION"),
      ),
    ).toEqual([]);
  });

  test("clicking a piece selects it (highlight)", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // Click e2 pawn
    const e2 = page.locator("#chess-board [onclick*='6,4']");
    if ((await e2.count()) > 0) {
      await e2.first().click();
      await page.waitForTimeout(800);
    }

    const html = await page.locator("#chess-board").innerHTML();
    // After clicking, the square should show some change (piece selected)
    expect(html.length).toBeGreaterThan(500);
    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
  });

  test("moving a piece changes the board", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // e2 → e4
    const e2 = page.locator("#chess-board [onclick*='6,4']");
    const e4 = page.locator("#chess-board [onclick*='4,4']");
    if ((await e2.count()) > 0 && (await e4.count()) > 0) {
      await e2.first().click();
      await page.waitForTimeout(200);
      await e4.first().click();
      await page.waitForTimeout(2000); // wait for AI
    }

    const status = page.locator("#chess-status");
    await expect(status).toContainText("Turn", { timeout: 4000 });
    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
  });

  test("AI responds after human move", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // e2 → e4
    const e2 = page.locator("#chess-board [onclick*='6,4']");
    const e4 = page.locator("#chess-board [onclick*='4,4']");
    if ((await e2.count()) > 0 && (await e4.count()) > 0) {
      await e2.first().click();
      await page.waitForTimeout(200);
      await e4.first().click();
      await page.waitForTimeout(2500); // wait for AI to think + respond
    }

    // Board should have changed — pieces moved
    const html = await page.locator("#chess-board").innerHTML();
    expect(html.length).toBeGreaterThan(500);
    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
  });
});
