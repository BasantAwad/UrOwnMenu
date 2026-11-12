/**
 * Measure every item photo and store its art-direction metadata.
 *
 * Templates place photographs from evidence: focal point, luminance (for
 * scrim strength), contrast, dominant colour and frame ratio. Existing
 * items predate that metadata, so this script runs the same measurement the
 * upload pipeline runs (src/media-intelligence.ts) over the stored files and
 * PATCHes `photo_meta` back onto each item.
 *
 * Usage: node scripts/art-direct-bistro.mjs [email] [password]
 */
import { chromium } from 'playwright'

const API = process.env.API_BASE || 'http://127.0.0.1:8787'
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
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' })

let measured = 0
let skipped = 0

for (const item of items) {
  if (!item.photo_url) { skipped++; continue }

  // Media may be served from the API origin, which would taint the canvas.
  // Inline it as a data URL first so measurements are allowed.
  let src = item.photo_url
  if (!src.startsWith('data:')) {
    const res = await fetch(src)
    const type = res.headers.get('content-type') || 'image/jpeg'
    const bytes = Buffer.from(await res.arrayBuffer())
    src = 'data:' + type + ';base64,' + bytes.toString('base64')
  }

  const meta = await page.evaluate(async ({ url, cutout }) => {
    const img = new Image()
    img.decoding = 'async'
    const loaded = new Promise((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode failed'))
    })
    img.src = url
    await loaded

    const MAX = 320
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(2, Math.round(img.naturalWidth * scale))
    const h = Math.max(2, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h).data

    const luma = new Float32Array(w * h)
    let sum = 0
    let count = 0
    let rSum = 0
    let gSum = 0
    let bSum = 0

    for (let i = 0; i < w * h; i++) {
      const o = i * 4
      const a = data[o + 3] / 255
      if (cutout && a < 0.08) { luma[i] = -1; continue }
      if (!cutout && a === 0) { luma[i] = -1; continue }
      const r = data[o]
      const g = data[o + 1]
      const b = data[o + 2]
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
      luma[i] = y
      sum += y
      count++
      rSum += r
      gSum += g
      bSum += b
    }

    const mean = count > 0 ? sum / count : 0.5
    let variance = 0
    for (let i = 0; i < w * h; i++) {
      if (luma[i] < 0) continue
      const d = luma[i] - mean
      variance += d * d
    }
    const std = count > 0 ? Math.sqrt(variance / count) : 0

    let fx = 0, fy = 0, fw = 0
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        const c = luma[i]
        if (c < 0) continue
        const l = luma[i - 1], r = luma[i + 1], u = luma[i - w], d = luma[i + w]
        if (l < 0 || r < 0 || u < 0 || d < 0) continue
        const gx = r - l
        const gy = d - u
        const energy = gx * gx + gy * gy
        if (energy < 64) continue
        const nx = (x / w - 0.5) * 2
        const ny = (y / h - 0.5) * 2
        const central = 1 - 0.65 * Math.min(1, Math.hypot(nx, ny) / 1.414)
        const weight = energy * central
        fx += x * weight
        fy += y * weight
        fw += weight
      }
    }

    let focusX = 0.5, focusY = 0.5
    if (fw > 0) {
      focusX = 0.5 + (fx / fw / w - 0.5) * 0.7
      focusY = 0.5 + (fy / fw / h - 0.5) * 0.7
    }
    focusX = Math.min(0.82, Math.max(0.18, focusX))
    focusY = Math.min(0.82, Math.max(0.18, focusY))

    const denom = Math.max(1, count)
    const round3 = (n) => Math.round(n * 1000) / 1000

    return {
      v: 1,
      focusX: round3(focusX),
      focusY: round3(focusY),
      ratio: round3(img.naturalWidth / img.naturalHeight),
      meanLuma: round3(mean / 255),
      contrast: round3(Math.min(1, std / 90)),
      coverage: 1,
      treatment: cutout ? 'contain' : 'cover',
      dominant: [Math.round(rSum / denom), Math.round(gSum / denom), Math.round(bSum / denom)],
      ...(cutout ? { subject: { x: 0, y: 0, w: 1, h: 1 } } : {}),
    }
  }, { url: src, cutout: Boolean(item.photo_is_cutout) })

  await call('/api/items/' + item.id, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ photo_meta: meta }),
  })

  measured++
  console.log(
    'measured',
    item.name.padEnd(30),
    'focus',
    meta.focusX + ',' + meta.focusY,
    'luma',
    meta.meanLuma,
    'contrast',
    meta.contrast,
    'ratio',
    meta.ratio,
  )
}

await browser.close()
console.log('\n' + measured + ' measured, ' + skipped + ' without a photo')
console.log('Restaurant: ' + restaurant.name + ' (' + restaurant.slug + ')')
