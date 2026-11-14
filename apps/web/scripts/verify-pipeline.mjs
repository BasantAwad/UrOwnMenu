/**
 * Checks for the deterministic pipeline core (planner + gate).
 *   node --experimental-strip-types scripts/verify-pipeline.mjs
 * Each check builds its own input and asserts on the output, so a check that
 * cannot fail is caught by breaking the code on purpose.
 */
import assert from 'node:assert/strict'
import { planLayers, rng } from '../src/pipeline/planner.ts'
import { gateAsset, measureAlpha } from '../src/pipeline/gate.ts'

let passed = 0
const check = (name, fn) => {
  try {
    fn()
    passed++
    console.log('ok  ', name)
  } catch (e) {
    console.log('FAIL', name, '\n     ', e.message)
    process.exitCode = 1
  }
}

const meta = (id, kind, extra = {}) => ({
  id, kind, width: 1000, height: 1000, alphaCoverage: 0.2,
  touchesEdge: false, sharpness: 0.6, intentionalBlur: false, ...extra,
})

const stage = { aspect: 16 / 10, copyZone: { x: 0.04, y: 0.2, w: 0.36, h: 0.6 } }
const assets = [
  meta('hero', 'hero'),
  meta('splash', 'splash', { alphaCoverage: 0.5 }),
  ...Array.from({ length: 7 }, (_, i) => meta('ing-' + i, 'ingredient')),
]

check('rng is deterministic for a seed and differs across seeds', () => {
  const a = rng(42)
  const b = rng(42)
  const c = rng(43)
  const seqA = [a(), a(), a()]
  assert.deepEqual(seqA, [b(), b(), b()])
  assert.notDeepEqual(seqA, [c(), c(), c()])
})

check('same seed gives an identical layer plan', () => {
  assert.deepEqual(planLayers(assets, stage, 7), planLayers(assets, stage, 7))
})

check('a different seed changes the arrangement', () => {
  const p = planLayers(assets, stage, 7).layers.map((l) => l.x)
  const q = planLayers(assets, stage, 8).layers.map((l) => l.x)
  assert.notDeepEqual(p, q)
})

check('no accent centre sits inside the copy zone', () => {
  const plan = planLayers(assets, stage, 7)
  const z = stage.copyZone
  for (const l of plan.layers.filter((l) => l.kind === 'ingredient')) {
    const inside = l.x > z.x && l.x < z.x + z.w && l.y > z.y && l.y < z.y + z.h
    assert.equal(inside, false, `${l.assetId} centre (${l.x.toFixed(2)}, ${l.y.toFixed(2)}) is in the copy zone`)
  }
})

check('layers draw back to front: splash, then hero, then accents by depth', () => {
  const layers = planLayers(assets, stage, 7).layers
  const zs = layers.map((l) => l.z)
  assert.deepEqual(zs, [...zs].sort((p, q) => p - q))
  assert.equal(layers[0].kind, 'splash')
  assert.equal(layers[1].kind, 'hero')
})

check('nearer accents are larger, more defocused and faster than farther ones', () => {
  const accents = planLayers(assets, stage, 7).layers.filter((l) => l.kind === 'ingredient')
  const near = accents.reduce((a, b) => (a.depth > b.depth ? a : b))
  const far = accents.reduce((a, b) => (a.depth < b.depth ? a : b))
  assert.ok(near.scale > far.scale, 'near should be larger')
  assert.ok(near.parallax > far.parallax, 'near should move faster')
  assert.ok(near.blurPx >= far.blurPx, 'near should be at least as defocused')
  assert.equal(far.blurPx, 0, 'far layers stay sharp')
})

check('the planner reports what it could not place instead of silently dropping', () => {
  const crowd = Array.from({ length: 40 }, (_, i) => meta('c' + i, 'ingredient'))
  const plan = planLayers([meta('hero', 'hero'), ...crowd], stage, 3)
  assert.equal(plan.layers.length + plan.dropped.length, 41)
  assert.ok(plan.dropped.length > 0, 'forty accents should not all fit')
})

check('gate rejects a too-small hero and passes a good ingredient', () => {
  assert.ok(gateAsset(meta('h', 'hero', { width: 500, height: 500 })).reasons.includes('too-small'))
  assert.deepEqual(gateAsset(meta('i', 'ingredient')), { ok: true, reasons: [] })
})

check('gate rejects a full-frame photo, a dirty matte and a soft hero', () => {
  assert.ok(gateAsset(meta('f', 'ingredient', { alphaCoverage: 0.97 })).reasons.includes('no-cutout'))
  assert.ok(gateAsset(meta('d', 'ingredient', { touchesEdge: true })).reasons.includes('dirty-edge'))
  assert.ok(gateAsset(meta('s', 'hero', { sharpness: 0.05 })).reasons.includes('soft-focus'))
})

check('gate allows deliberate motion blur on accents', () => {
  assert.equal(gateAsset(meta('m', 'accent', { sharpness: 0.05, intentionalBlur: true })).ok, true)
})

const solid = (w, h, fill) => {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let p = 0; p < w * h; p++) {
    d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = fill
    d[p * 4 + 3] = 255
  }
  return d
}

check('measureAlpha: a full opaque frame touches the edge and fills the frame', () => {
  const m = measureAlpha(solid(32, 32, 120), 32, 32)
  assert.equal(m.alphaCoverage, 1)
  assert.equal(m.touchesEdge, true)
})

check('measureAlpha: a centred blob does not touch the edge', () => {
  const w = 32
  const d = new Uint8ClampedArray(w * w * 4)
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const inside = Math.hypot(x - 16, y - 16) < 8
    d[(y * w + x) * 4 + 3] = inside ? 255 : 0
  }
  const m = measureAlpha(d, w, w)
  assert.equal(m.touchesEdge, false)
  assert.ok(m.alphaCoverage > 0.1 && m.alphaCoverage < 0.5, `coverage ${m.alphaCoverage}`)
})

check('measureAlpha: a checkerboard is sharper than a flat fill', () => {
  const w = 32
  const checker = solid(w, w, 0)
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const v = (x + y) % 2 ? 255 : 0
    const p = (y * w + x) * 4
    checker[p] = checker[p + 1] = checker[p + 2] = v
  }
  const flat = measureAlpha(solid(w, w, 120), w, w)
  const sharp = measureAlpha(checker, w, w)
  assert.ok(sharp.sharpness > flat.sharpness + 0.5, `${sharp.sharpness} vs ${flat.sharpness}`)
})

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`)
