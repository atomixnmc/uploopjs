import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("demo gallery tab navigation", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("text=Get Started")).toBeVisible();
  });

  test("Get Started navigates to Counter with correct URL and content", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.click("text=Get Started");
    await expect(page).toHaveURL(/tab=counter/);
    await expect(page.locator("#demo-slot")).toBeVisible();
    await expect(page.locator("#demo-slot")).not.toBeEmpty();
  });

  test("tab buttons navigate and update URL", async ({ page }) => {
    await page.goto(BASE);
    await page.click("text=Get Started");

    const checks = [
      { label: "Counter", url: /tab=counter/ },
      { label: "Todos", url: /tab=todo/ },
      { label: "🧭 Router", url: /tab=router/ },
      { label: "🛍 Store", url: /tab=store/ },
      { label: "🚗 Cars", url: /tab=cars/ },
    ];

    for (const { label, url } of checks) {
      await page.click(`button:has-text("${label}")`);
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(url);
      await expect(page.locator("#demo-slot")).toBeVisible();
    }
  });

  test("Home button returns to landing", async ({ page }) => {
    await page.goto(BASE);
    await page.click("text=Get Started");
    await page.click("text=← Home");
    await expect(page.locator("text=Get Started")).toBeVisible();
  });

  test("reload at ?tab=router shows router", async ({ page }) => {
    await page.goto(`${BASE}/?tab=router`);
    await page.waitForTimeout(1000);
    await expect(page.locator("#demo-slot")).toBeVisible();
  });

  test("cycle all 19 tabs without errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto(BASE);
    await page.click("text=Get Started");
    await page.waitForTimeout(300);

    const labels = [
      "Counter",
      "🎨 CSS",
      "Todos",
      "Form",
      "Grid",
      "Blog",
      "🧭 Router",
      "🛍 Store",
      "🚦 StateMachine",
      "🎨 Anim",
      "⚡ Async",
      "🖼 Carousel",
      "🎨 Paint",
      "🎵 Audio",
      "🎬 Video",
      "🎮 Tetris",
      "🎡 Wheel",
      "🐟 Fishes",
      "🚗 Cars",
    ];

    for (const label of labels) {
      const btn = page.locator(`button:has-text("${label}")`).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(200);
      }
    }

    expect(errors.length).toBe(0);
  });
});
