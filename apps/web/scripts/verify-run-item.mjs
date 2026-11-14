/**
 * Integration checks for the whole pipeline in dry-run mode (build spec 10.3).
 *   node --experimental-strip-types scripts/verify-run-item.mjs
 *
 * Each use case from section 4 runs as one case, asserts on its status and the
 * files it must leave behind, and reads the manifest rather than trusting the
 * return value alone.
 */
import assert from 'node:assert/strict'
import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../pipeline-runner/models.ts'
import { runItem } from '../pipeline-runner/run-item.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WEB = path.join(HERE, '..')
const OUT = path.join(WEB, 'pipeline-out', 'verify-run')

let passed = 0
const check = async (name, fn) => {
  try {
    await fn()
    passed++
    console.log('ok  ', name)
  } catch (error) {
    console.log('FAIL', name, '\n     ', error.message)
    process.exitCode = 1
  }
}

const all = JSON.parse(await readFile(path.join(WEB, 'harness', 'pipeline-fixtures', 'items', 'use-cases.json'), 'utf8'))
const byId = (id) => {
  const item = all.find((candidate) => candidate.id === id)
  if (!item) throw new Error('missing fixture ' + id)
  return item
}

const readJson = async (dir, name) => JSON.parse(await readFile(path.join(dir, name), 'utf8'))
const exists = async (file) => {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })
const config = await loadConfig({ dryRun: true, outDir: OUT })

const run = (id) => runItem(byId(id), { config, baseDir: path.join(WEB, 'harness', 'pipeline-fixtures') })

const layerIds = (brief) =>
  brief.layers.map((layer) => (layer.kind === 'accent' ? null : layer.kind))

const plannedOrDropped = (plan, brief) => {
  const placed = new Set(plan.layers.map((layer) => layer.assetId))
  const dropped = new Set(plan.dropped.map((entry) => entry.assetId))
  let accent = 0
  for (const layer of brief.layers) {
    const id = layer.kind === 'accent' ? `accent-${++accent}` : layer.kind
    assert.ok(placed.has(id) || dropped.has(id), `${id} is neither placed nor reported as dropped`)
  }
}

// ---- 4.1 strawberry yogurt bowl -------------------------------------------
let bowlDir
let bowlResult
await check('4.1 strawberry yogurt bowl: done, owner hero, fix then pass', async () => {
  const result = await run('item_0142')
  bowlResult = result
  bowlDir = result.dir
  assert.equal(result.status, 'done', result.reason)
  const analysis = await readJson(bowlDir, 'analysis.json')
  assert.equal(analysis.mood, 'fresh')
  assert.ok(analysis.hero.length > 0)

  const hero = await readJson(path.join(bowlDir, 'assets'), 'hero.meta.json')
  assert.equal(hero.source.source, 'owner-photo')
  assert.equal(hero.gate.ok, true)

  const manifest = await readJson(bowlDir, 'manifest.json')
  assert.equal(manifest.events.some((event) => event.stage === 'generate' && event.layer === 'hero'), false)
  const criticRuns = manifest.events.filter((event) => event.stage === 'critic')
  assert.deepEqual(criticRuns.map((event) => event.verdict), ['fix', 'pass'])

  const brief = await readJson(bowlDir, 'art-brief.json')
  const plan = await readJson(bowlDir, 'layers.desktop.json')
  plannedOrDropped(plan, brief)
  assert.ok(manifest.events.some((event) => event.stage === 'scout' && event.gate), 'gate results must be recorded')
})

// ---- 4.2 crispy fries ------------------------------------------------------
await check('4.2 crispy fries: hero is visually distinct from the accents', async () => {
  const result = await run('item_fries')
  assert.equal(result.status, 'done', result.reason)
  const brief = await readJson(result.dir, 'art-brief.json')
  const hero = brief.layers.find((layer) => layer.kind === 'hero')
  const accents = brief.layers.filter((layer) => layer.kind === 'accent')
  assert.ok(accents.every((accent) => /single/.test(accent.visual)))
  assert.ok(!accents.some((accent) => accent.visual === hero.visual))
})

// ---- 4.3 caesar salad ------------------------------------------------------
await check('4.3 caesar salad: no splash, four accents capped correctly', async () => {
  const result = await run('item_caesar')
  assert.equal(result.status, 'done', result.reason)
  const brief = await readJson(result.dir, 'art-brief.json')
  assert.equal(brief.layers.some((layer) => layer.kind === 'splash'), false)
  assert.equal(brief.layers.filter((layer) => layer.kind === 'accent').length, 4)
  const plan = await readJson(result.dir, 'layers.desktop.json')
  plannedOrDropped(plan, brief)
})

// ---- 4.4 empty ingredient list --------------------------------------------
await check('4.4 house lemonade: empty ingredients stay empty, no accents', async () => {
  const result = await run('item_lemonade')
  assert.equal(result.status, 'done', result.reason)
  const analysis = await readJson(result.dir, 'analysis.json')
  assert.deepEqual(analysis.ingredients, [])
  const brief = await readJson(result.dir, 'art-brief.json')
  assert.equal(brief.layers.filter((layer) => layer.kind === 'accent').length, 0)
  assert.equal(brief.layers.some((layer) => layer.kind === 'splash'), true)
  const plan = await readJson(result.dir, 'layers.desktop.json')
  assert.ok(plan.layers.length >= 1 && plan.layers.length <= 2, `got ${plan.layers.length} layers`)
})

// ---- 4.5 owner photo passes as the hero -----------------------------------
await check('4.5 owner photo: hero comes from the owner, no generation for it', async () => {
  const result = await run('item_owner')
  assert.equal(result.status, 'done', result.reason)
  const hero = await readJson(path.join(result.dir, 'assets'), 'hero.meta.json')
  assert.equal(hero.source.source, 'owner-photo')
  assert.ok(hero.meta.width >= 800, `hero short edge ${hero.meta.width}`)
  const manifest = await readJson(result.dir, 'manifest.json')
  assert.equal(manifest.events.some((event) => event.stage === 'generate' && event.layer === 'hero'), false)
})

// ---- 4.6 falling-leaves accent set ---------------------------------------
await check('4.6 falling accents: deliberate blur is allowed and recorded', async () => {
  const result = await run('item_green')
  assert.equal(result.status, 'done', result.reason)
  const brief = await readJson(result.dir, 'art-brief.json')
  const accents = brief.layers.filter((layer) => layer.kind === 'accent')
  assert.ok(accents.length > 0)
  assert.ok(accents.every((accent) => accent.intentionalBlur === true))
  const manifest = await readJson(result.dir, 'manifest.json')
  assert.ok(manifest.events.some((event) => event.stage === 'generate' || event.stage === 'scout'))
})

// ---- 4.7 nothing passes ----------------------------------------------------
await check('4.7 mystery tart: needs-assets, no hero, generation budget spent', async () => {
  const result = await run('item_mystery')
  assert.equal(result.status, 'needs-assets')
  assert.equal(result.reason, 'hero-unavailable')
  assert.equal(result.generationCalls, 12, `budget should be 12, got ${result.generationCalls}`)
  assert.equal(await exists(path.join(result.dir, 'assets', 'hero.png')), false)
  const plan = await readJson(result.dir, 'layers.desktop.json')
  assert.equal(plan.layers.length, 0)
})

// ---- 4.8 homepage hero clip ----------------------------------------------
await check('4.8 homepage hero: scrub clip exists and is a real MP4', async () => {
  const clip = path.join(bowlDir, 'scrub', 'scrub.mp4')
  assert.equal(await exists(clip), true)
  const bytes = await readFile(clip)
  assert.ok(bytes.length > 1000, `clip is ${bytes.length} bytes`)
  assert.equal(bytes.subarray(4, 8).toString('ascii'), 'ftyp')
})

// ---- 10.3 idempotency ------------------------------------------------------
await check('running 4.1 twice produces byte-identical layer plans', async () => {
  const OUT2 = path.join(WEB, 'pipeline-out', 'verify-run-2')
  await rm(OUT2, { recursive: true, force: true })
  const config2 = await loadConfig({ dryRun: true, outDir: OUT2 })
  const second = await runItem(byId('item_0142'), { config: config2, baseDir: path.join(WEB, 'harness', 'pipeline-fixtures') })
  assert.equal(second.status, 'done')
  const a = await readFile(path.join(bowlDir, 'layers.desktop.json'), 'utf8')
  const b = await readFile(path.join(second.dir, 'layers.desktop.json'), 'utf8')
  assert.equal(a, b)
})

// ---- section 13: licence refusal before any model call --------------------
await check('a real run stops with model-licence-unverified and calls no model', async () => {
  const OUT3 = path.join(WEB, 'pipeline-out', 'verify-run-licence')
  await rm(OUT3, { recursive: true, force: true })
  const real = await loadConfig({ dryRun: false, outDir: OUT3 })
  const unverified = Object.fromEntries(
    Object.entries(real.models).map(([role, entry]) => [
      role,
      { ...entry, licence: 'unverified', commercialOk: false, checkedOn: null },
    ]),
  )
  const result = await runItem(byId('item_fries'), {
    config: { ...real, models: unverified },
    baseDir: path.join(WEB, 'harness', 'pipeline-fixtures'),
  })
  assert.equal(result.status, 'needs-review')
  assert.equal(result.reason, 'model-licence-unverified')
  assert.equal(result.generationCalls, 0)
  const manifest = await readJson(result.dir, 'manifest.json')
  assert.equal(manifest.events.some((event) => event.stage === 'analyst'), false)
  assert.ok(manifest.events.some((event) => event.stage === 'licence' && event.result === 'refused'))
})

// ---- section 5: fixes stay inside the written bounds -----------------------
await check('applyFixes never moves x/y >0.05, scale >15% or blur >4px', async () => {
  const { applyFixes } = await import('../pipeline-runner/run-item.ts')
  const plan = {
    seed: 3,
    dropped: [],
    layers: [
      { assetId: 'accent-1', kind: 'accent', x: 0.5, y: 0.5, scale: 0.6, rotation: 0, depth: 0.4, blurPx: 3, parallax: 0.5, z: 30 },
    ],
  }
  const verdict = {
    verdict: 'fix',
    checks: [{ n: 4, ok: false, reason: 'on the copy' }],
    findings: [{ layerId: 'accent-1', check: 4, problem: 'on the copy', action: 'fix' }],
  }
  const fixed = applyFixes(plan, verdict, { warn: () => {} })
  const layer = fixed.layers[0]
  assert.ok(Math.abs(layer.x - 0.5) <= 0.05 + 1e-9)
  assert.ok(Math.abs(layer.y - 0.5) <= 0.05 + 1e-9)
  assert.ok(layer.scale >= 0.6 * 0.85 - 1e-9)
  assert.ok(layer.blurPx <= 4)
})

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`)
process.exit(process.exitCode ?? 0)
