/**
 * Pure RGBA image work for the runner: PNG in, PNG out, no DOM and no canvas.
 *
 * The browser has `media-intelligence.ts` (canvas). Node does not, so the same
 * three operations the Matter agent needs are implemented here over plain
 * arrays and tested:
 *   - cleanAlphaEdge: soften the matte boundary so no light halo survives
 *   - normaliseCutout: trim to content, scale to a fill, centre, pad to square
 *   - compositeStage: draw a LayerPlan to one PNG for the Critic to review
 *
 * Everything is nearest-neighbour and deterministic on purpose: a rerun must
 * produce the same bytes (docs/PIPELINE_BUILD_SPEC.md section 9.2).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { PNG } from 'pngjs'

export type Rgba = { data: Uint8ClampedArray; width: number; height: number }

export async function readPng(path: string): Promise<Rgba> {
  const buffer = await readFile(path)
  const png = PNG.sync.read(buffer)
  return { data: new Uint8ClampedArray(png.data), width: png.width, height: png.height }
}

/** Decode any image the open sources return (PNG, JPEG, WebP) via Jimp. */
export async function decodeImage(bytes: Buffer): Promise<Rgba> {
  const { Jimp } = await import('jimp')
  const image = await Jimp.read(bytes)
  const { width, height, data } = image.bitmap
  const copy = new Uint8ClampedArray(width * height * 4)
  copy.set(data)
  return { data: copy, width, height }
}

export function encodePng(image: Rgba): Buffer {
  const png = new PNG({ width: image.width, height: image.height })
  png.data = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength)
  return PNG.sync.write(png)
}

export async function writePng(path: string, image: Rgba): Promise<void> {
  await writeFile(path, encodePng(image))
}

/** Alpha bounds, or null when the image is empty / fully transparent. */
export function alphaBounds(image: Rgba): { left: number; top: number; right: number; bottom: number } | null {
  const { data, width, height } = image
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= 12) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (right < 0) return null
  return { left, top, right, bottom }
}

/** True when no pixel with alpha > 200 exists (the model returned an empty matte). */
export function isEmptyAlpha(image: Rgba): boolean {
  const { data } = image
  for (let i = 3; i < data.length; i += 4) if (data[i] > 200) return false
  return true
}

/**
 * Remove the matting model's one-pixel light fringe: any pixel that is less
 * than half opaque but touches a transparent pixel gets its brightness pulled
 * back and its alpha softened. Also zeroes isolated specks under alpha 24.
 */
export function cleanAlphaEdge(image: Rgba): Rgba {
  const { width, height } = image
  const src = image.data
  const out = new Uint8ClampedArray(src)
  const at = (x: number, y: number) => (y * width + x) * 4

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = at(x, y)
      const a = src[i + 3]
      if (a === 0) continue
      if (a < 24) {
        // A speck: if all four neighbours are transparent, drop it.
        if (!src[at(x - 1, y) + 3] && !src[at(x + 1, y) + 3] && !src[at(x, y - 1) + 3] && !src[at(x, y + 1) + 3]) {
          out[i + 3] = 0
        }
        continue
      }
      if (a > 240) continue
      // Edge pixel: un-mix 30% toward the opaque interior colour to kill the halo.
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const j = at(x + dx, y + dy)
        if (src[j + 3] > 220) {
          r += src[j]
          g += src[j + 1]
          b += src[j + 2]
          n++
        }
      }
      if (n === 0) continue
      const mix = 0.3
      out[i] = src[i] * (1 - mix) + (r / n) * mix
      out[i + 1] = src[i + 1] * (1 - mix) + (g / n) * mix
      out[i + 2] = src[i + 2] * (1 - mix) + (b / n) * mix
      out[i + 3] = Math.round(a + (255 - a) * 0.12)
    }
  }
  return { data: out, width, height }
}

/** Box-filter resample to an exact size. Deterministic, no DOM. */
export function resize(image: Rgba, width: number, height: number): Rgba {
  const out = new Uint8ClampedArray(Math.max(1, width) * Math.max(1, height) * 4)
  const sx = image.width / width
  const sy = image.height / height
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      const x0 = Math.floor(x * sx)
      const x1 = Math.min(image.width, Math.max(x0 + 1, Math.floor((x + 1) * sx)))
      const y0 = Math.floor(y * sy)
      const y1 = Math.min(image.height, Math.max(y0 + 1, Math.floor((y + 1) * sy)))
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * image.width + xx) * 4
          r += image.data[i]
          g += image.data[i + 1]
          b += image.data[i + 2]
          a += image.data[i + 3]
          n++
        }
      }
      const o = (y * width + x) * 4
      out[o] = r / n
      out[o + 1] = g / n
      out[o + 2] = b / n
      out[o + 3] = a / n
    }
  }
  return { data: out, width, height }
}

/**
 * Trim to the alpha bounds, scale the subject so its longest edge is `fill` of
 * the output, centre it optically, and pad to a square with transparent pixels.
 * The owner's crop never survives a cutout, so nothing here depends on it.
 */
export function normaliseCutout(
  image: Rgba,
  opts: { targetRatio?: number; fill?: number; pad?: number } = {},
): Rgba {
  const targetRatio = opts.targetRatio ?? 1
  const fill = opts.fill ?? 0.9
  const pad = opts.pad ?? 0.04
  const bounds = alphaBounds(image)
  if (!bounds) return image

  const sw = bounds.right - bounds.left + 1
  const sh = bounds.bottom - bounds.top + 1
  const side = Math.max(sw, sh)
  const frameSide = Math.round(side / Math.max(0.1, fill - pad))
  const width = targetRatio >= 1 ? frameSide : Math.round(frameSide * targetRatio)
  const height = targetRatio >= 1 ? Math.round(frameSide / targetRatio) : frameSide

  const scaledW = Math.max(1, Math.round((sw / side) * side * (fill / 1)))
  const scaledH = Math.max(1, Math.round((sh / side) * side * (fill / 1)))

  const subject = resize(
    {
      data: crop(image, bounds.left, bounds.top, sw, sh),
      width: sw,
      height: sh,
    },
    Math.max(1, Math.round(width * fill)),
    Math.max(1, Math.round(height * fill)),
  )

  const out = new Uint8ClampedArray(width * height * 4)
  const ox = Math.round((width - subject.width) / 2)
  const oy = Math.round((height - subject.height) / 2)
  for (let y = 0; y < subject.height; y++) {
    for (let x = 0; x < subject.width; x++) {
      const i = (y * subject.width + x) * 4
      const o = ((y + oy) * width + (x + ox)) * 4
      out[o] = subject.data[i]
      out[o + 1] = subject.data[i + 1]
      out[o + 2] = subject.data[i + 2]
      out[o + 3] = subject.data[i + 3]
    }
  }
  void scaledW
  void scaledH
  return { data: out, width, height }
}

function crop(image: Rgba, left: number, top: number, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const src = ((top + y) * image.width + left) * 4
    out.set(image.data.subarray(src, src + width * 4), y * width * 4)
  }
  return out
}

/**
 * Composite a plan into one PNG for the Critic. Layers are centred on their
 * normalised position and scaled to `scale / 3` of the stage width. Rotation is
 * not applied: the Critic judges content, light, halos and overlap, and a
 * nearest-neighbour rotation would add artefacts the reviewer would chase.
 */
export function compositeStage(
  plan: { layers: { assetId: string; x: number; y: number; scale: number; kind: string }[] },
  assets: Map<string, Rgba>,
  opts: { width: number; height: number; background?: [number, number, number] },
): Rgba {
  const { width, height } = opts
  const bg = opts.background ?? [244, 239, 231]
  const data = new Uint8ClampedArray(width * height * 4)
  for (let p = 0; p < width * height; p++) {
    data[p * 4] = bg[0]
    data[p * 4 + 1] = bg[1]
    data[p * 4 + 2] = bg[2]
    data[p * 4 + 3] = 255
  }
  const out: Rgba = { data, width, height }

  for (const layer of plan.layers) {
    const image = assets.get(layer.assetId)
    if (!image) continue
    const targetW = Math.max(1, Math.round((layer.scale / 3) * width))
    const targetH = Math.max(1, Math.round((targetW / image.width) * image.height))
    const scaled = resize(image, targetW, targetH)
    const cx = Math.round(layer.x * width)
    const cy = Math.round(layer.y * height)
    blit(out, scaled, cx - Math.round(targetW / 2), cy - Math.round(targetH / 2))
  }
  return out
}

/** Source-over blit with rounded integer coordinates. */
function blit(dest: Rgba, src: Rgba, dx: number, dy: number): void {
  for (let y = 0; y < src.height; y++) {
    const ty = y + dy
    if (ty < 0 || ty >= dest.height) continue
    for (let x = 0; x < src.width; x++) {
      const tx = x + dx
      if (tx < 0 || tx >= dest.width) continue
      const i = (y * src.width + x) * 4
      const o = (ty * dest.width + tx) * 4
      const a = src.data[i + 3] / 255
      if (a <= 0) continue
      dest.data[o] = src.data[i] * a + dest.data[o] * (1 - a)
      dest.data[o + 1] = src.data[i + 1] * a + dest.data[o + 1] * (1 - a)
      dest.data[o + 2] = src.data[i + 2] * a + dest.data[o + 2] * (1 - a)
      dest.data[o + 3] = 255
    }
  }
}

/**
 * A deterministic synthetic cutout, used by dry-run generation and sourcing.
 * `texture` adds high-frequency variation so the sharpness measure is
 * meaningful; `coverage` controls how much of the frame the blob fills.
 */
export function syntheticCutout(opts: {
  width: number
  height: number
  seed: number
  coverage?: number
  hue?: [number, number, number]
}): Rgba {
  const { width, height, seed } = opts
  const coverage = opts.coverage ?? 0.34
  const hue = opts.hue ?? [176, 74, 96]
  const data = new Uint8ClampedArray(width * height * 4)
  const cx = width / 2
  const cy = height / 2
  const radius = Math.sqrt((coverage * width * height) / Math.PI)
  let h = seed >>> 0
  const rand = () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 10000) / 10000
  }
  const lobes = 5
  const phase = rand() * Math.PI * 2
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx
      const dy = y - cy
      const angle = Math.atan2(dy, dx)
      const wobble = 1 + 0.16 * Math.sin(angle * lobes + phase) + 0.06 * Math.sin(angle * 11 + phase * 2)
      const distance = Math.hypot(dx, dy)
      const edge = radius * wobble
      const i = (y * width + x) * 4
      if (distance > edge) continue
      // Soft one-pixel-ish edge.
      const alpha = distance > edge - 2 ? 190 : 255
      const stripe = ((x + y) % 9 < 4 ? 1 : -1) * 10
      const shade = 1 - Math.min(1, distance / edge) * 0.22
      data[i] = Math.max(0, Math.min(255, hue[0] * shade + stripe + rand() * 8))
      data[i + 1] = Math.max(0, Math.min(255, hue[1] * shade + stripe + rand() * 8))
      data[i + 2] = Math.max(0, Math.min(255, hue[2] * shade + stripe + rand() * 8))
      data[i + 3] = alpha
    }
  }
  return { data, width, height }
}
