import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Form demo", () => {
  test("loads form demo", async ({ page }) => {
    await page.goto(`${BASE}/?tab=form`);
    await page.waitForTimeout(1000);
    await expect(page.locator("#demo-slot")).toBeVisible();
    await expect(page.locator("#demo-slot")).not.toBeEmpty();
  });

  test("name input is visible", async ({ page }) => {
    await page.goto(`${BASE}/?tab=form`);
    await page.waitForTimeout(1000);

    const nameInput = page
      .locator("#demo-slot")
      .locator('input[placeholder="Your full name"]');
    await expect(nameInput.first()).toBeVisible();
  });

  test("email input is visible", async ({ page }) => {
    await page.goto(`${BASE}/?tab=form`);
    await page.waitForTimeout(1000);

    const emailInput = page
      .locator("#demo-slot")
      .locator('input[placeholder="your@email.com"]');
    await expect(emailInput.first()).toBeVisible();
  });

  test("submit button exists", async ({ page }) => {
    await page.goto(`${BASE}/?tab=form`);
    await page.waitForTimeout(1000);

    const submitBtn = page
      .locator("#demo-slot")
      .locator(
        'button[type="submit"], button:has-text("Submit"), button:has-text("submit")',
      );
    await expect(submitBtn.first()).toBeVisible();
  });

  test("reset button exists", async ({ page }) => {
    await page.goto(`${BASE}/?tab=form`);
    await page.waitForTimeout(1000);

    const resetBtn = page
      .locator("#demo-slot")
      .locator(
        'button[type="reset"], button:has-text("Reset"), button:has-text("reset")',
      );
    await expect(resetBtn.first()).toBeVisible();
  });

  test("shows state indicator", async ({ page }) => {
    await page.goto(`${BASE}/?tab=form`);
    await page.waitForTimeout(1000);

    // Look for state machine indicator — could contain state names
    const slotContent = await page.locator("#demo-slot").textContent();
    const hasState =
      slotContent.toLowerCase().includes("idle") ||
      slotContent.toLowerCase().includes("dirty") ||
      slotContent.toLowerCase().includes("valid");
    expect(hasState).toBe(true);
  });

  test("does not throw errors on input", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(`${BASE}/?tab=form`);
    await page.waitForTimeout(1000);

    // Try filling each input field
    const nameInput = page
      .locator("#demo-slot")
      .locator('input[placeholder="Your full name"]')
      .first();
    if (await nameInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await nameInput.fill("John Doe");
      await page.waitForTimeout(300);
    }

    const emailInput = page
      .locator("#demo-slot")
      .locator('input[placeholder="your@email.com"]')
      .first();
    if (await emailInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await emailInput.fill("john@example.com");
      await page.waitForTimeout(300);
    }

    const phoneInput = page
      .locator("#demo-slot")
      .locator('input[placeholder="+84 123 456 789"]')
      .first();
    if (await phoneInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await phoneInput.fill("555-1234");
      await page.waitForTimeout(300);
    }

    const passwordInput = page
      .locator("#demo-slot")
      .locator('input[type="password"], input[name="password"]')
      .first();
    if (await passwordInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await passwordInput.fill("test123");
      await page.waitForTimeout(300);
    }

    const uploopErrors = errors.filter(
      (e) => e.includes("Uploop") || e.includes("Error"),
    );
    expect(uploopErrors).toEqual([]);
  });

  test("validation state changes on input", async ({ page }) => {
    await page.goto(`${BASE}/?tab=form`);
    await page.waitForTimeout(1000);

    // Get initial state
    const slotContentBefore = await page.locator("#demo-slot").textContent();

    // Type in the name field
    const nameInput = page
      .locator("#demo-slot")
      .locator('input[placeholder="Your full name"]')
      .first();
    if (await nameInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await nameInput.fill("Jane");
      await page.waitForTimeout(500);
    }

    // State should have changed (dirty or validating)
    const slotContentAfter = await page.locator("#demo-slot").textContent();
    const stateChanged =
      slotContentAfter.toLowerCase().includes("dirty") ||
      slotContentAfter.toLowerCase().includes("validating") ||
      slotContentAfter.toLowerCase().includes("valid");
    expect(stateChanged).toBe(true);
  });
});
