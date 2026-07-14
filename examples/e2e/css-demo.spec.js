import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:3100'

test.describe('CSS demo', () => {
  test('loads CSS demo', async ({ page }) => {
    await page.goto(`${BASE}/?tab=css`)
    await page.waitForSelector('#demo-slot h1')

    await expect(page.locator('#demo-slot')).toContainText('@uploop/css')
  })

  test('switches between all four themes', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=css`)
    await page.waitForSelector('#demo-slot')

    const themes = ['Dark', 'Brand', 'Ocean', 'Light']
    for (const theme of themes) {
      await page.locator('#demo-slot button').filter({ hasText: theme }).click()
      await page.waitForTimeout(300)

      // Theme button should have active styling (white text on primary)
      const activeBtn = page.locator('#demo-slot button').filter({ hasText: theme })
      const color = await activeBtn.evaluate(el =>
        getComputedStyle(el).color
      )
      // Active buttons should be white text
      expect(color).toBe('rgb(255, 255, 255)')
    }

    expect(errors).toEqual([])
  })

  test('shows color shade bars', async ({ page }) => {
    await page.goto(`${BASE}/?tab=css`)
    await page.waitForSelector('#demo-slot')

    // Shade bars are labeled "primary — ", "success — ", "warning — "
    await expect(page.locator('#demo-slot')).toContainText('primary —')
    await expect(page.locator('#demo-slot')).toContainText('success —')
    await expect(page.locator('#demo-slot')).toContainText('warning —')

    // Shade bars have visible color blocks
    const shadeBlocks = page.locator('#demo-slot').locator(
      'div[style*="height:36px"]'
    )
    const count = await shadeBlocks.count()
    expect(count).toBeGreaterThanOrEqual(10)
  })

  test('shows animation cards', async ({ page }) => {
    await page.goto(`${BASE}/?tab=css`)
    await page.waitForSelector('#demo-slot')

    // Animation cards should be visible
    await expect(page.locator('#demo-slot')).toContainText('Fade In')
    await expect(page.locator('#demo-slot')).toContainText('Slide Up')
    await expect(page.locator('#demo-slot')).toContainText('Scale In')
    await expect(page.locator('#demo-slot')).toContainText('Spin')
    await expect(page.locator('#demo-slot')).toContainText('Pulse')
    await expect(page.locator('#demo-slot')).toContainText('Bounce')
  })

  test('does not throw errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=css`)
    await page.waitForSelector('#demo-slot')

    // Interact with theme switching and wait
    const themes = ['Dark', 'Brand', 'Ocean', 'Light']
    for (const theme of themes) {
      await page.locator('#demo-slot button').filter({ hasText: theme }).click()
      await page.waitForTimeout(200)
    }

    // No JS errors should have occurred
    expect(errors).toEqual([])
  })
})
