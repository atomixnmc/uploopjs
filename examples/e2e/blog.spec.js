import { test, expect } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";

test.describe("Blog demo", () => {
  test("loads blog post list", async ({ page }) => {
    await page.goto(`${BASE}/?tab=blog`);
    await page.waitForSelector("#demo-slot h3");

    await expect(page.locator("#demo-slot")).toContainText("Blog");
    await expect(page.locator("#demo-slot h3").first()).toBeVisible();
  });

  test("shows at least 3 posts", async ({ page }) => {
    await page.goto(`${BASE}/?tab=blog`);
    await page.waitForSelector("#demo-slot h3");

    const count = await page.locator("#demo-slot h3").count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("filters posts via search", async ({ page }) => {
    await page.goto(`${BASE}/?tab=blog`);
    await page.waitForSelector("#demo-slot h3");

    const input = page.locator(
      '#demo-slot input[placeholder="Search posts..."]',
    );
    await input.fill("Introducing");
    await page.waitForTimeout(500);

    const visible = await page.locator("#demo-slot h3").count();
    expect(visible).toBe(1);
    await expect(page.locator("#demo-slot h3").first()).toContainText(
      "Introducing",
    );
  });

  test("navigates to post detail on click", async ({ page }) => {
    await page.goto(`${BASE}/?tab=blog`);
    await page.waitForSelector("#demo-slot h3");

    // Click first post card
    await page.locator("#demo-slot h3").first().click();
    await page.waitForTimeout(500);

    // Detail view should show Back and Edit buttons
    await expect(page.locator("#demo-slot")).toContainText("← Back");
    await expect(page.locator("#demo-slot")).toContainText("✏ Edit");
  });

  test("shows post body in detail view", async ({ page }) => {
    await page.goto(`${BASE}/?tab=blog`);
    await page.waitForSelector("#demo-slot h3");

    await page.locator("#demo-slot h3").first().click();
    await page.waitForTimeout(500);

    // Body paragraphs should be visible
    const bodyParagraphs = page
      .locator("#demo-slot p")
      .filter({ hasText: /./ });
    await expect(bodyParagraphs.first()).toBeVisible();
    await expect(page.locator("#demo-slot")).toContainText(
      "Uploop is a universal",
    );
  });

  test("navigates to edit view", async ({ page }) => {
    await page.goto(`${BASE}/?tab=blog`);
    await page.waitForSelector("#demo-slot h3");

    await page.locator("#demo-slot h3").first().click();
    await page.waitForTimeout(500);

    await page
      .locator("#demo-slot button")
      .filter({ hasText: "✏ Edit" })
      .click();
    await page.waitForTimeout(500);

    // Edit view should have Save and Cancel
    await expect(page.locator("#demo-slot")).toContainText("💾 Save");
    await expect(page.locator("#demo-slot")).toContainText("← Cancel");
    await expect(page.locator("#demo-slot textarea")).toBeVisible();
  });

  test("cancels edit and returns to detail", async ({ page }) => {
    await page.goto(`${BASE}/?tab=blog`);
    await page.waitForSelector("#demo-slot h3");

    await page.locator("#demo-slot h3").first().click();
    await page.waitForTimeout(500);

    await page
      .locator("#demo-slot button")
      .filter({ hasText: "✏ Edit" })
      .click();
    await page.waitForTimeout(500);

    await page
      .locator("#demo-slot button")
      .filter({ hasText: "← Cancel" })
      .click();
    await page.waitForTimeout(500);

    // Back in detail view
    await expect(page.locator("#demo-slot")).toContainText("← Back");
    await expect(page.locator("#demo-slot")).toContainText("✏ Edit");
  });

  test("saves edit and shows updated content", async ({ page }) => {
    await page.goto(`${BASE}/?tab=blog`);
    await page.waitForSelector("#demo-slot h3");

    await page.locator("#demo-slot h3").first().click();
    await page.waitForTimeout(500);

    await page
      .locator("#demo-slot button")
      .filter({ hasText: "✏ Edit" })
      .click();
    await page.waitForTimeout(500);

    // Edit the title — input has no type attr, use scoped input selector
    const titleInput = page.locator("#demo-slot input").first();
    await titleInput.fill("Updated Blog Title");
    await page.waitForTimeout(300);

    await page
      .locator("#demo-slot button")
      .filter({ hasText: "💾 Save" })
      .click();
    await page.waitForTimeout(500);

    // Detail view should show updated title
    await expect(page.locator("#demo-slot")).toContainText(
      "Updated Blog Title",
    );
  });

  test("back button returns to list", async ({ page }) => {
    await page.goto(`${BASE}/?tab=blog`);
    await page.waitForSelector("#demo-slot h3");

    await page.locator("#demo-slot h3").first().click();
    await page.waitForTimeout(500);

    await page
      .locator("#demo-slot button")
      .filter({ hasText: "← Back" })
      .click();
    await page.waitForTimeout(500);

    // Should be back to list view with multiple posts (h3 titles)
    const count = await page.locator("#demo-slot h3").count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
