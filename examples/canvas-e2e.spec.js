import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('canvas examples', () => {
  test('Bouncing Ball canvas has drawn pixels after 2 seconds', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await page.goto(`${BASE}/?tab=animation`)
    await page.waitForTimeout(3000)

    const canvas = page.locator('canvas').first()
    const hasPixels = await canvas.evaluate(el => {
      const ctx = el.getContext('2d')
      const d = ctx.getImageData(100, 100, 50, 50).data
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true
      return false
    })
    expect(hasPixels).toBe(true)
    expect(errors.filter(e => !e.includes('favicon'))).toEqual([])
  })

  test('Cars canvas has drawn pixels', async ({ page }) => {
    await page.goto(`${BASE}/?tab=cars`)
    await page.waitForTimeout(3000)
    await page.click('button:has-text("Start")')
    await page.waitForTimeout(1000)

    const canvas = page.locator('canvas').first()
    const hasPixels = await canvas.evaluate(el => {
      const ctx = el.getContext('2d')
      const d = ctx.getImageData(200, 150, 50, 50).data
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true
      return false
    })
    expect(hasPixels).toBe(true)
  })
})

test.describe('async search', () => {
  test('typing in search box does not throw errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=async`)
    await page.waitForTimeout(1000)

    const input = page.locator('input[placeholder*="Search"]')
    await input.fill('alice')
    await page.waitForTimeout(2000)

    const uploopErrors = errors.filter(e => e.includes('Uploop') || e.includes('query.trim'))
    expect(uploopErrors).toEqual([])
  })

  test('search results appear after typing', async ({ page }) => {
    await page.goto(`${BASE}/?tab=async`)
    await page.waitForTimeout(500)

    const input = page.locator('input[placeholder*="Search"]')
    await input.fill('al')
    await page.waitForTimeout(2000)

    // Should find Alice and Charlie (both contain "al")
    const results = page.locator('#demo-slot').textContent()
    expect(await results).toContain('Alice')
  })
})
