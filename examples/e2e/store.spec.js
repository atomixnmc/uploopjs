import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Store demo", () => {
  test("adds item to cart", async ({ page }) => {
    await page.goto(`${BASE}/?tab=store`);
    await expect(page.locator("text=Cart is empty")).toBeVisible();

    await page.locator('button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=Cart (1)")).toBeVisible();
    await expect(page.locator("#demo-slot")).toContainText("Total: $9.99");
  });

  test("removes item from cart", async ({ page }) => {
    await page.goto(`${BASE}/?tab=store`);
    await page.locator('button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(300);

    await page.click('button:has-text("×")');
    await page.waitForTimeout(300);
    await expect(page.locator("text=Cart is empty")).toBeVisible();
  });

  test("updates quantity via input", async ({ page }) => {
    await page.goto(`${BASE}/?tab=store`);
    await page.locator('button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(300);

    const input = page.locator('input[type="number"]');
    await input.fill("3");
    await input.press("Enter");
    await page.waitForTimeout(500);

    await expect(page.locator("#demo-slot")).toContainText("Total: $29.97");
  });

  test("clears cart", async ({ page }) => {
    await page.goto(`${BASE}/?tab=store`);

    // Add two different products
    const addBtns = page.locator('button:has-text("Add to Cart")');
    await addBtns.nth(0).click();
    await page.waitForTimeout(200);
    await addBtns.nth(1).click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=Cart (2)")).toBeVisible();

    await page.click('button:has-text("Clear")');
    await page.waitForTimeout(300);
    await expect(page.locator("text=Cart is empty")).toBeVisible();
  });
});
