/**
 * Capture the magazine page mid-fold.
 *
 * The in-session browser's compositor is frozen, so CSS animations never
 * advance there. Playwright drives a real Chromium with a live compositor, so
 * this is the only way to see the fold as a user does.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'

const url = process.argv[2] || 'http://localhost:5173/m/cairo-coffee-house'
const outDir = process.argv[3] || '.'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('.tpl-magazine__spread--base', { timeout: 15000 })
await page.waitForTimeout(1200)

// Start the turn, then grab frames while the page is folding.
await page.click('.tpl-magazine__controls button:last-child')

const frames = [120, 260, 400, 560]
let previous = 0
for (const t of frames) {
  await page.waitForTimeout(t - previous)
  previous = t
  const file = `${outDir}/fold-${String(t).padStart(4, '0')}.png`
  await page.screenshot({ path: file })
  console.log('captured', file)
}

// The final state after the turn settles.
await page.waitForTimeout(1200)
await page.screenshot({ path: `${outDir}/fold-settled.png` })
console.log('captured', `${outDir}/fold-settled.png`)

const state = await page.evaluate(() => ({
  counter: (document.querySelector('.tpl-magazine__counter') || {}).textContent,
  turning: !!document.querySelector('.tpl-magazine__spread--turning'),
  baseFeature: (document.querySelector('.tpl-magazine__featureTitle') || {}).textContent,
}))
console.log('state:', JSON.stringify(state))

await browser.close()
