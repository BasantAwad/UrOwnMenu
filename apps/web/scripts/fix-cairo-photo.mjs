/**
 * Replace the Cairo demo's mismatched photo.
 *
 * "Fresh Orange Juice" was seeded from a naive Commons search and ended up
 * with a photograph of a pizza, which is exactly the kind of mismatch that
 * makes a demo look careless. This resolves a licence-checked Commons file,
 * runs it through the real upload pipeline in the browser (centre crop to
 * 4:3, tone, sharpen, measurement), and PATCHes the result onto the item.
 *
 * Usage: node scripts/fix-cairo-photo.mjs
 */
import { chromium } from 'playwright'

const API = process.env.API_BASE || 'http://127.0.0.1:8787'
const WEB = process.env.WEB_BASE || 'http://localhost:5173'
const EMAIL = process.env.CAIRO_EMAIL || 'nour@cairo.test'
const PASSWORD = process.env.CAIRO_PASSWORD || 'TestPass123'
const UA = 'UrOwnMenu/1.0 (demo fixture repair)'

const FILE = 'Glass of orange juice with ice.jpeg'
const ACCEPTED_LICENCES = /^(CC0|Public domain|CC BY(-SA)? [0-9.]+)$/i

async function call(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (options.token) headers['Authorization'] = 'Bearer ' + options.token
  const res = await fetch(API + path, { ...options, headers })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
  if (!res.ok) throw new Error(path + ' -> ' + res.status + ' ' + (body && body.error))
  return body
}

/* 1. Resolve the file and prove its licence before downloading it. */
const infoUrl =
  'https://commons.wikimedia.org/w/api.php?action=query&titles=' +
  encodeURIComponent('File:' + FILE) +
  '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1400&format=json'
const info = await (await fetch(infoUrl, { headers: { 'User-Agent': UA } })).json()
const page = Object.values(info?.query?.pages ?? {})[0]
const image = page?.imageinfo?.[0]
if (!image?.url) throw new Error('Commons file not found: ' + FILE)

const ext = image.extmetadata ?? {}
const licence = ext.LicenseShortName?.value || ''
const artist = String(ext.Artist?.value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
console.log('file    ', FILE)
console.log('licence ', licence, '|', artist || 'unknown author')
if (!ACCEPTED_LICENCES.test(licence)) {
  throw new Error('Refusing to use a file with licence "' + licence + '"')
}

const imgRes = await fetch(image.thumburl || image.url, {
  headers: { 'User-Agent': UA, Accept: 'image/*' },
})
const type = imgRes.headers.get('content-type') || 'image/jpeg'
const bytes = Buffer.from(await imgRes.arrayBuffer())
if (!type.startsWith('image/')) throw new Error('Commons returned ' + type)
const sourceDataUrl = 'data:' + type + ';base64,' + bytes.toString('base64')
console.log('download', type, Math.round(bytes.length / 1024) + ' KB')

/* 2. Run the real upload pipeline against it. */
const browser = await chromium.launch()
const pageCtx = await browser.newPage()
await pageCtx.goto(WEB, { waitUntil: 'domcontentloaded' })

const prepared = await pageCtx.evaluate(async ({ dataUrl }) => {
  const blob = await (await fetch(dataUrl)).blob()
  const file = new File([blob], 'orange-juice.jpg', { type: blob.type })
  const media = await import('/src/media.ts')
  const result = await media.prepareForUpload(file, {
    ...media.DEFAULT_ADJUSTMENTS,
    aspectRatio: 4 / 3,
  })
  return {
    dataUrl: result.dataUrl,
    filename: result.filename,
    width: result.width,
    height: result.height,
    cutout: result.cutout,
    meta: result.meta,
  }
}, { dataUrl: sourceDataUrl })

await browser.close()
console.log('prepared', prepared.width + 'x' + prepared.height, 'cutout', prepared.cutout)

/* 3. Attach it to the item. */
const login = await call('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const token = login.session
const restaurants = await call('/api/restaurants', { token })
const restaurant = restaurants.restaurants.find((r) => r.slug === 'cairo-coffee-house') || restaurants.restaurants[0]
const tree = await call('/api/menus/' + restaurant.id + '/tree', { token })
const items = tree.menus.flatMap((m) => m.categories).flatMap((c) => c.items)
const item = items.find((i) => /orange/i.test(i.name))
if (!item) throw new Error('no orange juice item on ' + restaurant.slug)

await call('/api/items/' + item.id, {
  method: 'PATCH',
  token,
  body: JSON.stringify({
    photo_data_url: prepared.dataUrl,
    photo_filename: prepared.filename,
    photo_width: prepared.width,
    photo_height: prepared.height,
    photo_is_cutout: prepared.cutout,
    photo_meta: prepared.meta,
  }),
})

const published = await call('/api/publish', {
  method: 'POST',
  token,
  body: JSON.stringify({ restaurant_id: restaurant.id, template: 'ingredient-story' }),
})

console.log('patched ', item.name, 'on', restaurant.slug)
console.log('published v' + published.versionNumber, published.publishedUrl)
console.log('source  ', image.descriptionurl || infoUrl)
