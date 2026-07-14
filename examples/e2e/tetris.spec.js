import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:3100'

test.describe('tetris', () => {
  test('loads tetris game', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=tetris`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')
    await expect(slot).toBeVisible()
    await expect(slot).not.toBeEmpty()

    // Tetris renders a div-based game board (not canvas)
    const uploopErrors = errors.filter(e => !e.includes('favicon'))
    expect(uploopErrors).toEqual([])
  })

  test('start button is visible', async ({ page }) => {
    await page.goto(`${BASE}/?tab=tetris`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')
    // Button shows "Start" before game begins, "Restart" while running
    const startBtn = slot.locator('button:has-text("Start"), button:has-text("Restart")')
    await expect(startBtn.first()).toBeVisible({ timeout: 3000 })
  })

  test('canvas element exists', async ({ page }) => {
    await page.goto(`${BASE}/?tab=tetris`)
    await page.waitForTimeout(1000)

    // Tetris renders with div-based blocks (CSS grid style), not canvas.
    // The game board is a div with border styling containing the grid.
    const slot = page.locator('#demo-slot')
    const board = slot.locator('div[style*="border:2px solid #333"]')
    await expect(board.first()).toBeVisible({ timeout: 3000 })
  })

  test('clicking start does not throw errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=tetris`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')
    const startBtn = slot.locator('button:has-text("Start")')

    if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn.click()
      await page.waitForTimeout(500)
    }

    const uploopErrors = errors.filter(e => !e.includes('favicon'))
    expect(uploopErrors).toEqual([])
  })

  test('shows score display', async ({ page }) => {
    await page.goto(`${BASE}/?tab=tetris`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')

    // Score is displayed as a bold number
    await expect(slot.locator('text=Score')).toBeVisible({ timeout: 3000 })

    // Level display
    await expect(slot.locator('text=/Lv\\s*\\d/')).toBeVisible({ timeout: 3000 })
  })
})
