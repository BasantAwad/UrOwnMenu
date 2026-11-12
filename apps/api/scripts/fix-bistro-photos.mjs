/**
 * Repair the Gourmet Bistro after the naive Commons search delivered junk
 * (live chickens, Stabilizer chemistry diagrams, a book). Downloads curated,
 * licence-checked files via the Commons API, stores them as R2 assets via the
 * item PATCH endpoint, and sets the two hero ingredients the client demanded
 * be findable: the wrap gets Tzatziki, cold brew gets Cinnamon.
 */
import fs from 'node:fs'

const API = 'http://127.0.0.1:8787'
const EMAIL = 'owner@gourmet-bistro.test'
const PASS = 'TestPass123'
const UA = 'UrOwnMenu/1.0 (seed)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ITEM_PHOTOS = [
  { item: 'itm_621c1db5fe5d44d5acc2d2e10d4e420b', file: 'RedDot_Burger.jpg' },
  { item: 'itm_834764a3c6f4458ba252f72a2cce1324', file: '2014_smoked_salmon_and_egg_salad_toasted_baguette.JPG' },
  { item: 'itm_e99b7006092d4b83b59f14d851e6f427', file: 'Shawarma_2.jpg' },
  { item: 'itm_07013fcdeac247b388661f1200abbf65', file: 'Lemonade_-_27682817724.jpg' },
  { item: 'itm_99a39a5a92084e7ca43ad520ae73470d', file: 'Matcha_tea_latte_with_rosetta_latte_art.jpg' },
  { item: 'itm_0e2609d4ed5e494a96eafcb521b8c6ae', file: 'Preparation_of_cold_brew_coffee_06.jpg' },
  { item: 'itm_a8e8f31fc3f743e3b1698bfb137a9441', file: 'Baked_cheesecake_with_raspberries_and_blueberries.jpg' },
  { item: 'itm_13b6d6cedc2147ae8afca1a1f0240fc9', file: 'Chocolate_Fondant.jpg' },
  { item: 'itm_5a4f789365ae4718bb0319d55055d523', file: 'Tiramisu_-_Raffaele_Diomede.jpg' },
]

const HERO_SWAPS = [
  { item: 'itm_e99b7006092d4b83b59f14d851e6f427', mainIngredient: 'Tzatziki sauce' },
  { item: 'itm_0e2609d4ed5e494a96eafcb521b8c6ae', mainIngredient: 'Cinnamon' },
]

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: 'Bearer ' + opts.token } : {}),
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { error: text } }
  if (!res.ok) throw new Error(path + ' -> ' + res.status + ' ' + JSON.stringify(data))
  return data
}

const login = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASS }) })
const token = login.session
console.log('signed in')

function imageSize(bytes) {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let off = 2
    while (off + 9 < bytes.length) {
      if (bytes[off] !== 0xff) break
      const marker = bytes[off + 1]
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { height: bytes.readUInt16BE(off + 5), width: bytes.readUInt16BE(off + 7) }
      }
      const len = bytes.readUInt16BE(off + 2)
      off += 2 + len
    }
  }
  return { width: null, height: null }
}

for (const { item, file } of ITEM_PHOTOS) {
  const infoUrl =
    'https://commons.wikimedia.org/w/api.php?action=query&titles=' +
    encodeURIComponent('File:' + file) +
    '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600&format=json'
  const res = await fetch(infoUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  const data = await res.json()
  const pages = data?.query?.pages ?? {}
  const page = Object.values(pages)[0]
  const ii = page?.imageinfo?.[0]
  if (!ii?.url) {
    console.log('MISS', file)
    continue
  }
  const meta = ii.extmetadata ?? {}
  const license = meta.LicenseShortName?.value || 'see source'
  const artist = String(meta.Artist?.value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
  console.log('\n' + file, '|', license, '|', artist)

  const imgRes = await fetch(ii.thumburl || ii.url, {
    headers: { 'User-Agent': UA, Accept: 'image/*' },
  })
  const type = imgRes.headers.get('content-type') || 'image/jpeg'
  const buf = Buffer.from(await imgRes.arrayBuffer())
  if (!type.startsWith('image/') || buf.length === 0 || buf.length > 6 * 1024 * 1024) {
    console.log('  bad download:', type, buf.length)
    continue
  }
  const dims = imageSize(buf)
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
  const patched = await api('/api/items/' + item, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      photo_data_url: 'data:' + type + ';base64,' + buf.toString('base64'),
      photo_filename: file.replace(/[^a-zA-Z0-9_.-]/g, '_'),
      photo_width: dims.width ?? ii.thumbwidth ?? ii.width ?? null,
      photo_height: dims.height ?? ii.thumbheight ?? ii.height ?? null,
    }),
  })
  console.log('  item patched, photo', dims.width + 'x' + dims.height)
  await sleep(800)
}

for (const { item, mainIngredient } of HERO_SWAPS) {
  const patched = await api('/api/items/' + item, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ main_ingredient: mainIngredient }),
  })
  console.log('\nhero swap ->', mainIngredient, '(item', item.slice(0, 12) + ')')
}

const rests = await api('/api/restaurants', { token })
const rest = rests.restaurants.find((r) => r.slug === 'gourmet-bistro')
const published = await api('/api/publish', {
  method: 'POST',
  token,
  body: JSON.stringify({ restaurant_id: rest.id, template: 'ingredient-story' }),
})
console.log('\npublished v' + published.versionNumber, published.publishedUrl)
const pub = await api('/m/' + rest.slug)
console.log('\ningredientPhotos:')
for (const [slug, p] of Object.entries(pub.menu?.ingredientPhotos ?? {})) {
  console.log('  ' + slug.padEnd(26), '|', String(p.license).padEnd(14), '|', p.displayName, '|', p.sourceUrl)
}
