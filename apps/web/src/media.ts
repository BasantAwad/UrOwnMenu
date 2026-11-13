/**
 * UrOwnMenu Media Preparation
 *
 * Deterministic, free, in-browser image processing. No paid API, no server
 * inference for the common path.
 *
 * Implements the "Image preparation" section of docs/AI_MEDIA_PIPELINE.md:
 *   1. Preserve immutable original (done server-side: the original asset is
 *      never overwritten, derivatives are separate rows).
 *   2. Validate file signature / MIME / dimensions / size.
 *   3. Create responsive derivatives.
 *   4. Browser Canvas controls: crop, subject position, exposure, contrast,
 *      white balance, restrained sharpening.
 *   5. Optional ONNX background removal, loaded only on explicit request.
 *   6. Compare before/after; owner approves.
 *
 * Cutouts are additionally *normalised* (trimmed, rescaled, recentred,
 * padded) so the stored file is a subject of known geometry rather than the
 * model's original rectangular canvas. See media-intelligence.ts.
 */

import {
  alphaStats,
  analysePhoto,
  normaliseCutout,
  type PhotoMeta,
} from './media-intelligence'
import { autoEnhance, unsharpLuma } from './enhance'

export type Adjustments = {
  /** 0.5 - 2.0. 1 = unchanged. */
  exposure: number
  /** 0.5 - 2.0. 1 = unchanged. */
  contrast: number
  /** 0 - 2. 1 = unchanged. */
  saturation: number
  /** -1 (cool/blue) to 1 (warm/orange). 0 = unchanged. */
  temperature: number
  /** 0 - 1. Restrained luma-only unsharp mask. */
  sharpen: number
  /** 0 - 1. Auto-enhance strength (levels, gamma, white balance, vibrance). 0 = off. */
  auto: number
  /** Target width/height ratio. null = keep original ratio (no crop). */
  aspectRatio: number | null
  /** 0 - 1. Horizontal focal point of the crop window. */
  focusX: number
  /** 0 - 1. Vertical focal point of the crop window. */
  focusY: number
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  exposure: 1,
  contrast: 1,
  saturation: 1,
  temperature: 0,
  sharpen: 0,
  auto: 0,
  aspectRatio: null,
  focusX: 0.5,
  focusY: 0.5,
}

export type ProcessedImage = {
  dataUrl: string
  width: number
  height: number
  /** True when the subject was cut out (transparent background). */
  cutout: boolean
  /** Measured art-direction facts about the file being stored. */
  meta?: PhotoMeta
}

/** Validate an image file before doing any work on it. */
export async function inspectImageFile(file: File): Promise<{
  ok: boolean
  error?: string
  width: number
  height: number
  mime: string
  bytes: number
}> {
  const bytes = file.size
  const mime = file.type

  if (!mime.startsWith('image/')) {
    return { ok: false, error: 'That file is not an image.', width: 0, height: 0, mime, bytes }
  }
  if (bytes > 25 * 1024 * 1024) {
    return { ok: false, error: 'Image is larger than 25 MB.', width: 0, height: 0, mime, bytes }
  }

  try {
    const bitmap = await createImageBitmap(file)
    const width = bitmap.width
    const height = bitmap.height
    bitmap.close()

    if (width < 64 || height < 64) {
      return { ok: false, error: 'Image is too small (minimum 64x64).', width, height, mime, bytes }
    }
    return { ok: true, width, height, mime, bytes }
  } catch {
    return { ok: false, error: 'Could not read that image file.', width: 0, height: 0, mime, bytes }
  }
}

/** Load a File into an HTMLImageElement. */
async function loadImageElement(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = source
  })
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Compute the crop rectangle for a target aspect ratio and focal point.
 * The focal point keeps the subject inside the crop instead of blindly
 * centring it, which is what produced badly cropped dish photos.
 */
export function computeCropRect(
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: number | null,
  focusX: number,
  focusY: number,
): { x: number; y: number; width: number; height: number } {
  if (!aspectRatio) {
    return { x: 0, y: 0, width: sourceWidth, height: sourceHeight }
  }

  const sourceRatio = sourceWidth / sourceHeight
  let width: number
  let height: number

  if (sourceRatio > aspectRatio) {
    // Source is wider than target: trim the sides.
    height = sourceHeight
    width = Math.round(sourceHeight * aspectRatio)
  } else {
    // Source is taller than target: trim the top/bottom.
    width = sourceWidth
    height = Math.round(sourceWidth / aspectRatio)
  }

  const maxX = sourceWidth - width
  const maxY = sourceHeight - height
  const x = Math.round(Math.max(0, Math.min(maxX, focusX * sourceWidth - width / 2)))
  const y = Math.round(Math.max(0, Math.min(maxY, focusY * sourceHeight - height / 2)))

  return { x, y, width, height }
}

/**
 * Apply deterministic tone adjustments to image data.
 * Exposure and white balance are applied per-pixel via a lookup-free
 * matrix; contrast is a pivot-relative scale; saturation uses the
 * Rec. 709 luma weights.
 */
function applyToneAdjustments(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  adjustments: Adjustments,
) {
  const { exposure, contrast, saturation, temperature } = adjustments
  if (exposure === 1 && contrast === 1 && saturation === 1 && temperature === 0) return

  const imageData = context.getImageData(0, 0, width, height)
  const data = imageData.data

  // Temperature: nudge red up and blue down (or the reverse) in a way that
  // preserves overall luminance.
  const warmth = temperature * 28
  const exposureOffset = (exposure - 1) * 60
  const contrastFactor = contrast

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    // Exposure (multiplicative, clamped).
    if (exposure !== 1) {
      r *= exposure
      g *= exposure
      b *= exposure
    }

    // Exposure offset lifts shadows slightly without clipping highlights.
    if (exposureOffset !== 0) {
      r += exposureOffset
      g += exposureOffset
      b += exposureOffset
    }

    // White balance.
    if (warmth !== 0) {
      r += warmth
      b -= warmth
    }

    // Contrast around mid-grey (128).
    if (contrastFactor !== 1) {
      r = (r - 128) * contrastFactor + 128
      g = (g - 128) * contrastFactor + 128
      b = (b - 128) * contrastFactor + 128
    }

    // Saturation via Rec. 709 luma.
    if (saturation !== 1) {
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      r = luma + (r - luma) * saturation
      g = luma + (g - luma) * saturation
      b = luma + (b - luma) * saturation
    }

    data[i] = r < 0 ? 0 : r > 255 ? 255 : r
    data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g
    data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b
  }

  context.putImageData(imageData, 0, 0)
}

/** Apply auto-enhance to a canvas in place. Transparent pixels are ignored. */
function enhanceContext(context: CanvasRenderingContext2D, width: number, height: number, strength: number) {
  if (strength <= 0) return
  const imageData = context.getImageData(0, 0, width, height)
  autoEnhance(imageData.data, width, height, strength)
  context.putImageData(imageData, 0, 0)
}

/** Luma-only unsharp mask on a canvas in place (see enhance.ts). */
function sharpenContext(context: CanvasRenderingContext2D, width: number, height: number, amount: number) {
  if (amount <= 0) return
  const imageData = context.getImageData(0, 0, width, height)
  unsharpLuma(imageData.data, width, height, amount)
  context.putImageData(imageData, 0, 0)
}

/**
 * Run the full deterministic preparation pipeline on an image.
 *
 * @param source  Original image (data URL or object URL).
 * @param adjustments  Tone + crop settings chosen by the owner.
 * @param maxEdge  Longest edge of the output derivative.
 */
export async function prepareImage(
  source: string,
  adjustments: Adjustments,
  maxEdge = 1400,
): Promise<ProcessedImage> {
  const img = await loadImageElement(source)
  const sourceWidth = img.naturalWidth
  const sourceHeight = img.naturalHeight

  const crop = computeCropRect(
    sourceWidth,
    sourceHeight,
    adjustments.aspectRatio,
    adjustments.focusX,
    adjustments.focusY,
  )

  // Scale the cropped region down so the longest edge is at most maxEdge.
  const scale = Math.min(1, maxEdge / Math.max(crop.width, crop.height))
  const outWidth = Math.max(1, Math.round(crop.width * scale))
  const outHeight = Math.max(1, Math.round(crop.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is not available in this browser')

  context.imageSmoothingQuality = 'high'
  context.drawImage(
    img,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, outWidth, outHeight,
  )

  // Auto-enhance first (one analysis pass), then the owner's manual tweaks on
  // top of it, then sharpen last so it works on the final tones.
  enhanceContext(context, outWidth, outHeight, adjustments.auto)
  applyToneAdjustments(context, outWidth, outHeight, adjustments)
  sharpenContext(context, outWidth, outHeight, adjustments.sharpen)

  const dataUrl = canvas.toDataURL('image/jpeg', 0.86)
  return { dataUrl, width: outWidth, height: outHeight, cutout: false }
}

/**
 * Optional ONNX background removal.
 *
 * Models are fetched from the Hugging Face CDN only when the owner
 * explicitly asks for it, and the result is cached in the browser
 * afterwards. Every model below is permissively licensed and was checked
 * against docs/MODEL_CATALOG.md before being enabled.
 *
 * The caller is responsible for showing progress and allowing cancel.
 */
export type BackgroundRemovalProgress = (stage: string, percent: number) => void

export type CutoutModel = {
  key: string
  label: string
  blurb: string
  /** Hugging Face repo id. */
  repo: string
  /** ONNX dtype used at load time. */
  dtype: 'q8' | 'fp16' | 'fp32'
  /** Approximate download size in MB, shown to the owner before they opt in. */
  sizeMb: number
  /** Weight license, recorded for the audit trail. */
  license: string
  bestFor: string
}

export const CUTOUT_MODELS: CutoutModel[] = [
  {
    key: 'ormbg',
    label: 'General object (recommended)',
    blurb: 'Removes any clean background around a dish, drink or product.',
    repo: 'onnx-community/ormbg-ONNX',
    dtype: 'q8',
    sizeMb: 42,
    license: 'Apache-2.0',
    bestFor: 'Food, drinks and products shot on a plain surface',
  },
  {
    key: 'modnet',
    label: 'Portrait (lighter download)',
    blurb: 'Smaller and faster, but tuned for people rather than dishes.',
    repo: 'Xenova/modnet',
    dtype: 'q8',
    sizeMb: 6,
    license: 'Apache-2.0',
    bestFor: 'People and pets',
  },
]

let backgroundRemoverPromise: Promise<any> | null = null
let backgroundRemoverKey: string | null = null

async function getBackgroundRemover(
  model: CutoutModel,
  progress?: BackgroundRemovalProgress,
): Promise<(input: any) => Promise<any>> {
  if (backgroundRemoverPromise && backgroundRemoverKey === model.key) {
    return backgroundRemoverPromise
  }

  backgroundRemoverKey = model.key
  backgroundRemoverPromise = (async () => {
    progress?.('Downloading the background removal model…', 5)

    const { pipeline, env } = await import('@huggingface/transformers')

    // Keep the model fetch on the CDN; nothing is uploaded anywhere.
    env.allowLocalModels = false
    env.useBrowserCache = true

    const segmenter = await pipeline('background-removal', model.repo, {
      dtype: model.dtype,
      progress_callback: (info: any) => {
        if (info && typeof info.progress === 'number') {
          progress?.('Downloading the background removal model…', Math.round(info.progress))
        }
      },
    })

    progress?.('Model ready', 40)
    return segmenter
  })().catch((error) => {
    backgroundRemoverPromise = null
    backgroundRemoverKey = null
    throw error
  })

  return backgroundRemoverPromise
}

/**
 * Remove the background from an image, returning a PNG with transparency.
 * Returns null if the model cannot be loaded (the caller then keeps the
 * original image rather than failing the upload).
 */
export async function removeBackground(
  source: string,
  model: CutoutModel,
  onProgress?: BackgroundRemovalProgress,
): Promise<ProcessedImage | null> {
  try {
    const segmenter = await getBackgroundRemover(model, onProgress)

    onProgress?.('Analysing the photo…', 55)

    const { RawImage } = await import('@huggingface/transformers')
    const image = await RawImage.fromURL(source)

    // The background-removal pipeline returns the source image with the
    // predicted alpha matte already composited into the alpha channel.
    const result: any = await segmenter(image)

    const output = Array.isArray(result) ? result[0] : result
    if (!output) throw new Error('No output from the model')

    const width = output.width ?? image.width
    const height = output.height ?? image.height
    const channels = output.channels ?? output.data.length / (width * height)

    onProgress?.('Finishing the cutout…', 85)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null

    const imageData = context.createImageData(width, height)
    const src = output.data
    const dst = imageData.data

    for (let i = 0; i < width * height; i++) {
      const s = i * channels
      const d = i * 4
      dst[d] = src[s]
      dst[d + 1] = src[s + 1]
      dst[d + 2] = src[s + 2]
      dst[d + 3] = channels >= 4 ? src[s + 3] : 255
    }

    context.putImageData(imageData, 0, 0)
    onProgress?.('Framing the subject…', 92)

    // Clean the alpha edge.
    const cleaned = cleanAlphaEdge(context, width, height)

    /*
     * The model returns the full input canvas, so the subject still sits in a
     * field of empty pixels. Trim it, rescale it to a consistent fill and
     * centre it optically. Everything downstream (preview, storage, every
     * template) then receives a subject, not a photograph frame.
     */
    const framed = normaliseCutout(cleaned, { targetRatio: 1, fill: 0.9 })
    onProgress?.('Done', 100)

    return {
      dataUrl: framed.canvas.toDataURL('image/png'),
      width: framed.canvas.width,
      height: framed.canvas.height,
      cutout: true,
      meta: framed.meta,
    }
  } catch (error) {
    console.error('Background removal failed:', error)
    return null
  }
}

/**
 * Remove the faint alpha fringe a segmentation model leaves behind.
 *
 * The model returns a soft matte. The near-transparent pixels still carry
 * the original background colour, so on a light surface they read as a
 * faint rectangular smudge around the subject. Two passes fix it:
 *
 *   1. Threshold: anything below a low alpha becomes fully transparent.
 *   2. Erode: shrink the remaining matte by one pixel so the soft band is
 *      outside the shape rather than around it.
 *
 * The subject is never eroded because erosion only affects pixels that are
 * already partly transparent.
 */
function cleanAlphaEdge(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = context.canvas
  const imageData = context.getImageData(0, 0, width, height)
  const data = imageData.data

  const ALPHA_CUTOFF = 26

  // Pass 1 - threshold.
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < ALPHA_CUTOFF) data[i] = 0
  }

  // Pass 2 - one pixel erosion using the alpha neighbourhood.
  const alpha = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) alpha[i] = data[i * 4 + 3]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const here = alpha[i]
      if (here === 0) continue

      // Find the lowest alpha in the 4-neighbourhood.
      let min = here
      if (x > 0) min = Math.min(min, alpha[i - 1])
      if (x < width - 1) min = Math.min(min, alpha[i + 1])
      if (y > 0) min = Math.min(min, alpha[i - width])
      if (y < height - 1) min = Math.min(min, alpha[i + width])

      // Only erode the soft outer band, never a solid edge.
      if (min < 255 && min < here) {
        data[i * 4 + 3] = min
      }
    }
  }

  context.putImageData(imageData, 0, 0)
  return canvas
}

/**
 * Full preparation used at upload time: optional cutout, deterministic
 * tone/crop adjustments, a size-capped derivative, and the measurements the
 * templates use to place the image.
 *
 * A cutout ignores the owner's aspect crop: it is always trimmed to the
 * subject first and then padded to the requested ratio, because cropping a
 * rectangular canvas is what produced off-centre, undersized cutouts.
 */
export async function prepareForUpload(
  file: File,
  adjustments: Adjustments,
  options: {
    removeBackground?: boolean
    cutoutModel?: CutoutModel
    onProgress?: BackgroundRemovalProgress
  } = {},
): Promise<{
  dataUrl: string
  filename: string
  width: number
  height: number
  cutout: boolean
  meta: PhotoMeta
}> {
  const originalDataUrl = await readFileAsDataUrl(file)

  let working = originalDataUrl
  let cutout = false

  if (options.removeBackground) {
    const model = options.cutoutModel || CUTOUT_MODELS[0]
    const result = await removeBackground(originalDataUrl, model, options.onProgress)
    if (result) {
      working = result.dataUrl
      cutout = true
    }
  }

  const img = await loadImageElement(working)
  const maxEdge = 1400

  if (cutout) {
    // Draw at a sensible working size, then normalise to the requested frame.
    const workScale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight))
    const workW = Math.max(1, Math.round(img.naturalWidth * workScale))
    const workH = Math.max(1, Math.round(img.naturalHeight * workScale))
    const work = document.createElement('canvas')
    work.width = workW
    work.height = workH
    const workCtx = work.getContext('2d', { willReadFrequently: true })
    if (!workCtx) throw new Error('Canvas is not available in this browser')
    workCtx.imageSmoothingQuality = 'high'
    workCtx.drawImage(img, 0, 0, workW, workH)

    const framed = normaliseCutout(work, {
      targetRatio: adjustments.aspectRatio ?? 1,
      fill: 0.9,
    })

    /*
     * normaliseCutout returns a photograph unchanged when there was no matte
     * to trim (the model failed, or returned a fully opaque mask). Never
     * store that as a cutout: an opaque rectangle must go through the normal
     * crop path, or every template would centre an unmasked photo.
     */
    if (framed.meta.treatment === 'contain') {
      const framedCtx = framed.canvas.getContext('2d', { willReadFrequently: true })
      if (!framedCtx) throw new Error('Canvas is not available in this browser')
      enhanceContext(framedCtx, framed.canvas.width, framed.canvas.height, adjustments.auto)
      applyToneAdjustments(framedCtx, framed.canvas.width, framed.canvas.height, adjustments)
      sharpenContext(framedCtx, framed.canvas.width, framed.canvas.height, adjustments.sharpen)
      cleanAlphaEdge(framedCtx, framed.canvas.width, framed.canvas.height)

      const out = downscale(framed.canvas, maxEdge)
      const meta = analysePhoto(out, true)
      const bounds = alphaStats(out)
      meta.treatment = 'contain'
      if (bounds) {
        meta.coverage = bounds.coverage
        meta.subject = {
          x: bounds.left,
          y: bounds.top,
          w: bounds.right - bounds.left,
          h: bounds.bottom - bounds.top,
        }
      }

      return {
        dataUrl: out.toDataURL('image/webp', 0.88),
        filename: file.name.replace(/\.[^.]+$/, '') + '.webp',
        width: out.width,
        height: out.height,
        cutout: true,
        meta,
      }
    }

    cutout = false
  }

  const sourceWidth = img.naturalWidth
  const sourceHeight = img.naturalHeight

  const crop = computeCropRect(
    sourceWidth,
    sourceHeight,
    adjustments.aspectRatio,
    adjustments.focusX,
    adjustments.focusY,
  )

  const scale = Math.min(1, maxEdge / Math.max(crop.width, crop.height))
  const outWidth = Math.max(1, Math.round(crop.width * scale))
  const outHeight = Math.max(1, Math.round(crop.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is not available in this browser')

  context.imageSmoothingQuality = 'high'
  context.drawImage(
    img,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, outWidth, outHeight,
  )

  // Auto-enhance first (one analysis pass), then the owner's manual tweaks on
  // top of it, then sharpen last so it works on the final tones.
  enhanceContext(context, outWidth, outHeight, adjustments.auto)
  applyToneAdjustments(context, outWidth, outHeight, adjustments)
  sharpenContext(context, outWidth, outHeight, adjustments.sharpen)

  // Measure the stored file, not the original: the crop has changed the frame.
  const meta = analysePhoto(canvas, false)

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.86),
    filename: baseName + '.jpg',
    width: outWidth,
    height: outHeight,
    cutout: false,
    meta,
  }
}

/** Downscale a canvas so its long edge is at most `maxEdge`. */
function downscale(source: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height))
  if (scale >= 1) return source
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return source
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}
