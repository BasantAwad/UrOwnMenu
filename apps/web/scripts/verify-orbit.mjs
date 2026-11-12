/**
 * Verify the orbit actually orbits: the ring's rotation must advance between
 * two samples taken one second apart, and stop when prefers-reduced-motion.
 */
import { chromium } from 'playwright'

const url = process.argv[2] || 'http://localhost:5173/m/cairo-coffee-house'
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('.tpl-orbital__orbitSpin', { timeout: 15000 })

const sample = () =>
  page.evaluate(() => getComputedStyle(document.querySelector('.tpl-orbital__orbitSpin')).transform)

const t0 = await sample()
await page.waitForTimeout(1500)
const t1 = await sample()
console.log('transform at t=0:  ', t0)
console.log('transform at t=1.5s:', t1)
console.log('orbit moves:', t0 !== t1 ? 'YES' : 'NO')

// Hover pauses the orbit.
await page.hover('.tpl-orbital__stage')
const p0 = await sample()
await page.waitForTimeout(1000)
const p1 = await sample()
console.log('pauses on hover:', p0 === p1 ? 'YES' : 'NO')

await browser.close()

const b2 = await chromium.launch()
const p2 = await b2.newPage({ reducedMotion: 'reduce' })
await p2.goto(url, { waitUntil: 'networkidle' })
await p2.waitForSelector('.tpl-orbital__orbitSpin', { timeout: 15000 })
const r0 = await p2.evaluate(() => getComputedStyle(document.querySelector('.tpl-orbital__orbitSpin')).animationPlayState)
console.log('reduced motion play state:', r0)
await b2.close()
