import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Counter demo', () => {
  test('loads counter at zero', async ({ page }) => {
    await page.goto(`${BASE}/?tab=counter`)
    await page.waitForTimeout(500)

    await expect(page.locator('#demo-slot')).toContainText('0')
    await expect(page.locator('button:has-text("+1")')).toBeVisible()
    await expect(page.locator('button:has-text("-1")')).toBeVisible()
    await expect(page.locator('button:has-text("Switch to Multi")')).toBeVisible()
  })

  test('increments count on +1 click', async ({ page }) => {
    await page.goto(`${BASE}/?tab=counter`)
    await page.waitForTimeout(300)

    await page.click('button:has-text("+1")')
    await page.waitForTimeout(300)

    // Count moves from 0 to 1 — "0" should no longer appear
    await expect(page.locator('#demo-slot')).not.toContainText('0')
  })

  test('decrements count on -1 click', async ({ page }) => {
    await page.goto(`${BASE}/?tab=counter`)
    await page.waitForTimeout(300)

    // Click -1 twice to reach -2 (avoids ambiguity with the "-1" button text)
    await page.click('button:has-text("-1")')
    await page.waitForTimeout(150)
    await page.click('button:has-text("-1")')
    await page.waitForTimeout(300)

    await expect(page.locator('#demo-slot')).toContainText('-2')
  })

  test('resets count to zero', async ({ page }) => {
    await page.goto(`${BASE}/?tab=counter`)
    await page.waitForTimeout(300)

    await page.click('button:has-text("+1")')
    await page.waitForTimeout(100)
    await page.click('button:has-text("+1")')
    await page.waitForTimeout(100)
    await page.click('button:has-text("+1")')
    await page.waitForTimeout(100)

    await page.click('button:has-text("Reset")')
    await page.waitForTimeout(300)

    await expect(page.locator('#demo-slot')).toContainText('0')
  })

  test('switches to multi-counter mode', async ({ page }) => {
    await page.goto(`${BASE}/?tab=counter`)
    await page.waitForTimeout(300)

    await page.click('button:has-text("Switch to Multi")')
    await page.waitForTimeout(300)

    await expect(page.locator('#demo-slot')).toContainText('count1:')
    await expect(page.locator('#demo-slot')).toContainText('count2:')
    await expect(page.locator('#demo-slot')).toContainText('Sum:')
    await expect(page.locator('button:has-text("count1 +1")')).toBeVisible()
    await expect(page.locator('button:has-text("count2 +2")')).toBeVisible()
  })

  test('increments count1 and count2 independently in multi mode', async ({ page }) => {
    await page.goto(`${BASE}/?tab=counter`)
    await page.waitForTimeout(300)
    await page.click('button:has-text("Switch to Multi")')
    await page.waitForTimeout(300)

    await page.click('button:has-text("count1 +1")')
    await page.waitForTimeout(200)
    await expect(page.locator('#demo-slot')).toContainText('count1: 1')

    await page.click('button:has-text("count2 +2")')
    await page.waitForTimeout(200)
    await expect(page.locator('#demo-slot')).toContainText('count2: 2')
  })

  test('sum updates correctly in multi mode', async ({ page }) => {
    await page.goto(`${BASE}/?tab=counter`)
    await page.waitForTimeout(300)
    await page.click('button:has-text("Switch to Multi")')
    await page.waitForTimeout(300)

    await page.click('button:has-text("count1 +1")')
    await page.waitForTimeout(100)
    await page.click('button:has-text("count1 +1")')
    await page.waitForTimeout(100)
    await page.click('button:has-text("count2 +2")')
    await page.waitForTimeout(200)

    // count1=2, count2=2 → Sum: 4
    await expect(page.locator('#demo-slot')).toContainText('Sum: 4')
  })

  test('switches back to single mode and resets', async ({ page }) => {
    await page.goto(`${BASE}/?tab=counter`)
    await page.waitForTimeout(300)
    await page.click('button:has-text("Switch to Multi")')
    await page.waitForTimeout(200)

    await page.click('button:has-text("count1 +1")')
    await page.waitForTimeout(100)
    await page.click('button:has-text("count2 +2")')
    await page.waitForTimeout(200)

    await page.click('button:has-text("Switch to Single")')
    await page.waitForTimeout(300)

    // Back in single mode with count reset to 0
    await expect(page.locator('button:has-text("Switch to Multi")')).toBeVisible()
    await expect(page.locator('#demo-slot')).toContainText('0')
  })
})
