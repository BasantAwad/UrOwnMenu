/**
 * UrOwnMenu — Media intelligence
 *
 * The design layer that background removal alone does not provide.
 *
 * A segmentation model returns the *same canvas* as its input: a rectangle
 * stays a rectangle, with the subject somewhere inside a field of transparent
 * pixels. Any template that renders that file will therefore render the empty
 * margin too, whatever `object-fit` it uses. This module fixes the asset
 * itself, and then measures it so layout decisions can be made from evidence
 * instead of assumptions:
 *
 *   normaliseCutout()  trim to the subject, rescale to a consistent fill,
 *                      optically recentre, feather the matte, pad to a known
 *                      ratio. The output is a *subject*, not a photograph
 *                      frame.
 *   analysePhoto()     focal point, mean luminance, contrast, dominant
 *                      colour, subject coverage — the facts an art director
 *                      needs to place the image and decide whether type over
 *                      it needs a scrim.
 *
 * Everything is deterministic, in-browser, and free. No network, no model.
 */

export type PhotoMeta = {
  /** Schema version, so old metadata never has to be guessed at. */
  v: 1
  /** Subject focal point, 0..1, in the coordinate space of the stored file. */
  focusX: number
  focusY: number
  /** Stored file aspect ratio (width / height). */
  ratio: number
  /** Mean perceived luminance, 0..1. */
  meanLuma: number
  /** Luminance standard deviation normalised to 0..1. */
  contrast: number
  /** Fraction of the frame the subject occupies (1 for full-frame photos). */
  coverage: number
  /** How the file is meant to be drawn. */
  treatment: 'cover' | 'contain'
  /** Dominant colour of the subject, as 0..255 sRGB. */
  dominant: [number, number, number]
  /** Bounds of the subject inside the stored file, normalised 0..1. */
  subject?: { x: number; y: number; w: number; h: number }
}

export type NormaliseOptions = {
  /** Output aspect ratio. 1 = square, which is the neutral cutout frame. */
  targetRatio?: number
  /** Longest subject edge as a fraction of the output frame. 0..1. */
  fill?: number
  /** Transparent breathing room, as a fraction of the subject's long edge. */
  pad?: number
  /** Soften the matte boundary by one pixel to kill the model's halo. */
  feather?: boolean
}

type AlphaStats = {
  left: number
  top: number
  right: number
  bottom: number
  coverage: number
  centroidX: number
  centroidY: number
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas is not available in this browser')
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

/** Trim runs on a downscaled copy: alpha bounds are stable and it is ~50x faster. */
const TRIM_MAX_EDGE = 900
const ANALYSIS_MAX_EDGE = 320

/**
 * Bounding box and coverage of the non-transparent pixels.
 * Returns null when the image is fully opaque (nothing to trim) or fully
 * transparent (the model failed and returned an empty matte).
 */
export function alphaStats(
  source: CanvasImageSource & { width: number; height: number },
): AlphaStats | null {
  const scale = Math.min(1, TRIM_MAX_EDGE / Math.max(source.width, source.height))
  const w = Math.max(1, Math.round(source.width * scale))
  const h = Math.max(1, Math.round(source.height * scale))
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  ctx.drawImage(source, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data

  let left = w
  let top = h
  let right = -1
  let bottom = -1
  let count = 0
  let sumX = 0
  let sumY = 0
  const ALPHA = 12

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3]
      if (a <= ALPHA) continue
      count++
      sumX += x
      sumY += y
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }

  if (count === 0 || right < left) return null
  if (count >= w * h * 0.985) return null // opaque photo, no matte to trim

  return {
    left: left / w,
    top: top / h,
    right: (right + 1) / w,
    bottom: (bottom + 1) / h,
    coverage: count / (w * h),
    centroidX: sumX / count / w,
    centroidY: sumY / count / h,
  }
}

/**
 * Feather the matte: a 1px alpha box blur applied only where the matte is
 * partial. The subject's solid interior is left untouched.
 */
function featherAlpha(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const image = ctx.getImageData(0, 0, w, h)
  const data = image.data
  const alpha = new Uint8ClampedArray(w * h)
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3]

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const a = alpha[i]
      if (a === 0 || a === 255) continue
      let sum = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          sum += alpha[yy * w + xx]
          n++
        }
      }
      if (n > 0) data[i * 4 + 3] = sum / n
    }
  }
  ctx.putImageData(image, 0, 0)
}

/**
 * Normalise a cutout into a consistent subject frame.
 *
 * 1. Find the subject's bounding box.
 * 2. Crop to it.
 * 3. Scale so its longest edge is `fill` of the output frame.
 * 4. Centre it, with a small pull toward the alpha centroid so handle-heavy
 *    or asymmetrical objects do not read as leaning.
 * 5. Pad to `targetRatio` with transparency.
 *
 * The returned canvas is the file that should be stored. Nothing about the
 * original rectangle survives, so every template can treat the result as a
 * subject of known geometry.
 */
export function normaliseCutout(
  source: HTMLCanvasElement,
  options: NormaliseOptions = {},
): { canvas: HTMLCanvasElement; meta: PhotoMeta } {
  const targetRatio = options.targetRatio ?? 1
  const fill = Math.min(0.98, Math.max(0.4, options.fill ?? 0.9))
  const pad = Math.max(0, options.pad ?? 0.04)

  const stats = alphaStats(source)
  if (!stats) {
    // Nothing to trim: the matte is fully opaque (or fully transparent and
    // unusable). Measure it as a photograph so callers do not treat an
    // opaque rectangle as a cutout with a silhouette.
    return { canvas: source, meta: analysePhoto(source, false) }
  }

  const sx = Math.round(stats.left * source.width)
  const sy = Math.round(stats.top * source.height)
  const sw = Math.max(1, Math.round((stats.right - stats.left) * source.width))
  const sh = Math.max(1, Math.round((stats.bottom - stats.top) * source.height))

  // Output frame: the subject's long edge divided by the fill fraction.
  const subjectLong = Math.max(sw, sh)
  const frameLong = subjectLong / fill
  const frameW = targetRatio >= 1 ? Math.round(frameLong) : Math.round(frameLong * targetRatio)
  const frameH = targetRatio >= 1 ? Math.round(frameLong / targetRatio) : Math.round(frameLong)

  const canvas = createCanvas(frameW, frameH)
  const ctx = context2d(canvas)

  // Optical centring: mostly the bounding box, nudged by the centroid.
  const pull = 0.22
  const cx =
    (stats.left + stats.right) / 2 + (stats.centroidX - (stats.left + stats.right) / 2) * pull
  const cy =
    (stats.top + stats.bottom) / 2 + (stats.centroidY - (stats.top + stats.bottom) / 2) * pull

  // Source point (in px) that should land at the output centre.
  const sourceCx = cx * source.width
  const sourceCy = cy * source.height

  const scale = Math.min(
    (frameW * (1 - pad * 2)) / sw,
    (frameH * (1 - pad * 2)) / sh,
  )

  const dx = frameW / 2 - (sourceCx - sx) * scale
  const dy = frameH / 2 - (sourceCy - sy) * scale

  ctx.imageSmoothingQuality = 'high'
  // Clip to the subject's bounds so stray matte haze cannot leak in.
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, frameW, frameH)
  ctx.clip()
  ctx.drawImage(
    source,
    sx, sy, sw, sh,
    dx, dy, sw * scale, sh * scale,
  )
  ctx.restore()

  if (options.feather !== false) featherAlpha(ctx, frameW, frameH)

  const meta = analysePhoto(canvas, true)
  // The subject now fills a known share of a centred frame, so coverage is
  // exactly the composited area rather than the pre-trim value.
  const trimmed = alphaStats(canvas)
  if (trimmed) meta.coverage = trimmed.coverage
  meta.treatment = 'contain'
  meta.subject = trimmed
    ? {
        x: trimmed.left,
        y: trimmed.top,
        w: trimmed.right - trimmed.left,
        h: trimmed.bottom - trimmed.top,
      }
    : { x: 0, y: 0, w: 1, h: 1 }

  return { canvas, meta }
}

/**
 * Measure a photograph for art direction.
 *
 * Focal point comes from gradient energy: the sharpest, highest-contrast
 * region of a food photo is nearly always the subject. It is pulled toward
 * the centre so a busy background corner cannot drag the crop off the plate.
 */
export function analysePhoto(
  source: CanvasImageSource & { width: number; height: number },
  isCutout = false,
): PhotoMeta {
  const scale = Math.min(1, ANALYSIS_MAX_EDGE / Math.max(source.width, source.height))
  const w = Math.max(2, Math.round(source.width * scale))
  const h = Math.max(2, Math.round(source.height * scale))
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  ctx.drawImage(source, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data

  const luma = new Float32Array(w * h)
  let sum = 0
  let count = 0
  let rSum = 0
  let gSum = 0
  let bSum = 0

  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    const a = data[o + 3] / 255
    // Transparent pixels must not influence the luminance of a cutout.
    if (a < 0.08) {
      luma[i] = -1
      continue
    }
    const r = data[o]
    const g = data[o + 1]
    const b = data[o + 2]
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    luma[i] = y
    sum += y
    count++
    rSum += r
    gSum += g
    bSum += b
  }

  const mean = count > 0 ? sum / count : 0.5
  let variance = 0
  for (let i = 0; i < w * h; i++) {
    if (luma[i] < 0) continue
    const d = luma[i] - mean
    variance += d * d
  }
  const std = count > 0 ? Math.sqrt(variance / count) : 0

  // Gradient energy, weighted by how central the pixel is.
  let fx = 0
  let fy = 0
  let fw = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const c = luma[i]
      if (c < 0) continue
      const l = luma[i - 1]
      const r = luma[i + 1]
      const u = luma[i - w]
      const d = luma[i + w]
      if (l < 0 || r < 0 || u < 0 || d < 0) continue
      const gx = r - l
      const gy = d - u
      const energy = gx * gx + gy * gy
      if (energy < 64) continue
      // Centrality weight: 1 at the centre, 0.35 in the corners.
      const nx = (x / w - 0.5) * 2
      const ny = (y / h - 0.5) * 2
      const central = 1 - 0.65 * Math.min(1, Math.hypot(nx, ny) / 1.414)
      const weight = energy * central
      fx += x * weight
      fy += y * weight
      fw += weight
    }
  }

  let focusX = 0.5
  let focusY = 0.5
  if (fw > 0) {
    focusX = fx / fw / w
    focusY = fy / fw / h
    // Pull 30% toward the centre: a considered crop, not a jittery one.
    focusX = 0.5 + (focusX - 0.5) * 0.7
    focusY = 0.5 + (focusY - 0.5) * 0.7
  }
  focusX = Math.min(0.82, Math.max(0.18, focusX))
  focusY = Math.min(0.82, Math.max(0.18, focusY))

  const denom = Math.max(1, count)
  const dominant: [number, number, number] = [
    Math.round(rSum / denom),
    Math.round(gSum / denom),
    Math.round(bSum / denom),
  ]

  return {
    v: 1,
    focusX: round3(focusX),
    focusY: round3(focusY),
    ratio: round3(source.width / source.height),
    meanLuma: round3(mean / 255),
    contrast: round3(Math.min(1, std / 90)),
    coverage: 1,
    treatment: isCutout ? 'contain' : 'cover',
    dominant,
    ...(isCutout ? { subject: { x: 0, y: 0, w: 1, h: 1 } } : {}),
  }
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}

// ---------------------------------------------------------------- art direction

export type PhotoSlot = 'hero' | 'portrait' | 'square' | 'circle' | 'row' | 'tile'

/**
 * object-position for a slot. Cutouts are already normalised and centred,
 * so they always resolve to 50% 50%; photographs follow their measured
 * focal point so a crop never decapitates the subject.
 */
export function objectPositionFor(meta: PhotoMeta | null | undefined): string {
  if (!meta) return '50% 50%'
  if (meta.treatment === 'contain') return '50% 50%'
  return `${Math.round(meta.focusX * 100)}% ${Math.round(meta.focusY * 100)}%`
}

/**
 * Does type laid over this image need a scrim?
 * A bright, low-contrast photo (a white plate on a white table) needs a
 * stronger scrim than a dark one, and a very dark photo needs none.
 */
export function scrimFor(
  meta: PhotoMeta | null | undefined,
  region: 'bottom' | 'full' = 'bottom',
): 'none' | 'soft' | 'strong' {
  if (!meta) return 'strong'
  const l = meta.meanLuma
  if (region === 'full') {
    if (l < 0.32) return 'soft'
    return 'strong'
  }
  // Bottom band: assume the lower third is brighter than the mean.
  const band = Math.min(1, l * 1.15)
  if (band < 0.3) return 'none'
  if (band < 0.55) return 'soft'
  return 'strong'
}

/** Pick the strongest photograph to lead a template with. */
export function scorePhoto(meta: PhotoMeta | null | undefined): number {
  if (!meta) return 0
  let score = 0
  // A subject that fills a meaningful share of the frame.
  score += Math.min(1, meta.coverage) * 34
  // Detail and separation.
  score += meta.contrast * 30
  // Avoid photos that are nearly black or blown out behind type.
  const exposure = Math.abs(meta.meanLuma - 0.52)
  score += (1 - Math.min(1, exposure * 2)) * 22
  // Landscape frames lead better than extreme portraits.
  score += (1 - Math.min(1, Math.abs(meta.ratio - 1.4) / 1.4)) * 14
  if (meta.treatment === 'contain') score += 8
  return Math.round(score)
}

/** Portrait, landscape or square — used to choose a split ratio. */
export function shapeOf(meta: PhotoMeta | null | undefined): 'portrait' | 'landscape' | 'square' {
  const ratio = meta?.ratio ?? 1
  if (ratio > 1.15) return 'landscape'
  if (ratio < 0.87) return 'portrait'
  return 'square'
}

/**
 * Choose the text/photo split for a two-column hero from the photo's own
 * shape: a tall photo earns a wider column, a wide one a shorter column.
 */
export function splitFor(meta: PhotoMeta | null | undefined): { text: number; media: number } {
  switch (shapeOf(meta)) {
    case 'portrait':
      return { text: 0.52, media: 0.48 }
    case 'landscape':
      return { text: 0.58, media: 0.42 }
    default:
      return { text: 0.55, media: 0.45 }
  }
}
