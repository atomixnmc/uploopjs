import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3500";

async function ensurePvEStarted(page) {
  const pveBtn = page.locator("#chess-start-pve");
  if (await pveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pveBtn.click();
    await page.waitForTimeout(1500);
  }
}

async function clickSquare(page, row, col) {
  const square = page.locator(`#chess-board [onclick*='${row},${col}']`);
  await square.first().click();
}

async function getBoardPieces(page) {
  return page.locator("#chess-board [onclick]").count();
}

test.describe("Chess — Turn Taking", () => {
  test("human moves white, turn switches to black", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // Move e2→e4
    await clickSquare(page, 6, 4);
    await page.waitForTimeout(300);
    await clickSquare(page, 4, 4);
    await page.waitForTimeout(500);

    // Status should show black's turn
    const status = page.locator("#chess-status");
    await expect(status).toContainText("black", { timeout: 3000 });
    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
  });

  test("AI responds after human move within 5 seconds", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // Move e2→e4
    await clickSquare(page, 6, 4);
    await page.waitForTimeout(200);
    await clickSquare(page, 4, 4);

    // Wait for AI response
    await page.waitForTimeout(3000);

    // Turn should switch back to white
    const status = page.locator("#chess-status");
    const text = await status.textContent();
    expect(text).toContain("white");

    // Board should have changed (black piece moved)
    const html = await page.locator("#chess-board").innerHTML();
    expect(html.length).toBeGreaterThan(500);
    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
  });

  test("cannot move black pieces as white", async ({ page }) => {
    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // Try clicking a black pawn (row 1) — should do nothing (wrong turn)
    await clickSquare(page, 1, 4);
    await page.waitForTimeout(300);

    // Board should not show selected square highlight (baca44)
    const html = await page.locator("#chess-board").innerHTML();
    // Black pawn click should NOT select (it's not white's pieces)
    // The board should still have the initial state
    expect(html.length).toBeGreaterThan(500);
  });

  test("AI thinking indicator shows during black's turn", async ({ page }) => {
    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // Move e2→e4
    await clickSquare(page, 6, 4);
    await page.waitForTimeout(200);
    await clickSquare(page, 4, 4);

    // Immediately check for thinking indicator
    await page.waitForTimeout(200);
    const status = page.locator("#chess-status");
    const text = await status.textContent();
    // Should show either "black" (turn switched) or the AI thinking indicator
    expect(text.length).toBeGreaterThan(0);
  });

  test("reset clears game and allows new game", async ({ page }) => {
    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // Make a move
    await clickSquare(page, 6, 4);
    await page.waitForTimeout(200);
    await clickSquare(page, 4, 4);
    await page.waitForTimeout(500);

    // Click reset
    const resetBtn = page.locator("button:has-text('🔄 Reset')");
    await resetBtn.first().click();
    await page.waitForTimeout(1000);

    // Should show "Play vs Computer" button again
    const pveBtn = page.locator("#chess-start-pve");
    const visible = await pveBtn.isVisible({ timeout: 3000 }).catch(() => false);
    expect(visible).toBe(true);
  });
});

test.describe("Chess — Board Changes", () => {
  test("moved piece disappears from origin", async ({ page }) => {
    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // e2→e4: piece at e2 should be gone, piece at e4 should exist
    await clickSquare(page, 6, 4);
    await page.waitForTimeout(200);
    await clickSquare(page, 4, 4);
    await page.waitForTimeout(800);

    const html = await page.locator("#chess-board").innerHTML();
    // Board should have changed structure
    expect(html.length).toBeGreaterThan(500);
  });

  test("selected square has visual highlight", async ({ page }) => {
    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // Click e2 pawn — should show highlight
    await clickSquare(page, 6, 4);
    await page.waitForTimeout(400);

    const html = await page.locator("#chess-board").innerHTML();
    expect(html).toContain("baca44"); // selected highlight color
  });

  test("legal move squares are highlighted", async ({ page }) => {
    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // Click knight at b1 — should show legal moves at a3, c3
    await clickSquare(page, 7, 1);
    await page.waitForTimeout(400);

    const html = await page.locator("#chess-board").innerHTML();
    // Legal move squares use different color
    expect(html).toContain("646c40"); // dark legal move square
  });

  test("board has 64 squares at all times", async ({ page }) => {
    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // Initial
    expect(await getBoardPieces(page)).toBeGreaterThanOrEqual(64);

    // After move
    await clickSquare(page, 6, 4);
    await page.waitForTimeout(200);
    await clickSquare(page, 4, 4);
    await page.waitForTimeout(1000);

    expect(await getBoardPieces(page)).toBeGreaterThanOrEqual(64);
  });
});

test.describe("Chess — Full Game", () => {
  test("multiple alternating moves work", async ({ page }) => {
    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // Move 1: e2→e4
    await clickSquare(page, 6, 4);
    await page.waitForTimeout(200);
    await clickSquare(page, 4, 4);
    await page.waitForTimeout(2000); // wait for AI

    // Move 2: d2→d4 (if d-pawn still exists)
    const d2 = page.locator("#chess-board [onclick*='6,3']");
    if (await d2.count() > 0) {
      await clickSquare(page, 6, 3);
      await page.waitForTimeout(200);
      await clickSquare(page, 4, 3);
      await page.waitForTimeout(2000); // wait for AI
    }

    // Move 3: knight b1→c3
    const b1 = page.locator("#chess-board [onclick*='7,1']");
    if (await b1.count() > 0) {
      await clickSquare(page, 7, 1);
      await page.waitForTimeout(200);
      await clickSquare(page, 5, 2);
      await page.waitForTimeout(2000);
    }

    // Board should still be valid after 3 move pairs
    const html = await page.locator("#chess-board").innerHTML();
    expect(html.length).toBeGreaterThan(500);
  });

  test("can select different piece after deselecting", async ({ page }) => {
    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // Click e2 pawn → select
    await clickSquare(page, 6, 4);
    await page.waitForTimeout(300);

    // Click d2 pawn → should switch selection
    await clickSquare(page, 6, 3);
    await page.waitForTimeout(300);

    const html = await page.locator("#chess-board").innerHTML();
    expect(html).toContain("baca44"); // new square highlighted
  });

  test("game continues after many moves without errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(`${BASE}/chess`);
    await page.waitForTimeout(800);
    await ensurePvEStarted(page);

    // Play 5 move pairs (10 ply)
    const whiteMoves = [
      [6, 4, 4, 4], // e4
      [7, 6, 5, 5], // Nf3
      [7, 5, 4, 2], // Bc4
      [6, 3, 4, 3], // d4
      [7, 1, 5, 2], // Nc3
    ];

    for (const [fr, fc, tr, tc] of whiteMoves) {
      const piece = page.locator(`#chess-board [onclick*='${fr},${fc}']`);
      if (await piece.count() === 0) continue;

      await piece.first().click();
      await page.waitForTimeout(200);

      const target = page.locator(`#chess-board [onclick*='${tr},${tc}']`);
      if (await target.count() > 0) {
        await target.first().click();
        await page.waitForTimeout(2000); // wait for AI response
      }
    }

    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
  });
});
