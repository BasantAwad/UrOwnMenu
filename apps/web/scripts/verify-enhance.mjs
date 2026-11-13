/**
 * Verify src/enhance.ts on synthetic images with known properties.
 * Runs in plain Node (no browser): the module is pure.
 *
 * Usage: node scripts/verify-enhance.mjs
 */
import { autoEnhance, unsharpLuma } from '../src/enhance.ts'

let pass = 0, fail = 0
const check = (name, ok, detail = '') => { (ok ? pass++ : fail++); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : '')) }

const W = 240, H = 160
let seed = 1
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const make = (fn) => { const d = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b, a = 255] = fn(x, y); const i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a } return d }
const lumaAt = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
const stats = (d) => { let m = 0, n = 0, r = 0, g = 0, b = 0, clip = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 10) continue; m += lumaAt(d, i); r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; if (d[i] > 253 || d[i + 1] > 253 || d[i + 2] > 253) clip++ } return { mean: m / n, r: r / n, g: g / n, b: b / n, clip: clip / n } }
const hue = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return ((h * 60) + 360) % 360 }
// A scene with texture across tones: varied, not a flat ramp.
const scene = (gain = 1, cast = [1, 1, 1], noise = 6) => make((x, y) => { const base = 40 + 170 * (0.5 + 0.5 * Math.sin(x / 19) * Math.cos(y / 23)); const n = (rnd() - 0.5) * noise; return [0, 1, 2].map((c) => Math.max(0, Math.min(255, (base + n) * gain * cast[c] * (c === 0 ? 1.04 : c === 2 ? 0.92 : 1)))) })

// 1. strength 0 is a byte-exact no-op
{ const d = scene(); const c = new Uint8ClampedArray(d); autoEnhance(d, W, H, 0); unsharpLuma(d, W, H, 0); check('strength 0 is an exact no-op', c.every((v, i) => v === d[i])) }

// 2. underexposed photo is lifted toward a usable mean
{ const d = scene(0.32); const b = stats(d); const rep = autoEnhance(d, W, H, 1); const a = stats(d); check('underexposed image is brightened', a.mean > b.mean * 1.6 && a.mean > 95, `mean ${b.mean.toFixed(0)} -> ${a.mean.toFixed(0)} (gamma ${rep.gamma.toFixed(2)})`) }

// 3. a well-exposed photo is barely changed (do no harm)
{ const d = scene(1); const b = stats(d); autoEnhance(d, W, H, 1); const a = stats(d); check('well-exposed image changes modestly', Math.abs(a.mean - b.mean) < 22, `mean ${b.mean.toFixed(0)} -> ${a.mean.toFixed(0)}`) }

// 4. overexposed photo is pulled down, clipping does not grow
{ const d = scene(1.45); const b = stats(d); autoEnhance(d, W, H, 1); const a = stats(d); check('overexposed image: highlights not clipped harder', a.clip <= b.clip + 0.005, `clipped ${(b.clip * 100).toFixed(1)}% -> ${(a.clip * 100).toFixed(1)}%`) }

// 5. cool cast is reduced, and never by more than the clamp
{ const d = scene(0.9, [0.88, 1, 1.14]); const b = stats(d); const rep = autoEnhance(d, W, H, 1); const a = stats(d)
  check('cool cast is reduced', Math.abs(a.b - a.r) < Math.abs(b.b - b.r) * 0.75, `|B-R| ${Math.abs(b.b - b.r).toFixed(1)} -> ${Math.abs(a.b - a.r).toFixed(1)}`)
  check('white balance gains stay within ±10%', rep.gains.every((g) => g >= 0.899 && g <= 1.101), rep.gains.map((g) => g.toFixed(3)).join(', ')) }

// 6. a deliberately red subject keeps its hue (gray-world would turn it cyan)
{ const d = make((x, y) => { const t = 0.55 + 0.3 * Math.sin(x / 15) * Math.cos(y / 17); return [220 * t, 38 * t, 30 * t] }); const px = (d) => { let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ } return hue(r / n, g / n, b / n) }; const h0 = px(d); autoEnhance(d, W, H, 1); const h1 = px(d); const dh = Math.min(Math.abs(h1 - h0), 360 - Math.abs(h1 - h0)); check('saturated red subject keeps its hue', dh < 4, `hue ${h0.toFixed(1)}° -> ${h1.toFixed(1)}° (Δ${dh.toFixed(1)}°)`) }

// 7. transparent pixels (cutouts) are not touched or counted
{ const d = make((x, y) => x < W / 2 ? [90, 60, 40, 255] : [255, 0, 255, 0]); const c = new Uint8ClampedArray(d); autoEnhance(d, W, H, 1); let ok = true; for (let i = 0; i < d.length; i += 4) { if (c[i + 3] === 0 && (d[i] !== c[i] || d[i + 1] !== c[i + 1] || d[i + 2] !== c[i + 2] || d[i + 3] !== 0)) ok = false } check('transparent pixels are left untouched', ok) }

// 8. flat image is skipped rather than blown up
{ const d = make(() => [128, 128, 128]); const rep = autoEnhance(d, W, H, 1); const s = stats(d); check('flat image is skipped safely', rep.skipped && Math.abs(s.mean - 128) < 1) }

// 9. unsharp: step edge gets crisper, mean is preserved, flat noise is not amplified
{ const edge = make((x) => x < W / 2 ? [90, 90, 90] : [170, 170, 170]); const grad = (d) => { let m = 0; for (let x = 1; x < W; x++) m = Math.max(m, Math.abs(lumaAt(d, (80 * W + x) * 4) - lumaAt(d, (80 * W + x - 1) * 4))); return m }
  // soften first so there is something to sharpen
  // A realistic soft edge is ~4px wide; the unsharp radius scales with image size (1px at this size).
  const soft = make((x) => { const t = Math.max(0, Math.min(1, (x - W / 2 + 2) / 4)); const v = 90 + 80 * t; return [v, v, v] })
  const g0 = grad(soft), m0 = stats(soft).mean; unsharpLuma(soft, W, H, 0.8); const g1 = grad(soft), m1 = stats(soft).mean
  check('unsharp increases edge contrast', g1 > g0 * 1.15, `max step ${g0.toFixed(1)} -> ${g1.toFixed(1)}`)
  check('unsharp preserves mean brightness', Math.abs(m1 - m0) < 1.5, `${m0.toFixed(2)} -> ${m1.toFixed(2)}`)
  const noise = make(() => { const v = 128 + (rnd() - 0.5) * 3; return [v, v, v] }); const sd = (d) => { const m = stats(d).mean; let s = 0, n = 0; for (let i = 0; i < d.length; i += 4) { s += (lumaAt(d, i) - m) ** 2; n++ } return Math.sqrt(s / n) }
  const s0 = sd(noise); unsharpLuma(noise, W, H, 0.8); const s1 = sd(noise); check('unsharp noise gate: flat noise not amplified', s1 < s0 * 1.25, `σ ${s0.toFixed(2)} -> ${s1.toFixed(2)}`)
  // The detail signal must be identical on R, G and B (that is what "luma-only" means).
  const colour = make((x) => x < W / 2 ? [200, 100, 50] : [40, 60, 90]); const before = new Uint8ClampedArray(colour); unsharpLuma(colour, W, H, 1)
  let maxSpread = 0, changed = 0; for (let i = 0; i < colour.length; i += 4) { const dr = colour[i] - before[i], dg = colour[i + 1] - before[i + 1], db = colour[i + 2] - before[i + 2]; if (dr || dg || db) changed++; maxSpread = Math.max(maxSpread, Math.abs(dr - dg), Math.abs(dg - db)) }
  check('unsharp adds no coloured fringe (equal delta on R, G, B)', changed > 0 && maxSpread <= 1, `${changed} px changed, max channel spread ${maxSpread}`) }

console.log(`\n${pass}/${pass + fail} checks pass`)
process.exit(fail ? 1 : 0)
