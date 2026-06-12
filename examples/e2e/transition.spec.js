import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('CSS transitions', () => {
  test('animated box element persists across state changes (same DOM reference)', async ({ page }) => {
    await page.goto(`${BASE}/?tab=animation`)
    await page.waitForSelector('#anim-sub-container')

    // Click Transitions tab
    await page.click('button:has-text("✨ Transitions")')
    await page.waitForTimeout(500)

    // Get the box element reference before state change
    const refBefore = await page.evaluate(() => {
      const box = document.querySelector('#trans-box')
      if (!box) return null
      // Tag the element
      box._marker = 'ORIGINAL'
      return { marker: 'set', transform: box.style.transform || 'none' }
    })
    expect(refBefore).toBeTruthy()

    // Click Grow
    await page.click('button[data-action="grow"]')
    await page.waitForTimeout(100)

    // Check if the element is the SAME DOM reference
    const refAfter = await page.evaluate(() => {
      const box = document.querySelector('#trans-box')
      return {
        isSame: box?._marker === 'ORIGINAL',
        transform: box?.style.transform || 'none'
      }
    })

    // Element MUST be the same DOM reference for CSS transitions to work
    expect(refAfter.isSame).toBe(true)
    expect(refAfter.transform).not.toBe(refBefore.transform)
  })

  test('transform changes smoothly over time (transition is active)', async ({ page }) => {
    await page.goto(`${BASE}/?tab=animation`)
    await page.click('button:has-text("✨ Transitions")')
    await page.waitForTimeout(500)

    // Click Grow
    await page.click('button[data-action="grow"]')

    // Immediately check — should be at starting scale (1.0)
    const immediately = await page.evaluate(() => {
      const box = document.querySelector('#trans-box')
      return box ? getComputedStyle(box).transform : null
    })

    // Wait 200ms — should be transitioning (somewhere between 1.0 and 1.3)
    await page.waitForTimeout(200)
    const transitioning = await page.evaluate(() => {
      const box = document.querySelector('#trans-box')
      return box ? getComputedStyle(box).transform : null
    })

    // Wait 500ms — should have reached target (scale 1.3)
    await page.waitForTimeout(500)
    const finished = await page.evaluate(() => {
      const box = document.querySelector('#trans-box')
      return box ? getComputedStyle(box).transform : null
    })

    console.log('Immediate:', immediately)
    console.log('Transitioning:', transitioning)
    console.log('Finished:', finished)

    // At 200ms, the value should be DIFFERENT from the finished value
    // (proving the transition is in progress)
    if (transitioning && finished) {
      expect(transitioning).not.toBe(finished)
    }
  })

  test('multiple rapid state changes accumulate correctly', async ({ page }) => {
    await page.goto(`${BASE}/?tab=animation`)
    await page.click('button:has-text("✨ Transitions")')
    await page.waitForTimeout(500)

    // Click Grow four times rapidly
    for (let i = 0; i < 4; i++) {
      await page.click('button[data-action="grow"]')
      await page.waitForTimeout(50)
    }

    // Wait for transition to finish
    await page.waitForTimeout(2000)

    const finalTransform = await page.evaluate(() => {
      const box = document.querySelector('#trans-box')
      return box?.style.transform || 'none'
    })

    // After 4 grows: scale = min(1 + 0.3*4, 2.5) = 2.2
    expect(finalTransform).toContain('scale(2.2)')
  })
})
