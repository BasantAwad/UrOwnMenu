/**
 * Re-normalise cutouts that were stored before the media pipeline trimmed
 * them.
 *
 * Background removal returns the input canvas, so an early cutout kept the
 * original framing: the subject sits small and off-centre inside a field of
 * transparent pixels. Templates then render it at the wrong visual size and
 * the composition falls apart. This script downloads each stored cutout, runs
 * the same trim/scale/recentre/pad step new uploads use
 * (src/media-intelligence.ts), and PATCHes the result back.
 *
 * Originals are not destroyed by the API, and the item keeps its id, so
 * published snapshots are unaffected until the owner republishes.
 *
 * Usage: node scripts/normalise-stored-cutouts.mjs [email] [password]
 */
import { chromium } from 'playwright'

const API = process.env.API_BASE || 'http://127.0.0.1:8787'
const WEB = process.env.WEB_BASE || 'http://localhost:5173'
const EMAIL = process.argv[2] || 'owner@gourmet-bistro.test'
const PASSWORD = process.argv[3] || 'TestPass123'

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

const tree = await call('/api/menus/' + restaurant.id + '/tree', { token })
const items = tree.menus.flatMap((m) => m.categories).flatMap((c) => c.items)

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(WEB, { waitUntil: 'domcontentloaded' })

let fixed = 0
let skipped = 0

for (const item of items) {
  if (!item.photo_url || !item.photo_is_cutout) continue

  const res = await fetch(item.photo_url)
  if (!res.ok) {
    console.log('skip', item.name, '— photo fetch', res.status)
    skipped++
    continue
  }
  const type = res.headers.get('content-type') || 'image/png'
  const bytes = Buffer.from(await res.arrayBuffer())
  const dataUrl = 'data:' + type + ';base64,' + bytes.toString('base64')

  const result = await page.evaluate(async (url) => {
    const mod = await import('/src/media-intelligence.ts')
    const img = new Image()
    img.decoding = 'async'
    const loaded = new Promise((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode failed'))
    })
    img.src = url
    await loaded

    const framed = mod.normaliseCutout(img, { targetRatio: 1, fill: 0.9 })
    return {
      before: { w: img.naturalWidth, h: img.naturalHeight },
      dataUrl: framed.canvas.toDataURL('image/webp', 0.9),
      width: framed.canvas.width,
      height: framed.canvas.height,
      meta: framed.meta,
      changed: framed.canvas !== img,
    }
  }, dataUrl)

  if (!result.changed) {
    console.log('skip', item.name.padEnd(28), '— nothing to trim (fully opaque)')
    skipped++
    continue
  }

  await call('/api/items/' + item.id, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      photo_data_url: result.dataUrl,
      photo_filename: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.webp',
      photo_width: result.width,
      photo_height: result.height,
      photo_is_cutout: true,
      photo_meta: result.meta,
    }),
  })

  fixed++
  console.log(
    'fixed ',
    item.name.padEnd(28),
    result.before.w + 'x' + result.before.h,
    '->',
    result.width + 'x' + result.height,
    'fill',
    Math.round((result.meta.subject ? Math.max(result.meta.subject.w, result.meta.subject.h) : 0) * 100) + '%',
    'centre',
    result.meta.focusX + ',' + result.meta.focusY,
  )
}

await browser.close()
console.log('\n' + fixed + ' normalised, ' + skipped + ' skipped')
console.log('Restaurant: ' + restaurant.name + ' (' + restaurant.slug + ')')
