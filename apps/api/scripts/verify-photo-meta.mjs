/**
 * Verify art-direction metadata round-trips through the API.
 *
 *   1. An item PATCHed with photo_meta returns it in the owner tree.
 *   2. Out-of-range measurements are rejected (400), so a broken client
 *      cannot poison layout decisions.
 *   3. A published snapshot carries the metadata, which is what public
 *      templates actually read.
 *
 * Usage: node scripts/verify-photo-meta.mjs [email] [password]
 */
const API = process.env.API_BASE || 'http://127.0.0.1:8787'
const EMAIL = process.argv[2] || 'owner@gourmet-bistro.test'
const PASSWORD = process.argv[3] || 'TestPass123'

async function call(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (options.token) headers['Authorization'] = 'Bearer ' + options.token
  const res = await fetch(API + path, { ...options, headers })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
  return { ok: res.ok, status: res.status, body }
}

const checks = []
function check(label, ok, detail) {
  checks.push({ label, ok, detail })
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + label + (detail ? '  (' + detail + ')' : ''))
}

const login = await call('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const token = login.body.session
const restaurants = await call('/api/restaurants', { token })
const restaurant = restaurants.body.restaurants[0]
const tree = await call('/api/menus/' + restaurant.id + '/tree', { token })
const items = tree.body.menus.flatMap((m) => m.categories).flatMap((c) => c.items)
const withMeta = items.find((i) => i.photo_meta)

check('tree returns photo_meta for measured items', Boolean(withMeta), withMeta ? withMeta.name : 'none measured')

// A deliberately invalid measurement must be refused.
const target = withMeta || items[0]
const invalid = await call('/api/items/' + target.id, {
  method: 'PATCH',
  token,
  body: JSON.stringify({
    photo_meta: {
      v: 1,
      focusX: 2,
      focusY: 0.5,
      ratio: 1,
      meanLuma: 0.5,
      contrast: 0.5,
      coverage: 1,
      treatment: 'cover',
      dominant: [10, 10, 10],
    },
  }),
})
check('out-of-range focus is rejected', invalid.status === 400, 'status ' + invalid.status)

const valid = {
  v: 1,
  focusX: 0.42,
  focusY: 0.58,
  ratio: 1.5,
  meanLuma: 0.44,
  contrast: 0.71,
  coverage: 1,
  treatment: 'cover',
  dominant: [120, 90, 60],
}
const patched = await call('/api/items/' + target.id, {
  method: 'PATCH',
  token,
  body: JSON.stringify({ photo_meta: valid }),
})
check('valid photo_meta is accepted', patched.ok, 'status ' + patched.status)

const reread = await call('/api/menus/' + restaurant.id + '/tree', { token })
const after = reread.body.menus.flatMap((m) => m.categories).flatMap((c) => c.items)
  .find((i) => i.id === target.id)
check(
  'photo_meta round-trips exactly',
  after?.photo_meta?.focusX === valid.focusX && after?.photo_meta?.ratio === valid.ratio,
  after?.photo_meta ? 'focus ' + after.photo_meta.focusX + ',' + after.photo_meta.focusY : 'missing',
)

const published = await call('/api/publish', {
  method: 'POST',
  token,
  body: JSON.stringify({ restaurant_id: restaurant.id, template: 'ingredient-story' }),
})
check('publish succeeds with measured items', published.ok, 'v' + published.body?.versionNumber)

const publicMenu = await call('/m/' + restaurant.slug)
const snapshotItems = (publicMenu.body?.menu?.menus || [])
  .flatMap((m) => m.categories)
  .flatMap((c) => c.items)
const snapshotItem = snapshotItems.find((i) => i.id === target.id)
check(
  'published snapshot carries photo_meta',
  Boolean(snapshotItem?.photo_meta),
  snapshotItem?.photo_meta ? 'focus ' + snapshotItem.photo_meta.focusX : 'missing',
)

// Restore the original measurement so the demo data is not left with a fake.
if (withMeta && target.id === withMeta.id) {
  await call('/api/items/' + target.id, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ photo_meta: withMeta.photo_meta }),
  })
  await call('/api/publish', {
    method: 'POST',
    token,
    body: JSON.stringify({ restaurant_id: restaurant.id, template: 'ingredient-story' }),
  })
}

const failed = checks.filter((c) => !c.ok).length
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks passed')
process.exit(failed === 0 ? 0 : 1)
