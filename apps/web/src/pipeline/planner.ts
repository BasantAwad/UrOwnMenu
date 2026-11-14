/**
 * Layout planner: decides where each cutout goes, how big, how deep, and in
 * what order. It is the deterministic half of the Composer agent; the agent
 * chooses the inputs (which assets, which mood), this function turns them into
 * a layer stack that obeys the rules in docs/PIPELINE.md section 4.
 *
 * Rules it enforces:
 *   - One hero, placed first, at the stage's focal point beside the copy zone.
 *   - A splash or background, if present, sits at the very back, behind the hero.
 *   - Accents (floating ingredients) are placed by best-candidate sampling around
 *     the hero, so they read as a loose cloud, not a grid or a ring.
 *   - Depth is seeded per accent. Near layers are larger, defocused, and move
 *     faster on scroll. Far layers are smaller, sharper and steadier.
 *   - Crowded stages shrink every accent by the same factor, so size still
 *     follows depth. Only when even the smallest size does not fit is an
 *     accent dropped, and the drop is reported.
 *   - Nothing overlaps the copy zone; nothing overlaps another layer's core.
 *   - Output is deterministic for the same seed, so a re-run never reshuffles.
 *
 * Geometry: x runs 0..1 of the stage width, y runs 0..1 of its height. Every
 * distance is converted to real screen units with the stage aspect ratio, so a
 * "circle" is round on screen.
 */
import type { Layer, LayerPlan, Stage, AssetMeta } from './contracts.ts'

/** mulberry32: small, fast, seedable PRNG. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

/** Scale 1 = one-third of the stage width, so a layer's radius is scale / 6. */
const HERO_SCALE = 1.0
const SPLASH_SCALE = 3.3
const SHRINK_STEPS = [1, 0.85, 0.72, 0.6]

/**
 * Distance in stage-width units between two normalised points. Vertical
 * offsets are divided by the aspect ratio, so the result is the real distance.
 */
export function realDistance(ax: number, ay: number, bx: number, by: number, aspect: number): number {
  return Math.hypot(ax - bx, (ay - by) / aspect)
}

type Placed = { x: number; y: number; r: number }
type Focal = { x: number; y: number }
type PlaceAttempt = { layers: Layer[]; dropped: LayerPlan['dropped']; placed: Placed[] }

/**
 * Best-candidate search for one accent of radius r (stage-width units).
 * Keeps candidates clear of the copy zone and of every placed layer, and
 * prefers the one farthest from its neighbours while still hugging the focal
 * point.
 */
function findSpot(
  r: number,
  stage: Stage,
  placed: Placed[],
  focal: Focal,
  rand: () => number,
): { x: number; y: number } | null {
  const z = stage.copyZone
  const rh = r * stage.aspect
  let best: { x: number; y: number; score: number } | null = null
  for (let k = 0; k < 160; k++) {
    const x = 0.03 + rand() * 0.94
    const y = 0.03 + rand() * 0.94
    if (x - r < 0.02 || x + r > 0.98 || y - rh < 0.02 || y + rh > 0.98) continue
    const nx = clamp(x, z.x, z.x + z.w)
    const ny = clamp(y, z.y, z.y + z.h)
    if (realDistance(x, y, nx, ny, stage.aspect) < r) continue
    let gap = Infinity
    for (const p of placed) gap = Math.min(gap, realDistance(p.x, p.y, x, y, stage.aspect) - (p.r + r))
    if (gap < 0.02) continue
    const score = gap - 0.5 * realDistance(x, y, focal.x, focal.y, stage.aspect)
    if (!best || score > best.score) best = { x, y, score }
  }
  return best ? { x: best.x, y: best.y } : null
}

/** Place every accent at one shared size factor. Deterministic for a seed. */
function placeAccents(
  accents: AssetMeta[],
  stage: Stage,
  focal: Focal,
  seed: number,
  startPlaced: Placed[],
  factor: number,
): PlaceAttempt {
  const rand = rng(seed)
  const placed: Placed[] = [...startPlaced]
  const layers: Layer[] = []
  const dropped: LayerPlan['dropped'] = []

  for (const a of accents) {
    // depth 1 = nearest to the viewer: largest, defocused, fastest parallax.
    const depth = 0.05 + rand() * 0.9
    const scale = lerp(0.4, 1.0, depth) * factor
    const spot = findSpot(scale / 6, stage, placed, focal, rand)
    if (!spot) {
      dropped.push({ assetId: a.id, reason: 'no clear space without covering the copy or another layer' })
      continue
    }
    placed.push({ x: spot.x, y: spot.y, r: scale / 6 })
    layers.push({
      assetId: a.id,
      kind: a.kind,
      x: spot.x,
      y: spot.y,
      scale,
      rotation: (rand() - 0.5) * 50,
      depth,
      // Only the nearest layers defocus, like a shallow-depth photo.
      blurPx: depth > 0.75 ? (depth - 0.75) * 16 : 0,
      parallax: lerp(0.25, 0.9, depth),
      z: 20 + Math.round(depth * 100),
    })
  }
  return { layers, dropped, placed }
}

/**
 * Build the layer stack. `assets` must already have passed gateAsset.
 * `seed` is any integer; use a hash of the item name in the caller so the
 * same dish always gets the same arrangement.
 */
export function planLayers(assets: AssetMeta[], stage: Stage, seed: number): LayerPlan {
  const rand = rng(seed)
  const z = stage.copyZone
  const layers: Layer[] = []

  const hero = assets.find((a) => a.kind === 'hero')
  const splash = assets.find((a) => a.kind === 'splash' || a.kind === 'background')
  const accents = assets.filter((a) => a.kind === 'ingredient' || a.kind === 'accent')

  // Focal point: the stage side that is away from the copy zone.
  const copyOnLeft = z.x < 0.5
  const focal: Focal = {
    x: copyOnLeft ? 0.72 : 0.3,
    y: 0.46 + (rand() - 0.5) * 0.04,
  }

  // 1. Back: splash or background covers the stage behind everything.
  if (splash) {
    layers.push({
      assetId: splash.id,
      kind: splash.kind,
      x: focal.x,
      y: focal.y,
      scale: SPLASH_SCALE,
      rotation: (rand() - 0.5) * 6,
      depth: 0,
      blurPx: 0,
      parallax: 0.2,
      z: 0,
    })
  }

  // 2. Hero: fixed footprint, placed before any accent can block it.
  const startPlaced: Placed[] = []
  if (hero) {
    layers.push({
      assetId: hero.id,
      kind: 'hero',
      x: focal.x,
      y: focal.y,
      scale: HERO_SCALE,
      rotation: (rand() - 0.5) * 8,
      depth: 0.55,
      blurPx: 0,
      parallax: 0.55,
      z: 10,
    })
    startPlaced.push({ x: focal.x, y: focal.y, r: HERO_SCALE / 6 })
  }

  // 3. Accents: try full size first; shrink the whole set together if needed.
  //    Keep the first attempt that drops nothing, otherwise the one that drops least.
  const seedBase = seed ^ 0x9e3779b9
  let chosen: PlaceAttempt | null = null
  for (let i = 0; i < SHRINK_STEPS.length; i++) {
    const attempt = placeAccents(accents, stage, focal, seedBase + i * 7919, startPlaced, SHRINK_STEPS[i])
    if (!chosen || attempt.dropped.length < chosen.dropped.length) chosen = attempt
    if (attempt.dropped.length === 0) break
  }
  const accentsPlaced = chosen ? chosen.layers : []
  const dropped = chosen ? chosen.dropped : []
  layers.push(...accentsPlaced)

  // Far first, near last: the rendered order matches depth.
  layers.sort((p, q) => p.z - q.z)
  return { seed, layers, dropped }
}
