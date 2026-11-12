const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8787'

export type SessionUser = {
  id: string
  name: string | null
  email: string | null
}

export type PaletteKey =
  | 'espresso-cream'
  | 'tomato-parchment'
  | 'midnight-champagne'
  | 'pistachio-vanilla'
  | 'citrus-pop'
  | 'ocean-glass'
  | 'black-bone'
  | 'berry-blush'

export type TemplateKey =
  | 'editorial-showcase'
  | 'orbital-menu'
  | 'ingredient-universe'
  | 'endless-table'
  | 'magazine'
  | 'ingredient-story'
  | 'cafe'
  | 'mosaic'

export type MenuItem = {
  id: string
  category_id: string
  name: string
  short_description: string | null
  long_description: string | null
  price_minor: number | null
  currency_code: string
  primary_asset_id: string | null
  photo_url: string | null
  photo_width: number | null
  photo_height: number | null
  /** True when the photo is a background-removed cutout with transparency. */
  photo_is_cutout: boolean
  /** Measured placement facts (focal point, luminance, subject bounds). */
  photo_meta?: import('./media-intelligence').PhotoMeta | null
  is_featured: number
  is_available: number
  /** Owner-marked hero ingredient; falls back to the first listed ingredient. */
  main_ingredient?: string | null
  ingredients: string[]
  allergens: string[]
  dietary_labels: string[]
  tags: string[]
  sort_order: number
}

export type MenuCategory = {
  id: string
  menu_id: string
  name: string
  description: string | null
  sort_order: number
  is_visible: number
  items: MenuItem[]
}

export type MenuNode = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  is_active: number
  categories: MenuCategory[]
}

export type Restaurant = {
  id: string
  name: string
  slug: string
  owner_user_id: string
  description: string | null
  phone: string | null
  email: string | null
  website_url: string | null
  address_text: string | null
  currency_code: string
  locale: string
  timezone: string
  status: string
  published_version_id: string | null
}

export type PublishedSnapshot = {
  schema_version: number
  restaurant: {
    id: string
    name: string
    slug: string
    description: string | null
    phone: string | null
    email: string | null
    website_url: string | null
    address_text: string | null
    currency_code: string
    locale: string
    timezone: string
  }
  brand: {
    palette_key: PaletteKey
    theme_tokens: Record<string, string>
    typography: Record<string, string>
  }
  template: {
    key: TemplateKey
    version: string
    config: Record<string, unknown>
  }
  /** Macro ingredient photography resolved at publish time, keyed by slug. */
  ingredientPhotos?: Record<
    string,
    {
      displayName: string
      url: string
      source: string
      sourceUrl: string | null
      license: string
      licenseUrl: string | null
      creator: string | null
      width: number | null
      height: number | null
    }
  >
  menus: Array<{
    id: string
    name: string
    categories: Array<{
      id: string
      name: string
      description: string | null
      items: MenuItem[]
    }>
  }>
  published_at: string
}

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token') || ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = 'Bearer ' + token

  const res = await fetch(API_BASE + path, { ...options, headers })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { error: text }
  }
  if (!res.ok) {
    throw new ApiError(res.status, (data && data.error) || 'Request failed (' + res.status + ')')
  }
  return data as T
}

export const api = {
  base: API_BASE,

  health: () => request<{ status: string }>('/health'),

  meta: () => request<{
    palettes: Array<{ key: PaletteKey; name: string; tokens: Record<string, string> }>
    templates: Array<{ key: TemplateKey; name: string; bestFor: string }>
  }>('/api/meta'),

  signup: (name: string, email: string, password?: string) =>
    request<{ status: string; user: SessionUser; session: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password?: string) =>
    request<{ status: string; user: SessionUser; session: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  session: () => request<{ isAuthenticated: boolean; user: SessionUser | null }>('/api/auth/session'),

  signout: () => request<{ status: string }>('/api/auth/signout', { method: 'POST' }),

  listRestaurants: () => request<{ restaurants: Restaurant[] }>('/api/restaurants'),

  createRestaurant: (payload: Record<string, string | undefined>) =>
    request<{ status: string; restaurant: Restaurant }>('/api/restaurants', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getRestaurant: (id: string) =>
    request<{ restaurant: Restaurant; brand: any; config: any }>('/api/restaurants/' + id),

  setBrand: (restaurantId: string, paletteKey: PaletteKey) =>
    request<{ status: string; brand: any }>('/api/brand-profiles/' + restaurantId, {
      method: 'PUT',
      body: JSON.stringify({ palette_key: paletteKey }),
    }),

  setTemplate: (restaurantId: string, templateKey: TemplateKey) =>
    request<{ status: string; config: any }>('/api/restaurants/' + restaurantId + '/template', {
      method: 'PUT',
      body: JSON.stringify({ template_key: templateKey }),
    }),

  createMenu: (restaurantId: string, name: string) =>
    request<{ status: string; menu: any }>('/api/menus', {
      method: 'POST',
      body: JSON.stringify({ restaurant_id: restaurantId, name }),
    }),

  menuTree: (restaurantId: string) =>
    request<{ menus: MenuNode[] }>('/api/menus/' + restaurantId + '/tree'),

  createCategory: (menuId: string, name: string, description?: string) =>
    request<{ status: string; category: any }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ menu_id: menuId, name, description }),
    }),

  deleteCategory: (id: string) =>
    request<{ status: string }>('/api/categories/' + id, { method: 'DELETE' }),

  createItem: (payload: Record<string, unknown>) =>
    request<{ status: string; item: MenuItem }>('/api/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateItem: (id: string, payload: Record<string, unknown>) =>
    request<{ status: string; item: MenuItem }>('/api/items/' + id, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteItem: (id: string) =>
    request<{ status: string }>('/api/items/' + id, { method: 'DELETE' }),

  publish: (restaurantId: string, templateKey: TemplateKey) =>
    request<{
      status: string
      snapshotId: string
      versionNumber: number
      checksum: string
      template: string
      publishedUrl: string
      qrCodeData: string
      publishedAt: string
    }>('/api/publish', {
      method: 'POST',
      body: JSON.stringify({ restaurant_id: restaurantId, template: templateKey }),
    }),

  versions: (restaurantId: string) =>
    request<{ versions: Array<{ id: string; version_number: number; checksum_sha256: string; created_at: string }> }>(
      '/api/publish/' + restaurantId + '/versions',
    ),

  publicMenu: (slug: string) =>
    request<{
      status: string
      slug: string
      versionId: string
      versionNumber: number
      checksum: string
      publishedAt: string
      menu: PublishedSnapshot
    }>('/m/' + slug),

  qr: (versionId: string) =>
    request<{ qrCodeData: string; url: string; versionNumber: number }>('/api/qr/' + versionId),

  templateRecommendation: (payload: Record<string, unknown>) =>
    request<{ recommendations: Array<{ key: TemplateKey; name: string; score: number; reasons: string[]; best_for: string }> }>(
      '/api/ai/template-recommendation',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  organizeCategories: (items: Array<{ name: string; short_description?: string }>) =>
    request<{ categories: Array<{ name: string; items: string[] }> }>('/api/ai/organize-categories', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  visualReview: (payload: Record<string, unknown>) =>
    request<{ checks: Array<{ id: string; label: string; status: string }> }>('/api/ai/visual-review', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}

/** Format minor units as a human readable price. */
export function formatPrice(minor: number | null, currency: string): string {
  if (minor === null || minor === undefined) return ''
  const value = minor / 100
  const symbols: Record<string, string> = { EGP: 'E£', USD: '$', EUR: '€', GBP: '£' }
  const symbol = symbols[currency] || currency + ' '
  return symbol + value.toFixed(2)
}

/** Read a File as a data URL for upload. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Downscale and compress an image in the browser before upload.
 *
 * Menu photos are viewed on phones over mobile data, so serving a 4 MB
 * original for a 120 px thumbnail is wasteful. We cap the longest edge and
 * re-encode as JPEG, which typically cuts the payload by ~95%.
 *
 * Falls back to the original file if canvas processing is unavailable.
 */
export async function prepareImageForUpload(
  file: File,
  maxEdge = 1200,
  quality = 0.82,
): Promise<{ dataUrl: string; filename: string }> {
  try {
    const original = await readFileAsDataUrl(file)

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not decode image'))
      img.src = original
    })

    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight)
    if (!longestEdge) throw new Error('Empty image')

    const scale = Math.min(1, maxEdge / longestEdge)
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.drawImage(image, 0, 0, width, height)

    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (!dataUrl.startsWith('data:image/jpeg')) throw new Error('Encoding failed')

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return { dataUrl, filename: baseName + '.jpg' }
  } catch {
    // Fall back to the untouched original.
    return { dataUrl: await readFileAsDataUrl(file), filename: file.name }
  }
}
