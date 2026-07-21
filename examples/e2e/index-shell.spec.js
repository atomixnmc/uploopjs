import { test, expect } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";

test.describe("index.html shell", () => {
  test("page loads with required DOM elements", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("#app")).toBeVisible();
    await expect(page.locator("#inspector-toggle")).toBeVisible();
    await expect(page.locator("#inspector-panel")).toBeAttached();
  });

  test("inspector panel is hidden on load", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("#inspector-panel")).not.toBeVisible();
    await expect(page.locator("#inspector-panel")).not.toHaveClass(/open/);
  });

  test("inspector toggle opens and closes panel", async ({ page }) => {
    await page.goto(BASE);
    const toggle = page.locator("#inspector-toggle");
    const panel = page.locator("#inspector-panel");

    // Open
    await toggle.click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveClass(/open/);

    // Close
    await toggle.click();
    await expect(panel).not.toBeVisible();
    await expect(panel).not.toHaveClass(/open/);
  });

  test("inspector panel opens after navigating to a demo", async ({ page }) => {
    await page.goto(BASE);

    // Navigate to Counter demo via Get Started button
    await page.click("text=Get Started");
    await page.waitForTimeout(500);

    // Verify navigation happened: demo slot is populated
    await expect(page.locator("#demo-slot")).toBeVisible();
    await expect(page.locator("#demo-slot")).not.toBeEmpty();

    // Open inspector — should show HyperGraph data for the active component
    await page.locator("#inspector-toggle").click();
    await expect(page.locator("#inspector-panel")).toBeVisible();
  });

  test("no CSP violations in console", async ({ page }) => {
    const cspViolations = [];
    page.on("console", (msg) => {
      if (msg.text().includes("Content Security Policy") || msg.text().includes("CSP")) {
        cspViolations.push(msg.text());
      }
    });
    await page.goto(BASE);
    await page.waitForTimeout(2000);

    // Navigate to a demo and back to exercise fetch/ws
    await page.click("text=Get Started");
    await page.waitForTimeout(500);

    expect(cspViolations.length).toBe(0);
  });

  test("no page errors on load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err));
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    expect(errors.length).toBe(0);
  });

  test("inspector toggle accessible via keyboard", async ({ page }) => {
    await page.goto(BASE);
    const toggle = page.locator("#inspector-toggle");

    await toggle.focus();
    await expect(toggle).toBeFocused();

    // Enter key toggles
    await page.keyboard.press("Enter");
    await expect(page.locator("#inspector-panel")).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.locator("#inspector-panel")).not.toBeVisible();
  });
});
