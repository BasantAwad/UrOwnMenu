/**
 * Seed a "Gourmet Bistro" restaurant as the upgrade test bed.
 *
 * Creates the owner account, restaurant, menu, three categories and the nine
 * items from the client's menu, with ingredients and licence-checked photos
 * resolved from Openverse (fallback: Wikimedia Commons). Every image is stored
 * in R2 by the API (served via /media/*), attributed in the public footer.
 *
 * Usage: node scripts/seed-bistro.mjs
 */
const API = 'http://127.0.0.1:8787'
const EMAIL = 'owner@gourmet-bistro.test'
const PASS = 'TestPass123'
const UA = 'UrOwnMenu/1.0 (seed script)'

const ITEMS = [
  {
    name: 'Truffle Mushroom Burger',
    category: 'Foods',
    price: '16.50',
    description:
      'A juicy smash-style beef patty topped with sautéed wild mushrooms, aged Swiss cheese, and house-made black truffle aioli on a toasted brioche bun.',
    ingredients: ['Beef patty', 'Brioche bun', 'Wild mushrooms', 'Swiss cheese', 'Black truffle aioli', 'Arugula', 'Butter'],
    mainIngredient: 'Wild mushrooms',
    queries: ['truffle mushroom burger', 'gourmet burger mushrooms', 'mushroom beef burger', 'burger mushrooms'],
  },
  {
    name: 'Pan-Seared Salmon',
    category: 'Foods',
    price: '22.00',
    description:
      'Crispy skin-on Atlantic salmon fillet served over a bed of creamy garlic risotto and roasted asparagus.',
    ingredients: ['Atlantic salmon', 'Arborio rice', 'Garlic', 'Parmesan cheese', 'Butter', 'Asparagus', 'Lemon', 'Olive oil'],
    mainIngredient: 'Atlantic salmon',
    queries: ['pan seared salmon', 'salmon fillet risotto', 'seared salmon asparagus', 'grilled salmon fillet'],
  },
  {
    name: 'Mediterranean Chicken Wrap',
    category: 'Foods',
    price: '13.75',
    description:
      'Grilled marinated chicken breast wrapped in a warm whole-wheat tortilla with crisp vegetables, feta, and tangy tzatziki.',
    ingredients: ['Chicken breast', 'Whole-wheat tortilla', 'Cucumber', 'Tomatoes', 'Red onion', 'Feta cheese', 'Tzatziki sauce'],
    mainIngredient: 'Chicken breast',
    queries: ['chicken wrap mediterranean', 'grilled chicken wrap', 'chicken shawarma wrap', 'chicken tortilla wrap'],
  },
  {
    name: 'Sparkling Blackberry Lemonade',
    category: 'Drinks',
    price: '5.50',
    description:
      'A refreshing blend of freshly squeezed lemon juice, muddled wild blackberries, and sparkling mineral water served over ice.',
    ingredients: ['Lemon juice', 'Fresh blackberries', 'Cane sugar syrup', 'Sparkling mineral water', 'Mint leaf garnish'],
    mainIngredient: 'Fresh blackberries',
    queries: ['blackberry lemonade', 'berry lemonade sparkling', 'blackberry iced tea', 'sparkling lemonade'],
  },
  {
    name: 'Iced Vanilla Matcha Latte',
    category: 'Drinks',
    price: '6.00',
    description:
      'Ceremonial grade Japanese green tea whisked smooth, mixed with pure vanilla bean syrup, and layered over cold oat milk.',
    ingredients: ['Matcha green tea powder', 'Oat milk', 'Pure vanilla syrup', 'Ice'],
    mainIngredient: 'Matcha green tea powder',
    queries: ['iced matcha latte', 'matcha latte', 'matcha green tea latte', 'matcha'],
  },
  {
    name: 'Spiced Cold Brew Coffee',
    category: 'Drinks',
    price: '5.75',
    description:
      'Slow-steeped cold brew infused with warm spices, topped with a velvety cinnamon sweet cream cold foam.',
    ingredients: ['Arabica cold brew coffee', 'Heavy cream', 'Milk', 'Cinnamon', 'Nutmeg', 'Brown sugar'],
    mainIngredient: 'Arabica cold brew coffee',
    queries: ['cold brew coffee', 'iced coffee', 'cold brew', 'coffee'],
  },
  {
    name: 'Classic New York Cheesecake',
    category: 'Desserts',
    price: '8.50',
    description:
      'Rich and creamy baked cheesecake with a buttery graham cracker crust, topped with a sweet strawberry glaze.',
    ingredients: ['Cream cheese', 'Graham cracker crust', 'Sugar', 'Eggs', 'Vanilla extract', 'Strawberry glaze', 'Fresh mint'],
    mainIngredient: 'Cream cheese',
    queries: ['new york cheesecake', 'cheesecake slice', 'baked cheesecake', 'cheesecake'],
  },
  {
    name: 'Molten Lava Chocolate Cake',
    category: 'Desserts',
    price: '9.00',
    description:
      'Warm chocolate cake with a molten chocolate center, served alongside a scoop of premium Madagascar vanilla bean ice cream.',
    ingredients: ['Dark chocolate', 'Cocoa powder', 'Butter', 'Eggs', 'Sugar', 'Flour', 'Vanilla bean ice cream'],
    mainIngredient: 'Dark chocolate',
    isFeatured: true,
    queries: ['chocolate lava cake', 'molten lava cake', 'chocolate fondant', 'chocolate cake'],
  },
  {
    name: 'Artisanal Tiramisu',
    category: 'Desserts',
    price: '8.00',
    description:
      'Traditional Italian dessert with layers of espresso-soaked ladyfingers and whipped mascarpone cream, dusted with cocoa powder.',
    ingredients: ['Ladyfingers', 'Espresso coffee', 'Mascarpone cheese', 'Heavy cream', 'Cocoa powder', 'Egg yolks', 'Sugar'],
    mainIngredient: 'Mascarpone cheese',
    queries: ['tiramisu', 'tiramisu slice', 'italian tiramisu', 'coffee dessert'],
  },
]
// Flag one featured per other categories for promo slots.
for (const it of ITEMS) {
  if (!it.isFeatured && (it.name === 'Truffle Mushroom Burger' || it.name === 'Iced Vanilla Matcha Latte')) {
    it.isFeatured = true
  }
}

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

async function fetchJson(url, ms = 9000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('fetch failed ' + res.status + ' for ' + url)
  return res.json()
}

async function openverseImage(query) {
  const url =
    'https://api.openverse.org/v1/images/?q=' +
    encodeURIComponent(query) +
    '&license=cc0,pdm,by,by-sa&aspect_ratio=wide&page_size=10&mature=false'
  const data = await fetchJson(url)
  const results = (data.results || []).filter(
    (r) => typeof r.url === 'string' && r.width >= 1100 && r.width >= (r.height || 1),
  )
  const pick = results[0]
  if (!pick) return null
  return {
    url: pick.url,
    source: 'openverse',
    creator: pick.creator || null,
    license: pick.license
      ? String(pick.license).toUpperCase() + (pick.license_version ? ' ' + pick.license_version : '')
      : 'unknown',
    width: pick.width,
    height: pick.height,
  }
}

async function commonsImage(query) {
  const searchUrl =
    'https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=' +
    encodeURIComponent(query) +
    '&srnamespace=6&srlimit=8&format=json'
  const data = await fetchJson(searchUrl)
  for (const hit of data?.query?.search ?? []) {
    if (!hit?.title) continue
    const infoUrl =
      'https://commons.wikimedia.org/w/api.php?action=query&titles=' +
      encodeURIComponent(hit.title) +
      '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600&format=json'
    const info = await fetchJson(infoUrl)
    const pages = info?.query?.pages ?? {}
    const page = Object.values(pages)[0]
    const ii = page?.imageinfo?.[0]
    if (!ii?.url) continue
    const w = ii.width ?? 0
    if (w < 900) continue
    const meta = ii.extmetadata ?? {}
    const artist = String(meta.Artist?.value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return {
      url: ii.thumburl || ii.url,
      source: 'commons',
      creator: artist || null,
      license: meta.LicenseShortName?.value || 'see source',
      width: ii.thumbwidth ?? w,
      height: ii.thumbheight ?? ii.height ?? null,
    }
  }
  return null
}

/** Fetch image bytes; JPEG/PNG/WebP as data URL. */
async function downloadAsDataUrl(image) {
  const res = await fetch(image.url, {
    signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': UA, Accept: 'image/*' },
  })
  if (!res.ok) throw new Error('download failed ' + res.status)
  const type = res.headers.get('content-type') || 'image/jpeg'
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length > 6 * 1024 * 1024) throw new Error('too large: ' + bytes.length)
  if (!type.startsWith('image/')) throw new Error('not an image: ' + type)
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
  const dims = imageSize(bytes)
  return {
    dataUrl: `data:${type};base64,` + bytes.toString('base64'),
    filename: 'dish.' + ext,
    width: dims.width ?? image.width ?? null,
    height: dims.height ?? image.height ?? null,
    bytes: bytes.length,
    license: image.license,
    creator: image.creator,
    source: image.source,
  }
}

/** Minimal JPEG/PNG/WebP header parser. */
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

async function resolveDish(item) {
  for (const q of item.queries) {
    for (const attempt of [openverseImage, commonsImage]) {
      try {
        const found = await attempt(q)
        if (found) {
          console.log('  photo for "' + item.name + '" via ' + found.source + ' query "' + q + '"')
          return downloadAsDataUrl(found)
        }
      } catch (e) {
        console.log('  attempt failed for "' + q + '":', String(e.message).slice(0, 90))
      }
    }
  }
  return null
}

// ---------- auth ----------
let login
try {
  login = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASS }) })
  console.log('signed in as existing owner')
} catch {
  login = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name: 'Gourmet Bistro', email: EMAIL, password: PASS }) })
  console.log('created owner account')
}
const token = login.session

// ---------- restaurant ----------
const restaurants = await api('/api/restaurants', { token })
let rest = (restaurants.restaurants || []).find((r) => r.slug === 'gourmet-bistro')
if (!rest) {
  const created = await api('/api/restaurants', {
    method: 'POST',
    token,
    body: JSON.stringify({
      name: 'Gourmet Bistro',
      description: 'Modern bistro plates — from a truffle-mushroom smash burger to slow-steeped cold brew.',
      currency_code: 'USD',
      locale: 'en-US',
      timezone: 'America/New_York',
    }),
  })
  rest = created.restaurant
  console.log('restaurant created')
} else {
  console.log('restaurant exists', rest.id)
}

// ---------- menu + categories ----------
const tree0 = await api('/api/menus/' + rest.id + '/tree', { token })
let menu = tree0.menus[0]
if (!menu || menu.categories.length === 0 || menu.categories.flatMap((c) => c.items).length === 0) {
  if (!menu) {
    const m = await api('/api/menus', { method: 'POST', token, body: JSON.stringify({ restaurant_id: rest.id, name: 'Gourmet Bistro Menu', description: 'The full menu' }) })
    menu = m.menu
  }
  const tree1 = await api('/api/menus/' + rest.id + '/tree', { token })
  menu = tree1.menus[0]
  for (const catName of ['Foods', 'Drinks', 'Desserts']) {
    const existing = (menu.categories || []).find((c) => c.name === catName)
    if (!existing) await api('/api/categories', { method: 'POST', token, body: JSON.stringify({ menu_id: menu.id, name: catName }) })
  }
  const tree2 = await api('/api/menus/' + rest.id + '/tree', { token })
  menu = tree2.menus[0]
  console.log('categories ready')
} else {
  console.log('menu already has items, reusing existing menu')
}

const catId = {}
for (const cat of menu.categories) catId[cat.name] = cat.id

// ---------- items ----------
let added = 0
let skippedPhotos = 0
const existingNames = new Set(menu.categories.flatMap((c) => c.items.map((i) => i.name)))
for (const item of ITEMS) {
  if (existingNames.has(item.name)) {
    console.log('item exists, skipping:', item.name)
    continue
  }
  console.log('\nresolving photo:', item.name)
  const photo = await resolveDish(item)
  const payload = {
    category_id: catId[item.category],
    name: item.name,
    short_description: item.description,
    price: item.price,
    currency_code: 'USD',
    ingredients: item.ingredients,
    main_ingredient: item.mainIngredient,
    is_featured: Boolean(item.isFeatured),
  }
  if (photo) {
    payload.photo_data_url = photo.dataUrl
    payload.photo_filename = photo.filename
    payload.photo_width = photo.width
    payload.photo_height = photo.height
  } else {
    skippedPhotos++
    console.log('  NO PHOTO FOUND')
  }
  const created = await api('/api/items', { method: 'POST', token, body: JSON.stringify(payload) })
  console.log('  created item', created.item.id)
  added++
}

// ---------- publish (ingredient-story as the upgrade home) ----------
const published = await api('/api/publish', {
  method: 'POST',
  token,
  body: JSON.stringify({ restaurant_id: rest.id, template: 'ingredient-story' }),
})
console.log('\npublished v' + published.versionNumber, published.publishedUrl)
console.log('items added:', added, '| without photos:', skippedPhotos)
