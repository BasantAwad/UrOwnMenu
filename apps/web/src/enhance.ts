/**
 * UrOwnMenu — photo enhancement
 *
 * Pure functions over RGBA bytes (no DOM, no canvas), so they run in the
 * browser, in a Web Worker, and in Node for tests. Nothing here calls a model
 * or the network: it is classical image processing, which is why it is free,
 * private and deterministic.
 *
 * Why not the old per-channel tone code: contrast and exposure applied to R, G
 * and B independently shift hue, and a 4-neighbour Laplacian on each channel
 * draws coloured fringes on edges. Everything below works on luminance and
 * scales colour with it, so a tomato stays a tomato.
 *
 * Pipeline (strength s in 0..1):
 *   1. measure   luma percentiles, mean, mid-tone colour cast
 *   2. balance   gentle, clamped white balance (warm casts are flattering on
 *                food, so they are corrected less than cool ones)
 *   3. tone      levels -> adaptive gamma -> soft S-curve, as one LUT on luma
 *   4. colour    scale RGB by the luma ratio; pull back toward grey only if a
 *                channel would clip (keeps hue); add vibrance to flat colour
 *   5. sharpen   (separate) luma-only unsharp mask with a noise gate
 *
 * Transparent pixels (cutouts) are ignored when measuring and left untouched.
 */

export type EnhanceReport = {
  /** Luma percentiles used for levels, 0-255. */
  lo: number
  hi: number
  /** Mean luma before/after, 0-255. */
  meanBefore: number
  meanAfter: number
  /** Gamma applied to the mid-tones (<1 brightens). */
  gamma: number
  /** White balance gains actually applied. */
  gains: [number, number, number]
  /** True when the image was too flat or too empty to adjust safely. */
  skipped: boolean
}

const TARGET_MEAN = 0.46
const WB_COOL_LIMIT = 0.1
const WB_WARM_LIMIT = 0.05

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const smooth = (t: number) => t * t * (3 - 2 * t)

type Stats = {
  lo: number
  hi: number
  mean: number
  gains: [number, number, number]
  count: number
}

function measure(data: Uint8ClampedArray, width: number, height: number): Stats {
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 90000)))
  let sr = 0
  let sg = 0
  let sb = 0
  let sn = 0
  const hist = new Uint32Array(256)
  let total = 0
  let sum = 0

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 200) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const Y = luma(r, g, b)
      hist[Math.round(Y)]++
      total++
      sum += Y
      // Mid-tones only: clipped highlights and crushed shadows say nothing
      // about the light colour.
      if (Y > 38 && Y < 214) {
        sr += r
        sg += g
        sb += b
        sn++
      }
    }
  }

  if (total === 0) return { lo: 0, hi: 255, mean: 128, gains: [1, 1, 1], count: 0 }

  const pick = (frac: number) => {
    const goal = total * frac
    let acc = 0
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc >= goal) return v
    }
    return 255
  }

  let gains: [number, number, number] = [1, 1, 1]
  if (sn > total * 0.15) {
    const ar = sr / sn
    const ag = sg / sn
    const ab = sb / sn
    // Gray-world, anchored on green so overall brightness does not drift.
    let gr = ag / Math.max(ar, 1)
    let gb = ag / Math.max(ab, 1)
    // Ignore a cast under 3%: it is more likely the food than the light.
    if (Math.abs(gr - 1) < 0.03) gr = 1
    if (Math.abs(gb - 1) < 0.03) gb = 1
    // Warm (red high / blue low) is flattering; correct it less than cool.
    const limitR = gr < 1 ? WB_WARM_LIMIT : WB_COOL_LIMIT
    const limitB = gb > 1 ? WB_WARM_LIMIT : WB_COOL_LIMIT
    gains = [clamp(gr, 1 - limitR, 1 + limitR), 1, clamp(gb, 1 - limitB, 1 + limitB)]
  }

  return { lo: pick(0.005), hi: pick(0.995), mean: sum / total, gains, count: total }
}

/**
 * Enhance in place. `strength` 0 is an exact no-op; 1 is the full correction.
 */
export function autoEnhance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number,
): EnhanceReport {
  const s = clamp(strength, 0, 1)
  const blank: EnhanceReport = {
    lo: 0, hi: 255, meanBefore: 0, meanAfter: 0, gamma: 1, gains: [1, 1, 1], skipped: true,
  }
  if (s === 0) return blank

  const st = measure(data, width, height)
  if (st.count < 64) return blank

  // Gains scaled by strength (1 = identity).
  const gains: [number, number, number] = [
    1 + (st.gains[0] - 1) * s,
    1,
    1 + (st.gains[2] - 1) * s,
  ]

  // A measured range this small is a flat or near-empty frame: stretching it
  // would only amplify noise. Judge on the measurement, before any clamping.
  if (st.hi - st.lo < 40) {
    return { ...blank, lo: st.lo, hi: st.hi, meanBefore: st.mean, meanAfter: st.mean, gains }
  }

  // Levels after white balance: scale the endpoints through the gains (they
  // are within ±10%). The clamps bound how hard we stretch, not where the
  // endpoints may sit: shadows are never crushed past 46, and the white point
  // never drops below 95, which caps the stretch at about 2.7x so a night
  // photo is lifted, not turned into noon.
  const wbLuma = (Y: number) => Y * (0.2126 * gains[0] + 0.7152 + 0.0722 * gains[2])
  const lo = clamp(wbLuma(st.lo), 0, 46)
  const hi = clamp(wbLuma(st.hi), 95, 255)
  const range = hi - lo

  const tMean = clamp((wbLuma(st.mean) - lo) / range, 0.04, 0.96)
  // Gamma that would move the mean to the target, blended by strength and
  // limited: a night-time photo should look lit, not noon.
  const gammaFull = clamp(Math.log(TARGET_MEAN) / Math.log(tMean), 0.62, 1.55)
  const gamma = 1 + (gammaFull - 1) * s * 0.9

  // One LUT on luma 0..255 -> 0..255.
  const lut = new Float32Array(256)
  for (let v = 0; v < 256; v++) {
    const levelled = clamp((v - lo * s) / Math.max(1, 255 - (255 - hi) * s - lo * s), 0, 1)
    let t = Math.pow(levelled, gamma)
    // Soft S-curve, ~25% at full strength.
    t = t + 0.25 * s * (smooth(t) - t)
    // Shoulder: roll the top 12% off so highlights do not flatten to white.
    if (t > 0.88) t = 0.88 + (t - 0.88) * 0.85
    lut[v] = clamp(t, 0, 1) * 255
  }

  let sumAfter = 0
  let nAfter = 0
  const vibranceAmount = 0.32 * s

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a === 0) continue
    let r = data[i] * gains[0]
    let g = data[i + 1]
    let b = data[i + 2] * gains[2]
    const Y = luma(r, g, b)
    const Y2 = lut[clamp(Math.round(Y), 0, 255)]
    const k = Y2 / Math.max(Y, 1)
    r *= k
    g *= k
    b *= k

    // Vibrance: lift flat colour more than already-saturated colour.
    if (vibranceAmount > 0) {
      const mx = Math.max(r, g, b)
      const mn = Math.min(r, g, b)
      const sat = mx > 0 ? (mx - mn) / mx : 0
      const f = 1 + vibranceAmount * (1 - sat) * (1 - sat)
      r = Y2 + (r - Y2) * f
      g = Y2 + (g - Y2) * f
      b = Y2 + (b - Y2) * f
    }

    // Gamut clip that preserves hue: slide toward the grey of equal luma
    // just far enough to fit, instead of clamping channels independently.
    const top = Math.max(r, g, b)
    const bottom = Math.min(r, g, b)
    if (top > 255 || bottom < 0) {
      let f = 1
      if (top > 255 && top > Y2) f = Math.min(f, (255 - Y2) / (top - Y2))
      if (bottom < 0 && bottom < Y2) f = Math.min(f, Y2 / (Y2 - bottom))
      f = clamp(f, 0, 1)
      r = Y2 + (r - Y2) * f
      g = Y2 + (g - Y2) * f
      b = Y2 + (b - Y2) * f
    }

    data[i] = clamp(r, 0, 255)
    data[i + 1] = clamp(g, 0, 255)
    data[i + 2] = clamp(b, 0, 255)

    if (a > 200 && (i / 4) % 7 === 0) {
      sumAfter += Y2
      nAfter++
    }
  }

  return {
    lo, hi, gamma, gains,
    meanBefore: st.mean,
    meanAfter: nAfter ? sumAfter / nAfter : st.mean,
    skipped: false,
  }
}

/** Separable box blur of a float plane, repeated for a near-gaussian result. */
function blurPlane(src: Float32Array, width: number, height: number, radius: number, passes = 2): Float32Array {
  const win = radius * 2 + 1
  let input = src
  for (let p = 0; p < passes; p++) {
    const tmp = new Float32Array(src.length)
    const out = new Float32Array(src.length)
    // Horizontal: input -> tmp
    for (let y = 0; y < height; y++) {
      const row = y * width
      let acc = 0
      for (let x = -radius; x <= radius; x++) acc += input[row + clamp(x, 0, width - 1)]
      for (let x = 0; x < width; x++) {
        tmp[row + x] = acc / win
        acc += input[row + clamp(x + radius + 1, 0, width - 1)] - input[row + clamp(x - radius, 0, width - 1)]
      }
    }
    // Vertical: tmp -> out
    for (let x = 0; x < width; x++) {
      let acc = 0
      for (let y = -radius; y <= radius; y++) acc += tmp[clamp(y, 0, height - 1) * width + x]
      for (let y = 0; y < height; y++) {
        out[y * width + x] = acc / win
        acc += tmp[clamp(y + radius + 1, 0, height - 1) * width + x] - tmp[clamp(y - radius, 0, height - 1) * width + x]
      }
    }
    input = out
  }
  return input
}

/**
 * Luma-only unsharp mask. The detail signal is added equally to R, G and B,
 * so edges gain crispness without coloured fringes. Differences below a small
 * threshold are ignored so sensor noise and JPEG blocking are not amplified,
 * and the boost is capped so high-contrast edges do not grow halos.
 */
export function unsharpLuma(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): void {
  const k = clamp(amount, 0, 1)
  if (k === 0 || width < 8 || height < 8) return

  const n = width * height
  const Y = new Float32Array(n)
  for (let p = 0, i = 0; p < n; p++, i += 4) Y[p] = luma(data[i], data[i + 1], data[i + 2])

  // Radius scales with the image so a 1400px photo and a 400px thumbnail get
  // the same optical result.
  const radius = Math.max(1, Math.round(Math.min(width, height) / 520))
  const blur = blurPlane(Y, width, height, radius, 2)

  const gate = 2.2
  const cap = 38
  const gain = k * 1.1
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    if (data[i + 3] === 0) continue
    const d = Y[p] - blur[p]
    const ad = Math.abs(d)
    if (ad < gate) continue
    // Ease in above the gate so there is no visible threshold step.
    const eased = ad < gate * 2 ? ((ad - gate) / gate) * ad : ad
    const delta = clamp(Math.sign(d) * eased, -cap, cap) * gain
    data[i] = clamp(data[i] + delta, 0, 255)
    data[i + 1] = clamp(data[i + 1] + delta, 0, 255)
    data[i + 2] = clamp(data[i + 2] + delta, 0, 255)
  }
}
