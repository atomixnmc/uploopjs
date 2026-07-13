import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('wheel', () => {
  test('loads lucky wheel', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=wheel`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')
    await expect(slot).toBeVisible()
    await expect(slot).not.toBeEmpty()

    const uploopErrors = errors.filter(e => !e.includes('favicon'))
    expect(uploopErrors).toEqual([])
  })

  test('wheel SVG is visible', async ({ page }) => {
    await page.goto(`${BASE}/?tab=wheel`)
    await page.waitForTimeout(1000)

    const svg = page.locator('#lucky-wheel-svg')
    await expect(svg).toBeVisible({ timeout: 3000 })

    // Should have colored segments (path elements with fill)
    const segments = svg.locator('path[fill]')
    const count = await segments.count()
    expect(count).toBeGreaterThan(0)
  })

  test('spin button is present', async ({ page }) => {
    await page.goto(`${BASE}/?tab=wheel`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')
    const spinBtn = slot.locator('button:has-text("Spin")')
    await expect(spinBtn).toBeVisible({ timeout: 3000 })
  })

  test('clicking spin shows result after animation', async ({ page }) => {
    await page.goto(`${BASE}/?tab=wheel`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')
    const spinBtn = slot.locator('button:has-text("Spin!")')

    // Click spin
    await spinBtn.click()

    // Wait for animation to complete (3s duration + buffer)
    await page.waitForTimeout(4000)

    // After animation, a result should be displayed
    // The result is shown in a div with background #f0f8ff
    const result = slot.locator('div[style*="#f0f8ff"]')
    await expect(result.first()).toBeVisible({ timeout: 5000 })

    // Should contain a prize label
    const resultText = await result.first().textContent()
    expect(resultText).toBeTruthy()
  })

  test('history list appears after spins', async ({ page }) => {
    await page.goto(`${BASE}/?tab=wheel`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')
    const spinBtn = slot.locator('button:has-text("Spin!")')

    // Spin twice
    await spinBtn.click()
    await page.waitForTimeout(4000)

    // Wait for button to be clickable again
    await page.waitForTimeout(500)
    const spinBtn2 = slot.locator('button:has-text("Spin!")')
    if (await spinBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await spinBtn2.click()
      await page.waitForTimeout(4000)
    }

    // History section should appear after spins
    await expect(slot.locator('text=History')).toBeVisible({ timeout: 3000 })

    // Should have at least one history item
    const historyItems = slot.locator('text=History').locator('..').locator('div')
    const count = await historyItems.count()
    expect(count).toBeGreaterThan(0)
  })
})
