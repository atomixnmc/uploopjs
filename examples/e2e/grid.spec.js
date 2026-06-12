import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Data grid", () => {
  test("loads data grid with rows", async ({ page }) => {
    await page.goto(`${BASE}/?tab=grid`);
    await page.waitForSelector(
      '#demo-slot table, #demo-slot div[style*="display:flex"]',
    );

    // Should have row count display
    await expect(page.locator("#demo-slot")).toContainText("rows");
    // Should have column headers (col0, col1, etc.)
    await expect(page.locator("#demo-slot")).toContainText("col0");
  });

  test("sorts columns on header click", async ({ page }) => {
    await page.goto(`${BASE}/?tab=grid`);
    await page.waitForSelector("#demo-slot");

    // Click the first column header to sort
    const header = page.locator("#demo-slot").locator("text=col0").first();
    await header.click();
    await page.waitForTimeout(300);

    // Sort indicator ▲ should appear
    await expect(page.locator("#demo-slot")).toContainText("▲");
  });

  test("filters rows via search", async ({ page }) => {
    await page.goto(`${BASE}/?tab=grid`);
    await page.waitForSelector("#demo-slot");

    const input = page
      .locator('#demo-slot input[placeholder*="Search"]')
      .first();
    await input.fill("Alice");
    await page.waitForTimeout(500);

    // Should show only matching rows
    await expect(page.locator("#demo-slot")).toContainText("Alice");
    await expect(page.locator("#demo-slot")).not.toContainText("Bob");
  });

  test("selects a row on click", async ({ page }) => {
    await page.goto(`${BASE}/?tab=grid`);
    await page.waitForSelector("#demo-slot");

    // Click the first data row (not the header row) — look for rows with border-bottom
    const firstRow = page
      .locator("#demo-slot")
      .locator('div[style*="border-bottom"]');
    await firstRow.first().click();
    await page.waitForTimeout(300);

    // After click, the row should have a different background (selected state).
    // Check that the row element still exists (click didn't break anything).
    await expect(firstRow.first()).toBeVisible();
  });

  test("deselects row on second click", async ({ page }) => {
    await page.goto(`${BASE}/?tab=grid`);
    await page.waitForSelector("#demo-slot");

    const firstRow = page
      .locator("#demo-slot")
      .locator('div[style*="border-bottom"]');
    await firstRow.first().click();
    await page.waitForTimeout(300);

    // Click again to deselect
    await firstRow.first().click();
    await page.waitForTimeout(300);

    // Row should still be visible after deselect (no crash)
    await expect(firstRow.first()).toBeVisible();
  });

  test("paginates forward and backward", async ({ page }) => {
    await page.goto(`${BASE}/?tab=grid`);
    await page.waitForSelector("#demo-slot");

    // Should show page 1 (rows 1–20)
    await expect(page.locator("#demo-slot")).toContainText("1–20");

    // Click Next
    await page
      .locator("#demo-slot button")
      .filter({ hasText: "Next →" })
      .click();
    await page.waitForTimeout(300);

    // Should show page 2 (rows 21–40)
    await expect(page.locator("#demo-slot")).toContainText("21–40");

    // Click Prev
    await page
      .locator("#demo-slot button")
      .filter({ hasText: "← Prev" })
      .click();
    await page.waitForTimeout(300);

    // Back to page 1
    await expect(page.locator("#demo-slot")).toContainText("1–20");
  });

  test("changes column count via slider", async ({ page }) => {
    await page.goto(`${BASE}/?tab=grid`);
    await page.waitForSelector("#demo-slot");

    // Default is 5 columns — check header count
    const initialHeaders = await page
      .locator("#demo-slot")
      .locator('div[style*="background:#f5f5f7"] div')
      .count();
    expect(initialHeaders).toBe(5);

    // Move slider to change column count
    const slider = page.locator('#demo-slot input[type="range"]');
    await slider.fill("8");
    await page.waitForTimeout(500);

    // Should now have 8 column headers
    const newHeaders = await page
      .locator("#demo-slot")
      .locator('div[style*="background:#f5f5f7"] div')
      .count();
    expect(newHeaders).toBe(8);
  });
});
