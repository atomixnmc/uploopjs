import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('audioplayer', () => {
  test('loads audio player with playlist', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=audioplayer`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')
    await expect(slot).toBeVisible()
    await expect(slot).not.toBeEmpty()

    // Should show the current track area (Now Playing)
    const trackTitle = slot.locator('text=Synth Loop')
    await expect(trackTitle.first()).toBeVisible({ timeout: 3000 })

    const uploopErrors = errors.filter(e => !e.includes('favicon'))
    expect(uploopErrors).toEqual([])
  })

  test('shows playlist tracks', async ({ page }) => {
    await page.goto(`${BASE}/?tab=audioplayer`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')

    // Check for playlist section header
    await expect(slot.locator('text=Playlist')).toBeVisible({ timeout: 3000 })

    // Check all track titles appear
    const tracks = ['Synth Loop', 'Drum Beat', 'Bass Groove', 'Piano Chord', 'Ambient Pad']
    for (const title of tracks) {
      await expect(slot.locator(`text=${title}`).first()).toBeVisible()
    }
  })

  test('play button is visible', async ({ page }) => {
    await page.goto(`${BASE}/?tab=audioplayer`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')
    // Play/pause button contains ▶ or ⏸
    const playBtn = slot.locator('button:has-text("▶"), button:has-text("⏸")').first()
    await expect(playBtn).toBeVisible({ timeout: 3000 })
  })

  test('volume slider is present', async ({ page }) => {
    await page.goto(`${BASE}/?tab=audioplayer`)
    await page.waitForTimeout(1000)

    const slot = page.locator('#demo-slot')
    const volumeSlider = slot.locator('input[type="range"]').first()
    await expect(volumeSlider).toBeVisible({ timeout: 3000 })
    await expect(volumeSlider).toHaveAttribute('min', '0')
    await expect(volumeSlider).toHaveAttribute('max', '1')
  })

  test('does not throw errors on load', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=audioplayer`)
    await page.waitForTimeout(2000)

    const uploopErrors = errors.filter(
      e => !e.includes('favicon') && !e.includes('autoplay')
    )
    expect(uploopErrors).toEqual([])
  })
})
