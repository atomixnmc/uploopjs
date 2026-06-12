import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Todo demo', () => {
  test('loads empty todo list', async ({ page }) => {
    await page.goto(`${BASE}/?tab=todo`)
    await page.waitForTimeout(500)

    await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible()
    await expect(page.locator('button:has-text("Add")')).toBeVisible()
    await expect(page.locator('#demo-slot')).toContainText('0 left')
  })

  test('adds a new todo item', async ({ page }) => {
    await page.goto(`${BASE}/?tab=todo`)
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="What needs to be done?"]', 'Buy milk')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(300)

    await expect(page.locator('#demo-slot')).toContainText('Buy milk')
    await expect(page.locator('#demo-slot')).toContainText('1 left')
  })

  test('does not add empty todo', async ({ page }) => {
    await page.goto(`${BASE}/?tab=todo`)
    await page.waitForTimeout(300)

    // Click Add with empty input
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(300)

    // No todo should be added — count stays at 0
    await expect(page.locator('#demo-slot')).toContainText('0 left')
  })

  test('toggles todo completion via checkbox', async ({ page }) => {
    await page.goto(`${BASE}/?tab=todo`)
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="What needs to be done?"]', 'Buy milk')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(300)

    // Click the checkbox of the first todo
    await page.locator('#demo-slot input[type="checkbox"]').click()
    await page.waitForTimeout(300)

    // The span should gain line-through style
    const todoSpan = page.locator('#demo-slot li span').first()
    await expect(todoSpan).toHaveCSS('text-decoration-line', 'line-through')
    await expect(page.locator('#demo-slot')).toContainText('0 left')
  })

  test('removes a todo via × button', async ({ page }) => {
    await page.goto(`${BASE}/?tab=todo`)
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="What needs to be done?"]', 'Buy milk')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(300)

    await page.click('button:has-text("×")')
    await page.waitForTimeout(300)

    await expect(page.locator('#demo-slot')).not.toContainText('Buy milk')
    await expect(page.locator('#demo-slot')).toContainText('0 left')
  })

  test('filters to active todos', async ({ page }) => {
    await page.goto(`${BASE}/?tab=todo`)
    await page.waitForTimeout(300)

    // Add two todos
    await page.fill('input[placeholder="What needs to be done?"]', 'Todo 1')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(200)
    await page.fill('input[placeholder="What needs to be done?"]', 'Todo 2')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(200)

    // Complete the first todo
    await page.locator('#demo-slot input[type="checkbox"]').first().click()
    await page.waitForTimeout(200)

    // Click Active filter
    await page.click('button:has-text("Active")')
    await page.waitForTimeout(300)

    // Only the active (second) todo should be visible
    await expect(page.locator('#demo-slot')).toContainText('Todo 2')
    await expect(page.locator('#demo-slot')).not.toContainText('Todo 1')
  })

  test('filters to completed todos', async ({ page }) => {
    await page.goto(`${BASE}/?tab=todo`)
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="What needs to be done?"]', 'Todo 1')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(200)
    await page.fill('input[placeholder="What needs to be done?"]', 'Todo 2')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(200)

    // Complete the first todo
    await page.locator('#demo-slot input[type="checkbox"]').first().click()
    await page.waitForTimeout(200)

    // Click Completed filter
    await page.click('button:has-text("Completed")')
    await page.waitForTimeout(300)

    await expect(page.locator('#demo-slot')).toContainText('Todo 1')
    await expect(page.locator('#demo-slot')).not.toContainText('Todo 2')
  })

  test('shows All todos regardless of status', async ({ page }) => {
    await page.goto(`${BASE}/?tab=todo`)
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="What needs to be done?"]', 'Todo 1')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(200)
    await page.fill('input[placeholder="What needs to be done?"]', 'Todo 2')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(200)

    // Complete the first todo
    await page.locator('#demo-slot input[type="checkbox"]').first().click()
    await page.waitForTimeout(200)

    // Switch to a different filter then back to All
    await page.click('button:has-text("Completed")')
    await page.waitForTimeout(200)
    await page.click('button:has-text("All")')
    await page.waitForTimeout(300)

    // Both todos should be visible
    await expect(page.locator('#demo-slot')).toContainText('Todo 1')
    await expect(page.locator('#demo-slot')).toContainText('Todo 2')
  })

  test('clears completed todos', async ({ page }) => {
    await page.goto(`${BASE}/?tab=todo`)
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="What needs to be done?"]', 'Todo 1')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(200)
    await page.fill('input[placeholder="What needs to be done?"]', 'Todo 2')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(200)

    // Complete the first todo
    await page.locator('#demo-slot input[type="checkbox"]').first().click()
    await page.waitForTimeout(200)

    // Clear completed
    await page.click('button:has-text("Clear completed")')
    await page.waitForTimeout(300)

    await expect(page.locator('#demo-slot')).not.toContainText('Todo 1')
    await expect(page.locator('#demo-slot')).toContainText('Todo 2')
  })

  test('shows remaining count', async ({ page }) => {
    await page.goto(`${BASE}/?tab=todo`)
    await page.waitForTimeout(300)

    await page.fill('input[placeholder="What needs to be done?"]', 'Todo 1')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(200)
    await page.fill('input[placeholder="What needs to be done?"]', 'Todo 2')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(200)
    await page.fill('input[placeholder="What needs to be done?"]', 'Todo 3')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(200)

    await expect(page.locator('#demo-slot')).toContainText('3 left')

    // Complete one todo
    await page.locator('#demo-slot input[type="checkbox"]').first().click()
    await page.waitForTimeout(300)

    await expect(page.locator('#demo-slot')).toContainText('2 left')
  })
})
