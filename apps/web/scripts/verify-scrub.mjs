/**
 * Browser check for ScrollScrub: scroll down, the video moves forward; scroll
 * back up, it rewinds. Needs the dev server (default :5173, or HARNESS_BASE).
 *   node scripts/verify-scrub.mjs
 */
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const BASE = process.env.HARNESS_BASE || 'http://localhost:5173'
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage({ viewport: { width: 960, height: 600 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(BASE + '/harness/scrub.html')
await page.waitForSelector('section.scrub[data-ready]', { timeout: 20000 })

const goto = async (p) => {
  await page.evaluate((frac) => {
    const sec = document.querySelector('section.scrub')
    const span = sec.offsetHeight - window.innerHeight
    window.scrollTo(0, sec.offsetTop + frac * span)
  }, p)
  await page.waitForTimeout(900) // eased progress needs a few frames to settle
  return page.evaluate(() => document.querySelector('video').currentTime)
}

const t25 = await goto(0.25)
const t50 = await goto(0.5)
const t75 = await goto(0.75)
const back50 = await goto(0.5)

console.log({ t25, t50, t75, back50 })
assert.ok(t50 > t25 + 0.5, 'scrolling down should move the video forward')
assert.ok(t75 > t50 + 0.5, 'further down should move further forward')
assert.ok(back50 < t75 - 0.5, 'scrolling back up should rewind the video')
assert.ok(Math.abs(back50 - t50) < 0.6, 'the same scroll position should give the same frame')
assert.equal(errors.length, 0, 'no page errors: ' + errors.join(' | '))
console.log('ok   scroll down plays forward, scroll up rewinds, same position gives same frame')
await browser.close()
