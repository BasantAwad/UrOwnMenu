/**
 * UrOwnMenu — Art direction
 *
 * The rules a designer applies when they lay out a menu, written down so a
 * template can apply them without a human in the loop:
 *
 *   - Lead with the strongest photograph, not simply the first featured item.
 *   - Give a tall photo a wider column than a wide one.
 *   - Put a scrim behind type only when the photograph is bright enough to
 *     need it.
 *   - Never crop or box a cutout; let its alpha define the silhouette.
 *   - If there is no photograph, draw deliberate artwork rather than a hole.
 *
 * Every decision below is derived from `PhotoMeta`, which is measured from
 * the stored pixels. Nothing is guessed from the item name.
 */

import type { MenuItem } from '../api'
import {
  scrimFor,
  scorePhoto,
  splitFor,
  type PhotoMeta,
  type PhotoSlot,
} from '../media-intelligence'

export type Treatment = {
  /** How the file should be fitted into its slot. */
  fit: 'cover' | 'contain'
  /** CSS object-position for cover fits. */
  objectPosition: string
  /** Scrim strength for type laid over the image. */
  scrim: 'none' | 'soft' | 'strong'
  /** True when the template must draw generated art instead of an image. */
  generated: boolean
  /** Cutouts keep their silhouette and never receive a surface fill. */
  cutout: boolean
}

function metaOf(item: MenuItem | null | undefined): PhotoMeta | null {
  return item?.photo_meta ?? null
}

/** Pick the item a template should lead with. */
export function pickHero(items: MenuItem[], preferredId?: string): MenuItem | null {
  if (items.length === 0) return null

  const withPhoto = items.filter((i) => Boolean(i.photo_url))
  const pool = withPhoto.length > 0 ? withPhoto : items

  if (preferredId) {
    const preferred = pool.find((i) => i.id === preferredId)
    if (preferred) return preferred
  }

  // A featured item with a good photograph wins; otherwise the best photo.
  const featured = pool.filter((i) => i.is_featured === 1)
  const candidates = featured.length > 0 ? featured : pool

  let best = candidates[0]
  let bestScore = scorePhoto(metaOf(best))

  for (const item of candidates.slice(1)) {
    const score = scorePhoto(metaOf(item))
    if (score > bestScore) {
      best = item
      bestScore = score
    }
  }

  // With no measurements at all, fall back to the first item in menu order.
  return best ?? items[0]
}

/** Everything a template needs to place one item's image. */
export function treatmentFor(item: MenuItem | null | undefined, slot: PhotoSlot = 'square'): Treatment {
  if (!item || !item.photo_url) {
    return { fit: 'contain', objectPosition: '50% 50%', scrim: 'none', generated: true, cutout: false }
  }

  const meta = metaOf(item)
  const cutout = Boolean(item.photo_is_cutout) || meta?.treatment === 'contain'

  if (cutout) {
    return {
      fit: 'contain',
      objectPosition: '50% 50%',
      scrim: 'none',
      generated: false,
      cutout: true,
    }
  }

  const position = meta
    ? `${Math.round(meta.focusX * 100)}% ${Math.round(meta.focusY * 100)}%`
    : '50% 50%'

  // A hero or tile carries type over the image; a card usually does not.
  const needsOverlay = slot === 'hero' || slot === 'tile' || slot === 'circle'
  return {
    fit: 'cover',
    objectPosition: position,
    scrim: needsOverlay ? scrimFor(meta, 'bottom') : 'none',
    generated: false,
    cutout: false,
  }
}

/**
 * Class names a template can hang its scrim styles on. Kept as data so the
 * decision lives here and the CSS stays declarative.
 */
export function overlayClass(item: MenuItem | null | undefined, slot: PhotoSlot = 'tile'): string {
  const treatment = treatmentFor(item, slot)
  if (treatment.generated) return 'is-generated'
  if (treatment.cutout) return 'is-cutout'
  if (treatment.scrim === 'strong') return 'is-bright'
  if (treatment.scrim === 'soft') return 'is-mid'
  return 'is-dark'
}

/**
 * Column proportions for a two-part hero, from the lead photo's shape.
 * Returns CSS percentages that sum to 100.
 */
export function heroSplit(hero: MenuItem | null | undefined): { text: string; media: string } {
  const { text, media } = splitFor(metaOf(hero))
  return {
    text: Math.round(text * 100) + '%',
    media: Math.round(media * 100) + '%',
  }
}

/** Shape label, handy for choosing a layout variant. */
export function heroShape(item: MenuItem | null | undefined): 'portrait' | 'landscape' | 'square' {
  const ratio = metaOf(item)?.ratio ?? 1
  if (ratio > 1.15) return 'landscape'
  if (ratio < 0.87) return 'portrait'
  return 'square'
}

/**
 * Order items so photographs lead and typographic plates follow, which keeps
 * a sparsely photographed menu from opening with blanks.
 */
export function photoFirst(items: MenuItem[]): MenuItem[] {
  return [...items].sort((a, b) => {
    const photo = Number(Boolean(b.photo_url)) - Number(Boolean(a.photo_url))
    if (photo !== 0) return photo
    return 0
  })
}
