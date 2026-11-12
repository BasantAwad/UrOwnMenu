/**
 * Report elements that push the document wider than the viewport.
 * Usage: node scripts/probe-overflow.mjs <url> [mobile|desktop]
 */
import { chromium } from 'playwright'

const url = process.argv[2] || 'http://localhost:5173/m/gourmet-bistro'
const mode = process.argv[3] || 'mobile'
const viewport = mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport })
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const report = await page.evaluate(() => {
  const vw = window.innerWidth
  const offenders = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.right > vw + 0.5 || r.left < -0.5) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '',
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
      })
    }
  }
  return {
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: vw,
    offenders: offenders.slice(0, 25),
  }
})

console.log(JSON.stringify(report, null, 2))
await browser.close()
