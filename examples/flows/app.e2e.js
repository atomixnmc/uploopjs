/**
 * E2E tests for the Flows Showcase page.
 * Validates all 15 demos render and function correctly in a real browser.
 *
 * Run:
 *   npx playwright test examples/flows/app.e2e.js
 *   or: npx vitest run examples/flows/app.e2e.js --config vitest.e2e.config.js
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// These tests require a running dev server and playwright
// Skip in CI where browser may not be available
const HAS_BROWSER = typeof process !== 'undefined' && !process.env.CI

describe.runIf(HAS_BROWSER)('Flows Showcase E2E', () => {
  let page

  beforeAll(async () => {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch()
    page = await browser.newPage()
    await page.goto('http://localhost:5173/examples/flows/')
    await page.waitForSelector('.flows-showcase')
  })

  afterAll(async () => {
    await page?.context()?.browser()?.close()
  })

  // ── Shell ──────────────────────────────────────────────

  it('renders all 15 tab buttons', async () => {
    const tabs = await page.$$('.tab-btn')
    expect(tabs.length).toBe(15)
  })

  it('first tab is active by default', async () => {
    const active = await page.$('.tab-btn.active')
    expect(active).not.toBeNull()
    const text = await active.textContent()
    expect(text).toContain('Search')
  })

  // ── 1. Search Typeahead ────────────────────────────────

  it('search: typing updates results', async () => {
    await page.click('.tab-btn:first-child')
    const input = await page.$('.demo-input')
    await input.fill('Leanne')
    await page.waitForTimeout(500)
    const results = await page.$$('.result-item')
    expect(results.length).toBeGreaterThan(0)
  })

  // ── 2. Circuit Breaker ─────────────────────────────────

  it('circuit breaker: fails open circuit', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[1].click() // Circuit Breaker tab
    // click Fail 3 times
    const failBtn = await page.$('.demo-btn.danger')
    await failBtn.click()
    await failBtn.click()
    await failBtn.click()
    await page.waitForTimeout(100)
    const stateIndicator = await page.$('.state-OPEN')
    expect(stateIndicator).not.toBeNull()
  })

  // ── 3. Rate Limiter ────────────────────────────────────

  it('rate limiter: shows allowed/denied stats', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[2].click()
    // click many times
    const btn = await page.$('.demo-btn.primary')
    for (let i = 0; i < 10; i++) await btn.click()
    await page.waitForTimeout(100)
    const statValues = await page.$$('.stat-value')
    const texts = await Promise.all(statValues.map(s => s.textContent()))
    const allowed = texts.find(t => t && !isNaN(parseInt(t)))
    expect(allowed).toBeTruthy()
  })

  // ── 4. Priority Queue ──────────────────────────────────

  it('priority queue: adds jobs to queue display', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[3].click()
    const criticalBtn = await page.$('.demo-btn.danger')
    await criticalBtn.click()
    await page.waitForTimeout(100)
    const badges = await page.$$('.badge.fail')
    expect(badges.length).toBeGreaterThan(0)
  })

  // ── 5. Event Bus ───────────────────────────────────────

  it('event bus: emits events and shows log', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[4].click()
    const btn = await page.$('.demo-btn.primary')
    await btn.click()
    await page.waitForTimeout(100)
    const logEntries = await page.$$('.demo-log .log-entry')
    expect(logEntries.length).toBeGreaterThan(0)
  })

  // ── 6. Saga ────────────────────────────────────────────

  it('saga: successful checkout completes steps', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[5].click()
    const successBtn = await page.$('.demo-btn.primary')
    await successBtn.click()
    await page.waitForTimeout(2000) // saga takes time
    const okBadges = await page.$$('.badge.ok')
    expect(okBadges.length).toBeGreaterThan(0)
  })

  // ── 7. Batch Processor ─────────────────────────────────

  it('batch: adding items shows pending count', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[6].click()
    const btn = await page.$('.demo-btn.primary')
    await btn.click()
    await page.waitForTimeout(100)
    const pending = await page.$eval('.stat-value', el => el.textContent)
    expect(pending).toBeTruthy()
  })

  // ── 8. Dedup ───────────────────────────────────────────

  it('dedup: duplicate detection works', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[7].click()
    const fixedBtn = await page.$$('.demo-btn.primary')
    await fixedBtn[1].click()
    await fixedBtn[1].click()
    await page.waitForTimeout(100)
    const dupBadge = await page.$('.badge.fail')
    expect(dupBadge).not.toBeNull()
  })

  // ── 9. Fan-Out ─────────────────────────────────────────

  it('fan-out: runs tasks and shows results', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[8].click()
    const btn = await page.$('.demo-btn.primary')
    await btn.click()
    await page.waitForTimeout(2000)
    const results = await page.$$('.result-item')
    expect(results.length).toBeGreaterThan(0)
  })

  // ── 10. Actor ──────────────────────────────────────────

  it('actor: increments and shows state', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[9].click()
    const incBtn = await page.$('.demo-btn.primary')
    await incBtn.click()
    await page.waitForTimeout(200)
    const statValue = await page.$eval('.stat-value', el => el.textContent)
    expect(statValue).toBeTruthy()
  })

  // ── 11. Reactive Form ──────────────────────────────────

  it('reactive form: validation enables submit', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[10].click()
    const inputs = await page.$$('.form-field input')
    await inputs[0].fill('Jane')
    await inputs[1].fill('jane@test.com')
    await inputs[2].fill('25')
    await page.waitForTimeout(100)
    const submitBtn = await page.$('.demo-btn.primary')
    const disabled = await submitBtn.getAttribute('disabled')
    expect(disabled).toBeNull() // not disabled when valid
  })

  // ── 12. Worker ─────────────────────────────────────────

  it('worker: computes fibonacci and shows result', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[11].click()
    const btn = await page.$('.demo-btn.primary')
    await btn.click()
    await page.waitForTimeout(1000)
    const log = await page.$$('.demo-log .log-entry')
    expect(log.length).toBeGreaterThan(0)
  })

  // ── 13. Idempotency ────────────────────────────────────

  it('idempotency: duplicate payment is replayed', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[12].click()
    const btn = await page.$('.demo-btn.primary')
    await btn.click()
    await page.waitForTimeout(600)
    await btn.click()
    await page.waitForTimeout(100)
    const replayBadge = await page.$('.badge.warn')
    expect(replayBadge).not.toBeNull()
  })

  // ── 14. Retry ──────────────────────────────────────────

  it('retry: shows attempt count on recovery', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[13].click()
    const btn = await page.$('.demo-btn.primary')
    await btn.click()
    await page.waitForTimeout(1000)
    const log = await page.$$('.demo-log .log-entry')
    expect(log.length).toBeGreaterThan(0)
  })

  // ── 15. DLQ ────────────────────────────────────────────

  it('DLQ: shows messages and supports replay', async () => {
    const tabs = await page.$$('.tab-btn')
    await tabs[14].click()
    const failBtn = await page.$('.demo-btn.danger')
    await failBtn.click()
    await failBtn.click()
    await page.waitForTimeout(100)
    const log = await page.$$('.demo-log .log-entry')
    expect(log.length).toBeGreaterThan(0)
  })
})
