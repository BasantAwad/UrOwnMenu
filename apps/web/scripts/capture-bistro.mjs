/**
 * Publish each template for a restaurant and capture desktop + mobile folds.
 *
 * Usage: node scripts/capture-bistro.mjs [template ...]
 * Defaults to the templates that carry the new art-direction layer.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'

const API = process.env.API_BASE || 'http://127.0.0.1:8787'
const WEB = process.env.WEB_BASE || 'http://localhost:5173'
const EMAIL = process.env.TEST_EMAIL || 'owner@gourmet-bistro.test'
const PASSWORD = process.env.TEST_PASSWORD || 'TestPass123'

const requested = process.argv.slice(2)
const templates = requested.length
  ? requested
  : ['editorial-showcase', 'cafe', 'mosaic', 'endless-table', 'magazine', 'orbital-menu', 'ingredient-story']

async function call(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (options.token) headers['Authorization'] = 'Bearer ' + options.token
  let lastError = null
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(API + path, { ...options, headers })
      const text = await res.text()
      let body = null
      try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
      if (!res.ok) throw new Error(path + ' -> ' + res.status + ' ' + (body && body.error))
      return body
    } catch (e) {
      lastError = e
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw lastError
}

const login = await call('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const token = login.session
const restaurants = await call('/api/restaurants', { token })
const restaurant = restaurants.restaurants[0]
if (!restaurant) throw new Error('no restaurant for ' + EMAIL)

const outDir = process.env.SHOT_DIR || 'shots'
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()

for (const template of templates) {
  const published = await call('/api/publish', {
    method: 'POST',
    token,
    body: JSON.stringify({ restaurant_id: restaurant.id, template }),
  })
  const url = WEB + '/m/' + restaurant.slug
  console.log('\n### ' + template + ' v' + published.versionNumber + ' -> ' + url)

  for (const [label, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push(String(e)))

    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)

    /*
     * Trigger every whileInView reveal and lazy image before the full-page
     * shot. Without this, Chromium expands the viewport for the screenshot
     * before IntersectionObserver has fired, and revealed sections appear
     * blank — a capture artefact, not a rendering bug.
     */
    await page.evaluate(async () => {
      const step = Math.max(200, window.innerHeight * 0.8)
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 110))
      }
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(800)

    const probe = await page.evaluate(() => {
      const images = Array.from(document.images)
      const broken = images.filter((i) => i.complete && i.naturalWidth === 0).length
      const overflowsX = document.documentElement.scrollWidth - window.innerWidth
      const cutouts = document.querySelectorAll('img.is-cutout').length
      const posters = document.querySelectorAll('.tpl-poster').length
      return { images: images.length, broken, overflowsX, cutouts, posters }
    })

    const name = outDir + '/' + template + '-' + label
    await page.screenshot({ path: name + '.png' })
    // Full page, capped: enough to review the whole composition.
    await page.screenshot({ path: name + '-full.png', fullPage: true })

    console.log(
      '  ' + label.padEnd(8),
      'imgs', probe.images,
      'broken', probe.broken,
      'cutouts', probe.cutouts,
      'posters', probe.posters,
      'overflowX', probe.overflowsX,
      errors.length ? 'ERRORS ' + errors.slice(0, 2).join(' | ') : 'no console errors',
    )
    await page.close()
  }
}

await browser.close()

// Leave the intended home template published.
await call('/api/publish', {
  method: 'POST',
  token,
  body: JSON.stringify({ restaurant_id: restaurant.id, template: 'ingredient-story' }),
})
console.log('\nrestored ingredient-story')
