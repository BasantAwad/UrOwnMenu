/**
 * Test the ingredient photo resolver end-to-end:
 * add a dessert item with a hero ingredient, publish with ingredient-story,
 * and inspect the snapshot's ingredientPhotos credits.
 */
const API = 'http://127.0.0.1:8787'
const EMAIL = 'nour@cairo.test'
const PASS = 'TestPass123'

async function req(path, opts = {}) {
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

const login = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASS }) })
const token = login.session
console.log('logged in as', login.user?.email)

const restaurants = await req('/api/restaurants', { token })
const rest = (restaurants.restaurants || []).find((r) => r.slug === 'cairo-coffee-house')
if (!rest) throw new Error('restaurant not found')
console.log('restaurant:', rest.id)

const tree = await req('/api/menus/' + rest.id + '/tree', { token })
const menu = tree.menus[0]
const cat = menu.categories.find((c) => c.name.toLowerCase().includes('dessert')) ||
  menu.categories[0]
console.log('adding item to category:', cat.name)

const existing = (menu.categories.flatMap((c) => c.items)).find((i) => i.name === 'Dark Chocolate Lava Cake')
if (existing) {
  console.log('item already exists, id', existing.id)
} else {
  const created = await req('/api/items', {
    method: 'POST',
    token,
    body: JSON.stringify({
      category_id: cat.id,
      name: 'Dark Chocolate Lava Cake',
      short_description: 'Molten dark chocolate centre with vanilla cream',
      price: '85.00',
      currency_code: 'EGP',
      ingredients: ['Dark Chocolate', 'Butter', 'Eggs', 'Sugar', 'Flour'],
      main_ingredient: 'Dark Chocolate',
      is_featured: true,
    }),
  })
  console.log('created item', created.item.id, 'main_ingredient=', created.item.main_ingredient)
}

console.log('publishing ingredient-story...')
const published = await req('/api/publish', {
  method: 'POST',
  token,
  body: JSON.stringify({ restaurant_id: rest.id, template: 'ingredient-story' }),
})
console.log('published v' + published.versionNumber, published.publishedUrl)

const pub = await req('/m/' + rest.slug, { headers: {} })
const snap = pub.menu || pub
console.log('\ningredientPhotos in snapshot:')
console.log(JSON.stringify(snap.ingredientPhotos, null, 2))
