import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('paint', () => {
  test('loads paint canvas', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=paint`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')
    await expect(slot).toBeVisible()
    await expect(slot).not.toBeEmpty()

    const uploopErrors = errors.filter(e => !e.includes('favicon'))
    expect(uploopErrors).toEqual([])
  })

  test('color picker is visible', async ({ page }) => {
    await page.goto(`${BASE}/?tab=paint`)
    await page.waitForTimeout(1000)

    const colorPicker = page.locator('#demo-slot input[type="color"]')
    await expect(colorPicker).toBeVisible({ timeout: 3000 })
  })

  test('brush size slider is visible', async ({ page }) => {
    await page.goto(`${BASE}/?tab=paint`)
    await page.waitForTimeout(1000)

    const sizeSlider = page.locator('#demo-slot input[type="range"]')
    await expect(sizeSlider).toBeVisible({ timeout: 3000 })
    await expect(sizeSlider).toHaveAttribute('min', '2')
    await expect(sizeSlider).toHaveAttribute('max', '30')
  })

  test('tool buttons are present', async ({ page }) => {
    await page.goto(`${BASE}/?tab=paint`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')

    // Brush and eraser tool buttons
    await expect(slot.locator('button:has-text("Brush")')).toBeVisible({ timeout: 3000 })
    await expect(slot.locator('button:has-text("Eraser")')).toBeVisible({ timeout: 3000 })
  })

  test('canvas element exists with correct dimensions or is non-null', async ({ page }) => {
    await page.goto(`${BASE}/?tab=paint`)
    await page.waitForTimeout(1500)

    const canvas = page.locator('#paint-canvas')
    await expect(canvas).toBeAttached({ timeout: 3000 })

    // Verify canvas has valid dimensions
    const width = await canvas.getAttribute('width')
    const height = await canvas.getAttribute('height')
    expect(Number(width)).toBeGreaterThan(0)
    expect(Number(height)).toBeGreaterThan(0)
  })

  test('does not throw errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=paint`)
    await page.waitForTimeout(2000)

    const uploopErrors = errors.filter(e => !e.includes('favicon'))
    expect(uploopErrors).toEqual([])
  })
})
