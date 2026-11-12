import * as React from 'react'
import { api, formatPrice } from './api'
import type { MenuNode, PaletteKey, Restaurant, SessionUser, TemplateKey } from './api'
import { TemplateRenderer, paletteVars } from './templates'
import MediaEditor from './MediaEditor'
import { DEFAULT_ADJUSTMENTS, prepareForUpload } from './media'
import type { PhotoMeta } from './media-intelligence'
import QRCode from 'qrcode'
import './App.css'

type Step = 'welcome' | 'signup' | 'login' | 'restaurant' | 'brand' | 'menu' | 'preview' | 'publish'

type ItemDraft = {
  name: string
  description: string
  price: string
  ingredients: string
  /** Owner-marked hero ingredient (the dessert template backgrounds off it). */
  heroIngredient: string
  file: File | null
  /** Prepared photo produced by the media editor (data URL + filename + size). */
  prepared: {
    dataUrl: string
    filename: string
    width: number
    height: number
    cutout: boolean
    /** Measured placement facts; drives focal crops and scrim decisions. */
    meta?: PhotoMeta
  } | null
}

const EMPTY_DRAFT: ItemDraft = {
  name: '',
  description: '',
  price: '',
  ingredients: '',
  heroIngredient: '',
  file: null,
  prepared: null,
}

function parseIngredients(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

type PublishResult = {
  snapshotId: string
  versionNumber: number
  checksum: string
  template: string
  publishedUrl: string
  qrCodeData: string
  publishedAt: string
}

const PALETTE_OPTIONS: Array<{ key: PaletteKey; label: string; blurb: string }> = [
  { key: 'espresso-cream', label: 'Espresso & Cream', blurb: 'Cafés and coffee houses' },
  { key: 'tomato-parchment', label: 'Tomato & Parchment', blurb: 'Pizza, Italian, casual' },
  { key: 'midnight-champagne', label: 'Midnight & Champagne', blurb: 'Fine dining' },
  { key: 'pistachio-vanilla', label: 'Pistachio & Vanilla', blurb: 'Desserts, matcha, bakery' },
  { key: 'citrus-pop', label: 'Citrus Pop', blurb: 'Juice and smoothie bars' },
  { key: 'ocean-glass', label: 'Ocean Glass', blurb: 'Seafood, coastal, drinks' },
  { key: 'black-bone', label: 'Black & Bone', blurb: 'Minimalist and modern' },
  { key: 'berry-blush', label: 'Berry & Blush', blurb: 'Dessert and patisserie' },
]

const TEMPLATE_OPTIONS: Array<{ key: TemplateKey; label: string; blurb: string }> = [
  { key: 'editorial-showcase', label: 'Editorial Showcase', blurb: 'Cinematic hero with a full conventional menu' },
  { key: 'orbital-menu', label: 'Orbital Menu', blurb: 'Dishes arranged in a circular orbit' },
  { key: 'ingredient-universe', label: 'Ingredient Universe', blurb: 'Premium dark stage with the dish exploded into its ingredients' },
  { key: 'endless-table', label: 'Endless Table', blurb: 'Continuous scroll through editorial sections' },
  { key: 'magazine', label: 'Menu Magazine', blurb: 'Editorial spreads with page turns' },
  { key: 'ingredient-story', label: 'Ingredient Story', blurb: 'Each item gets a full-bleed section backed by its hero ingredient' },
  { key: 'cafe', label: 'Café Pedestal', blurb: 'Pedestal hero, pill category tabs, cream product cards' },
  { key: 'mosaic', label: 'Mosaïque', blurb: 'A 3x3 mosaic of alternating camel and maroon photo tiles' },
]

const PALETTE_SWATCHES: Record<PaletteKey, string[]> = {
  'espresso-cream': ['#2B211D', '#594239', '#B77A45', '#F4EFE7'],
  'tomato-parchment': ['#B83A2E', '#762B25', '#66704B', '#F5EBDD'],
  'midnight-champagne': ['#171B24', '#343B49', '#D5BD91', '#F3EFE7'],
  'pistachio-vanilla': ['#526348', '#A9B59A', '#F7F1E4', '#C98F83'],
  'citrus-pop': ['#F07835', '#F4D65E', '#4F7554', '#FFF8EA'],
  'ocean-glass': ['#164A4A', '#A9C8BE', '#EDE2D0', '#B97855'],
  'black-bone': ['#171717', '#353535', '#F1EEE7', '#A88A58'],
  'berry-blush': ['#6E304B', '#E7C6C5', '#F7EDE8', '#C98F83'],
}

export default function App() {
  const [step, setStep] = React.useState<Step>('welcome')
  const [user, setUser] = React.useState<SessionUser | null>(null)
  const [restaurant, setRestaurant] = React.useState<Restaurant | null>(null)
  const [palette, setPalette] = React.useState<PaletteKey>('tomato-parchment')
  const [template, setTemplate] = React.useState<TemplateKey>('editorial-showcase')
  const [menus, setMenus] = React.useState<MenuNode[]>([])
  const [publishResult, setPublishResult] = React.useState<PublishResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [booting, setBooting] = React.useState(true)

  // ---------- Form state ----------
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [restName, setRestName] = React.useState('')
  const [restSlug, setRestSlug] = React.useState('')
  const [restDescription, setRestDescription] = React.useState('')
  const [currency, setCurrency] = React.useState('EGP')
  const [timezone, setTimezone] = React.useState('Africa/Cairo')
  const [phone, setPhone] = React.useState('')
  const [address, setAddress] = React.useState('')

  const [newCategory, setNewCategory] = React.useState('')
  const [itemDraft, setItemDraft] = React.useState<Record<string, ItemDraft>>({})
  const [editingPhoto, setEditingPhoto] = React.useState<{
    file: File
    categoryId: string
  } | null>(null)

  // ---------- Boot ----------
  React.useEffect(() => {
    ;(async () => {
      try {
        const res = await api.session()
        if (res.isAuthenticated && res.user) {
          setUser(res.user)
          await loadWorkspace()
        }
      } catch {
        /* API not reachable yet - stay on welcome */
      } finally {
        setBooting(false)
      }
    })()
  }, [])

  async function loadWorkspace() {
    try {
      const res = await api.listRestaurants()
      const list = res.restaurants || []
      if (list.length > 0) {
        setRestaurant(list[0])
        setItemDraft({})
        const brand = await api.getRestaurant(list[0].id)
        if (brand.brand?.palette_key) setPalette(brand.brand.palette_key)
        if (brand.config?.template_key) setTemplate(brand.config.template_key)
        await loadMenuTree(list[0].id)
        setStep('menu')
      } else {
        setStep('restaurant')
      }
    } catch (e) {
      setError((e as Error).message)
      setStep('restaurant')
    }
  }

  async function loadMenuTree(restaurantId: string) {
    try {
      const res = await api.menuTree(restaurantId)
      setMenus(res.menus || [])
    } catch (e) {
      setError((e as Error).message)
    }
  }

  /**
   * The menu new categories are added to.
   *
   * Derived from the current restaurant's menu list rather than kept in its
   * own state, so switching accounts or restaurants can never leave a stale
   * menu id behind.
   */
  const activeMenu = menus[0] || null
  const itemCount = menus.reduce(
    (sum, m) => sum + m.categories.reduce((s, c) => s + c.items.length, 0),
    0,
  )
  const categoryCount = menus.reduce((sum, m) => sum + m.categories.length, 0)

  // ---------- Auth handlers ----------
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.signup(name.trim(), email.trim(), password || undefined)
      localStorage.setItem('token', res.session)
      setUser(res.user)
      await loadWorkspace()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.login(email.trim(), password || undefined)
      localStorage.setItem('token', res.session)
      setUser(res.user)
      await loadWorkspace()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSignout() {
    try {
      await api.signout()
    } catch {
      /* ignore */
    }
    localStorage.removeItem('token')
    setUser(null)
    setRestaurant(null)
    setMenus([])
    setItemDraft({})
    setPublishResult(null)
    setPalette('tomato-parchment')
    setTemplate('editorial-showcase')
    setStep('welcome')
  }

  // ---------- Restaurant ----------
  async function handleRestaurantSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.createRestaurant({
        name: restName.trim(),
        slug: restSlug.trim() || undefined,
        description: restDescription.trim() || undefined,
        phone: phone.trim() || undefined,
        address_text: address.trim() || undefined,
        currency_code: currency,
        timezone,
      } as Record<string, string | undefined>)
      setRestaurant(res.restaurant)
      setMenus([])
      setItemDraft({})
      await api.setBrand(res.restaurant.id, palette)
      setStep('brand')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // ---------- Brand ----------
  async function handlePaletteSelect(key: PaletteKey) {
    setPalette(key)
    if (!restaurant) return
    try {
      await api.setBrand(restaurant.id, key)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // ---------- Menu studio ----------
  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant) return
    const trimmed = newCategory.trim()
    if (!trimmed) return
    setError(null)
    setBusy(true)
    try {
      let menuId = activeMenu?.id
      if (!menuId) {
        const created = await api.createMenu(restaurant.id, 'Main Menu')
        menuId = created.menu.id
      }
      await api.createCategory(menuId, trimmed)
      setNewCategory('')
      await loadMenuTree(restaurant.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!restaurant) return
    setError(null)
    try {
      await api.deleteCategory(categoryId)
      await loadMenuTree(restaurant.id)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  function updateDraft(categoryId: string, patch: Partial<ItemDraft>) {
    setItemDraft((prev) => {
      const current = prev[categoryId] || EMPTY_DRAFT
      return { ...prev, [categoryId]: { ...current, ...patch } }
    })
  }

  async function handleAddItem(categoryId: string, e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant) return
    const draft = itemDraft[categoryId]
    if (!draft || !draft.name.trim()) return
    setError(null)
    setBusy(true)
    try {
      const payload: Record<string, unknown> = {
        category_id: categoryId,
        name: draft.name.trim(),
        short_description: draft.description.trim() || undefined,
        price: draft.price.trim() || undefined,
        currency_code: currency,
      }
      // Ingredients are owner-supplied facts. They are never inferred from
      // a photo, so this field is the only source for the ingredient
      // templates.
      const ingredientList = parseIngredients(draft.ingredients)
      if (ingredientList.length > 0) payload.ingredients = ingredientList
      if (draft.heroIngredient && ingredientList.includes(draft.heroIngredient)) {
        payload.main_ingredient = draft.heroIngredient
      }
      if (draft.prepared) {
        payload.photo_data_url = draft.prepared.dataUrl
        payload.photo_filename = draft.prepared.filename
        payload.photo_width = draft.prepared.width
        payload.photo_height = draft.prepared.height
        payload.photo_is_cutout = draft.prepared.cutout
        if (draft.prepared.meta) payload.photo_meta = draft.prepared.meta
      } else if (draft.file) {
        // A photo added without opening the editor still gets measured, so
        // every template can place it from evidence rather than a blind
        // centre crop.
        const prepared = await prepareForUpload(draft.file, DEFAULT_ADJUSTMENTS)
        payload.photo_data_url = prepared.dataUrl
        payload.photo_filename = prepared.filename
        payload.photo_width = prepared.width
        payload.photo_height = prepared.height
        payload.photo_is_cutout = prepared.cutout
        payload.photo_meta = prepared.meta
      }
      await api.createItem(payload)
      setItemDraft((prev) => ({ ...prev, [categoryId]: EMPTY_DRAFT }))
      await loadMenuTree(restaurant.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!restaurant) return
    try {
      await api.deleteItem(itemId)
      await loadMenuTree(restaurant.id)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleToggleAvailability(itemId: string, isAvailable: number) {
    if (!restaurant) return
    try {
      await api.updateItem(itemId, { is_available: isAvailable === 1 })
      await loadMenuTree(restaurant.id)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // ---------- Template ----------
  async function handleTemplateChange(key: TemplateKey) {
    setTemplate(key)
    if (restaurant) {
      try {
        await api.setTemplate(restaurant.id, key)
      } catch (err) {
        setError((err as Error).message)
      }
    }
  }

  async function handleRecommendation() {
    if (!restaurant) return
    setError(null)
    setBusy(true)
    try {
      const res = await api.templateRecommendation({
        item_count: itemCount,
        category_count: categoryCount,
        has_ingredients: false,
        photo_coverage: 0.5,
      })
      if (res.recommendations && res.recommendations.length > 0) {
        await handleTemplateChange(res.recommendations[0].key)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // ---------- Publish ----------
  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant) return
    setError(null)
    setBusy(true)
    try {
      const res = await api.publish(restaurant.id, template)
      setPublishResult(res)
      setStep('publish')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // ---------- Preview snapshot ----------
  const previewSnapshot = React.useMemo(() => {
    if (!restaurant) return null
    return {
      schema_version: 1,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        description: restaurant.description,
        phone: restaurant.phone,
        email: restaurant.email,
        website_url: restaurant.website_url,
        address_text: restaurant.address_text,
        currency_code: currency,
        locale: restaurant.locale,
        timezone: restaurant.timezone,
      },
      brand: {
        palette_key: palette,
        theme_tokens: paletteTokens(palette),
        typography: {
          display: "'Fraunces', Georgia, 'Times New Roman', serif",
          body: "'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
        },
      },
      template: { key: template, version: '1.0.0', config: {} },
      menus: menus.map((m) => ({
        id: m.id,
        name: m.name,
        categories: m.categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          items: c.items,
        })),
      })),
      published_at: new Date().toISOString(),
    }
  }, [restaurant, palette, template, menus, currency])

  // ---------- Render ----------
  if (booting) {
    return (
      <div className="app app--centered">
        <div className="boot">Loading UrOwnMenu…</div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__mark" aria-hidden="true">U</span>
          <span className="topbar__wordmark">UrOwnMenu</span>
        </div>
        <div className="topbar__right">
          {user && (
            <span className="topbar__user">{user.name || user.email}</span>
          )}
          {user && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleSignout}>
              Sign out
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
          <button type="button" className="alert__close" onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {step === 'welcome' && !user && (
        <WelcomeScreen onSignup={() => setStep('signup')} onLogin={() => setStep('login')} />
      )}

      {step === 'signup' && !user && (
        <AuthScreen
          mode="signup"
          name={name}
          email={email}
          password={password}
          busy={busy}
          onName={setName}
          onEmail={setEmail}
          onPassword={setPassword}
          onSubmit={handleSignup}
          onBack={() => setStep('welcome')}
        />
      )}

      {step === 'login' && !user && (
        <AuthScreen
          mode="login"
          name={name}
          email={email}
          password={password}
          busy={busy}
          onName={setName}
          onEmail={setEmail}
          onPassword={setPassword}
          onSubmit={handleLogin}
          onBack={() => setStep('welcome')}
        />
      )}

      {user && !restaurant && (
        <RestaurantScreen
          restName={restName}
          restSlug={restSlug}
          restDescription={restDescription}
          phone={phone}
          address={address}
          currency={currency}
          timezone={timezone}
          busy={busy}
          onRestName={setRestName}
          onRestSlug={setRestSlug}
          onRestDescription={setRestDescription}
          onPhone={setPhone}
          onAddress={setAddress}
          onCurrency={setCurrency}
          onTimezone={setTimezone}
          onSubmit={handleRestaurantSubmit}
        />
      )}

      {user && restaurant && step === 'brand' && (
        <BrandScreen
          palette={palette}
          onSelect={handlePaletteSelect}
          onContinue={() => setStep('menu')}
        />
      )}

      {user && restaurant && (step === 'menu' || step === 'preview') && (
        <div className="studio">
          <section className="studio__panel">
            <header className="studio__header">
              <div>
                <h1 className="studio__title">Menu Studio</h1>
                <p className="studio__subtitle">
                  {restaurant.name} · {categoryCount} categories · {itemCount} items
                </p>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStep('brand')}>
                Brand
              </button>
            </header>

            <div className="studio__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={step === 'menu'}
                className={'studio__tab' + (step === 'menu' ? ' is-active' : '')}
                onClick={() => setStep('menu')}
              >
                Build
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={step === 'preview'}
                className={'studio__tab' + (step === 'preview' ? ' is-active' : '')}
                onClick={() => setStep('preview')}
              >
                Preview
              </button>
            </div>

            {step === 'menu' && (
              <>
                <form className="studio__addRow" onSubmit={handleAddCategory}>
                  <input
                    className="input"
                    placeholder="New category (e.g. Mains)"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    aria-label="New category name"
                  />
                  <button type="submit" className="btn btn--primary" disabled={busy || !newCategory.trim()}>
                    Add category
                  </button>
                </form>

                {activeMenu && menus.length > 1 && (
                  <p className="studio__hint studio__hint--block">
                    Adding to <strong>{activeMenu.name}</strong>
                  </p>
                )}

                {menus.length === 0 && (
                  <p className="studio__empty">
                    No categories yet. Add one above to start building your menu.
                  </p>
                )}

                {menus.map((menu) => (
                  <div key={menu.id} className="studio__menu">
                    {menu.categories.length === 0 && (
                      <p className="studio__empty">{menu.name} has no categories yet.</p>
                    )}
                    {menu.categories.map((cat) => {
                      const draft = itemDraft[cat.id] || EMPTY_DRAFT
                      return (
                        <article key={cat.id} className="cat">
                          <header className="cat__header">
                            <h3 className="cat__name">{cat.name}</h3>
                            <span className="cat__count">{cat.items.length} items</span>
                            <button
                              type="button"
                              className="btn btn--danger btn--sm"
                              onClick={() => handleDeleteCategory(cat.id)}
                            >
                              Delete
                            </button>
                          </header>

                          {cat.items.length > 0 && (
                            <ul className="cat__items">
                              {cat.items.map((item) => (
                                <li key={item.id} className={'catItem' + (item.is_available ? '' : ' catItem--out')}>
                                  {item.photo_url ? (
                                    <img className="catItem__thumb" src={item.photo_url} alt="" />
                                  ) : (
                                    <span className="catItem__thumb catItem__thumb--empty" aria-hidden="true">
                                      {item.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                  <div className="catItem__body">
                                    <span className="catItem__name">{item.name}</span>
                                    {item.short_description && (
                                      <span className="catItem__desc">{item.short_description}</span>
                                    )}
                                  </div>
                                  <span className="catItem__price">
                                    {item.price_minor === null ? '—' : formatPrice(item.price_minor, item.currency_code)}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    onClick={() => handleToggleAvailability(item.id, item.is_available)}
                                  >
                                    {item.is_available ? 'Hide' : 'Show'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn--danger btn--sm"
                                    onClick={() => handleDeleteItem(item.id)}
                                  >
                                    Remove
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}

                          <form className="cat__addItem" onSubmit={(e) => handleAddItem(cat.id, e)}>
                            <input
                              className="input"
                              placeholder="Item name"
                              value={draft.name}
                              onChange={(e) => updateDraft(cat.id, { name: e.target.value })}
                              aria-label="Item name"
                            />
                            <input
                              className="input"
                              placeholder="Description"
                              value={draft.description}
                              onChange={(e) => updateDraft(cat.id, { description: e.target.value })}
                              aria-label="Item description"
                            />
                            <input
                              className="input input--price"
                              placeholder="12.95"
                              inputMode="decimal"
                              value={draft.price}
                              onChange={(e) => updateDraft(cat.id, { price: e.target.value })}
                              aria-label="Item price"
                            />
                            <input
                              className="input input--ingredients"
                              placeholder="Ingredients (comma separated)"
                              value={draft.ingredients}
                              onChange={(e) => updateDraft(cat.id, {
                                ingredients: e.target.value,
                                heroIngredient: '',
                              })}
                              aria-label="Item ingredients, comma separated"
                            />
                            {parseIngredients(draft.ingredients).length > 0 && (
                              <select
                                className="input input--select"
                                value={draft.heroIngredient}
                                onChange={(e) => updateDraft(cat.id, { heroIngredient: e.target.value })}
                                aria-label="Hero ingredient used for Ingredient Story backgrounds"
                                title="Ingredient Story backgrounds off this ingredient's photo"
                              >
                                <option value="">Hero ingredient: auto (first listed)</option>
                                {parseIngredients(draft.ingredients).map((ing) => (
                                  <option key={ing} value={ing}>Hero: {ing}</option>
                                ))}
                              </select>
                            )}
                            {draft.prepared ? (
                              <span className="fileBtn fileBtn--ready">
                                <span className="fileBtn__name">{draft.prepared.filename}</span>
                                <button
                                  type="button"
                                  className="fileBtn__clear"
                                  onClick={() => updateDraft(cat.id, { prepared: null, file: null })}
                                  aria-label="Remove the prepared photo"
                                  title="Remove the prepared photo"
                                >
                                  ×
                                </button>
                              </span>
                            ) : (
                              <label className="fileBtn">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                      setEditingPhoto({ file, categoryId: cat.id })
                                      e.target.value = ''
                                    }
                                  }}
                                />
                                {draft.file ? draft.file.name : 'Add photo'}
                              </label>
                            )}
                            <button type="submit" className="btn btn--primary" disabled={busy || !draft.name.trim()}>
                              Add item
                            </button>
                          </form>
                        </article>
                      )
                    })}
                  </div>
                ))}
              </>
            )}

            {step === 'preview' && (
              <div className="studio__preview">
                <div className="studio__templateBar">
                  {TEMPLATE_OPTIONS.map((t) => (
                    <button
                      type="button"
                      key={t.key}
                      className={'tplChip' + (template === t.key ? ' is-active' : '')}
                      onClick={() => handleTemplateChange(t.key)}
                      title={t.blurb}
                    >
                      {t.label}
                    </button>
                  ))}
                  <button type="button" className="btn btn--ghost btn--sm" onClick={handleRecommendation} disabled={busy}>
                    Suggest for me
                  </button>
                </div>

                <div className="studio__canvas" style={previewSnapshot ? paletteVars(previewSnapshot) : undefined}>
                  {previewSnapshot && itemCount > 0 ? (
                    <TemplateRenderer template={template} snapshot={previewSnapshot} />
                  ) : (
                    <p className="studio__empty">Add at least one item to see the preview.</p>
                  )}
                </div>

                <form className="studio__publishRow" onSubmit={handlePublish}>
                  <button type="submit" className="btn btn--primary btn--lg" disabled={busy || itemCount === 0}>
                    {busy ? 'Publishing…' : 'Publish menu'}
                  </button>
                  <span className="studio__hint">Publishing creates an immutable snapshot with a checksum.</span>
                </form>
              </div>
            )}
          </section>
        </div>
      )}

      {editingPhoto && (
        <MediaEditor
          file={editingPhoto.file}
          onCancel={() => setEditingPhoto(null)}
          onApply={(prepared) => {
            updateDraft(editingPhoto.categoryId, { prepared })
            setEditingPhoto(null)
          }}
        />
      )}

      {user && restaurant && step === 'publish' && publishResult && (
        <div className="publish">
          <div className="publish__card">
            <span className="publish__badge">Published</span>
            <h1 className="publish__title">{restaurant.name} is live</h1>
            <p className="publish__lede">
              Version {publishResult.versionNumber} · Template: {publishResult.template}
            </p>

            <dl className="publish__facts">
              <div>
                <dt>Public URL</dt>
                <dd>
                  <a href={publishResult.publishedUrl} target="_blank" rel="noreferrer">
                    {publishResult.publishedUrl}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Snapshot ID</dt>
                <dd><code>{publishResult.snapshotId}</code></dd>
              </div>
              <div>
                <dt>Checksum</dt>
                <dd><code>{publishResult.checksum.slice(0, 24)}…</code></dd>
              </div>
              <div>
                <dt>Published at</dt>
                <dd>{new Date(publishResult.publishedAt).toLocaleString()}</dd>
              </div>
            </dl>

            <div className="publish__qr">
              <QrBlock url={publishResult.qrCodeData} />
              <div>
                <h2 className="publish__qrTitle">Scan to open the menu</h2>
                <p className="publish__qrText">
                  This QR code points at the published snapshot. Future edits to your menu will not change it.
                </p>
                <code className="publish__qrUrl">{publishResult.qrCodeData}</code>
              </div>
            </div>

            <div className="publish__actions">
              <button type="button" className="btn btn--primary" onClick={() => setStep('menu')}>
                Back to studio
              </button>
              <a className="btn btn--secondary" href={publishResult.publishedUrl} target="_blank" rel="noreferrer">
                Open public menu
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ Palette token helper ============

function paletteTokens(key: PaletteKey): Record<string, string> {
  const map: Record<PaletteKey, Record<string, string>> = {
    'espresso-cream': {
      brandPrimary: '#2B211D', brandSecondary: '#594239', brandAccent: '#B77A45',
      pageBackground: '#F4EFE7', surface: '#FFFDF9', surfaceElevated: '#FFFFFF',
      textPrimary: '#2B211D', textSecondary: '#594239', textMuted: '#A99A8D', border: '#DED4C7', onPrimary: '#FFFDF9',
    },
    'tomato-parchment': {
      brandPrimary: '#B83A2E', brandSecondary: '#762B25', brandAccent: '#66704B',
      pageBackground: '#F5EBDD', surface: '#FFFAF1', surfaceElevated: '#FFFFFF',
      textPrimary: '#25231F', textSecondary: '#762B25', textMuted: '#8A8378', border: '#E2D5C0', onPrimary: '#FFFAF1',
    },
    'midnight-champagne': {
      brandPrimary: '#171B24', brandSecondary: '#343B49', brandAccent: '#D5BD91',
      pageBackground: '#F3EFE7', surface: '#FCFBF8', surfaceElevated: '#FFFFFF',
      textPrimary: '#171B24', textSecondary: '#343B49', textMuted: '#A6A9AE', border: '#DDD8CE', onPrimary: '#FCFBF8',
    },
    'pistachio-vanilla': {
      brandPrimary: '#526348', brandSecondary: '#4A382F', brandAccent: '#C98F83',
      pageBackground: '#F7F1E4', surface: '#FFFCF6', surfaceElevated: '#FFFFFF',
      textPrimary: '#3A4634', textSecondary: '#4A382F', textMuted: '#A9B59A', border: '#E0D8C6', onPrimary: '#FFFCF6',
    },
    'citrus-pop': {
      brandPrimary: '#F07835', brandSecondary: '#263B31', brandAccent: '#E66D62',
      pageBackground: '#FFF8EA', surface: '#FFFFFF', surfaceElevated: '#FFFFFF',
      textPrimary: '#263B31', textSecondary: '#4F7554', textMuted: '#9A9A90', border: '#F0E3CC', onPrimary: '#FFFFFF',
    },
    'ocean-glass': {
      brandPrimary: '#164A4A', brandSecondary: '#202A2A', brandAccent: '#B97855',
      pageBackground: '#EDE2D0', surface: '#FFF9F1', surfaceElevated: '#FFFFFF',
      textPrimary: '#202A2A', textSecondary: '#164A4A', textMuted: '#A9C8BE', border: '#DDD2BF', onPrimary: '#FFF9F1',
    },
    'black-bone': {
      brandPrimary: '#171717', brandSecondary: '#353535', brandAccent: '#A88A58',
      pageBackground: '#F1EEE7', surface: '#FCFBF8', surfaceElevated: '#FFFFFF',
      textPrimary: '#171717', textSecondary: '#353535', textMuted: '#A7A29A', border: '#DCD7CD', onPrimary: '#FCFBF8',
    },
    'berry-blush': {
      brandPrimary: '#6E304B', brandSecondary: '#442536', brandAccent: '#C98F83',
      pageBackground: '#F7EDE8', surface: '#FFF9F3', surfaceElevated: '#FFFFFF',
      textPrimary: '#442536', textSecondary: '#6E304B', textMuted: '#A98892', border: '#EBD9D4', onPrimary: '#FFF9F3',
    },
  }
  return map[key]
}

// ============ QR ============

/**
 * Renders a real, scannable QR code as inline SVG.
 * Uses the battle-tested `qrcode` package (MIT, no network calls, no paid API).
 */
function QrBlock({ url }: { url: string }) {
  const [svg, setSvg] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
      .then((result: string) => {
        if (!cancelled) setSvg(result)
      })
      .catch(() => {
        if (!cancelled) setError('Could not generate QR code')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (error) {
    return <div className="qr qr--error">{error}</div>
  }

  if (!svg) {
    return <div className="qr qr--loading" aria-hidden="true" />
  }

  return (
    <div className="qr" role="img" aria-label={'QR code linking to ' + url}>
      <div className="qr__svg" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}

// ============ Screens ============

function WelcomeScreen({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  return (
    <div className="welcome">
      <div className="welcome__inner">
        <span className="welcome__eyebrow">Free forever · No card required</span>
        <h1 className="welcome__title">Your menu, your brand, your link.</h1>
        <p className="welcome__lede">
          Build a beautiful digital menu for your restaurant, publish it with one click, and share it
          as a link or QR code. No credit card, no paid plan, ever.
        </p>
        <div className="welcome__actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={onSignup}>
            Create my menu
          </button>
          <button type="button" className="btn btn--secondary btn--lg" onClick={onLogin}>
            I already have an account
          </button>
        </div>
        <ul className="welcome__points">
          <li>5 designer templates</li>
          <li>8 curated brand palettes</li>
          <li>QR sharing built in</li>
        </ul>
      </div>
    </div>
  )
}

function AuthScreen(props: {
  mode: 'signup' | 'login'
  name: string
  email: string
  password: string
  busy: boolean
  onName: (v: string) => void
  onEmail: (v: string) => void
  onPassword: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onBack: () => void
}) {
  const isSignup = props.mode === 'signup'
  return (
    <div className="centered">
      <form className="card form" onSubmit={props.onSubmit}>
        <h1 className="form__title">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="form__lede">
          {isSignup
            ? 'Just a name and email. No card, no commitment.'
            : 'Enter the email you signed up with.'}
        </p>

        {isSignup && (
          <label className="field">
            <span className="field__label">Your name</span>
            <input
              className="input"
              type="text"
              required
              autoComplete="name"
              value={props.name}
              onChange={(e) => props.onName(e.target.value)}
            />
          </label>
        )}

        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="input"
            type="email"
            required
            autoComplete="email"
            value={props.email}
            onChange={(e) => props.onEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Password {isSignup ? '(optional)' : ''}</span>
          <input
            className="input"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={props.password}
            onChange={(e) => props.onPassword(e.target.value)}
          />
        </label>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={props.busy}>
          {props.busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
        </button>

        <button type="button" className="btn btn--ghost btn--block" onClick={props.onBack}>
          Back
        </button>
      </form>
    </div>
  )
}

function RestaurantScreen(props: {
  restName: string
  restSlug: string
  restDescription: string
  phone: string
  address: string
  currency: string
  timezone: string
  busy: boolean
  onRestName: (v: string) => void
  onRestSlug: (v: string) => void
  onRestDescription: (v: string) => void
  onPhone: (v: string) => void
  onAddress: (v: string) => void
  onCurrency: (v: string) => void
  onTimezone: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <div className="centered">
      <form className="card form form--wide" onSubmit={props.onSubmit}>
        <h1 className="form__title">Tell us about your restaurant</h1>
        <p className="form__lede">This becomes the header of your published menu.</p>

        <label className="field">
          <span className="field__label">Restaurant name</span>
          <input
            className="input"
            type="text"
            required
            value={props.restName}
            onChange={(e) => props.onRestName(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Share link (optional)</span>
          <input
            className="input"
            type="text"
            placeholder="my-restaurant"
            value={props.restSlug}
            onChange={(e) => props.onRestSlug(e.target.value)}
          />
          <span className="field__hint">Leave blank to generate one from the name.</span>
        </label>

        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="input"
            rows={3}
            value={props.restDescription}
            onChange={(e) => props.onRestDescription(e.target.value)}
          />
        </label>

        <div className="fieldRow">
          <label className="field">
            <span className="field__label">Currency</span>
            <select className="input" value={props.currency} onChange={(e) => props.onCurrency(e.target.value)}>
              <option value="EGP">EGP — Egyptian Pound</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — Pound Sterling</option>
            </select>
          </label>

          <label className="field">
            <span className="field__label">Timezone</span>
            <select className="input" value={props.timezone} onChange={(e) => props.onTimezone(e.target.value)}>
              <option value="Africa/Cairo">Africa/Cairo</option>
              <option value="UTC">UTC</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
            </select>
          </label>
        </div>

        <div className="fieldRow">
          <label className="field">
            <span className="field__label">Phone (optional)</span>
            <input className="input" type="tel" value={props.phone} onChange={(e) => props.onPhone(e.target.value)} />
          </label>

          <label className="field">
            <span className="field__label">Address (optional)</span>
            <input className="input" type="text" value={props.address} onChange={(e) => props.onAddress(e.target.value)} />
          </label>
        </div>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={props.busy}>
          {props.busy ? 'Creating…' : 'Continue to branding'}
        </button>
      </form>
    </div>
  )
}

function BrandScreen({
  palette,
  onSelect,
  onContinue,
}: {
  palette: PaletteKey
  onSelect: (key: PaletteKey) => void
  onContinue: () => void
}) {
  return (
    <div className="centered">
      <div className="card form form--wide">
        <h1 className="form__title">Pick your brand palette</h1>
        <p className="form__lede">Curated starting points from the UrOwnMenu design system. You can change this later.</p>

        <div className="paletteGrid">
          {PALETTE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.key}
              className={'paletteCard' + (palette === option.key ? ' is-active' : '')}
              onClick={() => onSelect(option.key)}
              aria-pressed={palette === option.key}
            >
              <span className="paletteCard__swatches" aria-hidden="true">
                {PALETTE_SWATCHES[option.key].map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </span>
              <span className="paletteCard__label">{option.label}</span>
              <span className="paletteCard__blurb">{option.blurb}</span>
            </button>
          ))}
        </div>

        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={onContinue}>
          Continue to menu builder
        </button>
      </div>
    </div>
  )
}
