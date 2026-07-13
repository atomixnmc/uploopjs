import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('StateMachine demo', () => {
  test('loads traffic light', async ({ page }) => {
    await page.goto(`${BASE}/?tab=statemachine`)
    await page.waitForTimeout(500)

    await expect(page.locator('#demo-slot')).toContainText('State Machine Demo')
    await expect(page.locator('#demo-slot')).toBeVisible()
  })

  test('shows initial state as red', async ({ page }) => {
    await page.goto(`${BASE}/?tab=statemachine`)
    // Initial state is "red" with a 4s duration — check quickly
    await page.waitForTimeout(300)

    await expect(page.locator('#demo-slot')).toContainText('State: red')
    await expect(page.locator('#demo-slot')).toContainText('● Running')
  })

  test('advances state on Next click', async ({ page }) => {
    await page.goto(`${BASE}/?tab=statemachine`)
    await page.waitForTimeout(300)

    // Pause auto-cycle so state doesn't change on its own
    await page.click('button:has-text("⏸ Pause")')
    await page.waitForTimeout(500)

    // Click Next to advance: red → green
    await page.click('button:has-text("Next →")')
    await page.waitForTimeout(500)

    await expect(page.locator('#demo-slot')).toContainText('State: green')
  })

  test('disables Emergency button after activation', async ({ page }) => {
    await page.goto(`${BASE}/?tab=statemachine`)
    await page.waitForTimeout(300)

    // Pause, then advance to green (Emergency only available from green)
    await page.click('button:has-text("⏸ Pause")')
    await page.waitForTimeout(500)
    await page.click('button:has-text("Next →")')
    await page.waitForTimeout(500)

    // Click Emergency
    const emergBtn = page.locator('button:has-text("Emergency")')
    await emergBtn.click()
    await page.waitForTimeout(300)

    // Button should now be disabled
    await expect(emergBtn).toBeDisabled()
  })

  test('pauses and resumes auto-cycle', async ({ page }) => {
    await page.goto(`${BASE}/?tab=statemachine`)
    await page.waitForTimeout(500)

    // Pause
    await page.click('button:has-text("⏸ Pause")')
    await page.waitForTimeout(500)
    await expect(page.locator('#demo-slot')).toContainText('■ Stopped')

    // Resume
    await page.click('button:has-text("▶ Resume")')
    await page.waitForTimeout(500)
    await expect(page.locator('#demo-slot')).toContainText('● Running')
  })

  test('does not error when cycling through states', async ({ page }) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(err))

    await page.goto(`${BASE}/?tab=statemachine`)

    // Let auto-cycle run — red(4s) + green(3s) + yellow(1.5s) = 8.5s cycle
    // Wait long enough to pass through multiple states
    await page.waitForTimeout(6000)

    expect(errors.length).toBe(0)
  })
})
