import * as React from 'react'
import { Blur } from '@animate-ui/react/primitives/effects/blur'
import { Magnetic } from '@animate-ui/react/primitives/effects/magnetic'

// The 3D set piece is code-split: it pulls in three.js only when a template
// that uses it is actually rendered, and only when WebGL is available.
const PlateScene = React.lazy(() => import('./three/PlateScene'))
import { MotionConfig, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'
import { Reveal, usePointerTilt } from './motion-primitives'
import { PlatedPoster } from './design/generated'
import { heroSplit, overlayClass, pickHero } from './design/art-director'
import type { PublishedSnapshot, MenuItem, TemplateKey } from './api'
import {
  depthPlanes,
  focalTransition,
  motionPresets,
  snapTransition,
  staggerContainer,
} from './motion'
import { TabIndicator } from './motion-parts'
import './templates.css'

export type TemplateProps = {
  snapshot: PublishedSnapshot
}

type Category = { id: string; name: string; items: MenuItem[] }

/** Items across all categories of the published menus. */
export function allItems(snapshot: PublishedSnapshot): MenuItem[] {
  const out: MenuItem[] = []
  for (const menu of snapshot.menus || []) {
    for (const cat of menu.categories || []) {
      for (const item of cat.items || []) out.push(item)
    }
  }
  return out
}

/** Categories across all published menus, flattened, with their items. */
export function allCategories(snapshot: PublishedSnapshot): Category[] {
  const out: Category[] = []
  for (const menu of snapshot.menus || []) {
    for (const cat of menu.categories || []) {
      out.push({ id: cat.id, name: cat.name, items: cat.items || [] })
    }
  }
  return out
}

function categoryOf(snapshot: PublishedSnapshot, itemId: string): string {
  for (const cat of allCategories(snapshot)) {
    if (cat.items.some((i) => i.id === itemId)) return cat.name
  }
  return ''
}

export function paletteVars(snapshot: PublishedSnapshot): Record<string, string> {
  const tokens = snapshot.brand?.theme_tokens || {}
  const vars: Record<string, string> = {}
  for (const key of Object.keys(tokens)) {
    vars['--' + key.replace(/([A-Z])/g, '-$1').toLowerCase()] = tokens[key]
  }

  /*
   * Typography. Brand profiles created before the house type system store
   * Georgia/system-ui; treat those as "not chosen" so the self-hosted
   * Fraunces + Instrument Sans stacks apply. A real choice always wins.
   */
  const typography = snapshot.brand?.typography || {}
  const legacy = new Set([
    'georgia, serif',
    'georgia,"times new roman",serif',
    'system-ui, sans-serif',
    'system-ui,-apple-system,"segoe ui",sans-serif',
  ])
  const isLegacy = (v?: string) =>
    !v ||
    legacy.has(
      v
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/"([^"]+)"/g, '$1')
        .replace(/'/g, ''),
    )
  const display = typography.display
  const body = typography.body
  if (display && !isLegacy(display)) vars['--tpl-display'] = display
  if (body && !isLegacy(body)) {
    vars['--tpl-body'] = body
  }
  return vars
}

/**
 * Inline style for an item photo.
 *
 * The aspect ratio prevents layout shift, and the measured focal point
 * drives `object-position` so a cover crop keeps the subject in frame. A
 * cutout carries transparency, so it must not be drawn on an opaque fill or
 * it ends up inside a visible white box, and it must never be cropped.
 */
function photoStyle(item: MenuItem): React.CSSProperties | undefined {
  const style: React.CSSProperties = { ...photoFrameStyle(item) }
  if (item.photo_width && item.photo_height && item.photo_height > 0) {
    style.aspectRatio = item.photo_width + ' / ' + item.photo_height
  }
  return Object.keys(style).length > 0 ? style : undefined
}

/**
 * Class for an item photo.
 *
 * A cutout carries transparency, so it must not be drawn on an opaque fill or
 * it ends up inside a visible white box, and it must never be cropped.
 */
function photoClass(item: MenuItem, extra?: string): string {
  const parts: string[] = []
  if (item.photo_is_cutout) parts.push('is-cutout')
  if (extra) parts.push(extra)
  return parts.join(' ')
}

/**
 * Generated plate study used when a slot has no photograph.
 *
 * A missing photo becomes deliberate artwork rather than a grey hole or a
 * lone initial: deterministic from the item's id, tinted by the restaurant's
 * palette, and drawn as SVG so it scales to any slot.
 */
function GeneratedPlate({
  item,
  className,
  tone = 'ink',
}: {
  item: MenuItem
  className?: string
  tone?: 'ink' | 'cream'
}) {
  return (
    <PlatedPoster
      seed={item.id || item.name}
      label={item.name}
      tone={tone}
      className={className}
    />
  )
}

/**
 * Intrinsic size for an image, so the page does not shift on load.
 *
 * The stored dimensions are already the normalised cutout frame, so a cutout
 * reports the square it was saved as; a photograph reports its cropped size.
 */
function photoSize(item: MenuItem): { width?: number; height?: number } {
  if (!item.photo_width || !item.photo_height) return {}
  return { width: item.photo_width, height: item.photo_height }
}

/**
 * Placement style shared by every template.
 *
 * `object-position` comes from the measured focal point, so a cover crop
 * keeps the subject in frame instead of centring blindly. A normalised
 * cutout always resolves to the centre because trimming already did the
 * framing work.
 */
function photoFrameStyle(item: MenuItem): React.CSSProperties {
  const meta = item.photo_meta ?? null
  if (!meta) return {}
  const position =
    meta.treatment === 'contain'
      ? '50% 50%'
      : `${Math.round(meta.focusX * 100)}% ${Math.round(meta.focusY * 100)}%`
  return { objectPosition: position }
}

function formatPrice(minor: number | null, currency: string): string {
  if (minor === null || minor === undefined) return ''
  const symbols: Record<string, string> = { EGP: 'E£', USD: '$', EUR: '€', GBP: '£' }
  const symbol = symbols[currency] || currency + ' '
  return symbol + (minor / 100).toFixed(2)
}

// ============ 1. Editorial Showcase ============

/**
 * "Purposeful hero, restaurant identity, concise statement, clear Explore
 * Menu action, signature items, categories/full menu and optional
 * story/gallery/location. Menu must be reachable immediately; no long
 * decorative intro." - docs/INSPIRATION.md section 4
 */
function EditorialShowcase({ snapshot }: TemplateProps) {
  const categories = allCategories(snapshot)
  const items = allItems(snapshot)
  const signature = items.filter((i) => i.is_featured)
  // Lead with the strongest photograph, not simply menu order.
  const hero = pickHero(signature.length > 0 ? signature : items)
  const split = heroSplit(hero)
  const [activeCategory, setActiveCategory] = React.useState(categories[0]?.id || '')

  return (
    <div className="tpl tpl-editorial">
      {/* --- Hero: type on ink, media beside it --- */}
      <header
        className="tpl-editorial__hero"
        style={
          {
            '--hero-text': split.text,
            '--hero-media': split.media,
          } as React.CSSProperties
        }
      >
        <motion.div
          className="tpl-editorial__heroCopy"
          variants={staggerContainer(0.08)}
          initial="hidden"
          animate="show"
        >
          <motion.p className="tpl-eyebrow" variants={motionPresets.rise}>
            {snapshot.restaurant.address_text || 'Signature menu'}
          </motion.p>
          <Blur initialBlur={16} delay={120}>
            <motion.h1 className="tpl-editorial__title" variants={motionPresets.rise}>
              {snapshot.restaurant.name}
            </motion.h1>
          </Blur>
          {snapshot.restaurant.description && (
            <motion.p className="tpl-editorial__tagline" variants={motionPresets.rise}>
              {snapshot.restaurant.description}
            </motion.p>
          )}
          <motion.div className="tpl-editorial__heroActions" variants={motionPresets.rise}>
            <Magnetic strength={0.4}>
              <a href="#tpl-menu" className="tpl-editorial__cta">
                Explore menu
                <motion.span aria-hidden="true" whileHover={{ y: 4 }} transition={snapTransition}>
                  ↓
                </motion.span>
              </a>
            </Magnetic>
          </motion.div>
        </motion.div>

        {hero && (
          <motion.div
            className={
              'tpl-editorial__heroMedia' + (hero.photo_url ? '' : ' is-generated')
            }
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 180, damping: 22, delay: 0.08 }}
          >
            <span className="tpl-editorial__heroGlow" aria-hidden="true" />
            {hero.photo_url ? (
              <img
                src={hero.photo_url}
                alt={hero.name}
                className={photoClass(hero, 'tpl-editorial__heroImage')}
                style={photoStyle(hero)}
                {...photoSize(hero)}
              />
            ) : (
              <GeneratedPlate
                item={hero}
                tone="cream"
                className="tpl-editorial__heroImage tpl-editorial__heroPlate"
              />
            )}
          </motion.div>
        )}
      </header>

      {/* --- Signature dishes --- */}
      {signature.length > 0 && (
        <section className="tpl-editorial__signature">
          <div className="tpl-sectionHead">
            <span className="tpl-sectionIndex">01</span>
            <h2 className="tpl-sectionTitle">Signature dishes</h2>
            <span className="tpl-sectionRule" aria-hidden="true" />
          </div>
          <motion.div
            className="tpl-editorial__signatureRow"
            variants={staggerContainer(0.09)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
          >
            {signature.slice(0, 3).map((item) => (
              <motion.article
                key={item.id}
                className="tpl-editorial__signatureItem tpl-sweep"
                variants={motionPresets.rise}
              >
                <div
                  className={
                    'tpl-editorial__signatureMedia' + (item.photo_url ? '' : ' is-generated')
                  }
                >
                  {item.photo_url ? (
                    <motion.img
                      src={item.photo_url}
                      alt={item.name}
                      className={photoClass(item)}
                      style={photoStyle(item)}
                      loading="lazy"
                      whileHover={{ scale: 1.05 }}
                      transition={snapTransition}
                      {...photoSize(item)}
                    />
                  ) : (
                    <GeneratedPlate item={item} className="tpl-editorial__signaturePlate" />
                  )}
                </div>
                <div className="tpl-editorial__signatureCopy">
                  <h3 className="tpl-editorial__signatureName">{item.name}</h3>
                  {item.short_description && (
                    <p className="tpl-editorial__signatureDesc">{item.short_description}</p>
                  )}
                  <span className="tpl-editorial__signaturePrice">
                    {formatPrice(item.price_minor, item.currency_code)}
                  </span>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </section>
      )}

      {/* --- Section rail (replaces the old orbital nav band) --- */}
      {categories.length > 0 && (
        <nav className="tpl-editorial__rail" aria-label="Menu sections">
          <span className="tpl-editorial__railLabel">Sections</span>
          <ul className="tpl-editorial__railList">
            {categories.map((cat, i) => (
              <li key={cat.id}>
                <a
                  href={'#cat-' + cat.id}
                  className={
                    'tpl-editorial__railLink' +
                    (cat.id === activeCategory ? ' is-active' : '')
                  }
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <span className="tpl-editorial__railIndex">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="tpl-editorial__railName">{cat.name}</span>
                  <span className="tpl-editorial__railCount">{cat.items.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* --- Full menu --- */}
      <section id="tpl-menu" className="tpl-editorial__menu">
        {categories.map((cat, idx) => (
          <motion.article
            key={cat.id}
            id={'cat-' + cat.id}
            className={'tpl-editorial__chapter' + (cat.id === activeCategory ? ' is-active' : '')}
            variants={staggerContainer(0.06)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
          >
            <motion.header className="tpl-editorial__chapterHead" variants={motionPresets.rise}>
              <span className="tpl-editorial__chapterIndex">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <motion.h2 className="tpl-editorial__chapterTitle" variants={motionPresets.rise}>
                {cat.name}
              </motion.h2>
              <span className="tpl-editorial__chapterCount">
                {cat.items.length} {cat.items.length === 1 ? 'item' : 'items'}
              </span>
            </motion.header>

            <ul className="tpl-editorial__items">
              {cat.items.map((item) => (
                <motion.li
                  key={item.id}
                  className={'tpl-editorial__item' + (item.is_available ? '' : ' is-hidden')}
                  variants={motionPresets.rise}
                  whileHover={{ x: 5 }}
                  transition={snapTransition}
                >
                  {item.photo_url && (
                    <div className="tpl-editorial__itemMedia">
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        className={photoClass(item)}
                        style={photoStyle(item)}
                        loading="lazy"
                        {...photoSize(item)}
                      />
                    </div>
                  )}
                  <div className="tpl-editorial__itemMain">
                    <div className="tpl-editorial__itemHead">
                      <span className="tpl-editorial__itemName">{item.name}</span>
                      <span className="tpl-editorial__itemRule" aria-hidden="true" />
                      <span className="tpl-editorial__itemPrice">
                        {formatPrice(item.price_minor, item.currency_code)}
                      </span>
                    </div>
                    {item.short_description && (
                      <p className="tpl-editorial__itemDesc">{item.short_description}</p>
                    )}
                  </div>
                </motion.li>
              ))}
            </ul>
          </motion.article>
        ))}
      </section>

      {/* --- Visit --- */}
      {(snapshot.restaurant.address_text || snapshot.restaurant.phone || snapshot.restaurant.email) && (
        <section className="tpl-editorial__visit">
          <div className="tpl-sectionHead">
            <span className="tpl-sectionIndex">{String(signature.length > 0 ? 2 : 1).padStart(2, '0')}</span>
            <h2 className="tpl-sectionTitle">Visit us</h2>
            <span className="tpl-sectionRule" aria-hidden="true" />
          </div>
          <div className="tpl-editorial__visitGrid">
            {snapshot.restaurant.address_text && (
              <div className="tpl-editorial__visitCell">
                <span className="tpl-label">Address</span>
                <span className="tpl-editorial__visitValue">{snapshot.restaurant.address_text}</span>
              </div>
            )}
            {snapshot.restaurant.phone && (
              <div className="tpl-editorial__visitCell">
                <span className="tpl-label">Phone</span>
                <a className="tpl-editorial__visitValue" href={'tel:' + snapshot.restaurant.phone}>
                  {snapshot.restaurant.phone}
                </a>
              </div>
            )}
            {snapshot.restaurant.email && (
              <div className="tpl-editorial__visitCell">
                <span className="tpl-label">Email</span>
                <a className="tpl-editorial__visitValue" href={'mailto:' + snapshot.restaurant.email}>
                  {snapshot.restaurant.email}
                </a>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

// ============ 2. Orbital Menu ============

type OrbitVariant = 'centered' | 'horizontal' | 'vertical'

/**
 * "A rotating wheel/orbit suited to round dishes... Active image moves to a
 * focal area. Implement Orbital Menu with horizontal, vertical and centered
 * variants. Use actual ellipse geometry." - docs/INSPIRATION.md section 2
 *
 * Motion model, after the "Orbiting items" pattern (animata.design, MIT):
 * the ring rotates continuously 360 degrees in a circle; each dish chip
 * counter-rotates at the same rate so the food stays upright while it travels
 * in the orbit. The animation is the orbit itself, not a crossfade.
 *
 * The centered variant is a true circle and orbits continuously (paused on
 * hover/focus, and under prefers-reduced-motion). The horizontal and vertical
 * variants are ellipses; there the dishes travel ALONG the ellipse arc when
 * the selection changes, animated with a spring, which is the same circular
 * motion scaled to an ellipse.
 *
 * All dish photography sits on the plate/cutout itself. No caption text is
 * rendered on or over a photo; the caption lives below the stage.
 */

/** Dish chip that orbits on the ellipse. Owns the spring-driven position. */
function ArcMarker({
  rotation,
  baseAngleDeg,
  rxPct,
  ryPct,
  item,
  index,
  selected,
  onSelect,
}: {
  rotation: ReturnType<typeof useSpring>
  baseAngleDeg: number
  rxPct: number
  ryPct: number
  item: MenuItem
  index: number
  selected: boolean
  onSelect: (index: number) => void
}) {
  const left = useTransform(rotation, (r: number) => {
    const a = ((baseAngleDeg + r) % 360) * (Math.PI / 180)
    return 50 + Math.cos(a) * rxPct + '%'
  })
  const top = useTransform(rotation, (r: number) => {
    const a = ((baseAngleDeg + r) % 360) * (Math.PI / 180)
    return 50 + Math.sin(a) * ryPct + '%'
  })

  return (
    <motion.button
      type="button"
      className={'tpl-orbital__chip' + (selected ? ' is-active' : '')}
      style={{ left, top }}
      onClick={() => onSelect(index)}
      aria-pressed={selected}
      aria-label={item.name}
    >
      {item.photo_url && (
        <span className="tpl-orbital__chipInner">
          <img
            className={photoClass(item, 'tpl-orbital__chipPhoto')}
            src={item.photo_url}
            alt=""
            aria-hidden="true"
            loading="lazy"
          />
        </span>
      )}
    </motion.button>
  )
}

function OrbitalMenu({ snapshot }: TemplateProps) {
  const items = React.useMemo(() => allItems(snapshot).slice(0, 10), [snapshot])
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [variant, setVariant] = React.useState<OrbitVariant>('centered')
  const dragStart = React.useRef<number | null>(null)

  const active = items[selectedIndex]

  // Only mount the WebGL set piece when the device can actually render it and
  // the user has not asked for reduced motion. Everyone else gets the
  // photograph or the generated plate, which is the accessibility fallback.
  const canUse3D = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    try {
      const canvas = document.createElement('canvas')
      return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
    } catch {
      return false
    }
  }, [])
  /*
   * Arc-jump rotation for the ellipse variants. Selecting a dish springs the
   * ring by the angular delta between the previous and new selection, so the
   * dishes travel along the ellipse instead of swapping in place.
   */
  const arcRotation = useMotionValue(0)
  const smoothArc = useSpring(arcRotation, { stiffness: 68, damping: 17, restDelta: 0.01 })
  const arcRef = React.useRef(0)

  const select = React.useCallback((index: number) => {
    if (!items.length) return
    const next = ((index % items.length) + items.length) % items.length
    const step = 360 / items.length
    // Shortest arc from current selection to the new one.
    let delta = (next - selectedIndex) * step
    delta = ((delta + 540) % 360) - 180
    arcRef.current += delta
    arcRotation.set(arcRef.current)
    setSelectedIndex(next)
  }, [items, selectedIndex, arcRotation])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select(selectedIndex + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select(selectedIndex - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIndex, select])

  const stepDeg = items.length ? 360 / items.length : 360

  return (
    <div className="tpl tpl-orbital">
      <header className="tpl-orbital__head">
        <div>
          <p className="tpl-eyebrow">Orbital menu</p>
          <h1 className="tpl-orbital__title">{snapshot.restaurant.name}</h1>
        </div>
        <div className="tpl-orbital__variants" role="group" aria-label="Orbit layout">
          {(['centered', 'horizontal', 'vertical'] as OrbitVariant[]).map((v) => (
            <button
              type="button"
              key={v}
              className={'tpl-orbital__variant' + (variant === v ? ' is-active' : '')}
              onClick={() => setVariant(v)}
              aria-pressed={variant === v}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <div className="tpl-orbital__layout">
        <div className="tpl-orbital__main">
          <div
            className={'tpl-orbital__stage tpl-orbital__stage--' + variant}
            onPointerDown={(e) => { dragStart.current = e.clientX }}
            onPointerUp={(e) => {
              if (dragStart.current === null) return
              const delta = e.clientX - dragStart.current
              dragStart.current = null
              if (Math.abs(delta) > 24) select(selectedIndex + (delta < 0 ? 1 : -1))
            }}
            onPointerCancel={() => { dragStart.current = null }}
            role="group"
            aria-label="Dish orbit. Click a dish, drag, or use the arrow keys."
          >
            {/* The orbit path the dishes travel on. */}
            <span className="tpl-orbital__ringPath" aria-hidden="true" />

            {variant === 'centered' ? (
              /*
               * Continuous orbit, straight from the animata "Orbiting items"
               * pattern: the ring turns 360 degrees forever, each chip
               * counter-rotates so the dish stays upright, and the whole
               * thing pauses on hover/focus. Transforms only, so the browser
               * keeps it on the compositor.
               */
              <div className="tpl-orbital__orbitSpin">
                {items.map((item, idx) => {
                  const a = (idx / items.length) * Math.PI * 2 - Math.PI / 2
                  const pos = {
                    left: 50 + Math.cos(a) * 42 + '%',
                    top: 50 + Math.sin(a) * 42 + '%',
                  }
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={'tpl-orbital__chip' + (idx === selectedIndex ? ' is-active' : '')}
                      style={pos}
                      onClick={() => setSelectedIndex(idx)}
                      aria-pressed={idx === selectedIndex}
                      aria-label={item.name}
                    >
                      {item.photo_url && (
                        <span className="tpl-orbital__chipCounter">
                          <img
                            className={photoClass(item, 'tpl-orbital__chipPhoto')}
                            src={item.photo_url}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                          />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              /*
               * Ellipse variants: the dishes ride the ellipse itself and
               * spring along it when the selection changes.
               */
              items.map((item, idx) => {
                const rxPct = variant === 'horizontal' ? 38 : 30
                const ryPct = variant === 'horizontal' ? 30 : 38
                return (
                  <ArcMarker
                    key={item.id}
                    rotation={smoothArc}
                    baseAngleDeg={idx * stepDeg - 90}
                    rxPct={rxPct}
                    ryPct={ryPct}
                    item={item}
                    index={idx}
                    selected={idx === selectedIndex}
                    onSelect={select}
                  />
                )
              })
            )}

            {/* The focal dish: photography only, never text. */}
            {active && (
              <div className="tpl-orbital__focal">
                {canUse3D ? (
                  <React.Suspense
                    fallback={
                      active.photo_url ? (
                        <motion.img
                          key={active.id}
                          src={active.photo_url}
                          alt={active.name}
                          className={photoClass(active, 'tpl-orbital__focalPhoto')}
                          style={photoStyle(active)}
                          {...photoSize(active)}
                        />
                      ) : (
                        <GeneratedPlate item={active} className="tpl-orbital__focalPlate" />
                      )
                    }
                  >
                    <PlateScene
                      key={active.id}
                      textureUrl={active.photo_url ?? undefined}
                      tint="var(--tpl-accent)"
                      className="tpl-orbital__focal3d"
                    />
                  </React.Suspense>
                ) : active.photo_url ? (
                  <motion.img
                    key={active.id}
                    src={active.photo_url}
                    alt={active.name}
                    className={photoClass(active, 'tpl-orbital__focalPhoto')}
                    style={photoStyle(active)}
                    initial={{ opacity: 0, scale: 0.92, rotate: -4 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 210, damping: 22 }}
                    {...photoSize(active)}
                  />
                ) : (
                  <motion.div
                    key={active.id}
                    className="tpl-orbital__focalArt"
                    initial={{ opacity: 0, scale: 0.92, rotate: -4 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 210, damping: 22 }}
                  >
                    <GeneratedPlate item={active} className="tpl-orbital__focalPlate" />
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* The caption lives below the photography, never on it. */}
          <div className="tpl-orbital__caption">
            {active && (
              <>
                <span className="tpl-orbital__focalCategory">{categoryOf(snapshot, active.id)}</span>
                <h2 className="tpl-orbital__focalTitle">{active.name}</h2>
                <span className="tpl-orbital__focalPrice">
                  {formatPrice(active.price_minor, active.currency_code)}
                </span>
                {active.short_description && (
                  <p className="tpl-orbital__focalDesc">{active.short_description}</p>
                )}
              </>
            )}
          </div>
        </div>

        <aside className="tpl-orbital__list">
          <span className="tpl-label">All dishes</span>
          <ul>
            {items.map((item, idx) => (
              <li key={item.id}>
                <motion.button
                  type="button"
                  className={'tpl-orbital__listItem' + (idx === selectedIndex ? ' is-active' : '')}
                  onClick={() => select(idx)}
                  whileHover={{ x: 6 }}
                  transition={snapTransition}
                >
                  <span className="tpl-orbital__listNum">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="tpl-orbital__listName">{item.name}</span>
                  <span className="tpl-orbital__listPrice">
                    {formatPrice(item.price_minor, item.currency_code)}
                  </span>
                </motion.button>
              </li>
            ))}
          </ul>
          <p className="tpl-orbital__hint">Click, drag or use the arrow keys.</p>
        </aside>
      </div>
    </div>
  )
}

// ============ 3. Ingredient Universe ============

/**
 * "Central glass remains hero; owner-confirmed ingredient cutouts occupy
 * stable front/middle/back planes with deliberate scale, perspective,
 * coherent lighting, contact shadows, labels and connector lines.
 * Rotation/drag changes composition coherently. No random floating PNGs and
 * never infer ingredients from pixels." - docs/INSPIRATION.md section 3
 */
function IngredientUniverse({ snapshot }: TemplateProps) {
  const items = allItems(snapshot)
  const [activeId, setActiveId] = React.useState(items[0]?.id || '')
  const [highlight, setHighlight] = React.useState<string | null>(null)
  const [rotation, setRotation] = React.useState(0)
  const dragStart = React.useRef<number | null>(null)
  // Cursor-reactive pitch: a couple of degrees of rotateX so the stage
  // feels physical, on top of the drag rotation on the same node.
  const { bind: tiltBind, rotateX } = usePointerTilt(3.5)

  const active = items.find((i) => i.id === activeId) || items[0]

  // Ingredients come from the owner's own data only. Never inferred.
  const ingredients = React.useMemo(() => {
    if (!active) return [] as string[]
    const own = active.ingredients || []
    if (own.length > 0) return own.slice(0, 3)
    return [active.name]
  }, [active])

  return (
    <div className="tpl tpl-ingredient">
      <header className="tpl-ingredient__head">
        <p className="tpl-eyebrow">Ingredient universe</p>
        <h1 className="tpl-ingredient__title">{snapshot.restaurant.name}</h1>
        {snapshot.restaurant.description && (
          <p className="tpl-ingredient__sub">{snapshot.restaurant.description}</p>
        )}
      </header>

      {items.length > 1 && (
        <nav className="tpl-ingredient__switcher" aria-label="Choose a dish">
          {items.map((item) => (
            <motion.button
              type="button"
              key={item.id}
              className={'tpl-ingredient__switchBtn' + (item.id === active?.id ? ' is-active' : '')}
              onClick={() => { setActiveId(item.id); setHighlight(null) }}
              whileTap={{ scale: 0.96 }}
              transition={snapTransition}
              aria-pressed={item.id === active?.id}
            >
              {item.name}
            </motion.button>
          ))}
        </nav>
      )}

      <div className="tpl-ingredient__scene" {...tiltBind}>
        <motion.div
          className="tpl-ingredient__stage"
          animate={{ rotateY: rotation }}
          style={{ rotateX, transformPerspective: 1100 }}
          transition={focalTransition}
          onPointerDown={(e) => { dragStart.current = e.clientX }}
          onPointerUp={(e) => {
            if (dragStart.current === null) return
            const delta = e.clientX - dragStart.current
            dragStart.current = null
            if (Math.abs(delta) > 16) setRotation((r) => r + (delta < 0 ? 16 : -16))
          }}
          role="group"
          aria-label="Ingredient composition. Drag to rotate."
        >
          <svg className="tpl-ingredient__wires" viewBox="0 0 800 520" aria-hidden="true" focusable="false">
            {ingredients.map((ingredient, idx) => {
              const targetX = idx === 0 ? 190 : idx === 1 ? 210 : 620
              const targetY = idx === 0 ? 190 : idx === 1 ? 356 : 220
              const isHot = highlight === ingredient
              return (
                <motion.line
                  key={ingredient}
                  x1="400"
                  y1="260"
                  x2={targetX}
                  y2={targetY}
                  stroke="currentColor"
                  strokeWidth={isHot ? 1.6 : 1}
                  initial={false}
                  animate={{ opacity: isHot ? 0.9 : 0.3 }}
                  transition={snapTransition}
                />
              )
            })}
          </svg>

          {/* The hero stays the hero. */}
          {active && (
            <motion.div
              className="tpl-ingredient__hero"
              key={active.id}
              initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              transition={focalTransition}
            >
              <span className="tpl-ingredient__glow" aria-hidden="true" />
              {active.photo_url ? (
                <img
                  src={active.photo_url}
                  alt={active.name}
                  className={photoClass(active, 'tpl-ingredient__heroPhoto')}
                  style={photoStyle(active)}
                  {...photoSize(active)}
                />
              ) : (
                <span className="tpl-ingredient__heroInitial">
                  {active.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="tpl-ingredient__heroShadow" aria-hidden="true" />
            </motion.div>
          )}

          {/* Ingredient planes at deliberate depths. */}
          {ingredients.map((ingredient, idx) => {
            const plane = depthPlanes[idx % depthPlanes.length]
            const isHot = highlight === ingredient
            return (
              <motion.button
                type="button"
                key={ingredient}
                className={
                  'tpl-ingredient__plane tpl-ingredient__plane--' + plane.key +
                  (isHot ? ' is-highlighted' : '')
                }
                initial={{ opacity: 0, y: 26 }}
                animate={{
                  opacity: isHot ? 1 : plane.opacity,
                  y: 0,
                  scale: isHot ? plane.scale * 1.12 : plane.scale,
                  z: plane.z,
                }}
                transition={{ ...focalTransition, delay: idx * 0.07 }}
                onClick={() => setHighlight(isHot ? null : ingredient)}
                aria-pressed={isHot}
              >
                <span className="tpl-ingredient__planeLabel">{ingredient}</span>
              </motion.button>
            )
          })}
        </motion.div>
      </div>

      <motion.div
        className="tpl-ingredient__meta"
        key={active?.id}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={focalTransition}
      >
        {active && (
          <>
            <span className="tpl-label">{categoryOf(snapshot, active.id)}</span>
            <h2 className="tpl-ingredient__metaTitle">{active.name}</h2>
            <p className="tpl-ingredient__metaPrice">
              {formatPrice(active.price_minor, active.currency_code)}
            </p>
            {active.short_description && <p>{active.short_description}</p>}
            {active.ingredients && active.ingredients.length > 0 && (
              <ul className="tpl-ingredient__metaList">
                {active.ingredients.map((ing) => (
                  <li
                    key={ing}
                    className={highlight === ing ? 'is-highlighted' : ''}
                    onClick={() => setHighlight(highlight === ing ? null : ing)}
                  >
                    {ing}
                  </li>
                ))}
              </ul>
            )}
            {active.allergens && active.allergens.length > 0 && (
              <p className="tpl-ingredient__allergens">Contains: {active.allergens.join(', ')}</p>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}

// ============ 4. Endless Table ============

/**
 * "Native vertical scroll through editorial item sections with alternating
 * image/text alignment, variable scale and category chapters. Active category
 * indicator; compact scan/list mode. Never hijack scroll."
 * - docs/INSPIRATION.md section 5
 */
function EndlessTable({ snapshot }: TemplateProps) {
  const categories = allCategories(snapshot)
  const [activeCategory, setActiveCategory] = React.useState(categories[0]?.id || '')
  const [compact, setCompact] = React.useState(false)

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) {
          const categoryId = (visible.target as HTMLElement).dataset.categoryId
          if (categoryId) setActiveCategory(categoryId)
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.6] },
    )
    const nodes = document.querySelectorAll('.tpl-endless__chapter')
    nodes.forEach((n) => observer.observe(n))
    return () => observer.disconnect()
  }, [snapshot])

  // A running index so the image/text alternation continues across chapters.
  let rowIndex = 0

  return (
    <div className="tpl tpl-endless">
      <nav className="tpl-endless__jump" aria-label="Menu sections">
        <ul>
          {categories.map((cat, idx) => (
            <li key={cat.id} className={cat.id === activeCategory ? 'is-active' : ''}>
              <a href={'#chapter-' + cat.id}>
                <span className="tpl-endless__jumpNum">{String(idx + 1).padStart(2, '0')}</span>
                {cat.name}
              </a>
            </li>
          ))}
        </ul>
        <motion.button
          type="button"
          className="tpl-endless__mode"
          onClick={() => setCompact((c) => !c)}
          whileTap={{ scale: 0.96 }}
          transition={snapTransition}
          aria-pressed={compact}
        >
          {compact ? 'Editorial view' : 'Compact list'}
        </motion.button>
      </nav>

      {categories.map((cat, catIdx) => (
        <section
          key={cat.id}
          id={'chapter-' + cat.id}
          data-category-id={cat.id}
          className={'tpl-endless__chapter' + (compact ? ' is-compact' : '')}
        >
          <motion.header
            className="tpl-endless__chapterHead"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={focalTransition}
          >
            <span className="tpl-endless__chapterNum">{String(catIdx + 1).padStart(2, '0')}</span>
            <h2 className="tpl-endless__chapterTitle">{cat.name}</h2>
            <span className="tpl-endless__chapterRule" aria-hidden="true" />
          </motion.header>

          <div className="tpl-endless__rows">
            {cat.items.map((item) => {
              const flip = rowIndex % 2 === 1
              rowIndex += 1
              const featured = item.is_featured === 1
              return (
                <motion.article
                  key={item.id}
                  className={
                    'tpl-endless__row' +
                    (flip ? ' tpl-endless__row--flip' : '') +
                    (featured ? ' tpl-endless__row--featured' : '')
                  }
                  initial={{ opacity: 0, y: 34 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={focalTransition}
                >
                  <div className={'tpl-endless__media' + (item.photo_url ? '' : ' is-generated')}>
                    {item.photo_url ? (
                      <motion.img
                        src={item.photo_url}
                        alt={item.name}
                        className={photoClass(item)}
                        style={photoStyle(item)}
                        loading="lazy"
                        whileHover={{ scale: 1.035 }}
                        transition={snapTransition}
                        {...photoSize(item)}
                      />
                    ) : (
                      <GeneratedPlate item={item} className="tpl-endless__plate" />
                    )}
                  </div>
                  <div className="tpl-endless__body">
                    {featured && <span className="tpl-label tpl-label--accent">Signature</span>}
                    <h3 className="tpl-endless__name">{item.name}</h3>
                    {item.short_description && (
                      <p className="tpl-endless__desc">{item.short_description}</p>
                    )}
                    <div className="tpl-endless__meta">
                      <span className="tpl-endless__price">
                        {formatPrice(item.price_minor, item.currency_code)}
                      </span>
                      {item.dietary_labels && item.dietary_labels.length > 0 && (
                        <span className="tpl-endless__tags">{item.dietary_labels.join(' · ')}</span>
                      )}
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

// ============ 5. Menu Magazine ============

/**
 * A magazine spread with two pages, each carrying its own content, and a real
 * page fold.
 *
 * "Items showcased like models in a magazine with folding/page-turn animation.
 * Editorial spreads, page numbers, category tabs, page transitions and item
 * details. Start with a robust 2D slide/hinge/fold illusion; no realistic
 * page-curl dependency. Text must never mirror or become unreadable. Mobile
 * uses swipe/vertical spreads and accessible list fallback."
 * - docs/INSPIRATION.md section 6
 *
 * The fold is a two-half construction. The right page hinges on the centre
 * gutter and sweeps edge-on (90 degrees), exactly like turning a magazine
 * page; the left page fades to reveal the revealed spread underneath. The
 * shading gradient rides the turning page so it reads as curving.
 */
function MenuMagazine({ snapshot }: TemplateProps) {
  const categories = allCategories(snapshot)
  const [page, setPage] = React.useState(0)
  const [listMode, setListMode] = React.useState(false)
  const [turning, setTurning] = React.useState<null | { from: number; to: number }>(null)
  const touchStart = React.useRef<number | null>(null)

  const totalPages = categories.length
  const current = categories[page]

  // The spread revealed underneath while the current one folds away.
  const revealIndex = turning ? turning.to : page
  const revealCat = categories[revealIndex]

  const turnTo = React.useCallback(
    (target: number) => {
      if (target < 0 || target >= totalPages || target === page) return
      setTurning({ from: page, to: target })
    },
    [page, totalPages],
  )

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') turnTo(page + 1)
      if (e.key === 'ArrowLeft') turnTo(page - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, turnTo])

  const forward = turning ? turning.to > turning.from : true

  return (
    <div className="tpl tpl-magazine">
      <header className="tpl-magazine__masthead">
        <div className="tpl-magazine__mastheadLeft">
          <span className="tpl-label">Issue 01</span>
          <h1 className="tpl-magazine__title">{snapshot.restaurant.name}</h1>
        </div>
        <span className="tpl-label">{snapshot.restaurant.address_text || 'Menu'}</span>
      </header>

      <nav className="tpl-magazine__tabs" aria-label="Categories">
        {categories.map((cat, idx) => (
          <motion.button
            type="button"
            key={cat.id}
            data-tab-id={cat.id}
            className={'tpl-magazine__tab' + (idx === page ? ' is-active' : '')}
            onClick={() => turnTo(idx)}
            whileTap={{ scale: 0.97 }}
            transition={snapTransition}
            aria-current={idx === page ? 'page' : undefined}
          >
            <span className="tpl-magazine__tabNum">{String(idx + 1).padStart(2, '0')}</span>
            {cat.name}
          </motion.button>
        ))}
        <button
          type="button"
          className="tpl-magazine__tab tpl-magazine__tab--list"
          onClick={() => setListMode((v) => !v)}
          aria-pressed={listMode}
        >
          {listMode ? 'Spread' : 'List'}
        </button>
        <TabIndicator activeId={current?.id || ''} scope=".tpl-magazine__tabs" />
      </nav>

      {listMode ? (
        // Accessible list fallback: every item, as plain readable text.
        <div className="tpl-magazine__list">
          {categories.map((cat) => (
            <section key={cat.id} className="tpl-magazine__listSection">
              <h2 className="tpl-magazine__listTitle">{cat.name}</h2>
              <ul>
                {cat.items.map((item) => (
                  <li key={item.id}>
                    <span className="tpl-magazine__listName">{item.name}</span>
                    {item.short_description && (
                      <span className="tpl-magazine__listDesc">{item.short_description}</span>
                    )}
                    <span className="tpl-magazine__listPrice">
                      {formatPrice(item.price_minor, item.currency_code)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div
          className="tpl-magazine__viewport"
          onTouchStart={(e) => { touchStart.current = e.touches[0].clientX }}
          onTouchEnd={(e) => {
            if (touchStart.current === null) return
            const delta = e.changedTouches[0].clientX - touchStart.current
            touchStart.current = null
            if (Math.abs(delta) > 30) turnTo(page + (delta < 0 ? 1 : -1))
          }}
        >
          <div className="tpl-magazine__stage">
            {/*
              The spread being revealed. It sits underneath and becomes
              visible as the current pages fold away.
            */}
            <div className="tpl-magazine__spread tpl-magazine__spread--base">
              {revealCat && (
                <SpreadPages
                  category={revealCat}
                  pageIndex={revealIndex}
                  total={totalPages}
                  snapshot={snapshot}
                />
              )}
            </div>

            {/*
              The current spread. The RIGHT page hinges on the centre gutter
              and sweeps over to the left, exactly like a magazine. It stops
              at 90 degrees, where it is edge-on and invisible, so the
              revealed spread can take over. Stopping there is also what
              stops the text from ever appearing mirrored.
            */}
            {turning && (
              <div className="tpl-magazine__turner">
                <motion.div
                  className="tpl-magazine__half tpl-magazine__half--left"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.22, delay: 0.2, ease: 'easeIn' }}
                >
                  {categories[turning.from] && (
                    <SpreadPages
                      category={categories[turning.from]}
                      pageIndex={turning.from}
                      total={totalPages}
                      snapshot={snapshot}
                      halfOnly="left"
                    />
                  )}
                </motion.div>

                <motion.div
                  className="tpl-magazine__half tpl-magazine__half--right"
                  initial={{ rotateY: 0 }}
                  animate={{ rotateY: forward ? -90 : 90 }}
                  transition={{ duration: 0.52, ease: [0.42, 0, 0.25, 1] }}
                  style={{ transformOrigin: 'left center' }}
                  onAnimationComplete={() => {
                    setPage(turning.to)
                    setTurning(null)
                  }}
                >
                  {categories[turning.from] && (
                    <SpreadPages
                      category={categories[turning.from]}
                      pageIndex={turning.from}
                      total={totalPages}
                      snapshot={snapshot}
                      halfOnly="right"
                    />
                  )}
                </motion.div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="tpl-magazine__controls">
        <motion.button
          type="button"
          onClick={() => turnTo(page - 1)}
          disabled={page === 0}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.94, y: 1 }}
          transition={snapTransition}
          aria-label="Previous page"
        >
          ←
        </motion.button>
        <span className="tpl-magazine__counter">
          {page + 1} / {Math.max(totalPages, 1)}
        </span>
        <motion.button
          type="button"
          onClick={() => turnTo(page + 1)}
          disabled={page >= totalPages - 1}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.94, y: 1 }}
          transition={snapTransition}
          aria-label="Next page"
        >
          →
        </motion.button>
      </div>
    </div>
  )
}

/**
 * One magazine spread: a left page carrying the feature and a right page
 * carrying the numbered index. Each page has its own content, which is what
 * makes the spread read like a magazine rather than a grid.
 *
 * `halfOnly` renders a single half, which is what the page turn needs: the
 * two halves hinge independently at the gutter.
 */
function SpreadPages({
  category,
  pageIndex,
  total,
  snapshot,
  halfOnly,
}: {
  category: Category
  pageIndex: number
  total: number
  snapshot: PublishedSnapshot
  halfOnly?: 'left' | 'right'
}) {
  const items = category.items
  // The lead item gets the left page as the feature; the right-hand page
  // carries the complete numbered index, so it is never an empty page.
  const lead = items.find((i) => i.is_featured) || items[0]

  const leftPage = (
    <section className="tpl-magazine__page tpl-magazine__page--left">
      <div className="tpl-magazine__pageHead">
        <span className="tpl-magazine__folio">{pageIndex + 1}</span>
        <span className="tpl-magazine__folioTotal">of {total}</span>
      </div>

      <h2 className="tpl-magazine__featureTitle">{category.name}</h2>
      {snapshot.restaurant.description && (
        <p className="tpl-magazine__featureLede">{snapshot.restaurant.description}</p>
      )}

      {lead && (
        <figure className={'tpl-magazine__feature' + (lead.photo_url ? '' : ' is-generated')}>
          {lead.photo_url ? (
            <img
              src={lead.photo_url}
              alt={lead.name}
              className={photoClass(lead, 'tpl-magazine__featureImage')}
              style={photoStyle(lead)}
              {...photoSize(lead)}
            />
          ) : (
            <GeneratedPlate item={lead} className="tpl-magazine__featurePlate" />
          )}
          <figcaption className="tpl-magazine__caption">
            <h3 className="tpl-magazine__itemName">{lead.name}</h3>
            {lead.short_description && (
              <p className="tpl-magazine__itemDesc">{lead.short_description}</p>
            )}
            <span className="tpl-magazine__itemPrice">
              {formatPrice(lead.price_minor, lead.currency_code)}
            </span>
          </figcaption>
        </figure>
      )}
    </section>
  )

  const rightPage = (
    <section className="tpl-magazine__page tpl-magazine__page--right">
      <div className="tpl-magazine__pageHead">
        <span className="tpl-label">On this page</span>
        <span className="tpl-magazine__folio">{String(pageIndex + 1).padStart(2, '0')}</span>
      </div>

      <ul className="tpl-magazine__index">
        {items.map((item, idx) => (
          <li key={item.id} className="tpl-magazine__indexRow">
            {item.photo_url && (
              <img
                src={item.photo_url}
                alt=""
                aria-hidden="true"
                className={photoClass(item, 'tpl-magazine__indexImage')}
                style={photoStyle(item)}
                loading="lazy"
                {...photoSize(item)}
              />
            )}
            <span className="tpl-magazine__indexNum">{String(idx + 1).padStart(2, '0')}</span>
            <div className="tpl-magazine__indexBody">
              <span className="tpl-magazine__indexName">{item.name}</span>
              {item.short_description && (
                <span className="tpl-magazine__indexDesc">{item.short_description}</span>
              )}
            </div>
            <span className="tpl-magazine__indexPrice">
              {formatPrice(item.price_minor, item.currency_code)}
            </span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="tpl-magazine__indexEmpty">Nothing in this section yet.</li>
        )}
      </ul>

      <footer className="tpl-magazine__pageFoot">
        <span className="tpl-magazine__pageFootMark">
          {String(pageIndex + 1).padStart(2, '0')} · {category.name}
        </span>
        {snapshot.restaurant.address_text && (
          <span className="tpl-magazine__pageFootNote">{snapshot.restaurant.address_text}</span>
        )}
      </footer>
    </section>
  )

  if (halfOnly === 'left') return <>{leftPage}</>
  if (halfOnly === 'right') return <>{rightPage}</>

  return (
    <div className="tpl-magazine__spreadInner">
      {leftPage}
      {rightPage}
      {/* The spine. */}
      <span className="tpl-magazine__gutter" aria-hidden="true" />
    </div>
  )
}

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
          {heroItem && (
            <figure
              className={
                'tpl-cafe__heroMedia' + (heroItem.photo_is_cutout ? ' is-cutout' : '')
              }
            >
              {heroItem.photo_is_cutout && (
                <>
                  <span className="tpl-cafe__steam tpl-cafe__steam--a" aria-hidden="true" />
                  <span className="tpl-cafe__steam tpl-cafe__steam--b" aria-hidden="true" />
                </>
              )}
              {heroItem.photo_url ? (
                <img
                  src={heroItem.photo_url}
                  alt={heroItem.name}
                  className={photoClass(heroItem, 'tpl-cafe__heroPhoto')}
                  style={photoStyle(heroItem)}
                  {...photoSize(heroItem)}
                />
              ) : (
                <GeneratedPlate
                  item={heroItem}
                  className="tpl-cafe__heroPhoto tpl-cafe__heroPlate"
                />
              )}
            </figure>
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
              <div
                className={
                  'tpl-cafe__cardMedia' + (item.photo_url ? '' : ' is-generated')
                }
              >
                {item.photo_url ? (
                  <img
                    src={item.photo_url}
                    alt={item.name}
                    className={photoClass(item, 'tpl-cafe__cardImg')}
                    style={photoStyle(item)}
                    loading="lazy"
                    {...photoSize(item)}
                  />
                ) : (
                  <GeneratedPlate item={item} className="tpl-cafe__cardPlate" />
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

      {/* ---------- Promo band ---------- */}
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
          <div className={'tpl-cafe__promoMedia' + (heroItem.photo_url ? '' : ' is-generated')}>
            {heroItem.photo_url ? (
              <img
                src={heroItem.photo_url}
                alt={heroItem.name}
                className={photoClass(heroItem, 'tpl-cafe__promoPhoto')}
                style={photoStyle(heroItem)}
                loading="lazy"
                {...photoSize(heroItem)}
              />
            ) : (
              <GeneratedPlate item={heroItem} className="tpl-cafe__promoPlate" />
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
              style={{ ['--i' as string]: idx } as React.CSSProperties}
              className={
                'tpl-mosaic__tile tpl-mosaic__tile--' + ground +
                ' ' + overlayClass(item, 'tile') +
                (featured ? ' is-featured' : '')
              }
            >
              {hasPhoto ? (
                <>
                  {item.photo_is_cutout && (
                    <div className="tpl-mosaic__tileGlow" aria-hidden="true" />
                  )}
                  <img
                    src={item.photo_url ?? ''}
                    alt={item.name}
                    className={photoClass(item, 'tpl-mosaic__tilePhoto')}
                    style={photoStyle(item)}
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
                  <GeneratedPlate
                    item={item}
                    tone={ground === 'maroon' || ground === 'red' ? 'cream' : 'ink'}
                    className="tpl-mosaic__tilePoster"
                  />
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

      <footer className="tpl-mosaic__visit">
        <span className="tpl-label">Visit us</span>
        <p className="tpl-mosaic__visitLine">
          {rest.address_text ?? rest.description ?? rest.name}
        </p>
        {rest.phone && <a className="tpl-mosaic__visitPhone" href={'tel:' + rest.phone}>{rest.phone}</a>}
      </footer>
    </div>
  )
}

// ============ 8. Ingredient Story ============

/** Client-side copy of the resolver's slug function. Keep in sync. */
function ingredientSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
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

type StoryHero = { name: string; slug: string } | null

type ChapterProps = {
  item: MenuItem
  category: string
  number: string
  hero: StoryHero
  heroPhoto?: { url: string }
}

/** Chapter-shared bits. */
function StoryMetaRow({ item, hero }: { item: MenuItem; hero: StoryHero }) {
  const price = formatPrice(item.price_minor, item.currency_code)
  const chips = (item.ingredients ?? []).slice(0, 4)
  return (
    <>
      <div className="tpl-story__metaRow">
        <span className="tpl-story__price">{price}</span>
        {hero && <span className="tpl-story__heroTag">Hero ingredient: {hero.name}</span>}
      </div>
      {chips.length > 0 && (
        <ul className="tpl-story__chips">
          {chips.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
    </>
  )
}

/**
 * Full-bleed chapter: macro hero photography drifts behind a darkened
 * gradient, the copy sets big and high-contrast, the dish photo floats
 * opposite. useScroll scrubs the backdrop at its own rate, so the page
 * feels layered instead of flat.
 */
function StoryCover({ item, category, number, hero, heroPhoto }: ChapterProps) {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const bgY = useSpring(useTransform(scrollYProgress, [0, 1], ['-9%', '9%']), {
    stiffness: 110,
    damping: 24,
    mass: 0.7,
  })
  const photoY = useSpring(useTransform(scrollYProgress, [0, 1], ['7%', '-7%']), {
    stiffness: 110,
    damping: 24,
    mass: 0.7,
  })

  return (
    <section
      ref={ref}
      className={'tpl-story__section tpl-story__section--cover' + (heroPhoto ? ' has-hero' : '')}
      aria-label={item.name}
    >
      {heroPhoto && (
        <motion.span
          className="tpl-story__coverBg"
          style={{ backgroundImage: 'url("' + heroPhoto.url + '")', y: bgY }}
          aria-hidden="true"
        />
      )}
      <span className="tpl-story__folio tpl-story__folio--cover" aria-hidden="true">
        {number}
      </span>

      <div className="tpl-story__coverBody">
        <Reveal y={26}>
          <span className="tpl-story__eyebrow">{category}</span>
          <h2 className="tpl-story__coverName">{item.name}</h2>
        </Reveal>
        {item.short_description && (
          <p className="tpl-story__desc">{item.short_description}</p>
        )}
        <StoryMetaRow item={item} hero={hero} />
      </div>

      {item.photo_url && (
        <div className="tpl-story__coverPhoto">
          {reduced ? (
            <img
              src={item.photo_url}
              alt={item.name}
              className={photoClass(item)}
              loading="lazy"
              {...photoSize(item)}
            />
          ) : (
            <motion.img
              src={item.photo_url}
              alt={item.name}
              style={{ y: photoY }}
              className={photoClass(item)}
              loading="lazy"
              {...photoSize(item)}
            />
          )}
        </div>
      )}

      {heroPhoto && (
        <span className="tpl-story__sideLabel" aria-hidden="true">
          {hero!.name}
        </span>
      )}
    </section>
  )
}

/**
 * Split chapter: the macro plate above, ink below, the dish photo floating
 * across the seam - the pistachio macaron reference.
 */
function StorySplit({ item, category, number, hero, heroPhoto }: ChapterProps) {
  const ref = React.useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const bgY = useSpring(useTransform(scrollYProgress, [0, 1], ['-7%', '7%']), {
    stiffness: 110,
    damping: 24,
    mass: 0.7,
  })

  return (
    <section
      ref={ref}
      className={
        'tpl-story__section tpl-story__section--split' + (heroPhoto ? ' has-hero' : '')
      }
      aria-label={item.name}
    >
      <div className="tpl-story__splitTop">
        {heroPhoto && (
          <motion.span
            className="tpl-story__splitBg"
            style={{ backgroundImage: 'url("' + heroPhoto.url + '")', y: bgY }}
            aria-hidden="true"
          />
        )}
        {heroPhoto ? (
          <span className="tpl-story__splitName">{hero!.name}</span>
        ) : (
          <span className="tpl-story__splitFallback">{hero?.name ?? item.name}</span>
        )}
        <span className="tpl-story__folio" aria-hidden="true">{number}</span>
      </div>

      {item.photo_url && (
        <div className="tpl-story__splitPhoto">
          <img
            src={item.photo_url}
            alt={item.name}
            className={photoClass(item)}
            loading="lazy"
            {...photoSize(item)}
          />
        </div>
      )}

      <div className="tpl-story__splitBody">
        <Reveal y={26}>
          <span className="tpl-story__eyebrow">{category}</span>
          <h2 className="tpl-story__name">{item.name}</h2>
        </Reveal>
        {item.short_description && <p className="tpl-story__desc">{item.short_description}</p>}
        <StoryMetaRow item={item} hero={hero} />
      </div>
    </section>
  )
}

/**
 * The owner's idea, taken literally: every item is its own chapter, and the
 * chapter's background is a macro photograph of the item's hero ingredient,
 * resolved from Openverse / Wikimedia Commons at publish time. Layouts
 * alternate between a full-bleed cover and a split composition where the
 * product photo floats across the seam - the pistachio macaron reference -
 * with an ink half carrying the copy and the ingredient name set across
 * the divide.
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
        return idx % 2 === 1 ? (
          <StorySplit
            key={item.id}
            item={item}
            category={category}
            number={number}
            hero={hero}
            heroPhoto={heroPhoto}
          />
        ) : (
          <StoryCover
            key={item.id}
            item={item}
            category={category}
            number={number}
            hero={hero}
            heroPhoto={heroPhoto}
          />
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

export function TemplateRenderer({ template, snapshot }: {
  template: TemplateKey
  snapshot: PublishedSnapshot
}) {
  return (
    <MotionConfig reducedMotion="user">
      {template === 'orbital-menu' && <OrbitalMenu snapshot={snapshot} />}
      {template === 'ingredient-universe' && <IngredientUniverse snapshot={snapshot} />}
      {template === 'endless-table' && <EndlessTable snapshot={snapshot} />}
      {template === 'magazine' && <MenuMagazine snapshot={snapshot} />}
      {template === 'editorial-showcase' && <EditorialShowcase snapshot={snapshot} />}
      {template === 'ingredient-story' && <IngredientStory snapshot={snapshot} />}
      {template === 'cafe' && <CafePedestal snapshot={snapshot} />}
      {template === 'mosaic' && <Mosaic snapshot={snapshot} />}
    </MotionConfig>
  )
}
