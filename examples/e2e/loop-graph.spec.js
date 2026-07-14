import { test, expect } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";

test.describe("Loop Graph demo", () => {
  test("renders keyed loop rows and exposes loop metadata", async ({ page }) => {
    await page.goto(`${BASE}/?tab=loop-graph`);

    const slot = page.locator("#demo-slot");
    await expect(slot).toContainText("Loop Graph");
    await expect(slot).toContainText("loop kind:");
    await expect(slot).toContainText("uploop.html.loop");
    await expect(slot).toContainText("keys:");
    await expect(slot).toContainText("alpha, beta, gamma");

    await slot.locator("button", { hasText: "+1" }).first().click();
    await expect(slot).toContainText("Alpha");
    await expect(slot).toContainText("2");

    await page.locator("button", { hasText: "Reverse keyed order" }).click();
    await expect(slot).toContainText("gamma, beta, alpha");

    await page.screenshot({
      path: "tmp/screenshots/loop-graph-demo.png",
      fullPage: true,
    });
  });
});
