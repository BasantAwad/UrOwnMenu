/**
 * Re-publish a restaurant's menu so the snapshot picks up the latest
 * template code, the cutout flag and the photo dimensions.
 *
 * Usage: node scripts/republish.mjs <email> <password> [templateKey]
 */
const API = process.env.API_BASE || 'http://127.0.0.1:8787'
const [email, password, templateKey] = process.argv.slice(2)

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

const login = await call('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
})
const token = login.session

const restaurants = await call('/api/restaurants', { token })
const restaurant = restaurants.restaurants[0]
if (!restaurant) throw new Error('no restaurant for ' + email)

// Mark the first item as a signature dish so the Editorial Showcase shows
// the signature section.
const tree = await call('/api/menus/' + restaurant.id + '/tree', { token })
const firstItem = tree.menus.flatMap((m) => m.categories).flatMap((c) => c.items)[0]
if (firstItem && !firstItem.is_featured) {
  await call('/api/items/' + firstItem.id, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ is_featured: true }),
  })
  console.log('marked signature:', firstItem.name)
}

const published = await call('/api/publish', {
  method: 'POST',
  token,
  body: JSON.stringify({
    restaurant_id: restaurant.id,
    template: templateKey || 'editorial-showcase',
  }),
})

console.log('published v' + published.versionNumber, published.publishedUrl)
console.log('snapshot', published.snapshotId)
