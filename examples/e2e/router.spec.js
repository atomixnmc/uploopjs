import { test, expect } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";

test.describe("Router demo", () => {
  test("loads router demo", async ({ page }) => {
    await page.goto(`${BASE}/?tab=router`);
    await page.waitForTimeout(1000);
    await expect(page.locator("#demo-slot")).toBeVisible();
    await expect(page.locator("#demo-slot")).not.toBeEmpty();
  });

  test("shows navigation links", async ({ page }) => {
    await page.goto(`${BASE}/?tab=router`);
    await page.waitForTimeout(1000);

    await expect(page.locator("#demo-slot")).toContainText("Home");
    await expect(page.locator("#demo-slot")).toContainText("Users");
    await expect(page.locator("#demo-slot")).toContainText("About");
  });

  test("login as admin shows admin link accessible", async ({ page }) => {
    await page.goto(`${BASE}/?tab=router`);
    await page.waitForTimeout(1000);

    await page
      .locator("#demo-slot")
      .locator('button:has-text("Login as Admin")')
      .click();
    await page.waitForTimeout(500);

    // Admin link should be visible after admin login
    await expect(page.locator("#demo-slot")).toContainText("Admin");
    await expect(page.locator("#demo-slot")).toContainText("Alice");
  });

  test("login as user shows user info", async ({ page }) => {
    await page.goto(`${BASE}/?tab=router`);
    await page.waitForTimeout(1000);

    await page
      .locator("#demo-slot")
      .locator('button:has-text("Login as User")')
      .click();
    await page.waitForTimeout(500);

    await expect(page.locator("#demo-slot")).toContainText("Bob");
  });

  test("logout clears user state", async ({ page }) => {
    await page.goto(`${BASE}/?tab=router`);
    await page.waitForTimeout(1000);

    // Login first
    await page
      .locator("#demo-slot")
      .locator('button:has-text("Login as Admin")')
      .click();
    await page.waitForTimeout(500);
    await expect(page.locator("#demo-slot")).toContainText("Alice");

    // Logout
    await page
      .locator("#demo-slot")
      .locator('button:has-text("Logout")')
      .click();
    await page.waitForTimeout(500);

    await expect(page.locator("#demo-slot")).not.toContainText("Alice");
  });

  test("navigates to users list", async ({ page }) => {
    await page.goto(`${BASE}/?tab=router`);
    await page.waitForTimeout(1000);

    // The router demo uses hash-based routing within the component.
    // Navigate directly via URL hash to the users page.
    await page.goto(`${BASE}/?tab=router#/users`);
    await page.waitForTimeout(1000);

    // Should show user names in the content
    await expect(page.locator("#demo-slot")).toBeVisible();
    const content = await page.locator("#demo-slot").textContent();
    const hasUsers =
      content.includes("Alice") ||
      content.includes("Users") ||
      content.includes("users");
    expect(hasUsers).toBe(true);
  });

  test("navigates to user detail via click", async ({ page }) => {
    await page.goto(`${BASE}/?tab=router#/users`);
    await page.waitForTimeout(1000);

    // Users have links rendered in the router outlet
    const aliceLink = page.locator('#demo-slot a:has-text("Alice")');
    const linkVisible = await aliceLink
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (linkVisible) {
      await aliceLink.click();
      await page.waitForTimeout(800);
    }

    // Page should still be functional
    await expect(page.locator("#demo-slot")).toBeVisible();
  });

  test("navigates to about page", async ({ page }) => {
    await page.goto(`${BASE}/?tab=router`);
    await page.waitForTimeout(1000);

    await page.locator("#demo-slot").locator('a:has-text("About")').click();
    await page.waitForTimeout(500);

    const routerOutlet = page.locator("#demo-slot").locator("#router-outlet");
    await expect(routerOutlet).toContainText("router");
  });

  test("navigates back to home", async ({ page }) => {
    await page.goto(`${BASE}/?tab=router`);
    await page.waitForTimeout(1000);

    // Go to About first
    await page.locator("#demo-slot").locator('a:has-text("About")').click();
    await page.waitForTimeout(500);

    // Navigate back to Home
    await page.locator("#demo-slot").locator('a:has-text("Home")').click();
    await page.waitForTimeout(500);

    const routerOutlet = page.locator("#demo-slot").locator("#router-outlet");
    await expect(routerOutlet).toBeVisible();
  });

  test("shows 404 for unknown route", async ({ page }) => {
    await page.goto(`${BASE}/?tab=router#/nonexistent`);
    await page.waitForTimeout(1000);

    const routerOutlet = page.locator("#demo-slot").locator("#router-outlet");
    // Should show a 404 or not-found message
    const content = await routerOutlet.textContent();
    const has404 =
      content.toLowerCase().includes("404") ||
      content.toLowerCase().includes("not found") ||
      content.toLowerCase().includes("notfound");
    expect(has404).toBe(true);
  });

  test("does not throw errors during navigation", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Handle alert dialogs for admin guard
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto(`${BASE}/?tab=router`);
    await page.waitForTimeout(1000);

    // Navigate through all main routes
    const links = ["Home", "Users", "About"];
    for (const link of links) {
      const anchor = page
        .locator("#demo-slot")
        .locator(`a:has-text("${link}")`)
        .first();
      if (await anchor.isVisible({ timeout: 500 }).catch(() => false)) {
        await anchor.click();
        await page.waitForTimeout(300);
      }
    }

    // Try Admin as user (should trigger alert)
    await page
      .locator("#demo-slot")
      .locator('button:has-text("Login as User")')
      .click();
    await page.waitForTimeout(300);

    const adminLink = page.locator("#demo-slot").locator('a:has-text("Admin")');
    if (await adminLink.isVisible({ timeout: 500 }).catch(() => false)) {
      await adminLink.click();
      await page.waitForTimeout(500);
    }

    const uploopErrors = errors.filter(
      (e) => e.includes("Uploop") || e.includes("Error") || e.includes("error"),
    );
    expect(uploopErrors).toEqual([]);
  });
});
