// ============ 6. Café Pedestal ============

/**
 * A warm café landing built around the Drinko reference:
 *
 * - A plaster-sand hero pierced by the restaurant's name in huge white sans
 *   type, with the signature drink staged on a stone plinth breaking the line.
 * - A menu block with pill category tabs; the active category's items render
 *   as cream product cards (white photo inset on a cream body, price with a
 *   signature mark for featured items).
 * - A pastel promotion band at the bottom for the house hero, with its
 *   ingredient chips - never a fabricated discount line.
 */
function CafePedestal({ snapshot }: TemplateProps) {
  const categories = allCategories(snapshot)
  const items = allItems(snapshot)
  const featured = items.filter((i) => i.is_featured)
  const heroItem = featured[0] ?? items[0]
  const firstCat = categories[0]
  const [activeCategory, setActiveCategory] = React.useState(firstCat?.id ?? '')
  const [showAll, setShowAll] = React.useState(false)

  const activeCat = categories.find((c) => c.id === activeCategory) ?? firstCat
  const activeItems = activeCat?.items ?? []
  const visibleItems = showAll ? activeItems : activeItems.slice(0, 4)
  const heroWord = (firstCat?.name ?? 'menu').toUpperCase()

  return (
    <div className="tpl tpl-cafe">
      {/* ---------- Hero ---------- */}
      <header className="tpl-cafe__hero">
        <div className="tpl-cafe__topRow">
          <span className="tpl-cafe__wordmark">{snapshot.restaurant.name}</span>
          <span className="tpl-cafe__topMeta">
            {snapshot.restaurant.address_text ?? 'Menu'}
          </span>
        </div>

        <div className="tpl-cafe__heroRow">
          <span className="tpl-cafe__heroWord tpl-cafe__heroWord--left">ORDER</span>
          {heroItem?.photo_url && (
            <div className="tpl-cafe__pedestal">
              <span className="tpl-cafe__plinth" aria-hidden="true" />
              <img
                src={heroItem.photo_url}
                alt={heroItem.name}
                className={photoClass(heroItem, 'tpl-cafe__heroPhoto')}
                style={photoStyle(heroItem)}
                {...photoSize(heroItem)}
              />
            </div>
          )}
          <span className="tpl-cafe__heroWord tpl-cafe__heroWord--right">{heroWord}</span>
        </div>

        <p className="tpl-cafe__welcome">
          {snapshot.restaurant.description ?? 'Welcome'}
        </p>
        <a className="tpl-cafe__cta" href="#cafe-menu">
          See the menu
          <span aria-hidden="true"> ↓</span>
        </a>
      </header>

      {/* ---------- Menu ---------- */}
      <section id="cafe-menu" className="tpl-cafe__menu" aria-label="Menu">
        <div className="tpl-cafe__menuHead">
          <h2 className="tpl-cafe__menuTitle">
            Menu
            <span className="tpl-cafe__script">{(activeCat?.name ?? 'drinks').toLowerCase()}</span>
          </h2>
        </div>

        {categories.length > 0 && (
          <div className="tpl-cafe__pills" role="tablist" aria-label="Menu sections">
            {categories.map((cat) => {
              const selected = cat.id === activeCategory
              return (
                <button
                  type="button"
                  key={cat.id}
                  role="tab"
                  aria-selected={selected}
                  className={'tpl-cafe__pill' + (selected ? ' is-active' : '')}
                  onClick={() => { setActiveCategory(cat.id); setShowAll(false) }}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>
        )}

        <div className="tpl-cafe__grid">
          {visibleItems.map((item) => (
            <article key={item.id} className="tpl-cafe__card">
              <div className="tpl-cafe__cardMedia">
                {item.photo_url ? (
                  <img
                    src={item.photo_url}
                    alt={item.name}
                    className={photoClass(item, 'tpl-cafe__cardImg')}
                    loading="lazy"
                    {...photoSize(item)}
                  />
                ) : (
                  <span className="tpl-cafe__cardInitial" aria-hidden="true">
                    {item.name.charAt(0).toUpperCase()}
                  </span>
                )}
                {item.is_featured === 1 && <span className="tpl-cafe__badge">Signature</span>}
              </div>
              <div className="tpl-cafe__cardBody">
                <h3 className="tpl-cafe__cardName">{item.name}</h3>
                {item.short_description && (
                  <p className="tpl-cafe__cardDesc">{item.short_description}</p>
                )}
                <div className="tpl-cafe__cardFoot">
                  <span className="tpl-cafe__price">
                    {formatPrice(item.price_minor, item.currency_code)}
                  </span>
                  {item.dietary_labels && item.dietary_labels.length > 0 && (
                    <span className="tpl-cafe__cardTags">{item.dietary_labels[0]}</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {activeItems.length > 4 && (
          <div className="tpl-cafe__moreRow">
            <button type="button" className="tpl-cafe__more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show less' : 'More'}
            </button>
          </div>
        )}
      </section>

      {/* ---------- Promo band: patent-pink, featured drink, real data only ---------- */}
      {heroItem && (
        <section className="tpl-cafe__promo" aria-label="Signature">
          <div className="tpl-cafe__promoCopy">
            <span className="tpl-cafe__promoKicker">
              <em>house</em> signature
            </span>
            <h2 className="tpl-cafe__promoTitle">{heroItem.name}</h2>
            {heroItem.short_description && (
              <p className="tpl-cafe__promoDesc">{heroItem.short_description}</p>
            )}
            {heroItem.ingredients && heroItem.ingredients.length > 0 && (
              <ul className="tpl-cafe__promoChips">
                {heroItem.ingredients.slice(0, 4).map((ing) => (
                  <li key={ing}>{ing}</li>
                ))}
              </ul>
            )}
            <span className="tpl-cafe__promoPrice">
              {formatPrice(heroItem.price_minor, heroItem.currency_code)}
            </span>
          </div>
          <div className="tpl-cafe__promoMedia">
            {heroItem.photo_url && (
              <img
                src={heroItem.photo_url}
                alt={heroItem.name}
                className={photoClass(heroItem, 'tpl-cafe__promoPhoto')}
                loading="lazy"
                {...photoSize(heroItem)}
              />
            )}
          </div>
        </section>
      )}
    </div>
  )
}

// ============ 7. Mosaïque ============

/**
 * The AKME reference: a wall of square poster tiles in alternating warm
 * grounds - camel, maroon, deep red, cream - each carrying either the
 * restaurant's macro photography or a typographic plate with the dish
 * name, price and folio. Soft radial light sits behind every photo so
 * studio shots feel staged on seamless paper.
 */
function Mosaic({ snapshot }: TemplateProps) {
  const items = allItems(snapshot)
  const tiles = items.slice(0, 9)

  const grounds = ['camel', 'maroon', 'red', 'cream'] as const
  const rest = snapshot.restaurant

  return (
    <div className="tpl tpl-mosaic">
      <header className="tpl-mosaic__rail">
        <span className="tpl-mosaic__wordmark">{rest.name}</span>
        <span className="tpl-mosaic__railMeta">
          {rest.address_text ?? 'Menu'}
          {rest.phone ? ' · ' + rest.phone : ''}
        </span>
      </header>

      <div className="tpl-mosaic__grid" role="list">
        {tiles.map((item, idx) => {
          const ground = grounds[idx % grounds.length]
          const hasPhoto = Boolean(item.photo_url)
          const featured = item.is_featured === 1
          return (
            <article
              key={item.id}
              role="listitem"
              className={
                'tpl-mosaic__tile tpl-mosaic__tile--' + ground + (featured ? ' is-featured' : '')
              }
            >
              <span className="tpl-mosaic__tileWordmark">{rest.name}</span>
              {hasPhoto ? (
                <>
                  <div className="tpl-mosaic__tileGlow" aria-hidden="true" />
                  <img
                    src={item.photo_url ?? ''}
                    alt={item.name}
                    className={photoClass(item, 'tpl-mosaic__tilePhoto')}
                    loading="lazy"
                    {...photoSize(item)}
                  />
                  <div className="tpl-mosaic__tileBar">
                    <div className="tpl-mosaic__tileBarCopy">
                      <h2 className="tpl-mosaic__tileName">{item.name}</h2>
                      {item.short_description && (
                        <p className="tpl-mosaic__tileDesc">{item.short_description}</p>
                      )}
                    </div>
                    <span className="tpl-mosaic__tilePrice">
                      {formatPrice(item.price_minor, item.currency_code)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="tpl-mosaic__tileType">
                  <span className="tpl-mosaic__folio">N°{String(idx + 1).padStart(2, '0')}</span>
                  <h2 className="tpl-mosaic__tileTitle">{item.name}</h2>
                  {item.short_description && (
                    <p className="tpl-mosaic__tileBody">{item.short_description}</p>
                  )}
                  <span className="tpl-mosaic__tileFoot">
                    <span className="tpl-mosaic__folioPrice">
                      {formatPrice(item.price_minor, item.currency_code)}
                    </span>
                    {featured && <span className="tpl-mosaic__sig">Signature</span>}
                  </span>
                </div>
              )}
            </article>
          )
        })}
        {tiles.length === 0 && (
          <div className="tpl-mosaic__empty">Nothing on the board yet.</div>
        )}
      </div>

      {rest.address_text && (
        <footer className="tpl-mosaic__visit">
          <span className="tpl-label">Visit us</span>
          <p className="tpl-mosaic__visitLine">{rest.address_text}</p>
          {rest.phone && <a className="tpl-mosaic__visitPhone" href={'tel:' + rest.phone}>{rest.phone}</a>}
        </footer>
      )}
    </div>
  )
}

// ============ 8. Ingredient Story ============

/** Client-side copy of the resolver's slug function. */
function ingredientSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** The hero ingredient of an item: the owner's pick, else the first listed. */
function heroIngredientOf(item: MenuItem): { name: string; slug: string } | null {
  const candidate =
    (item.main_ingredient && item.main_ingredient.trim()) || item.ingredients?.[0] || ''
  if (!candidate) return null
  const slug = ingredientSlug(candidate)
  return slug ? { name: candidate, slug } : null
}

/**
 * The owner's idea, taken literally: every item is its own chapter, and the
 * chapter's background is a macro photograph of the item's hero ingredient,
 * resolved from Openverse / Wikimedia Commons at publish time. Layouts
 * alternate between a full-bleed cover and a split composition where the
 * product photo floats across the seam - the pistachio macaron reference -
 * with a gapless ink half and the ingredient name set across the divide.
 *
 * Dessert menus are the intended home, but any menu gets the treatment.
 */
function IngredientStory({ snapshot }: TemplateProps) {
  const categories = allCategories(snapshot)
  const entries = categories.flatMap((cat) =>
    cat.items.map((item) => ({ item, category: cat.name })),
  )

  if (entries.length === 0) {
    return (
      <div className="tpl tpl-story">
        <p className="tpl-story__empty">Nothing on the board yet.</p>
      </div>
    )
  }

  const photos = snapshot.ingredientPhotos ?? {}

  return (
    <div className="tpl tpl-story">
      <header className="tpl-story__masthead">
        <span className="tpl-eyebrow">The ingredient story</span>
        <h1 className="tpl-story__title">{snapshot.restaurant.name}</h1>
        {snapshot.restaurant.description && (
          <p className="tpl-story__lede">{snapshot.restaurant.description}</p>
        )}
        <span className="tpl-story__count">
          {entries.length} {entries.length === 1 ? 'chapter' : 'chapters'}
        </span>
      </header>

      {entries.map(({ item, category }, idx) => {
        const number = String(idx + 1).padStart(2, '0')
        const hero = heroIngredientOf(item)
        const heroPhoto = hero ? photos[hero.slug] : undefined
        const split = idx % 2 === 1
        const style = heroPhoto
          ? ({ ['--hero-img' as any]: `url("${heroPhoto.url}")` } as React.CSSProperties)
          : undefined

        const price = formatPrice(item.price_minor, item.currency_code)
        const chips = (item.ingredients ?? []).slice(0, 4)

        if (split) {
          return (
            <section
              key={item.id}
              className={
                'tpl-story__section tpl-story__section--split' + (heroPhoto ? ' has-hero' : '')
              }
              style={style}
              aria-label={item.name}
            >
              <div className="tpl-story__splitTop">
                {heroPhoto && <span className="tpl-story__splitName">{hero!.name}</span>}
                {!heroPhoto && (
                  <span className="tpl-story__splitFallback">{hero?.name ?? item.name}</span>
                )}
                <span className="tpl-story__folio">{number}</span>
              </div>

              {item.photo_url && (
                <div className="tpl-story__splitPhoto">
                  <img
                    src={item.photo_url}
                    alt={item.name}
                    className={photoClass(item)}
                    loading="lazy"
                    {...(photoSize(item) as any)}
                  />
                </div>
              )}

              <div className="tpl-story__splitBody">
                <span className="tpl-story__eyebrow">{category}</span>
                <h2 className="tpl-story__name">{item.name}</h2>
                {item.short_description && <p className="tpl-story__desc">{item.short_description}</p>}
                <div className="tpl-story__metaRow">
                  <span className="tpl-story__price">{price}</span>
                  {chips.length > 0 && (
                    <ul className="tpl-story__chips">
                      {chips.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          )
        }

        return (
          <section
            key={item.id}
            className={'tpl-story__section tpl-story__section--cover' + (heroPhoto ? ' has-hero' : '')}
            style={style}
            aria-label={item.name}
          >
            <span className="tpl-story__folio tpl-story__folio--cover">{number}</span>

            <div className="tpl-story__coverBody">
              <span className="tpl-story__eyebrow">{category}</span>
              <h2 className="tpl-story__coverName">{item.name}</h2>
              {item.short_description && <p className="tpl-story__desc">{item.short_description}</p>}
              <div className="tpl-story__metaRow">
                <span className="tpl-story__price">{price}</span>
                <span className="tpl-story__heroTag">
                  {hero ? 'Hero ingredient: ' + hero.name : 'House recipe'}
                </span>
              </div>
              {chips.length > 0 && (
                <ul className="tpl-story__chips">
                  {chips.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </div>

            {item.photo_url && (
              <div className="tpl-story__coverPhoto">
                <img
                  src={item.photo_url}
                  alt={item.name}
                  className={photoClass(item)}
                  loading="lazy"
                  {...photoSize(item)}
                />
              </div>
            )}

            {heroPhoto && (
              <span className="tpl-story__sideLabel" aria-hidden="true">
                {hero!.name}
              </span>
            )}
          </section>
        )
      })}

      <footer className="tpl-story__visit">
        <span className="tpl-eyebrow">Visit us</span>
        <p className="tpl-story__visitLine">
          {snapshot.restaurant.address_text ?? snapshot.restaurant.name}
        </p>
        {snapshot.restaurant.phone && (
          <a className="tpl-story__visitPhone" href={'tel:' + snapshot.restaurant.phone}>
            {snapshot.restaurant.phone}
          </a>
        )}
      </footer>
    </div>
  )
}

// ============ Dispatcher ============
