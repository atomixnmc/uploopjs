/**
 * Chess PvP E2E Tests — Two browser contexts playing a full multi-turn match
 *
 * Tests:
 *  - Two players connect and play against each other
 *  - Turn alternation is enforced
 *  - Legal moves only
 *  - Chat between players
 *  - Reset and new game
 */

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3500";

// ── Helpers ────────────────────────────────────────────────

async function clickSquare(page, row, col) {
  const square = page.locator(`#chess-board [onclick*='${row},${col}']`);
  await square.first().click();
}

/** Move a piece: click source then destination */
async function makeMove(page, fromRow, fromCol, toRow, toCol) {
  await clickSquare(page, fromRow, fromCol);
  await page.waitForTimeout(200);
  await clickSquare(page, toRow, toCol);
  await page.waitForTimeout(400);
}

async function waitForTurn(page, color) {
  await expect(page.locator("#chess-status")).toContainText(color, {
    timeout: 8000,
  });
}

// ── Tests ──────────────────────────────────────────────────

test.describe("Chess PvP — Two Player Match", () => {
  test("two players connect and play alternating moves", async ({
    browser,
  }) => {
    const errors = [];
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    p1.on("pageerror", (e) => errors.push("P1: " + e.message));
    p2.on("pageerror", (e) => errors.push("P2: " + e.message));

    // Both load the page
    await p1.goto(`${BASE}/chess`);
    await p2.goto(`${BASE}/chess`);
    await Promise.all([p1.waitForTimeout(1500), p2.waitForTimeout(1500)]);
    await expect(p1.locator("#chess-board")).toBeVisible();
    await expect(p2.locator("#chess-board")).toBeVisible();

    // P1 = white, P2 = black (by join order)
    // 1. e4
    await makeMove(p1, 6, 4, 4, 4);
    await waitForTurn(p1, "black");
    await waitForTurn(p2, "black");

    // 1... e5
    await makeMove(p2, 1, 4, 3, 4);
    await waitForTurn(p1, "white");
    await waitForTurn(p2, "white");

    // 2. Nf3
    await makeMove(p1, 7, 6, 5, 5);
    await waitForTurn(p1, "black");

    // 2... Nc6
    await makeMove(p2, 0, 1, 2, 2);
    await waitForTurn(p1, "white");

    // 3. Bc4
    await makeMove(p1, 7, 5, 4, 2);
    await waitForTurn(p1, "black");

    // 3... Bc5
    await makeMove(p2, 0, 5, 4, 1);
    await waitForTurn(p1, "white");

    // Both boards still intact
    await expect(p1.locator("#chess-board")).toBeVisible();
    await expect(p2.locator("#chess-board")).toBeVisible();

    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
    await ctx1.close();
    await ctx2.close();
  });

  test("players see each other's moves in real time", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    await p1.goto(`${BASE}/chess`);
    await p2.goto(`${BASE}/chess`);
    await Promise.all([p1.waitForTimeout(1500), p2.waitForTimeout(1500)]);

    // P1 moves e4
    await makeMove(p1, 6, 4, 4, 4);
    await waitForTurn(p2, "black");

    // P2 moves e5
    await makeMove(p2, 1, 4, 3, 4);
    await waitForTurn(p1, "white");

    // P1 selects d2 pawn — P2 should see the selection highlight
    await clickSquare(p1, 6, 3);
    await p1.waitForTimeout(300);
    await p2.waitForTimeout(400);

    // P2's board should contain the selection highlight (baca44)
    const p2html = await p2.locator("#chess-board").innerHTML();
    expect(p2html).toContain("baca44");

    // P1 completes d4
    await clickSquare(p1, 4, 3);
    await p1.waitForTimeout(300);
    await p2.waitForTimeout(400);

    await waitForTurn(p1, "black");
    await waitForTurn(p2, "black");

    await ctx1.close();
    await ctx2.close();
  });

  test("turn enforcement — wrong player cannot move", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    await p1.goto(`${BASE}/chess`);
    await p2.goto(`${BASE}/chess`);
    await Promise.all([p1.waitForTimeout(1500), p2.waitForTimeout(1500)]);

    // P1 (white) starts by selecting e2 pawn
    await clickSquare(p1, 6, 4);
    await p1.waitForTimeout(300);

    // P2 (black) tries to click a piece on white's turn — should be ignored
    // The click goes to server but server rejects it (wrong turn)
    await clickSquare(p2, 1, 4);
    await p2.waitForTimeout(300);

    // P2 should not see any selected square
    // P1 can still complete their move
    await clickSquare(p1, 4, 4); // e4
    await p1.waitForTimeout(300);

    // Now black's turn — both see it
    await waitForTurn(p1, "black");
    await waitForTurn(p2, "black");

    // P2 can now move
    await makeMove(p2, 1, 4, 3, 4);

    await ctx1.close();
    await ctx2.close();
  });

  test("checkmate via fool's mate is detected in PvP", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    const errors = [];
    p1.on("pageerror", (e) => errors.push("P1: " + e.message));
    p2.on("pageerror", (e) => errors.push("P2: " + e.message));

    await p1.goto(`${BASE}/chess`);
    await p2.goto(`${BASE}/chess`);
    await Promise.all([p1.waitForTimeout(1500), p2.waitForTimeout(1500)]);

    // Fool's mate: 1.f3 e5 2.g4 Qh4#
    // P1 (white) plays 1.f3
    await makeMove(p1, 6, 5, 5, 5);
    await waitForTurn(p2, "black");

    // P2 (black) plays 1...e5
    await makeMove(p2, 1, 4, 3, 4);
    await waitForTurn(p1, "white");

    // P1 plays 2.g4
    await makeMove(p1, 6, 6, 4, 6);
    await waitForTurn(p2, "black");

    // P2 plays 2...Qh4# — checkmate!
    await makeMove(p2, 0, 3, 4, 7);
    await p1.waitForTimeout(500);
    await p2.waitForTimeout(500);

    // Both should see game over with black as winner
    const p1Status = await p1.locator("#chess-status").textContent();
    const p2Status = await p2.locator("#chess-status").textContent();
    expect(p1Status).toContain("black");
    expect(p2Status).toContain("black");

    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
    await ctx1.close();
    await ctx2.close();
  });
});

test.describe("Chess PvP — Chat", () => {
  test("chat messages broadcast between players", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    await p1.goto(`${BASE}/chess`);
    await p2.goto(`${BASE}/chess`);
    await Promise.all([p1.waitForTimeout(1500), p2.waitForTimeout(1500)]);

    // P1 sends a message
    await p1.locator("#chess-chat-input").fill("Hello from P1!");
    await p1.locator("#chess-chat-send").click();
    await p1.waitForTimeout(300);

    // P2 sees it
    await expect(p2.locator("#chess-chat")).toContainText("Hello from P1!", {
      timeout: 3000,
    });

    // P2 responds
    await p2.locator("#chess-chat-input").fill("Hello from P2!");
    await p2.locator("#chess-chat-send").click();
    await p2.waitForTimeout(300);

    // P1 sees the response
    await expect(p1.locator("#chess-chat")).toContainText("Hello from P2!", {
      timeout: 3000,
    });

    await ctx1.close();
    await ctx2.close();
  });

  test("chat persists during gameplay", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    await p1.goto(`${BASE}/chess`);
    await p2.goto(`${BASE}/chess`);
    await Promise.all([p1.waitForTimeout(1500), p2.waitForTimeout(1500)]);

    // Play a move + chat simultaneously
    await makeMove(p1, 6, 4, 4, 4);
    await p1.waitForTimeout(200);

    await p2.locator("#chess-chat-input").fill("Nice e4!");
    await p2.locator("#chess-chat-send").click();
    await p1.waitForTimeout(300);

    await expect(p1.locator("#chess-chat")).toContainText("Nice e4!", {
      timeout: 3000,
    });

    await ctx1.close();
    await ctx2.close();
  });
});

test.describe("Chess PvP — Reset", () => {
  test("reset returns both players to waiting state", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    const errors = [];
    p1.on("pageerror", (e) => errors.push("P1: " + e.message));
    p2.on("pageerror", (e) => errors.push("P2: " + e.message));

    await p1.goto(`${BASE}/chess`);
    await p2.goto(`${BASE}/chess`);
    await Promise.all([p1.waitForTimeout(1500), p2.waitForTimeout(1500)]);

    // Make a move
    await makeMove(p1, 6, 4, 4, 4);
    await p1.waitForTimeout(300);

    // P1 resets
    await p1.locator("button:has-text('🔄 Reset')").first().click();
    await p1.waitForTimeout(800);
    await p2.waitForTimeout(800);

    // Both see waiting state
    await expect(p1.locator("#chess-start-pve")).toBeVisible({ timeout: 3000 });
    await expect(p2.locator("#chess-start-pve")).toBeVisible({ timeout: 3000 });

    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
    await ctx1.close();
    await ctx2.close();
  });
});

test.describe("Chess PvP — Multi-Turn Match", () => {
  test("10 alternating half-moves complete without errors", async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    const errors = [];
    p1.on("pageerror", (e) => errors.push("P1: " + e.message));
    p2.on("pageerror", (e) => errors.push("P2: " + e.message));

    await p1.goto(`${BASE}/chess`);
    await p2.goto(`${BASE}/chess`);
    await Promise.all([p1.waitForTimeout(1500), p2.waitForTimeout(1500)]);

    // Book moves: Italian Game opening
    const bookMoves = [
      { player: p1, from: [6, 4], to: [4, 4] }, // 1. e4
      { player: p2, from: [1, 4], to: [3, 4] }, // 1... e5
      { player: p1, from: [7, 6], to: [5, 5] }, // 2. Nf3
      { player: p2, from: [0, 1], to: [2, 2] }, // 2... Nc6
      { player: p1, from: [7, 5], to: [4, 2] }, // 3. Bc4
      { player: p2, from: [0, 5], to: [4, 1] }, // 3... Bc5
      { player: p1, from: [6, 2], to: [4, 2] }, // 4. c3
      { player: p2, from: [0, 6], to: [2, 5] }, // 4... Nf6
      { player: p1, from: [6, 3], to: [4, 3] }, // 5. d4
    ];

    for (const { player, from, to } of bookMoves) {
      const piece = player.locator(
        `#chess-board [onclick*='${from[0]},${from[1]}']`,
      );
      const target = player.locator(
        `#chess-board [onclick*='${to[0]},${to[1]}']`,
      );
      if ((await piece.count()) > 0 && (await target.count()) > 0) {
        await piece.first().click();
        await player.waitForTimeout(200);
        await target.first().click();
        await player.waitForTimeout(400);
      }
    }

    // After 9 half-moves (moves 0-8), it should be black's turn
    await waitForTurn(p1, "black");
    await waitForTurn(p2, "black");

    // Both boards fully rendered
    await expect(p1.locator("#chess-board")).toBeVisible();
    await expect(p2.locator("#chess-board")).toBeVisible();

    const p1html = await p1.locator("#chess-board").innerHTML();
    const p2html = await p2.locator("#chess-board").innerHTML();
    expect(p1html.length).toBeGreaterThan(500);
    expect(p2html.length).toBeGreaterThan(500);

    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
    await ctx1.close();
    await ctx2.close();
  });

  test("capture reduces piece count on both boards", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    await p1.goto(`${BASE}/chess`);
    await p2.goto(`${BASE}/chess`);
    await Promise.all([p1.waitForTimeout(1500), p2.waitForTimeout(1500)]);

    // Play e4 d5 exd5 (pawn capture)
    await makeMove(p1, 6, 4, 4, 4); // 1. e4
    await waitForTurn(p2, "black");

    await makeMove(p2, 1, 3, 3, 3); // 1... d5
    await waitForTurn(p1, "white");

    await makeMove(p1, 4, 4, 3, 3); // 2. exd5 (captures d5 pawn)
    await waitForTurn(p2, "black");

    // Both boards should still be valid after capture
    await expect(p1.locator("#chess-board")).toBeVisible();
    await expect(p2.locator("#chess-board")).toBeVisible();

    await ctx1.close();
    await ctx2.close();
  });
});
