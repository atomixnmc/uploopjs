import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:3100'

test.describe('fishes', () => {
  test('loads fishes game', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=fishes`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')
    await expect(slot).toBeVisible()
    await expect(slot).not.toBeEmpty()

    const uploopErrors = errors.filter(e => !e.includes('favicon'))
    expect(uploopErrors).toEqual([])
  })

  test('canvas element exists', async ({ page }) => {
    await page.goto(`${BASE}/?tab=fishes`)
    await page.waitForTimeout(1500)

    // Canvas is created in mount hook inside #fishes-container
    const container = page.locator('#fishes-container')
    await expect(container).toBeVisible({ timeout: 3000 })

    const canvas = container.locator('canvas')
    await expect(canvas.first()).toBeAttached({ timeout: 3000 })
  })

  test('does not throw errors on load', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=fishes`)
    await page.waitForTimeout(2000)

    const uploopErrors = errors.filter(e => !e.includes('favicon'))
    expect(uploopErrors).toEqual([])
  })

  test('canvas has rendered content after waiting', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=fishes`)
    await page.waitForTimeout(1500)

    // Click Start to begin the game
    const startBtn = page.locator('#demo-slot button:has-text("Start")')
    if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn.click()
    }

    // Wait for fish rendering (animation frames)
    await page.waitForTimeout(3000)

    // Check that the canvas has non-transparent pixels
    const canvas = page.locator('#fishes-container canvas').first()
    const hasPixels = await canvas.evaluate(el => {
      const ctx = el.getContext('2d')
      if (!ctx) return false
      // Sample the center of the canvas
      const w = el.width || 600
      const h = el.height || 200
      const d = ctx.getImageData(w / 2 - 25, h / 2 - 25, 50, 50).data
      for (let i = 3; i < d.length; i += 4) {
        if (d[i] > 0) return true
      }
      return false
    })
    expect(hasPixels).toBe(true)

    const uploopErrors = errors.filter(e => !e.includes('favicon'))
    expect(uploopErrors).toEqual([])
  })
})
