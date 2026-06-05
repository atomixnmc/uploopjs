# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: examples\canvas-e2e.spec.js >> async search >> search results appear after typing
- Location: examples\canvas-e2e.spec.js:58:3

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "Alice"
Received string:    "·······
        ⚡ Async Data Demo·········
          Demonstrates debounce (300ms),
          interruptible fetch, error retry
          with backoff, suspend loading states, and
          cache with TTL + SWR — all declarative, zero
          boilerplate.························································
          🕐 debounce: 300ms
          🛑 interruptible
          🔄 error: 3 retries
          💾 cache: 10s TTL + SWR······························
                Type to search users...·············································
            🔄 Force Refresh (bust cache)······················
            Clear Error State······················
            Invalidate Cache······························
          Debug: Loop State & Metadata
          Query:·
Pending (search): false
Error (search): none
Cache (results): {\"value\":[],\"fresh\":true,\"stale\":false,\"expired\":false,\"age\":6}
Results count: 0
Selected: none
Handler meta: {\"debounce\":300,\"interruptible\":true}
Events: 0 total, 0 rejected, depth 0················
    "
```

# Page snapshot

```yaml
- generic [ref=e1]:
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
      - heading "⚡ Async Data Demo" [level=2] [ref=e36]
      - paragraph [ref=e37]:
        - text: Demonstrates
        - strong [ref=e38]: debounce
        - text: (300ms),
        - strong [ref=e39]: interruptible
        - text: fetch,
        - strong [ref=e40]: error
        - text: retry with backoff,
        - strong [ref=e41]: suspend
        - text: loading states, and
        - strong [ref=e42]: cache
        - text: with TTL + SWR — all declarative, zero boilerplate.
      - textbox "Search users (try 'a', 'bob', 'grace')..." [active] [ref=e44]: al
      - generic [ref=e45]:
        - generic [ref=e46]: "🕐 debounce: 300ms"
        - generic [ref=e47]: 🛑 interruptible
        - generic [ref=e48]: "🔄 error: 3 retries"
        - generic [ref=e49]: "💾 cache: 10s TTL + SWR"
      - generic [ref=e51]: Type to search users...
      - generic [ref=e52]:
        - button "🔄 Force Refresh (bust cache)" [ref=e53] [cursor=pointer]
        - button "Clear Error State" [ref=e54] [cursor=pointer]
        - button "Invalidate Cache" [ref=e55] [cursor=pointer]
      - group [ref=e56]:
        - 'generic "Debug: Loop State & Metadata" [ref=e57]'
    - paragraph [ref=e58]: Pure ESM · No build · No JSX · HyperGraph architecture
  - button "⚡" [ref=e59] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | const BASE = 'http://localhost:3000'
  4  | 
  5  | test.describe('canvas examples', () => {
  6  |   test('Bouncing Ball canvas has drawn pixels after 2 seconds', async ({ page }) => {
  7  |     const errors = []
  8  |     page.on('pageerror', e => errors.push(e.message))
  9  |     page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  10 | 
  11 |     await page.goto(`${BASE}/?tab=animation`)
  12 |     await page.waitForTimeout(3000)
  13 | 
  14 |     const canvas = page.locator('canvas').first()
  15 |     const hasPixels = await canvas.evaluate(el => {
  16 |       const ctx = el.getContext('2d')
  17 |       const d = ctx.getImageData(100, 100, 50, 50).data
  18 |       for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true
  19 |       return false
  20 |     })
  21 |     expect(hasPixels).toBe(true)
  22 |     expect(errors.filter(e => !e.includes('favicon'))).toEqual([])
  23 |   })
  24 | 
  25 |   test('Cars canvas has drawn pixels', async ({ page }) => {
  26 |     await page.goto(`${BASE}/?tab=cars`)
  27 |     await page.waitForTimeout(3000)
  28 |     await page.click('button:has-text("Start")')
  29 |     await page.waitForTimeout(1000)
  30 | 
  31 |     const canvas = page.locator('canvas').first()
  32 |     const hasPixels = await canvas.evaluate(el => {
  33 |       const ctx = el.getContext('2d')
  34 |       const d = ctx.getImageData(200, 150, 50, 50).data
  35 |       for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true
  36 |       return false
  37 |     })
  38 |     expect(hasPixels).toBe(true)
  39 |   })
  40 | })
  41 | 
  42 | test.describe('async search', () => {
  43 |   test('typing in search box does not throw errors', async ({ page }) => {
  44 |     const errors = []
  45 |     page.on('pageerror', e => errors.push(e.message))
  46 | 
  47 |     await page.goto(`${BASE}/?tab=async`)
  48 |     await page.waitForTimeout(1000)
  49 | 
  50 |     const input = page.locator('input[placeholder*="Search"]')
  51 |     await input.fill('alice')
  52 |     await page.waitForTimeout(2000)
  53 | 
  54 |     const uploopErrors = errors.filter(e => e.includes('Uploop') || e.includes('query.trim'))
  55 |     expect(uploopErrors).toEqual([])
  56 |   })
  57 | 
  58 |   test('search results appear after typing', async ({ page }) => {
  59 |     await page.goto(`${BASE}/?tab=async`)
  60 |     await page.waitForTimeout(500)
  61 | 
  62 |     const input = page.locator('input[placeholder*="Search"]')
  63 |     await input.fill('al')
  64 |     await page.waitForTimeout(2000)
  65 | 
  66 |     // Should find Alice and Charlie (both contain "al")
  67 |     const results = page.locator('#demo-slot').textContent()
> 68 |     expect(await results).toContain('Alice')
     |                           ^ Error: expect(received).toContain(expected) // indexOf
  69 |   })
  70 | })
  71 | 
```