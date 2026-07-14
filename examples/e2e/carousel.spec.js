import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:3100'

test.describe('Carousel', () => {
  test('loads carousel', async ({ page }) => {
    await page.goto(`${BASE}/?tab=carousel`)
    // Allow time for external images to load
    await page.waitForTimeout(3000)

    // Carousel should be mounted in demo-slot
    await expect(page.locator('#demo-slot')).not.toBeEmpty()
    await expect(page.locator('#demo-slot')).toContainText('⏸ Pause')
  })

  test('navigates to next slide via arrow', async ({ page }) => {
    await page.goto(`${BASE}/?tab=carousel`)
    await page.waitForTimeout(3000)

    // Click the next arrow (›)
    await page.locator('#demo-slot button').filter({ hasText: '›' }).click()
    await page.waitForTimeout(1000)

    // Carousel area should still be visible
    const imageLayer = page.locator('#demo-slot div[role="img"]').first()
    await expect(imageLayer).toBeVisible()
    const bg = await imageLayer.getAttribute('style')
    expect(bg).toContain('picsum.photos')
  })

  test('navigates to previous slide via arrow', async ({ page }) => {
    await page.goto(`${BASE}/?tab=carousel`)
    await page.waitForTimeout(3000)

    // Click prev arrow (‹)
    await page.locator('#demo-slot button').filter({ hasText: '‹' }).click()
    await page.waitForTimeout(1000)

    // Image area still visible
    const imageLayer = page.locator('#demo-slot div[role="img"]').first()
    await expect(imageLayer).toBeVisible()
    const bg = await imageLayer.getAttribute('style')
    expect(bg).toContain('picsum.photos')
  })

  test('pauses and resumes auto-play', async ({ page }) => {
    await page.goto(`${BASE}/?tab=carousel`)
    await page.waitForTimeout(3000)

    // Should start playing by default
    await expect(page.locator('#demo-slot')).toContainText('⏸ Pause')

    // Click pause
    await page.locator('#demo-slot button').filter({ hasText: '⏸ Pause' }).click()
    await page.waitForTimeout(500)

    await expect(page.locator('#demo-slot')).toContainText('▶ Play')

    // Click play to resume
    await page.locator('#demo-slot button').filter({ hasText: '▶ Play' }).click()
    await page.waitForTimeout(500)

    await expect(page.locator('#demo-slot')).toContainText('⏸ Pause')
  })

  test('image area is visible and has background', async ({ page }) => {
    await page.goto(`${BASE}/?tab=carousel`)
    // Allow ample time for picsum.photos to load
    await page.waitForTimeout(5000)

    // The "to" layer (z-index:2) should have a background-image
    const toLayer = page.locator('#demo-slot div[role="img"]').last()
    await expect(toLayer).toBeVisible()

    const style = await toLayer.getAttribute('style')
    expect(style).toContain('background-image')
    expect(style).toContain('picsum.photos')
  })
})
