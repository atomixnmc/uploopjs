# E2E Test Guidelines for Uploop Examples

Each example in `examples/` needs a Playwright E2E test in `examples/e2e/`.
Tests verify that components render, respond to user interaction, and update the URL correctly.

## Test Structure

```
examples/e2e/
├── tab-navigation.spec.js   # Demo gallery tabs + URL routing
├── store.spec.js            # @uploop/store — cart CRUD + persistence
├── transition.spec.js       # CSS transitions (DOM persistence)
├── canvas.spec.js           # Canvas rendering (pixels on screen)
├── counter.spec.js          # Counter (TODO)
├── todo.spec.js             # Todo CRUD (TODO)
├── router.spec.js           # Router guards/params/layouts (TODO)
├── statemachine.spec.js     # State machine transitions (TODO)
├── form.spec.js             # Form validation (TODO)
├── async-data.spec.js       # Async debounce/suspend/cache (TODO)
├── css-demo.spec.js         # CSS utilities rendering (TODO)
├── blog.spec.js             # Blog data display (TODO)
├── grid.spec.js             # Data grid (TODO)
├── carousel.spec.js         # Carousel auto-advance (TODO)
├── audioplayer.spec.js      # Audio playback (TODO)
├── videoplayer.spec.js      # Video playback (TODO)
├── paint.spec.js            # Canvas drawing interactions (TODO)
├── tetris.spec.js           # Game rendering (TODO)
├── wheel.spec.js            # Spin animation (TODO)
├── fishes.spec.js           # Particle rendering (TODO)
└── cars.spec.js             # Canvas animation (TODO)
```

## Test Patterns by Example Type

### Pattern 1: Reactive UI (Counter, Todo, Store, Form)

```js
import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:3100'

test.describe('Counter', () => {
  test('increments count on button click', async ({ page }) => {
    await page.goto(`${BASE}/?tab=counter`)
    // Verify initial state
    await expect(page.locator('#demo-slot')).toContainText(/0/)
    // Interact
    await page.click('button:has-text("+1")')
    await page.waitForTimeout(100)
    // Verify state change
    await expect(page.locator('#demo-slot')).toContainText(/1/)
  })

  test('resets to zero', async ({ page }) => {
    await page.goto(`${BASE}/?tab=counter`)
    await page.click('button:has-text("+1")')
    await page.click('button:has-text("+1")')
    await page.click('button:has-text("Reset")')
    await expect(page.locator('#demo-slot')).toContainText(/0/)
  })
})
```

**Key assertions:**
- Component renders in `#demo-slot`
- Buttons are clickable
- State changes are reflected in DOM text
- URL updates to `?tab=xxx`

### Pattern 2: State Machine (traffic light)

```js
test('cycles through states', async ({ page }) => {
  await page.goto(`${BASE}/?tab=statemachine`)
  // Verify initial state
  await expect(page.locator('#demo-slot')).toContainText(/State:.*red/)
  // Trigger transition
  await page.click('button:has-text("Next")')
  await page.waitForTimeout(100)
  // Verify new state
  await expect(page.locator('#demo-slot')).toContainText(/State:.*green/)
})

test('emergency forces red', async ({ page }) => {
  await page.goto(`${BASE}/?tab=statemachine`)
  await page.click('button:has-text("Emergency")')
  await expect(page.locator('#demo-slot')).toContainText(/State:.*red/)
})
```

### Pattern 3: Router (guards, params, layouts)

```js
test('navigates to user detail via params', async ({ page }) => {
  await page.goto(`${BASE}/?tab=router`)
  // Login as admin
  await page.click('button:has-text("Login as Admin")')
  // Click a user link
  await page.click('a:has-text("Alice")')
  await page.waitForTimeout(300)
  // Verify user detail page
  await expect(page.locator('#demo-slot')).toContainText('Alice Johnson')
  await expect(page).toHaveURL(/#\/users\/1/)
})

test('admin guard blocks non-admin', async ({ page }) => {
  await page.goto(`${BASE}/?tab=router`)
  await page.click('button:has-text("Login as User")')
  await page.click('a:has-text("Admin")')
  // Should show alert/not navigate
  page.on('dialog', dialog => dialog.accept())
  await expect(page.locator('#demo-slot')).not.toContainText('Admin Panel')
})
```

### Pattern 4: Canvas (Bouncing Ball, Cars, Tetris, etc.)

```js
test('canvas has drawn pixels after animation starts', async ({ page }) => {
  await page.goto(`${BASE}/?tab=animation`)
  await page.waitForTimeout(3000) // Wait for rAF frames

  const hasPixels = await page.locator('canvas').first().evaluate(el => {
    const ctx = el.getContext('2d')
    const d = ctx.getImageData(100, 100, 50, 50).data
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true
    return false
  })
  expect(hasPixels).toBe(true)
})
```

**Key assertions for canvas:**
- Canvas element exists with correct dimensions
- getContext('2d') returns valid context
- getImageData shows non-zero alpha pixels after animation runs
- No page errors

### Pattern 5: CSS/Animation (Transitions, Keyframes)

```js
test('CSS transition animates smoothly', async ({ page }) => {
  await page.goto(`${BASE}/?tab=animation`)
  await page.click('button:has-text("✨ Transitions")')
  await page.waitForTimeout(500)

  // Tag element to verify DOM persistence
  await page.evaluate(() => {
    document.querySelector('#trans-box')._marker = 'ORIGINAL'
  })

  // Trigger state change
  await page.click('button[data-action="grow"]')

  // Check mid-transition value
  await page.waitForTimeout(200)
  const mid = await page.evaluate(() => {
    const box = document.querySelector('#trans-box')
    return { isSame: box?._marker === 'ORIGINAL', transform: getComputedStyle(box).transform }
  })
  expect(mid.isSame).toBe(true) // DOM persisted!

  // Check final value
  await page.waitForTimeout(500)
  const end = await page.evaluate(() => {
    return getComputedStyle(document.querySelector('#trans-box')).transform
  })
  expect(mid.transform).not.toBe(end.transform) // Transition was active!
})
```

### Pattern 6: Async (debounce, suspend, error)

```js
test('debounced search shows results', async ({ page }) => {
  await page.goto(`${BASE}/?tab=async`)
  const input = page.locator('input[placeholder*="Search"]')
  await input.fill('alice')
  // Wait for debounce (300ms) + simulated API delay
  await page.waitForTimeout(2000)
  await expect(page.locator('#demo-slot')).toContainText('Alice')
})

test('error state shows retry button', async ({ page }) => {
  // API simulates failures on first 2 calls
  await page.goto(`${BASE}/?tab=async`)
  const input = page.locator('input[placeholder*="Search"]')
  await input.fill('test')
  await page.waitForTimeout(3000)
  // Should show error or retry
  await expect(page.locator('#demo-slot')).toContainText(/Error|Retry/)
})
```

## Test Requirements Checklist

For each example, verify:

- [ ] Component renders without errors in `#demo-slot`
- [ ] URL is `?tab=xxx` after navigation
- [ ] At least one user interaction works (click, type, etc.)
- [ ] State change is reflected in DOM
- [ ] No console errors or uncaught exceptions
- [ ] Canvas examples: pixels are actually drawn
- [ ] Router examples: URL hash/params update correctly
- [ ] Store examples: data persists across interactions

## Running Tests

```bash
# Run a single test file
npx playwright test examples/e2e/store.spec.js

# Run all E2E tests
npx playwright test examples/e2e/

# Run with visible browser
npx playwright test examples/e2e/ --headed

# List tests without running
npx playwright test examples/e2e/ --list
```

## Test File Naming

`examples/e2e/<example-name>.spec.js` — matches the example directory name.
