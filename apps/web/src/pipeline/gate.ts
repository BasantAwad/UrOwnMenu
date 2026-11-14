/**
 * Quality gate for generated or fetched cutouts. Pure functions over RGBA
 * bytes, so the same checks run in the browser, in Node tests, and in the
 * Critic agent's pre-flight. A failed asset never reaches the layout planner.
 */
import type { AssetKind, AssetMeta, GateReason, GateResult } from './contracts.ts'

const MIN_SHORT_EDGE: Record<AssetKind, number> = {
  hero: 800,
  ingredient: 400,
  splash: 700,
  accent: 300,
  background: 800,
}

/**
 * Measure what the gate needs from an RGBA buffer: alpha coverage, whether the
 * matte touches the border, and a sharpness score from the Laplacian variance
 * of luma over opaque pixels.
 */
export function measureAlpha(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Pick<AssetMeta, 'alphaCoverage' | 'touchesEdge' | 'sharpness'> {
  const n = width * height
  let opaque = 0
  let touchesEdge = false
  const lumaAt = (p: number) => {
    const i = p * 4
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (data[p * 4 + 3] <= 200) continue
      opaque++
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true
    }
  }

  // Sharpness: variance of a 4-neighbour Laplacian over interior opaque pixels.
  let sum = 0
  let sumSq = 0
  let count = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x
      if (data[p * 4 + 3] <= 200) continue
      const lap = 4 * lumaAt(p) - lumaAt(p - 1) - lumaAt(p + 1) - lumaAt(p - width) - lumaAt(p + width)
      sum += lap
      sumSq += lap * lap
      count++
    }
  }
  const variance = count > 1 ? sumSq / count - (sum / count) ** 2 : 0
  // Empirically, 0 is flat/blurred and ~400 is a crisp macro photo. Clamp to 0..1.
  const sharpness = Math.min(1, Math.max(0, Math.sqrt(variance) / 20))

  return { alphaCoverage: opaque / Math.max(1, n), touchesEdge, sharpness }
}

/**
 * Decide whether an asset may enter the layout. Every reason is returned, so
 * the Critic can say exactly what to regenerate or re-source.
 */
export function gateAsset(meta: AssetMeta): GateResult {
  const reasons: GateReason[] = []
  const short = Math.min(meta.width, meta.height)

  if (short < MIN_SHORT_EDGE[meta.kind]) reasons.push('too-small')
  if (meta.alphaCoverage < 0.01) reasons.push('nothing-visible')
  else if (meta.alphaCoverage > 0.92 && meta.kind !== 'background') reasons.push('no-cutout')
  if (meta.alphaCoverage > 0.6 && meta.kind !== 'background') reasons.push('fills-frame')
  if (meta.touchesEdge && meta.kind !== 'background' && meta.kind !== 'splash') reasons.push('dirty-edge')
  // Deliberate motion blur is part of the look for accents; it is a defect for hero shots.
  if (meta.sharpness < 0.15 && !meta.intentionalBlur && (meta.kind === 'hero' || meta.kind === 'ingredient')) {
    reasons.push('soft-focus')
  }

  return { ok: reasons.length === 0, reasons }
}
