/**
 * Blog CMS E2E Tests — with page error tracking and regression detection
 */

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3500";

// ── Helpers ────────────────────────────────────────────────

/** Create a page that tracks JS errors, console errors, and failed requests */
async function monitoredPage(context) {
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];

  page.on("pageerror", (e) => errors.push("PAGE: " + e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("CONSOLE: " + msg.text());
  });
  page.on("requestfailed", (req) => {
    failedRequests.push(req.url());
  });

  return { page, errors, failedRequests };
}

function assertNoErrors(errors) {
  const real = errors.filter(
    (e) =>
      !e.includes("favicon") &&
      !e.includes("ERR_CONNECTION") &&
      !e.includes("WebSocket") &&
      !e.includes("ws://"),
  );
  if (real.length > 0) {
    console.error("UNEXPECTED ERRORS:", real);
  }
  expect(real).toEqual([]);
}

// ── Tests ──────────────────────────────────────────────────

test.describe("Blog CMS — Page Load", () => {
  test("editor page renders with all required elements", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const { page, errors } = await monitoredPage(ctx);

    await page.goto(`${BASE}/blog/new`);
    await page.waitForTimeout(2000);

    // Required DOM elements must exist
    await expect(page.locator("#blog-editor-root")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("#be-title")).toBeVisible();
    await expect(page.locator("#be-save")).toBeVisible();
    await expect(page.locator("#be-save")).toContainText("Publish");

    // WYSIWYG toolbar + body must exist (mounted by client JS)
    await expect(page.locator(".up-wysiwyg-toolbar")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator(".up-wysiwyg-body")).toBeVisible();

    // Toolbar must have formatting buttons
    await expect(page.locator("button[data-cmd='bold']")).toBeVisible();
    await expect(page.locator("button[data-cmd='italic']")).toBeVisible();
    await expect(page.locator("button[data-media='image']")).toBeVisible();

    assertNoErrors(errors);
    await ctx.close();
  });

  test("WYSIWYG contenteditable is editable", async ({ browser }) => {
    const ctx = await browser.newContext();
    const { page, errors } = await monitoredPage(ctx);

    await page.goto(`${BASE}/blog/new`);
    await page.waitForTimeout(2000);

    const body = page.locator(".up-wysiwyg-body");
    await expect(body).toBeVisible();

    // Type into the WYSIWYG
    await body.click();
    await page.keyboard.type("Hello WYSIWYG!");

    // Content should appear in the DOM
    const html = await body.innerHTML();
    expect(html).toContain("Hello WYSIWYG!");

    assertNoErrors(errors);
    await ctx.close();
  });

  test("title input works", async ({ browser }) => {
    const ctx = await browser.newContext();
    const { page, errors } = await monitoredPage(ctx);

    await page.goto(`${BASE}/blog/new`);
    await page.waitForTimeout(2000);

    const title = page.locator("#be-title");
    await title.fill("My Post Title");
    await expect(title).toHaveValue("My Post Title");

    assertNoErrors(errors);
    await ctx.close();
  });
});

test.describe("Blog CMS — WYSIWYG Toolbar", () => {
  test("bold button inserts bold formatting", async ({ browser }) => {
    const ctx = await browser.newContext();
    const { page, errors } = await monitoredPage(ctx);

    await page.goto(`${BASE}/blog/new`);
    await page.waitForTimeout(2000);

    const body = page.locator(".up-wysiwyg-body");
    await body.click();
    await page.keyboard.type("Bold text");
    await page.keyboard.press("Control+a");
    await page.waitForTimeout(100);

    await page.locator("button[data-cmd='bold']").first().click();
    await page.waitForTimeout(200);

    const html = await body.innerHTML();
    expect(html).toMatch(/<b>|<strong>/i);

    assertNoErrors(errors);
    await ctx.close();
  });

  test("media buttons exist and show dialog", async ({ browser }) => {
    const ctx = await browser.newContext();
    const { page, errors } = await monitoredPage(ctx);

    await page.goto(`${BASE}/blog/new`);
    await page.waitForTimeout(2000);

    // Click image button
    await page.locator("button[data-media='image']").click();
    await page.waitForTimeout(300);

    // Media dialog appears
    const dialog = page.locator("#be-media-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#mf-src")).toBeVisible();

    // Close it
    await page.locator("#be-media-close").click();
    await expect(dialog).toBeHidden();

    assertNoErrors(errors);
    await ctx.close();
  });
});

test.describe("Blog CMS — Create & Edit Flow", () => {
  test("create post and verify it appears on blog list", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const { page, errors } = await monitoredPage(ctx);

    await page.goto(`${BASE}/blog/new`);
    await page.waitForTimeout(2000);

    // Fill title
    await page.locator("#be-title").fill("E2E Create Test " + Date.now());

    // Fill WYSIWYG
    const body = page.locator(".up-wysiwyg-body");
    await body.click();
    await page.keyboard.type(
      "This content was created by Playwright E2E test.",
    );

    // Save
    await page.locator("#be-save").click();
    await page.waitForTimeout(2500);

    // Should redirect to blog detail
    expect(page.url()).toMatch(/\/blog\/\d+$/);
    await expect(page.locator("main.content")).toContainText("E2E Create Test");

    assertNoErrors(errors);
    await ctx.close();
  });

  test("edit page loads with toolbar and content", async ({ browser }) => {
    const ctx = await browser.newContext();
    const { page, errors } = await monitoredPage(ctx);

    // Create a post via API
    const apiCtx = await browser.newContext();
    const apiPage = await apiCtx.newPage();
    const createRes = await apiPage.request.post(`${BASE}/api/blog`, {
      data: {
        title: "Edit E2E Test " + Date.now(),
        body: "<p><b>Rich content</b> for editing</p>",
        author: "E2E",
      },
    });
    expect(createRes.status()).toBe(201);
    const post = await createRes.json();
    await apiCtx.close();

    // Navigate to edit
    await page.goto(`${BASE}/blog/${post.id}/edit`);
    await page.waitForTimeout(3000);

    // Title must be pre-filled
    await expect(page.locator("#be-title")).toHaveValue(post.title);

    // WYSIWYG toolbar must be visible (proves client JS loaded)
    await expect(page.locator(".up-wysiwyg-toolbar")).toBeVisible({
      timeout: 5000,
    });

    // WYSIWYG body must contain the original content
    const bodyEl = page.locator(".up-wysiwyg-body");
    await expect(bodyEl).toBeVisible();
    const html = await bodyEl.innerHTML();
    expect(html).toContain("Rich content");

    // Cleanup
    await page.request.delete(`${BASE}/api/blog/${post.id}`);
    assertNoErrors(errors);
    await ctx.close();
  });

  test("edit and save updates the post", async ({ browser }) => {
    const ctx = await browser.newContext();
    const { page, errors } = await monitoredPage(ctx);

    // Create via API
    const apiCtx = await browser.newContext();
    const apiPage = await apiCtx.newPage();
    const cr = await apiPage.request.post(`${BASE}/api/blog`, {
      data: {
        title: "Update E2E " + Date.now(),
        body: "<p>Before</p>",
        author: "E2E",
      },
    });
    const post = await cr.json();
    await apiCtx.close();

    // Edit
    await page.goto(`${BASE}/blog/${post.id}/edit`);
    await page.waitForTimeout(3000);

    // Change title
    await page.locator("#be-title").fill("Updated via E2E");
    await page.waitForTimeout(200);

    // Save
    await page.locator("#be-save").click();
    await page.waitForTimeout(2500);

    // Verify via API
    const getRes = await page.request.get(`${BASE}/api/blog/${post.id}`);
    const updated = await getRes.json();
    expect(updated.title).toBe("Updated via E2E");

    // Cleanup
    await page.request.delete(`${BASE}/api/blog/${post.id}`);
    assertNoErrors(errors);
    await ctx.close();
  });
});

test.describe("Blog CMS — API", () => {
  test("GET /api/blog returns JSON array", async ({ request }) => {
    const res = await request.get(`${BASE}/api/blog`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("POST /api/blog creates and returns post with id", async ({
    request,
  }) => {
    const res = await request.post(`${BASE}/api/blog`, {
      data: {
        title: "API Test " + Date.now(),
        body: "<p>Test</p>",
        author: "E2E",
      },
    });
    expect(res.status()).toBe(201);
    const post = await res.json();
    expect(post.id).toBeGreaterThan(0);
    expect(post.title).toContain("API Test");

    // Cleanup via direct DB delete
    await request.delete(`${BASE}/api/blog/${post.id}`);
  });
});
