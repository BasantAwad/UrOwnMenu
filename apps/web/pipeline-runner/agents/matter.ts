/**
 * Matter: turn a candidate photo into a clean cutout (build spec 3.5).
 * Steps, all required:
 *   1. background-removal model (real runs only; dry-run candidates are RGBA)
 *   2. cleanAlphaEdge to remove the model's halo
 *   3. normaliseCutout to trim, centre and pad to a square
 * The Gate then measures the result; nothing else may skip a step.
 */
import type { PipelineConfig } from '../models.ts'
import { requireLicensed } from '../models.ts'
import type { Cache } from '../cache.ts'
import { matteKeyPayload } from '../../src/pipeline/cache.ts'
import type { Rgba } from '../imaging.ts'
import { cleanAlphaEdge, decodeImage, encodePng, isEmptyAlpha, normaliseCutout } from '../imaging.ts'
import { sha256 } from '../store.ts'

export type MatterResult = {
  image: Rgba
  /** True when the model returned nothing visible; caller marks `empty-matte`. */
  empty: boolean
}

export async function matter(
  input: Rgba,
  inputSha256: string,
  config: PipelineConfig,
  cache: Cache,
  opts: { simulateEmptyMatte?: boolean } = {},
): Promise<MatterResult> {
  if (opts.simulateEmptyMatte) {
    return { image: { data: new Uint8ClampedArray(input.width * input.height * 4), width: input.width, height: input.height }, empty: true }
  }

  let cutout = input
  if (!config.dryRun) {
    cutout = await removeBackground(input, inputSha256, config, cache)
  }
  if (isEmptyAlpha(cutout)) return { image: cutout, empty: true }

  const cleaned = cleanAlphaEdge(cutout)
  const normalised = normaliseCutout(cleaned, { targetRatio: 1, fill: 0.9, pad: 0.04 })
  return { image: normalised, empty: isEmptyAlpha(normalised) }
}

async function removeBackground(
  input: Rgba,
  inputSha256: string,
  config: PipelineConfig,
  cache: Cache,
): Promise<Rgba> {
  const entry = requireLicensed(config, 'matting')
  const key = cache.key(matteKeyPayload(inputSha256, entry.id))
  const cached = await cache.readBytes(key, 'png')
  if (cached) return decodeImage(cached)
  if (!config.matteUrl) throw new Error('PIPELINE_MATTE_URL is not set')

  const response = await fetch(config.matteUrl.replace(/\/$/, '') + '/remove', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: entry.id, image: encodePng(input).toString('base64') }),
  })
  if (!response.ok) throw new Error(`matte-http-${response.status}`)
  const type = response.headers.get('content-type') ?? ''
  const bytes = type.includes('application/json')
    ? Buffer.from(((await response.json()) as { image: string }).image, 'base64')
    : Buffer.from(await response.arrayBuffer())
  await cache.writeBytes(key, bytes, 'png')
  return decodeImage(bytes)
}

export function matterCacheHint(image: Rgba): string {
  return sha256(Buffer.from(image.data.buffer))
}
