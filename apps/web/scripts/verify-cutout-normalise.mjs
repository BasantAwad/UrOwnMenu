/**
 * Verify the cutout normaliser against synthetic mattes.
 *
 * The bug this guards: background removal returns the input canvas, so a
 * rectangle stays a rectangle with the subject small and off-centre inside a
 * field of transparent pixels. `normaliseCutout` must trim, rescale, recentre
 * and pad, and must leave an opaque photograph untouched.
 *
 * Usage: node scripts/verify-cutout-normalise.mjs
 */
import { chromium } from 'playwright'

const WEB = process.env.WEB_BASE || 'http://localhost:5173'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(WEB, { waitUntil: 'domcontentloaded' })

const result = await page.evaluate(async () => {
  const mod = await import('/src/media-intelligence.ts')

  function makeCanvas(w, h) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }

  // An off-centre, irregular subject on a tall rectangle: exactly what a
  // segmentation model hands back for a framed product photo.
  const source = makeCanvas(900, 1200)
  const ctx = source.getContext('2d')
  ctx.fillStyle = 'rgba(0,0,0,0)'
  ctx.clearRect(0, 0, 900, 1200)
  ctx.fillStyle = '#b4512f'
  // Body of the dish.
  ctx.beginPath()
  ctx.ellipse(620, 780, 150, 96, 0.2, 0, Math.PI * 2)
  ctx.fill()
  // A handle, so the alpha centroid differs from the bounding-box centre.
  ctx.beginPath()
  ctx.ellipse(760, 700, 44, 60, -0.5, 0, Math.PI * 2)
  ctx.fill()

  const { canvas, meta } = mod.normaliseCutout(source, { targetRatio: 1, fill: 0.9 })
  const out = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data

  // Recompute the alpha bounds of the output.
  let left = canvas.width, top = canvas.height, right = -1, bottom = -1
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (out[(y * canvas.width + x) * 4 + 3] <= 12) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }

  const boundsW = (right - left + 1) / canvas.width
  const boundsH = (bottom - top + 1) / canvas.height
  const centreX = (left + right + 1) / 2 / canvas.width
  const centreY = (top + bottom + 1) / 2 / canvas.height
  const fill = Math.max(boundsW, boundsH)

  // An opaque photo must pass through untouched.
  const photo = makeCanvas(640, 480)
  const pctx = photo.getContext('2d')
  pctx.fillStyle = '#8a6a4a'
  pctx.fillRect(0, 0, 640, 480)
  const photoResult = mod.normaliseCutout(photo, { targetRatio: 1, fill: 0.9 })

  return {
    source: { w: source.width, h: source.height },
    output: { w: canvas.width, h: canvas.height, ratio: canvas.width / canvas.height },
    boundsW: Math.round(boundsW * 1000) / 1000,
    boundsH: Math.round(boundsH * 1000) / 1000,
    fill: Math.round(fill * 1000) / 1000,
    centreX: Math.round(centreX * 1000) / 1000,
    centreY: Math.round(centreY * 1000) / 1000,
    meta,
    opaqueUntouched: {
      sameCanvas: photoResult.canvas === photo,
      coverage: photoResult.meta.coverage,
      treatment: photoResult.meta.treatment,
    },
  }
})

const checks = [
  ['output is square', Math.abs(result.output.ratio - 1) < 0.02],
  ['subject fills ~90%', result.fill >= 0.86 && result.fill <= 0.94],
  ['subject is horizontally centred', Math.abs(result.centreX - 0.5) <= 0.025],
  ['subject is vertically centred', Math.abs(result.centreY - 0.5) <= 0.025],
  ['no transparent margin collapse', result.boundsW > 0.8],
  ['meta marks the file as contain', result.meta.treatment === 'contain'],
  ['meta records subject bounds', Boolean(result.meta.subject)],
  ['opaque photo is left untouched', result.opaqueUntouched.sameCanvas === true],
]

console.log(JSON.stringify(result, null, 2))
console.log('')
let failed = 0
for (const [label, ok] of checks) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + label)
  if (!ok) failed++
}
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks passed')

await browser.close()
process.exit(failed === 0 ? 0 : 1)
