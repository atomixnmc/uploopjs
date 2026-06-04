# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: examples\tab-e2e.spec.js >> demo gallery tab navigation >> tab buttons navigate to correct URLs
- Location: examples\tab-e2e.spec.js:22:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button[data-tab="counter"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Uploop" [level=1] [ref=e5]
      - button "← Home" [ref=e6] [cursor=pointer]
    - generic [ref=e7]:
      - generic [ref=e8]: Apps
      - button "Counter" [ref=e9] [cursor=pointer]
      - button "🎨 CSS" [ref=e10] [cursor=pointer]
      - button "Todos" [ref=e11] [cursor=pointer]
      - button "Form" [ref=e12] [cursor=pointer]
      - button "Grid" [ref=e13] [cursor=pointer]
      - button "Blog" [ref=e14] [cursor=pointer]
    - generic [ref=e15]:
      - generic [ref=e16]: Pkgs
      - button "🧭 Router" [ref=e17] [cursor=pointer]
      - button "🛍 Store" [ref=e18] [cursor=pointer]
      - button "🚦 StateMachine" [ref=e19] [cursor=pointer]
      - button "🎨 Anim" [ref=e20] [cursor=pointer]
      - button "⚡ Async" [ref=e21] [cursor=pointer]
    - generic [ref=e22]:
      - generic [ref=e23]: Media
      - button "🖼 Carousel" [ref=e24] [cursor=pointer]
      - button "🎨 Paint" [ref=e25] [cursor=pointer]
      - button "🎵 Audio" [ref=e26] [cursor=pointer]
      - button "🎬 Video" [ref=e27] [cursor=pointer]
    - generic [ref=e28]:
      - generic [ref=e29]: Games
      - button "🎮 Tetris" [ref=e30] [cursor=pointer]
      - button "🎡 Wheel" [ref=e31] [cursor=pointer]
      - button "🐟 Fishes" [ref=e32] [cursor=pointer]
      - button "🚗 Cars" [ref=e33] [cursor=pointer]
    - generic [ref=e35]:
      - button "Switch to Multi" [ref=e36] [cursor=pointer]
      - generic [ref=e37]: "0"
      - generic [ref=e38]:
        - button "-1" [ref=e39] [cursor=pointer]
        - button "+1" [ref=e40] [cursor=pointer]
      - button "Reset" [ref=e41] [cursor=pointer]
    - paragraph [ref=e42]: Pure ESM · No build · No JSX · HyperGraph architecture
  - button "⚡" [ref=e43] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | const BASE = "http://localhost:3000";
  4   | 
  5   | test.describe("demo gallery tab navigation", () => {
  6   |   test("landing page loads with Get Started button", async ({ page }) => {
  7   |     await page.goto(BASE);
  8   |     await page.waitForSelector("text=Get Started");
  9   |     await expect(page.locator("text=Uploop").first()).toBeVisible();
  10  |   });
  11  | 
  12  |   test("clicking Get Started navigates to Counter", async ({ page }) => {
  13  |     await page.goto(BASE);
  14  |     await page.click("text=Get Started");
  15  |     await expect(page).toHaveURL(/tab=counter/);
  16  |     const slot = page.locator("#demo-slot");
  17  |     await expect(slot).toBeVisible();
  18  |     // Counter shows a number display
  19  |     await expect(slot.locator("div")).not.toHaveCount(0);
  20  |   });
  21  | 
  22  |   test("tab buttons navigate to correct URLs", async ({ page }) => {
  23  |     await page.goto(BASE);
  24  |     await page.click("text=Get Started");
  25  |     await page.waitForSelector("#demo-slot");
  26  | 
  27  |     const tabs = [
  28  |       { label: "Counter", urlPattern: /tab=counter/ },
  29  |       { label: "Todos", urlPattern: /tab=todo/ },
  30  |       { label: "Router", urlPattern: /tab=router/ },
  31  |       { label: "Store", urlPattern: /tab=store/ },
  32  |       { label: "Cars", urlPattern: /tab=cars/ },
  33  |     ];
  34  | 
  35  |     for (const tab of tabs) {
> 36  |       await page.click(
      |                  ^ Error: page.click: Test timeout of 30000ms exceeded.
  37  |         `button[data-tab="${tab.label === "Todos" ? "todo" : tab.label === "Router" ? "router" : tab.label === "Store" ? "store" : tab.label === "Cars" ? "cars" : "counter"}"]`,
  38  |       );
  39  |       await page.waitForTimeout(500);
  40  |       await expect(page).toHaveURL(tab.urlPattern);
  41  |       // At minimum the demo-slot should be present
  42  |       await expect(page.locator("#demo-slot")).toBeVisible();
  43  |     }
  44  |   });
  45  | 
  46  |   test("Home button returns to landing page", async ({ page }) => {
  47  |     await page.goto(BASE);
  48  |     await page.click("text=Get Started");
  49  |     await page.waitForSelector("#demo-slot");
  50  |     await page.click("text=← Home");
  51  |     await expect(page.locator("text=Get Started")).toBeVisible();
  52  |   });
  53  | 
  54  |   test("URL shows correct tab on page reload", async ({ page }) => {
  55  |     await page.goto(`${BASE}/?tab=router`);
  56  |     await page.waitForTimeout(1000);
  57  |     await expect(page.locator("#demo-slot")).toBeVisible();
  58  |   });
  59  | 
  60  |   test("can cycle through all 19 tabs without errors", async ({ page }) => {
  61  |     const errors = [];
  62  |     page.on("pageerror", (err) => errors.push(err));
  63  | 
  64  |     await page.goto(BASE);
  65  |     await page.click("text=Get Started");
  66  |     await page.waitForTimeout(300);
  67  | 
  68  |     const allTabIds = [
  69  |       "counter",
  70  |       "css",
  71  |       "todo",
  72  |       "form",
  73  |       "grid",
  74  |       "blog",
  75  |       "router",
  76  |       "store",
  77  |       "statemachine",
  78  |       "animation",
  79  |       "async",
  80  |       "carousel",
  81  |       "paint",
  82  |       "audioplayer",
  83  |       "videoplayer",
  84  |       "tetris",
  85  |       "wheel",
  86  |       "fishes",
  87  |       "cars",
  88  |     ];
  89  | 
  90  |     for (const id of allTabIds) {
  91  |       const btn = page.locator(`button[data-tab="${id}"]`);
  92  |       if (await btn.isVisible()) {
  93  |         await btn.click();
  94  |         await page.waitForTimeout(300);
  95  |       }
  96  |     }
  97  | 
  98  |     expect(errors.length).toBe(0);
  99  |   });
  100 | });
  101 | 
```