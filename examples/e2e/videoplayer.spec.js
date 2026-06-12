import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('videoplayer', () => {
  test('loads video player with playlist', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=videoplayer`)
    await page.waitForTimeout(1500)

    const slot = page.locator('#demo-slot')
    await expect(slot).toBeVisible()
    await expect(slot).not.toBeEmpty()

    // Should show the video slot container
    await expect(slot.locator('#video-slot')).toBeVisible({ timeout: 3000 })

    const uploopErrors = errors.filter(e => !e.includes('favicon'))
    expect(uploopErrors).toEqual([])
  })

  test('shows video playlist items', async ({ page }) => {
    await page.goto(`${BASE}/?tab=videoplayer`)
    await page.waitForTimeout(1500)

    const slot = page.locator('#demo-slot')

    // Check for playlist section header
    await expect(slot.locator('text=Playlist')).toBeVisible({ timeout: 3000 })

    // Check all video titles appear in playlist
    const videos = ['Big Buck Bunny', 'Jellyfish', 'Sintel']
    for (const title of videos) {
      await expect(slot.locator(`text=${title}`).first()).toBeVisible()
    }
  })

  test('video element exists', async ({ page }) => {
    await page.goto(`${BASE}/?tab=videoplayer`)
    await page.waitForTimeout(1500)

    // Video element is created in mount hook inside #video-slot
    const videoEl = page.locator('#video-slot video')
    await expect(videoEl.first()).toBeAttached({ timeout: 3000 })
  })

  test('does not throw errors on load', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`${BASE}/?tab=videoplayer`)
    await page.waitForTimeout(2000)

    const uploopErrors = errors.filter(
      e => !e.includes('favicon') && !e.includes('autoplay')
    )
    expect(uploopErrors).toEqual([])
  })
})
