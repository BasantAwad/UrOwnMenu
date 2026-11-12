/**
 * UrOwnMenu end-to-end client journey test.
 * Acts exactly like a restaurant owner registering and publishing a menu.
 *
 * Run: node scripts/e2e-client-journey.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const API = process.env.API_BASE || 'http://127.0.0.1:8787'
const WEB = process.env.WEB_BASE || 'http://localhost:5173'

let token = null
let passed = 0
let failed = 0
const failures = []

function check(name, condition, detail) {
  if (condition) {
    passed++
    console.log('  PASS  ' + name + (detail ? '  (' + detail + ')' : ''))
  } else {
    failed++
    failures.push(name + (detail ? ' - ' + detail : ''))
    console.log('  FAIL  ' + name + (detail ? '  (' + detail + ')' : ''))
  }
}

function section(title) {
  console.log('\n=== ' + title + ' ===')
}

async function api(pathname, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers['Authorization'] = 'Bearer ' + token
  const res = await fetch(API + pathname, { ...options, headers })
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }
  return { status: res.status, body }
}

function imageDataUrl(relativePath) {
  const abs = path.resolve(relativePath)
  const ext = path.extname(abs).toLowerCase()
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
  const buffer = fs.readFileSync(abs)
  return 'data:' + mime + ';base64,' + buffer.toString('base64')
}

async function main() {
  console.log('UrOwnMenu — End-to-End Client Journey Test')
  console.log('API:', API)
  console.log('WEB:', WEB)

  const stamp = Date.now()
  const email = 'owner' + stamp + '@pizzafun.test'
  const password = 'TestPass123'

  // ---------------------------------------------------------------- health
  section('Health')
  const health = await api('/health')
  check('GET /health returns ok', health.status === 200 && health.body?.status === 'ok')

  const meta = await api('/api/meta')
  check('GET /api/meta exposes 8 palettes', meta.body?.palettes?.length === 8,
    (meta.body?.palettes?.length || 0) + ' palettes')
  check('GET /api/meta exposes 8 templates', meta.body?.templates?.length === 8,
    (meta.body?.templates?.length || 0) + ' templates')

  // ---------------------------------------------------------------- signup
  section('Phase 0 — Registration')
  const signup = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Mario Rossi', email, password }),
  })
  check('signup returns 201', signup.status === 201, 'status ' + signup.status)
  check('signup returns a user', !!signup.body?.user?.id)
  check('signup returns a session token', !!signup.body?.session)
  token = signup.body?.session || null

  const dupe = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Mario Rossi', email, password }),
  })
  check('duplicate email is rejected (409)', dupe.status === 409, 'status ' + dupe.status)

  const session = await api('/api/auth/session')
  check('session endpoint reports authenticated', session.body?.isAuthenticated === true)
  check('session returns the signed-up email', session.body?.user?.email === email)

  // ---------------------------------------------------------------- login
  section('Auth — Login / Logout')
  const badLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'wrong-password' }),
  })
  check('wrong password is rejected (401)', badLogin.status === 401, 'status ' + badLogin.status)

  const goodLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  check('correct password logs in', goodLogin.status === 200 && !!goodLogin.body?.session)
  const savedToken = token
  token = goodLogin.body?.session
  const session2 = await api('/api/auth/session')
  check('new session token works', session2.body?.isAuthenticated === true)
  token = savedToken

  // ---------------------------------------------------------------- restaurant
  section('Phase 1 — Restaurant Creation')
  const rest = await api('/api/restaurants', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Pizza Fun',
      description: 'Wood-fired pizza and fresh juices',
      phone: '+20 100 000 0000',
      currency_code: 'EGP',
      locale: 'en',
      timezone: 'Africa/Cairo',
    }),
  })
  check('restaurant created (201)', rest.status === 201, 'status ' + rest.status)
  const restaurant = rest.body?.restaurant
  const slug = restaurant?.slug
  check('restaurant has an id', !!restaurant?.id)
  check('restaurant slug auto-generated', !!slug, slug)
  check('restaurant slug is URL safe', /^[a-z0-9-]+$/.test(slug || ''))
  check('restaurant currency stored', restaurant?.currency_code === 'EGP')

  const dupSlug = await api('/api/restaurants', {
    method: 'POST',
    body: JSON.stringify({ name: 'Pizza Fun', currency_code: 'EGP' }),
  })
  check('duplicate slug gets a suffix', dupSlug.body?.restaurant?.slug !== restaurant?.slug,
    dupSlug.body?.restaurant?.slug)

  // ---------------------------------------------------------------- brand
  section('Phase 2 — Brand Palette')
  const brand = await api('/api/brand-profiles/' + restaurant.id, {
    method: 'PUT',
    body: JSON.stringify({ palette_key: 'tomato-parchment' }),
  })
  check('palette saved', brand.status === 200 && brand.body?.brand?.palette_key === 'tomato-parchment')
  check('palette returns theme tokens', !!brand.body?.brand?.theme_tokens?.brandPrimary,
    brand.body?.brand?.theme_tokens?.brandPrimary)

  const readBrand = await api('/api/brand-profiles/' + restaurant.id)
  check('palette persists on read', readBrand.body?.brand?.palette_key === 'tomato-parchment')

  // ---------------------------------------------------------------- menu
  section('Phase 3 — Menu Building (2 items: food + drink)')
  const menu = await api('/api/menus', {
    method: 'POST',
    body: JSON.stringify({ restaurant_id: restaurant.id, name: 'Main Menu' }),
  })
  check('menu created (201)', menu.status === 201, 'status ' + menu.status)
  const menuId = menu.body?.menu?.id

  const catPizza = await api('/api/categories', {
    method: 'POST',
    body: JSON.stringify({ menu_id: menuId, name: 'Pizza' }),
  })
  check('category "Pizza" created', catPizza.status === 201, 'status ' + catPizza.status)
  const pizzaCat = catPizza.body?.category?.id

  const catDrinks = await api('/api/categories', {
    method: 'POST',
    body: JSON.stringify({ menu_id: menuId, name: 'Drinks' }),
  })
  check('category "Drinks" created', catDrinks.status === 201, 'status ' + catDrinks.status)
  const drinksCat = catDrinks.body?.category?.id

  const foodImage = imageDataUrl(process.argv[2] || 'test-assets/food.png')
  const drinkImage = imageDataUrl(process.argv[3] || 'test-assets/drink.png')

  const item1 = await api('/api/items', {
    method: 'POST',
    body: JSON.stringify({
      category_id: pizzaCat,
      name: 'Margherita Pizza',
      short_description: 'Tomato, mozzarella and fresh basil',
      price: '12.95',
      currency_code: 'EGP',
      is_featured: true,
      ingredients: ['Tomato', 'Mozzarella', 'Basil'],
      photo_data_url: foodImage,
      photo_filename: 'food.png',
    }),
  })
  check('item 1 "Margherita Pizza" created', item1.status === 201, 'status ' + item1.status)
  check('item 1 price stored as 1295 minor units', item1.body?.item?.price_minor === 1295,
    String(item1.body?.item?.price_minor))
  check('item 1 photo attached', !!item1.body?.item?.primary_asset_id)

  const item2 = await api('/api/items', {
    method: 'POST',
    body: JSON.stringify({
      category_id: drinksCat,
      name: 'Fresh Orange Juice',
      short_description: 'Freshly squeezed oranges, no sugar added',
      price: '4.95',
      currency_code: 'EGP',
      ingredients: ['Orange'],
      photo_data_url: drinkImage,
      photo_filename: 'drink.png',
    }),
  })
  check('item 2 "Fresh Orange Juice" created', item2.status === 201, 'status ' + item2.status)
  check('item 2 price stored as 495 minor units', item2.body?.item?.price_minor === 495,
    String(item2.body?.item?.price_minor))
  check('item 2 photo attached', !!item2.body?.item?.primary_asset_id)

  const tree = await api('/api/menus/' + restaurant.id + '/tree')
  const treeItems = (tree.body?.menus || []).flatMap((m) =>
    (m.categories || []).flatMap((c) => c.items || []),
  )
  check('menu tree returns 2 items', treeItems.length === 2, treeItems.length + ' items')
  check('menu tree returns 2 categories',
    (tree.body?.menus || []).flatMap((m) => m.categories || []).length === 2)
  check('menu tree includes item photos', treeItems.every((i) => !!i.photo_url))
  check('menu tree includes prices', treeItems.every((i) => typeof i.price_minor === 'number'))

  // Media is actually retrievable over HTTP.
  const firstPhoto = treeItems.find((i) => i.photo_url)
  if (firstPhoto) {
    try {
      const imgRes = await fetch(firstPhoto.photo_url)
      check('item photo is downloadable over HTTP', imgRes.status === 200, 'status ' + imgRes.status)
      check('item photo has an image content type',
        (imgRes.headers.get('content-type') || '').startsWith('image/'),
        imgRes.headers.get('content-type'))
    } catch (e) {
      check('item photo is downloadable over HTTP', false, e.message)
    }
  } else {
    check('item photo is downloadable over HTTP', false, 'no photo url')
  }

  // ---------------------------------------------------------------- edit item
  section('Phase 3 — Item Editing')
  const patched = await api('/api/items/' + item1.body.item.id, {
    method: 'PATCH',
    body: JSON.stringify({ price: '14.50', is_available: false }),
  })
  check('item price updated to 1450', patched.body?.item?.price_minor === 1450,
    String(patched.body?.item?.price_minor))
  check('item marked unavailable', patched.body?.item?.is_available === 0)

  const restored = await api('/api/items/' + item1.body.item.id, {
    method: 'PATCH',
    body: JSON.stringify({ price: '12.95', is_available: true }),
  })
  check('item restored', restored.body?.item?.price_minor === 1295 && restored.body?.item?.is_available === 1)

  // ---------------------------------------------------------------- tenant isolation
  section('Phase 4 — Tenant Isolation')
  const otherEmail = 'other' + stamp + '@other.test'
  const otherSignup = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Other Owner', email: otherEmail, password }),
  })
  const mainToken = token
  token = otherSignup.body?.session
  const otherRestaurants = await api('/api/restaurants')
  check('other user sees no restaurants', (otherRestaurants.body?.restaurants || []).length === 0)

  const steal = await api('/api/menus/' + restaurant.id + '/tree')
  check('other user cannot read the menu tree (403)', steal.status === 403, 'status ' + steal.status)

  const stealPublish = await api('/api/publish', {
    method: 'POST',
    body: JSON.stringify({ restaurant_id: restaurant.id, template: 'editorial-showcase' }),
  })
  check('other user cannot publish (403)', stealPublish.status === 403, 'status ' + stealPublish.status)
  token = mainToken

  // ---------------------------------------------------------------- publish
  section('Phase 5 — Publishing')
  const publish = await api('/api/publish', {
    method: 'POST',
    body: JSON.stringify({ restaurant_id: restaurant.id, template: 'editorial-showcase' }),
  })
  check('publish returns 201', publish.status === 201, 'status ' + publish.status)
  check('publish returns a snapshot id', !!publish.body?.snapshotId)
  check('publish returns version 1', publish.body?.versionNumber === 1)
  check('publish returns a checksum', !!publish.body?.checksum && publish.body.checksum.length === 64)
  check('publish returns a public URL', (publish.body?.publishedUrl || '').includes('/m/' + slug),
    publish.body?.publishedUrl)
  check('publish returns a QR target', (publish.body?.qrCodeData || '').includes('/m/' + slug + '/'),
    publish.body?.qrCodeData)

  const v1Checksum = publish.body?.checksum
  const v1Snapshot = publish.body?.snapshotId

  // immutability
  const secondPublish = await api('/api/publish', {
    method: 'POST',
    body: JSON.stringify({ restaurant_id: restaurant.id, template: 'magazine' }),
  })
  check('second publish creates version 2', secondPublish.body?.versionNumber === 2)
  check('second publish has a different checksum', secondPublish.body?.checksum !== v1Checksum)

  const publicMenu = await fetch(API + '/m/' + slug).then((r) => r.json())
  check('public menu is accessible without auth', !!publicMenu?.menu)
  check('public menu serves the latest version', publicMenu?.versionNumber === 2)
  check('public menu carries the restaurant name', publicMenu?.menu?.restaurant?.name === 'Pizza Fun')
  check('public menu carries the palette', publicMenu?.menu?.brand?.palette_key === 'tomato-parchment')
  check('public menu carries both items',
    (publicMenu?.menu?.menus?.[0]?.categories || []).flatMap((c) => c.items || []).length === 2)
  check('public menu carries item photos',
    (publicMenu?.menu?.menus?.[0]?.categories || []).flatMap((c) => c.items || []).every((i) => !!i.photo_url))

  const pinnedMenu = await fetch(API + '/m/' + slug + '/' + v1Snapshot).then((r) => r.json())
  check('pinned snapshot is still retrievable', pinnedMenu?.versionNumber === 1)
  check('pinned snapshot keeps its original checksum', pinnedMenu?.checksum === v1Checksum)

  // ---------------------------------------------------------------- qr
  section('Phase 6 — QR Code')
  const qr = await api('/api/qr/' + v1Snapshot)
  check('QR endpoint returns the URL', (qr.body?.qrCodeData || '').includes('/m/' + slug + '/'),
    qr.body?.qrCodeData)
  check('QR endpoint returns the version number', qr.body?.versionNumber === 1)

  // ---------------------------------------------------------------- versions
  section('Phase 7 — Version History')
  const versions = await api('/api/publish/' + restaurant.id + '/versions')
  check('version history lists 2 versions', (versions.body?.versions || []).length === 2)
  check('version history has unique checksums',
    new Set((versions.body?.versions || []).map((v) => v.checksum_sha256)).size === 2)

  // ---------------------------------------------------------------- ai helpers
  section('Phase 8 — AI Helpers (deterministic, free)')
  const rec = await api('/api/ai/template-recommendation', {
    method: 'POST',
    body: JSON.stringify({ item_count: 2, category_count: 2, has_ingredients: false, photo_coverage: 0.8 }),
  })
  check('template recommendation returns up to 3', (rec.body?.recommendations || []).length <= 3)
  check('template recommendation has reasons', (rec.body?.recommendations || [])[0]?.reasons?.length > 0)

  const org = await api('/api/ai/organize-categories', {
    method: 'POST',
    body: JSON.stringify({
      items: [
        { name: 'Margherita Pizza' },
        { name: 'Fresh Orange Juice' },
        { name: 'Chocolate Cake' },
      ],
    }),
  })
  check('category organizer groups items', (org.body?.categories || []).length >= 3)

  const review = await api('/api/ai/visual-review', {
    method: 'POST',
    body: JSON.stringify({ version_id: v1Snapshot }),
  })
  check('visual review returns checks', (review.body?.checks || []).length > 0)

  // ---------------------------------------------------------------- logout
  section('Phase 9 — Sign out')
  const signout = await api('/api/auth/signout', { method: 'POST' })
  check('signout returns ok', signout.status === 200)
  const afterSignout = await api('/api/auth/session')
  check('session is cleared after signout', afterSignout.body?.isAuthenticated === false)
  const protectedCall = await api('/api/restaurants')
  check('protected route rejects after signout (401)', protectedCall.status === 401,
    'status ' + protectedCall.status)

  // public menu still works after signout
  const publicAfter = await fetch(API + '/m/' + slug).then((r) => r.json())
  check('public menu still works after signout', !!publicAfter?.menu)

  // ------------------------------------------- multi-account isolation
  section('Phase 9b — Second account on the same device')
  const secondEmail = 'second' + stamp + '@other.test'
  const secondSignup = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Second Owner', email: secondEmail, password }),
  })
  check('second account registers', secondSignup.status === 201)
  token = secondSignup.body?.session

  const secondRestaurants = await api('/api/restaurants')
  check('second account starts with no restaurants',
    (secondRestaurants.body?.restaurants || []).length === 0,
    (secondRestaurants.body?.restaurants || []).length + ' restaurants')

  const secondRest = await api('/api/restaurants', {
    method: 'POST',
    body: JSON.stringify({ name: 'Second Cafe', currency_code: 'USD' }),
  })
  check('second account can create its own restaurant', secondRest.status === 201,
    'status ' + secondRest.status)
  const secondRestaurantId = secondRest.body?.restaurant?.id

  const secondMenu = await api('/api/menus', {
    method: 'POST',
    body: JSON.stringify({ restaurant_id: secondRestaurantId, name: 'Second Menu' }),
  })
  check('second account can create a menu', secondMenu.status === 201)

  const secondCategory = await api('/api/categories', {
    method: 'POST',
    body: JSON.stringify({ menu_id: secondMenu.body?.menu?.id, name: 'Second Category' }),
  })
  check('second account can add a category to its own menu', secondCategory.status === 201,
    'status ' + secondCategory.status)

  // Sign back in as the first account and confirm its own data is intact.
  token = null
  const relogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  token = relogin.body?.session
  check('first account can log back in', relogin.status === 200 && !!token)

  // Now that the FIRST account is authenticated, it must not reach the
  // second account's restaurant.
  const crossAccess = await api('/api/menus/' + secondRestaurantId + '/tree')
  check('first account cannot read the second account menu (403)', crossAccess.status === 403,
    'status ' + crossAccess.status)

  const crossPublish = await api('/api/publish', {
    method: 'POST',
    body: JSON.stringify({ restaurant_id: secondRestaurantId, template: 'editorial-showcase' }),
  })
  check('first account cannot publish the second account menu (403)', crossPublish.status === 403,
    'status ' + crossPublish.status)

  const firstTree = await api('/api/menus/' + restaurant.id + '/tree')
  check('first account still owns its menu after the second account existed',
    firstTree.status === 200 && (firstTree.body?.menus || []).length > 0,
    'status ' + firstTree.status)

  // ---------------------------------------------------------------- web app
  section('Phase 10 — Web App Reachability')
  try {
    const webRes = await fetch(WEB)
    check('web app responds on ' + WEB, webRes.status === 200, 'status ' + webRes.status)
    const html = await webRes.text()
    check('web app serves the SPA shell', html.includes('<div id="root">'))
  } catch (e) {
    check('web app responds on ' + WEB, false, e.message)
  }

  // ---------------------------------------------------------------- summary
  console.log('\n========================================')
  console.log('PASSED: ' + passed + '   FAILED: ' + failed)
  if (failed > 0) {
    console.log('\nFailures:')
    for (const f of failures) console.log('  - ' + f)
  }
  console.log('========================================')
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('Test harness crashed:', e)
  process.exit(2)
})
