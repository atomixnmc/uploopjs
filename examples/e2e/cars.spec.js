import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Cars canvas demo', () => {
  test('loads cars demo', async ({ page }) => {
    await page.goto(`${BASE}/?tab=cars`)
    await page.waitForTimeout(1000)
    await expect(page.locator('#demo-slot')).toBeVisible()
    await expect(page.locator('#demo-slot')).not.toBeEmpty()
  })

  test('start button is visible', async ({ page }) => {
    await page.goto(`${BASE}/?tab=cars`)
    await page.waitForTimeout(1000)

    const startBtn = page.locator('#demo-slot').locator('button:has-text("Start")')
    await expect(startBtn).toBeVisible()
  })

  test('canvas element exists', async ({ page }) => {
    await page.goto(`${BASE}/?tab=cars`)
    await page.waitForTimeout(1000)

    const canvas = page.locator('#demo-slot').locator('canvas')
    await expect(canvas.first()).toBeVisible()
  })

  test('canvas renders content after starting and waiting', async ({ page }) => {
    await page.goto(`${BASE}/?tab=cars`)
    await page.waitForTimeout(2000)

    // Click Start to begin the cars animation
    await page.locator('#demo-slot').locator('button:has-text("Start")').click()
    await page.waitForTimeout(3000)

    const canvas = page.locator('#demo-slot').locator('canvas').first()
    const hasPixels = await canvas.evaluate(el => {
      const ctx = el.getContext('2d')
      if (!ctx) return false
      const d = ctx.getImageData(100, 100, 50, 50).data
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true
      return false
    })
    expect(hasPixels).toBe(true)
  })

  test('does not throw errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=cars`)
    await page.waitForTimeout(1000)

    // Click Start
    const startBtn = page.locator('#demo-slot').locator('button:has-text("Start")')
    if (await startBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await startBtn.click()
      await page.waitForTimeout(3000)
    }

    // Let animation run a bit longer
    await page.waitForTimeout(2000)

    const uploopErrors = errors.filter(e =>
      e.includes('Uploop') || e.includes('Error')
    )
    expect(uploopErrors).toEqual([])
  })
})
