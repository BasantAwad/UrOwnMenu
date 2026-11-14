import * as React from 'react'

// The 3D set piece is code-split: it pulls in three.js only when a template
// that uses it is actually rendered, and only when WebGL is available.
import { MotionConfig, motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'
import { Reveal, usePointerTilt } from './motion-primitives'
import { PlatedPoster, hashString } from './design/generated'
import { Art, IcedCoffee, LavaCake, OrangeJuice, RoundDishes, type Dish } from './design/dishes'
import { overlayClass } from './design/art-director'
import type { PublishedSnapshot, MenuItem, TemplateKey } from './api'
import {
  focalTransition,
  snapTransition,
} from './motion'
import { TabIndicator } from './motion-parts'
import './templates.css'
import './story.css'
import './lazy-susan.css'
import './apothecary.css'
import './cover-story.css'

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

// ============ 1. Cover Story (editorial-showcase) ============

/**
 * Cover Story: the restaurant's name is the masthead, set at full ink; the
 * hero dish is lifted in front of it, overlapping the letters, then the menu
 * opens like the inside pages of a magazine: each course a section, each item
 * a line with a dotted leader to its price.
 */
function EditorialShowcase({ snapshot }: TemplateProps) {
  const courses = React.useMemo(
    () => allCategories(snapshot).filter((c) => c.items.length > 0),
    [snapshot],
  )
  const everything = React.useMemo(() => allItems(snapshot), [snapshot])
  const cover = everything.find((i) => i.is_featured) ?? everything.find((i) => i.photo_url) ?? everything[0]
  const standfirst = snapshot.restaurant.description

  return (
    <div className="tpl tpl-editorial cover">
      <section className="cover__hero" aria-label="Cover">
        {standfirst ? <p className="cover__standfirst">{standfirst}</p> : <span />}
        <h1 className="cover__mast">{snapshot.restaurant.name}</h1>
        {cover ? (
          <figure className="cover__dish">
            {cover.photo_url ? (
              <img
                className={photoClass(cover, 'cover__photo')}
                src={cover.photo_url}
                alt={cover.name}
                style={photoFrameStyle(cover)}
              />
            ) : (
              <GeneratedPlate item={cover} className="cover__photo" />
            )}
          </figure>
        ) : null}
        {cover ? (
          <p className="cover__caption">
            <span className="cover__capName">{cover.name}</span>
            {cover.price_minor !== null ? (
              <span className="cover__capPrice">{formatPrice(cover.price_minor, cover.currency_code)}</span>
            ) : null}
          </p>
        ) : null}
      </section>

      <main className="cover__menu">
        {courses.map((course) => (
          <section key={course.id} className="cover__course" aria-labelledby={`course-${course.id}`}>
            <h2 id={`course-${course.id}`} className="cover__courseName">
              {course.name}
            </h2>
            <ul className="cover__items">
              {course.items.map((item) => {
                const desc = item.short_description || item.long_description
                return (
                  <li key={item.id} className="cover__item">
                    <div className="cover__line">
                      <span className="cover__itemName">{item.name}</span>
                      <span className="cover__leader" aria-hidden="true" />
                      {item.price_minor !== null ? (
                        <span className="cover__itemPrice">{formatPrice(item.price_minor, item.currency_code)}</span>
                      ) : null}
                    </div>
                    {desc ? <p className="cover__itemDesc">{desc}</p> : null}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </main>
    </div>
  )
}

// ============ 2. Orbital Menu ============

/**
 * Lazy Susan: the shared table's turntable, seen from the side. The dishes
 * stand on a lacquered disc in perspective. Drag the table, use the arrow
 * keys, pick a dish, or choose a category; the table turns the short way and
 * settles with an ease-out. Depth is real: the dish nearest the diner is the
 * largest and sharpest, the far side is smaller, dimmer and softly out of
 * focus. Colours come from the owner's palette tokens, so every palette works.
 */
const SPIN_RAD_PER_PX = 0.008
const SPIN_MS = 560

function OrbitalMenu({ snapshot }: TemplateProps) {
  const items = React.useMemo(() => allItems(snapshot).slice(0, 12), [snapshot])
  const categories = React.useMemo(
    () => allCategories(snapshot).filter((c) => c.items.length > 0),
    [snapshot],
  )
  const n = items.length
  const step = n > 0 ? (Math.PI * 2) / n : 0

  const [angle, setAngle] = React.useState(0)
  const angleRef = React.useRef(0)
  const frame = React.useRef(0)
  const drag = React.useRef<{ x: number; a: number; moved: boolean } | null>(null)
  const suppressClick = React.useRef(false)

  const reduced = React.useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const apply = React.useCallback((a: number) => {
    angleRef.current = a
    setAngle(a)
  }, [])

  const cancelSpin = () => {
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = 0
  }

  // Which dish is at the front: the one whose angle is closest to zero.
  const frontIndex = (a: number) => (n > 0 ? ((Math.round(-a / step) % n) + n) % n : 0)
  const front = frontIndex(angle)

  const spinTo = React.useCallback(
    (target: number) => {
      cancelSpin()
      if (reduced) {
        apply(target)
        return
      }
      const from = angleRef.current
      const t0 = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / SPIN_MS)
        const eased = 1 - Math.pow(1 - t, 3)
        apply(from + (target - from) * eased)
        frame.current = t < 1 ? requestAnimationFrame(tick) : 0
      }
      frame.current = requestAnimationFrame(tick)
    },
    [apply, reduced],
  )

  /** Turn the table the short way so dish `index` reaches the front. */
  const select = React.useCallback(
    (index: number) => {
      if (n === 0) return
      const cur = angleRef.current
      let delta = -index * step - cur
      delta -= Math.PI * 2 * Math.round(delta / (Math.PI * 2))
      spinTo(cur + delta)
    },
    [n, step, spinTo],
  )

  React.useEffect(() => () => cancelSpin(), [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    cancelSpin()
    drag.current = { x: e.clientX, a: angleRef.current, moved: false }
    suppressClick.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (Math.abs(dx) > 4) {
      d.moved = true
      suppressClick.current = true
    }
    apply(d.a + dx * SPIN_RAD_PER_PX)
  }
  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    select(frontIndex(angleRef.current))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      select((front + 1) % n)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      select((front - 1 + n) % n)
    } else if (e.key === 'Home') {
      e.preventDefault()
      select(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      select(n - 1)
    }
  }

  if (n === 0) {
    return (
      <div className="tpl tpl-orbital lazy">
        <p className="lazy__empty">No dishes on the table yet. Add a dish to start turning the table.</p>
      </div>
    )
  }

  const active = items[front]
  const activeCategory = categories.find((c) => c.id === active.category_id)
  const firstIndexOf = (categoryId: string) => items.findIndex((i) => i.category_id === categoryId)

  return (
    <div className="tpl tpl-orbital lazy">
      <header className="lazy__head">
        <h1 className="lazy__venue">{snapshot.restaurant.name}</h1>
        {categories.length > 1 ? (
          <nav className="lazy__cats" aria-label="Categories">
            {categories.map((c) => {
              const idx = firstIndexOf(c.id)
              const current = active.category_id === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  className="lazy__cat"
                  aria-pressed={current}
                  disabled={idx < 0}
                  onClick={() => idx >= 0 && select(idx)}
                >
                  {c.name}
                </button>
              )
            })}
          </nav>
        ) : null}
      </header>

      <div className="lazy__body">
        <div
          className="lazy__stage"
          role="group"
          tabIndex={0}
          aria-roledescription="rotating menu"
          aria-label="Dishes on the table. Drag the table, or use the arrow keys."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          <div className="lazy__glow" aria-hidden="true" />
          <div className="lazy__disc" aria-hidden="true" />
          {items.map((item, i) => {
            const th = i * step + angle
            const s = Math.sin(th)
            const c = Math.cos(th)
            const d = (1 + c) / 2
            const style: React.CSSProperties = {
              left: `${50 + 36 * s}%`,
              top: `${60 + 19 * c}%`,
              width: `${18 + 11 * d}%`,
              zIndex: Math.round(d * 100),
              opacity: 0.42 + 0.58 * d,
              filter: d < 0.5 ? `blur(${((0.5 - d) * 2.2).toFixed(2)}px)` : undefined,
            }
            const isFront = i === front
            return (
              <button
                key={item.id}
                type="button"
                className={
                  'lazy__dish' +
                  (isFront ? ' is-front' : '') +
                  (item.photo_is_cutout || !item.photo_url ? ' is-cutout' : ' is-medallion')
                }
                style={style}
                aria-label={item.name}
                aria-current={isFront ? 'true' : undefined}
                tabIndex={-1}
                onClick={() => {
                  if (suppressClick.current) return
                  select(i)
                }}
              >
                {item.photo_url ? (
                  <img
                    className={photoClass(item, 'lazy__photo')}
                    src={item.photo_url}
                    alt=""
                    aria-hidden="true"
                    loading={isFront ? 'eager' : 'lazy'}
                    style={photoFrameStyle(item)}
                  />
                ) : (
                  <GeneratedPlate item={item} className="lazy__photo" />
                )}
              </button>
            )
          })}
        </div>

        <article className="lazy__copy" aria-live="polite">
          {activeCategory ? <p className="lazy__kicker">{activeCategory.name}</p> : null}
          <h2 className="lazy__name">{active.name}</h2>
          {active.price_minor !== null ? (
            <p className="lazy__price">{formatPrice(active.price_minor, active.currency_code)}</p>
          ) : null}
          {active.short_description || active.long_description ? (
            <p className="lazy__desc">{active.short_description || active.long_description}</p>
          ) : null}
          {n > 1 ? (
            <div className="lazy__controls">
              <button
                type="button"
                className="lazy__btn"
                onClick={() => select((front - 1 + n) % n)}
              >
                Previous dish
              </button>
              <button type="button" className="lazy__btn" onClick={() => select((front + 1) % n)}>
                Next dish
              </button>
            </div>
          ) : null}
        </article>
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
/**
 * Apothecary Cabinet: the menu is a wooden cabinet of shelves. Each category is
 * one shelf; each dish is a jar on it, labelled with the dish name. Tapping a
 * jar lifts it off the shelf and opens its drawer below: the price, the
 * description, and the ingredients the owner listed, each as a specimen card.
 * Ingredients come only from the owner's list; nothing is inferred.
 */
function IngredientUniverse({ snapshot }: TemplateProps) {
  const shelves = React.useMemo(
    () => allCategories(snapshot).filter((c) => c.items.length > 0),
    [snapshot],
  )
  const flat = React.useMemo(() => shelves.flatMap((s) => s.items), [shelves])
  const [activeId, setActiveId] = React.useState<string>(flat[0]?.id ?? '')
  const active = flat.find((i) => i.id === activeId) ?? flat[0]
  const specimens = (active?.ingredients ?? []).slice(0, 6)

  if (flat.length === 0) {
    return (
      <div className="tpl tpl-ingredient apo">
        <p className="apo__empty">No jars on the shelves yet. Add a dish to fill the cabinet.</p>
      </div>
    )
  }

  return (
    <div className="tpl tpl-ingredient apo">
      <header className="apo__head">
        <h1 className="apo__title">{snapshot.restaurant.name}</h1>
        {snapshot.restaurant.description ? (
          <p className="apo__lede">{snapshot.restaurant.description}</p>
        ) : null}
      </header>

      <div className="apo__cabinet">
        {shelves.map((shelf) => (
          <section key={shelf.id} className="apo__shelf" aria-label={shelf.name}>
            <h2 className="apo__shelfName">{shelf.name}</h2>
            <ul className="apo__row" role="list">
              {shelf.items.map((item) => {
                const on = item.id === active?.id
                return (
                  <li key={item.id} className="apo__slot">
                    <button
                      type="button"
                      className={'apo__jar' + (on ? ' is-lifted' : '')}
                      aria-pressed={on}
                      onClick={() => setActiveId(item.id)}
                    >
                      <span className="apo__glass" aria-hidden="true">
                        {item.photo_url ? (
                          <img
                            className={photoClass(item, 'apo__photo')}
                            src={item.photo_url}
                            alt=""
                            loading="lazy"
                            style={photoFrameStyle(item)}
                          />
                        ) : (
                          <GeneratedPlate item={item} className="apo__photo" />
                        )}
                      </span>
                      <span className="apo__label">{item.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      {active ? (
        <article className="apo__drawer" aria-live="polite">
          <div className="apo__drawerHead">
            <h3 className="apo__name">{active.name}</h3>
            {active.price_minor !== null ? (
              <p className="apo__price">{formatPrice(active.price_minor, active.currency_code)}</p>
            ) : null}
          </div>
          {active.short_description || active.long_description ? (
            <p className="apo__desc">{active.short_description || active.long_description}</p>
          ) : null}
          {specimens.length > 0 ? (
            <ul className="apo__specimens" aria-label="Ingredients">
              {specimens.map((s) => (
                <li key={s} className="apo__card">
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ) : null}
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
  total: number
  hero: StoryHero
  heroPhoto?: { url: string }
  flip: boolean
  fitVw: number
}

/**
 * Procedural stand-in for a macro photograph that could not be resolved.
 * Deterministic per ingredient: the same word always gets the same hue, so a
 * menu never reshuffles between visits, and the chapter keeps its depth
 * (colour field + bokeh + grain) instead of collapsing to flat ink.
 */
function proceduralMacro(seed: string): React.CSSProperties {
  const h = hashString(seed || 'x')
  // Food-aware hue: a tomato chapter must not glow blue. Known ingredients
  // map to their natural colour; anything else lands in the warm/earth
  // range (amber to olive) so a random hash can never produce an alien tone.
  const key = seed.toLowerCase()
  const named: Array<[RegExp, number, number]> = [
    [/(tomato|chili|chilli|pepper|strawberr|cherry|beet|pomegran)/, 6, 62],
    [/(raspberr|berry|hibiscus|rose|plum|fig)/, 340, 48],
    [/(cocoa|chocolate|cacao|coffee|cold-brew|espresso|mocha|cinnamon|date)/, 22, 52],
    [/(orange|carrot|mango|apricot|peach|saffron|turmeric|honey|caramel)/, 30, 78],
    [/(vanilla|cream|milk|butter|cheese|mozzarella|egg|cardamom|almond|oat)/, 42, 44],
    [/(lemon|banana|pineapple|corn|lime-zest)/, 52, 70],
    [/(basil|mint|zucchini|cucumber|spinach|pistachio|matcha|olive|avocado|lime|herb|pesto|pea)/, 112, 46],
    [/(blueberr|grape|lavender|eggplant|aubergine)/, 262, 40],
    [/(ice|coconut|yoghurt|yogurt|sugar|salt|flour)/, 205, 18],
  ]
  const match = named.find(([re]) => re.test(key))
  const warm = [8, 18, 28, 38, 48, 96, 112][h % 7]
  const hue = match ? match[1] : warm
  const sat = match ? match[2] : 48
  const hue2 = (hue + 14 + ((h >> 4) % 20)) % 360
  const x1 = 56 + (h % 30)
  const y1 = 18 + ((h >> 3) % 30)
  const x2 = 14 + ((h >> 6) % 30)
  const y2 = 64 + ((h >> 9) % 26)
  return {
    backgroundImage: [
      `radial-gradient(38% 46% at ${x1}% ${y1}%, hsl(${hue} ${sat + 12}% 34% / .85), transparent 72%)`,
      `radial-gradient(34% 42% at ${x2}% ${y2}%, hsl(${hue2} ${sat}% 24% / .8), transparent 70%)`,
      `radial-gradient(90% 70% at 50% 120%, hsl(${hue} ${Math.round(sat * 0.7)}% 10%), transparent 70%)`,
      `linear-gradient(160deg, hsl(${hue} ${Math.round(sat * 0.6)}% 9%), hsl(${hue2} ${Math.round(sat * 0.7)}% 14%))`,
    ].join(','),
  }
}

/** Illustrated plate used when an item has no photograph at all. */
function pickIllustration(name: string): Dish | null {
  const n = name.toLowerCase()
  if (/(coffee|latte|espresso|frapp|brew|mocha|cappuc|iced)/.test(n)) return IcedCoffee
  if (/(juice|orange|lemonade|smoothie)/.test(n)) return OrangeJuice
  if (/(lava|cake|brownie|chocolate|fondant)/.test(n)) return LavaCake
  if (/(pizza|margherita)/.test(n)) return RoundDishes.pizza
  if (/(donut|doughnut)/.test(n)) return RoundDishes.donut
  if (/(tart|pie|cheesecake)/.test(n)) return RoundDishes.tart
  if (/(pancake|waffle|crepe)/.test(n)) return RoundDishes.pancakes
  if (/(burger|sandwich)/.test(n)) return RoundDishes.burger
  return null
}

/**
 * The dish itself, in the right treatment for what we actually have:
 *  - cutout      : floats, lit from above, with a contact shadow and a
 *                  faint reflection, never boxed or cropped;
 *  - photograph  : set in an arch window with its own shadow and an offset
 *                  hairline, so a rectangle reads as a deliberate frame;
 *  - nothing     : a drawn plate, so the slot is never a hole.
 */
function StoryDish({ item }: { item: MenuItem }) {
  const art = !item.photo_url ? pickIllustration(item.name) : null
  const isCutout = Boolean(item.photo_url && item.photo_is_cutout)
  const ratio =
    item.photo_width && item.photo_height ? item.photo_width / item.photo_height : art ? art.w / art.h : 1

  if (item.photo_url && !isCutout) {
    return (
      <div className="story-dish story-dish--photo">
        <div className="story-arch" style={{ aspectRatio: '4 / 5' }}>
          <img
            src={item.photo_url}
            alt={item.name}
            loading="lazy"
            style={photoFrameStyle(item)}
            {...photoSize(item)}
          />
        </div>
        <span className="story-arch__line" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div
      className={'story-dish story-dish--cutout' + (ratio > 1.05 ? ' is-wide' : '')}
      style={{ ['--ratio' as string]: String(ratio) }}
    >
      {!art && <span className="story-dish__shadow" aria-hidden="true" />}
      {isCutout ? (
        <img
          className="story-dish__img"
          src={item.photo_url as string}
          alt={item.name}
          loading="lazy"
          {...photoSize(item)}
        />
      ) : art ? (
        <Art dish={art} className="story-dish__img is-art" />
      ) : (
        <GeneratedPlate item={item} className="story-dish__img is-plate" tone="cream" />
      )}
    </div>
  )
}

/**
 * One chapter. Six layers, back to front, each moving at its own rate:
 * macro photograph -> grain + vignette -> giant ingredient word -> light
 * bloom -> dish -> copy. The depth comes from that stacking and from the
 * light: the bloom sits behind the dish, the shadow under it, and nothing
 * else on the page is lit.
 */
function StoryChapter({ item, category, number, total, hero, heroPhoto, flip, fitVw }: ChapterProps) {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const spring = { stiffness: 110, damping: 24, mass: 0.7 }
  const bgY = useSpring(useTransform(scrollYProgress, [0, 1], ['-7%', '7%']), spring)
  const bgScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.16, 1.08, 1.16])
  const dishY = useSpring(useTransform(scrollYProgress, [0, 1], ['5%', '-5%']), spring)
  const wordX = useSpring(useTransform(scrollYProgress, [0, 1], flip ? ['-2.5%', '2.5%'] : ['2.5%', '-2.5%']), spring)
  const bloomY = useSpring(useTransform(scrollYProgress, [0, 1], ['-8%', '8%']), spring)
  const tilt = usePointerTilt(3.5)

  const word = (hero?.name ?? item.name).toUpperCase()
  const words = word.split(/\s+/).filter(Boolean)
  const price = formatPrice(item.price_minor, item.currency_code)
  const chips = (item.ingredients ?? []).slice(0, 5)
  const bgStyle: React.CSSProperties = heroPhoto
    ? { backgroundImage: 'url("' + heroPhoto.url + '")' }
    : proceduralMacro(hero?.slug ?? item.id)

  const dish = <StoryDish item={item} />

  return (
    <section
      ref={ref}
      id={'chapter-' + number}
      data-chapter={number}
      className={
        'story-ch' +
        (flip ? ' is-flip' : '') +
        (heroPhoto ? ' has-macro' : ' has-proc') +
        (item.photo_url && !item.photo_is_cutout ? ' has-photo' : '')
      }
      aria-label={item.name}
    >
      <div className="story-ch__bgwrap" aria-hidden="true">
        <motion.span
          className="story-ch__bg"
          style={reduced ? bgStyle : { ...bgStyle, y: bgY, scale: bgScale }}
        />
      </div>
      <span className="story-ch__grain" aria-hidden="true" />
      <span className="story-ch__vignette" aria-hidden="true" />

      <motion.div
        className="story-ch__word"
        aria-hidden="true"
        style={{ ['--fit' as string]: fitVw.toFixed(2), ...(reduced ? {} : { x: wordX }) } as React.CSSProperties}
      >
        {words.map((w, i) => (
          <span key={w + i}>{w}</span>
        ))}
      </motion.div>

      <div className="story-ch__top" aria-hidden="true">
        <span className="story-ch__no">{number}</span>
        <span className="story-ch__of">/ {String(total).padStart(2, '0')}</span>
      </div>

      <motion.span className="story-ch__bloom" aria-hidden="true" style={reduced ? undefined : { y: bloomY }} />

      <div className="story-ch__stage" {...tilt.bind}>
        <motion.div
          className="story-ch__float"
          style={reduced ? undefined : { y: dishY, rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
        >
          {dish}
        </motion.div>
      </div>

      <div className="story-ch__copy">
        <Reveal y={22}>
          <span className="story-ch__eyebrow">{category}</span>
          <h2 className="story-ch__name">{item.name}</h2>
        </Reveal>
        {item.short_description && <p className="story-ch__desc">{item.short_description}</p>}
        <div className="story-ch__meta">
          {price && <span className="story-ch__price">{price}</span>}
          {hero && (
            <span className="story-ch__hero">
              <i aria-hidden="true" /> Hero ingredient <b>{hero.name}</b>
            </span>
          )}
        </div>
        {chips.length > 0 && (
          <ul className="story-ch__chips" aria-label="Ingredients">
            {chips.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        {(item.dietary_labels?.length > 0 || item.allergens?.length > 0) && (
          <p className="story-ch__notes">
            {[...(item.dietary_labels ?? []), ...(item.allergens?.length ? ['Contains ' + item.allergens.join(', ')] : [])].join(' · ')}
          </p>
        )}
      </div>

      {hero && (
        <span className="story-ch__side" aria-hidden="true">
          {hero.name}
        </span>
      )}
    </section>
  )
}

/**
 * Ingredient Story. Every item is its own chapter and the chapter's ground is
 * the macro photography of its hero ingredient (resolved at publish from
 * Openverse / Wikimedia Commons, credited in the public footer). The page
 * opens with an index so the full menu is one tap away, a chapter rail keeps
 * position, and every chapter stacks the same six depth layers so the whole
 * scroll reads as one lit set rather than eight posters.
 */
function IngredientStory({ snapshot }: TemplateProps) {
  const categories = allCategories(snapshot)
  const entries = categories.flatMap((cat) => cat.items.map((item) => ({ item, category: cat.name })))
  const photos = snapshot.ingredientPhotos ?? {}
  const reduced = useReducedMotion()
  const [active, setActive] = React.useState('01')

  React.useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter]'))
    if (nodes.length === 0 || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (list) => {
        for (const e of list) if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.chapter || '01')
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [entries.length])

  if (entries.length === 0) {
    return (
      <div className="tpl istory">
        <p className="story-empty">Nothing on the board yet.</p>
      </div>
    )
  }

  const go = (no: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById('chapter-' + no)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <div className="tpl istory">
      <header className="story-mast">
        <div className="story-mast__lead">
          <span className="story-mast__eyebrow">
            The ingredient story <i aria-hidden="true" /> {entries.length} {entries.length === 1 ? 'chapter' : 'chapters'}
          </span>
          <h1 className="story-mast__title">{snapshot.restaurant.name}</h1>
          {snapshot.restaurant.description && <p className="story-mast__lede">{snapshot.restaurant.description}</p>}
        </div>
        <nav className="story-index" aria-label="Menu index">
          <ol>
            {entries.map(({ item, category }, idx) => {
              const no = String(idx + 1).padStart(2, '0')
              return (
                <li key={item.id}>
                  <a href={'#chapter-' + no} onClick={go(no)}>
                    <span className="story-index__no">{no}</span>
                    <span className="story-index__name">
                      {item.name}
                      <small>{category}</small>
                    </span>
                    <span className="story-index__dots" aria-hidden="true" />
                    <span className="story-index__price">{formatPrice(item.price_minor, item.currency_code)}</span>
                  </a>
                </li>
              )
            })}
          </ol>
        </nav>
      </header>

      <div className="story-railwrap" aria-hidden={entries.length < 2}>
        <nav className="story-rail" aria-label="Chapters">
          {entries.map(({ item }, idx) => {
            const no = String(idx + 1).padStart(2, '0')
            return (
              <a
                key={item.id}
                href={'#chapter-' + no}
                onClick={go(no)}
                className={active === no ? 'is-active' : ''}
                aria-current={active === no ? 'true' : undefined}
                aria-label={'Chapter ' + no + ': ' + item.name}
              >
                <span>{no}</span>
              </a>
            )
          })}
        </nav>
      </div>

      {entries.map(({ item, category }, idx) => {
        const number = String(idx + 1).padStart(2, '0')
        const hero = heroIngredientOf(item)
        const heroPhoto = hero ? photos[hero.slug] : undefined
        const longest = Math.max(...(hero?.name ?? item.name).split(/\s+/).map((w) => w.length), 4)
        // Size the word so its longest line spans ~88% of the viewport, capped.
        const fitVw = Math.min(17.5, 88 / (longest * 0.74))
        return (
          <StoryChapter
            key={item.id}
            item={item}
            category={category}
            number={number}
            total={entries.length}
            hero={hero}
            heroPhoto={heroPhoto}
            flip={idx % 2 === 1}
            fitVw={fitVw}
          />
        )
      })}

      <footer className="story-visit">
        <span className="story-mast__eyebrow">Visit us</span>
        <p className="story-visit__line">{snapshot.restaurant.address_text ?? snapshot.restaurant.name}</p>
        {snapshot.restaurant.phone && (
          <a className="story-visit__phone" href={'tel:' + snapshot.restaurant.phone}>
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
