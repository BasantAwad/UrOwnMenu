/**
 * Orchestrator: one item, stages in the fixed order from the build spec
 * (section 5). Every transition writes a manifest event; stop conditions halt
 * the item with a reason instead of guessing.
 *
 * This is the only file that knows the stage order. Agents know nothing about
 * each other, so any one of them can be replaced without touching the rest.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  ArtBrief,
  AssetSidecar,
  ChosenAsset,
  CriticResult,
  ItemAnalysis,
  LayerBrief,
  LayerPlan,
} from '../src/pipeline/contracts.ts'
import { RULES, isLiquidBased } from '../src/pipeline/rules.ts'
import { fnv1a32 } from '../src/pipeline/hash.ts'
import { planLayers } from '../src/pipeline/planner.ts'
import { capAccents, enforceSplash } from '../src/pipeline/schemas.ts'
import type { PipelineConfig } from './models.ts'
import type { DryItem } from './fixtures.ts'
import { ItemStore, sha256, type RunStatus } from './store.ts'
import { Cache } from './cache.ts'
import { SpendGuard } from './llm.ts'
import { runAnalyst, type AnalystInput } from './agents/analyst.ts'
import { runArtDirector } from './agents/art-director.ts'
import {
  candidateSource,
  downloadCandidate,
  dryItemCandidates,
  hasUsableLicence,
  keepCandidates,
  rank,
  searchOpenverse,
  searchWikimedia,
  sourcePlan,
  type Candidate,
} from './agents/scout.ts'
import { matter } from './agents/matter.ts'
import { generateCandidates, generatedSource } from './agents/generator.ts'
import { runCritic } from './agents/critic.ts'
import { renderClip, runMotion } from './agents/motion.ts'
import { gateAsset, measureAlpha } from '../src/pipeline/gate.ts'
import type { AssetMeta, LayerKind } from '../src/pipeline/contracts.ts'
import { compositeStage, decodeImage, encodePng, readPng, type Rgba } from './imaging.ts'

export type RunOptions = {
  config: PipelineConfig
  /** Folder that owns relative owner-photo paths. */
  baseDir?: string
}

export type ItemResult = {
  itemId: string
  status: RunStatus
  reason?: string
  dir: string
  generationCalls: number
  warnings: string[]
}

type LayerWithId = LayerBrief & { id: string; kind: LayerKind }

type SourceCtx = {
  item: DryItem
  store: ItemStore
  cache: Cache
  config: PipelineConfig
  guard: SpendGuard
  images: Map<string, Rgba>
  budget: { calls: number }
  baseDir: string
  /** The one lighting sentence for this item, copied into every prompt. */
  briefLight: string
}

const kindToAssetKind = (kind: LayerKind): AssetMeta['kind'] =>
  kind === 'hero' ? 'hero' : kind === 'splash' ? 'splash' : 'accent'

function layerList(brief: ArtBrief): LayerWithId[] {
  let accents = 0
  return brief.layers.map((layer) => {
    if (layer.kind === 'accent') {
      accents++
      return { ...layer, id: `accent-${accents}` }
    }
    return { ...layer, id: layer.kind }
  })
}

export async function runItem(item: DryItem, options: RunOptions): Promise<ItemResult> {
  const { config } = options
  const store = new ItemStore(config.outDir, item.id)
  await store.init()
  const cache = new Cache(store.cacheDir)
  const guard = new SpendGuard(config.maxSpendUsd, config.costPerCallUsd)
  const manifest = store.manifest

  const images = new Map<string, Rgba>()
  const budget = { calls: 0 }
  const venue = item.venue ?? { name: 'UrOwnMenu', tone: 'warm, neighbourhood' }

  const finish = async (status: RunStatus, reason?: string): Promise<ItemResult> => {
    if (reason) manifest.stop(status, reason)
    else manifest.finish(status)
    manifest.data.generationCalls = budget.calls
    await manifest.flush()
    return {
      itemId: item.id,
      status: manifest.data.status,
      reason: manifest.data.needsDecision,
      dir: store.dir,
      generationCalls: budget.calls,
      warnings: manifest.data.warnings,
    }
  }

  // ---- Stage 1: Analyst ---------------------------------------------------
  const analystInput: AnalystInput = {
    item: {
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      ingredients: item.ingredients,
      photoPath: item.photoPath ?? null,
    },
    venue,
    photoStats: item.palette ? { palette: item.palette } : null,
  }

  let analysis: ItemAnalysis
  try {
    const result = await runAnalyst(analystInput, item, config, cache)
    analysis = result.value
    manifest.note({ stage: 'analyst', result: 'ok', attempts: result.attempts, cached: result.cached })
  } catch (error) {
    manifest.note({ stage: 'analyst', result: 'failed', error: message(error) })
    return finish('failed', 'analyst-invalid')
  }
  await store.writeJson('analysis.json', analysis)

  // ---- Stage 2: Art Director ---------------------------------------------
  let brief: ArtBrief
  try {
    const result = await runArtDirector(
      {
        analysis,
        hasOwnerHeroCutout: Boolean(item.photoPath),
        stageAspects: [RULES.stages.desktop.aspect, RULES.stages.mobile.aspect],
        maxAccents: RULES.maxAccents.desktop,
        brandPalette: analysis.palette,
      },
      config,
      cache,
    )
    brief = result.value
    manifest.note({ stage: 'art-director', result: 'ok', attempts: result.attempts, cached: result.cached })
  } catch (error) {
    manifest.note({ stage: 'art-director', result: 'failed', error: message(error) })
    return finish('failed', 'art-director-invalid')
  }

  const capped = capAccents(brief, RULES.maxAccents.desktop)
  if (capped.trimmed > 0) manifest.warn(`art-director: ${capped.trimmed} accents over the cap were trimmed`)
  const liquid = isLiquidBased(item.name, analysis.hero)
  const proposedSplash = brief.layers.some((layer) => layer.kind === 'splash')
  if (proposedSplash !== liquid) {
    manifest.warn(
      `art-director: splash ${proposedSplash ? 'removed' : 'added'} by code because "${item.name}" is ${liquid ? '' : 'not '}liquid-based`,
    )
  }
  brief = enforceSplash(capped.brief, liquid, analysis)
  await store.writeJson('art-brief.json', brief)

  // ---- Stages 3-5: per layer, source -> matte -> gate ---------------------
  const layers = layerList(brief)
  const chosen = new Map<string, ChosenAsset>()
  const missing: { assetId: string; reason: string }[] = []
  let heroMissing = false

  for (const layer of layers) {
    const pick = await sourceLayer(layer, {
      item,
      store,
      cache,
      config,
      guard,
      images,
      budget,
      baseDir: options.baseDir ?? process.cwd(),
      briefLight: brief.lightSentence,
    })
    if (!pick) {
      manifest.note({ stage: 'scout', layer: layer.id, result: 'no-asset' })
      missing.push({ assetId: layer.id, reason: 'no asset passed the gate' })
      if (layer.kind === 'hero') {
        heroMissing = true
        break
      }
      continue
    }
    chosen.set(layer.id, pick)
    images.set(layer.id, await readPng(pick.path))
  }

  if (heroMissing) {
    await store.writeJson('layers.desktop.json', {
      seed: fnv1a32(item.name),
      layers: [],
      dropped: [{ assetId: 'hero', reason: 'hero-unavailable' }],
    })
    // A spend stop is a different question for the owner than "no asset
    // passed"; do not overwrite it with hero-unavailable.
    if (manifest.data.status === 'needs-review' && manifest.data.needsDecision === 'spend-limit') {
      return finish('needs-review', 'spend-limit')
    }
    return finish('needs-assets', 'hero-unavailable')
  }

  // ---- Stage 6: Composer --------------------------------------------------
  const metas = [...chosen.values()].map((asset) => asset.meta)
  let desktopPlan = planForStage(metas, 'desktop', item.name)
  let mobilePlan = planForStage(metas, 'mobile', item.name)
  desktopPlan = { ...desktopPlan, dropped: [...desktopPlan.dropped, ...missing] }
  mobilePlan = { ...mobilePlan, dropped: [...mobilePlan.dropped, ...missing] }
  await store.writeJson('layers.desktop.json', desktopPlan)
  await store.writeJson('layers.mobile.json', mobilePlan)

  // ---- Stage 7: Critic ----------------------------------------------------
  let verdict: CriticResult | null = null
  let bestPlan = desktopPlan
  let needsReview = false

  for (let run = 1; run <= RULES.criticMaxRuns; run++) {
    const stagePng = compositeStage(bestPlan, images, {
      width: 1440,
      height: Math.round(1440 / RULES.stages.desktop.aspect),
    })
    const png = encodePng(stagePng)
    const pngSha = sha256(png)
    await writeFile(path.join(store.cacheDir, `stage-${run}.png`), png)

    try {
      const result = await runCritic(
        { png, pngSha256: pngSha, brief, plan: bestPlan, run },
        item,
        config,
        cache,
        guard,
      )
      verdict = result.value
    } catch (error) {
      manifest.note({ stage: 'critic', run, result: 'failed', error: message(error) })
      return finish('needs-review', 'critic-failed')
    }
    await store.writeJson(`critic-${run}.json`, verdict)
    manifest.note({ stage: 'critic', run, verdict: verdict.verdict })

    if (verdict.verdict === 'pass') break
    if (run === RULES.criticMaxRuns) {
      needsReview = true
      break
    }

    if (verdict.verdict === 'fix') {
      bestPlan = applyFixes(bestPlan, verdict, manifest)
      await store.writeJson('layers.desktop.json', bestPlan)
      continue
    }

    // regenerate: re-source the flagged layers once, then review again
    const flagged = new Set(verdict.findings.filter((f) => f.action === 'regenerate').map((f) => f.layerId))
    for (const layerId of flagged) {
      const layer = layers.find((candidate) => candidate.id === layerId)
      if (!layer) continue
      const pick = await sourceLayer(layer, {
        item,
        store,
        cache,
        config,
        guard,
        images,
        budget,
        baseDir: options.baseDir ?? process.cwd(),
        briefLight: brief.lightSentence,
      })
      if (!pick) {
        manifest.note({ stage: 'scout', layer: layerId, result: 'regenerate-failed' })
        continue
      }
      chosen.set(layerId, pick)
      images.set(layerId, await readPng(pick.path))
    }
    bestPlan = planForStage([...chosen.values()].map((asset) => asset.meta), 'desktop', item.name)
    await store.writeJson('layers.desktop.json', bestPlan)
  }

  if (needsReview) {
    return finish('needs-review', 'critic-did-not-pass')
  }

  // ---- Stage 8: Motion (homepage hero only) ------------------------------
  if (item.homepageHero) {
    try {
      const motion = await runMotion({ analysis, brief, item }, config, cache, guard)
      store.manifest.note({ stage: 'motion', result: 'ok', attempts: motion.attempts, cached: motion.cached })
      const clip = await renderClip(motion.value, store.scrubDir, config)
      store.manifest.note({ stage: 'motion', result: 'clip', raw: path.basename(clip.rawPath), scrub: path.basename(clip.scrubPath) })
    } catch (error) {
      manifest.warn(`motion: ${message(error)}`)
    }
  }

  if (!verdict || verdict.verdict !== 'pass') {
    return finish('needs-review', 'no-passing-verdict')
  }
  return finish('done')
}

// ---------------------------------------------------------------------------

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function planForStage(metas: AssetMeta[], stage: 'desktop' | 'mobile', name: string): LayerPlan {
  const maxAccents = RULES.maxAccents[stage]
  let accents = 0
  const kept = metas.filter((meta) => {
    if (meta.kind !== 'accent' && meta.kind !== 'ingredient') return true
    accents++
    return accents <= maxAccents
  })
  const dropped = metas
    .filter((meta) => !kept.includes(meta))
    .map((meta) => ({ assetId: meta.id, reason: `accent cap for the ${stage} stage (${maxAccents})` }))
  const plan = planLayers(kept, RULES.stages[stage], fnv1a32(name))
  return { ...plan, dropped: [...plan.dropped, ...dropped] }
}

/**
 * Apply a fix verdict inside the bounds from build spec section 5:
 * x/y at most 0.05, scale at most 15%, blur at most 4px. A layer that would
 * need more becomes a regenerate finding and is not moved.
 */
export function applyFixes(plan: LayerPlan, verdict: CriticResult, manifest: { warn(message: string): void }): LayerPlan {
  const copyZone = RULES.stages.desktop.copyZone
  const layers = plan.layers.map((layer) => ({ ...layer }))
  for (const finding of verdict.findings) {
    if (finding.action !== 'fix') continue
    const layer = layers.find((candidate) => candidate.assetId === finding.layerId)
    if (!layer) {
      manifest.warn(`critic: finding references unknown layer ${finding.layerId}`)
      continue
    }
    if (finding.check === 4) {
      // Push away from the copy zone's centre, bounded.
      const cx = copyZone.x + copyZone.w / 2
      const cy = copyZone.y + copyZone.h / 2
      const dx = layer.x - cx
      const dy = layer.y - cy
      const length = Math.hypot(dx, dy) || 1
      layer.x = clamp01(layer.x + (dx / length) * 0.02)
      layer.y = clamp01(layer.y + (dy / length) * 0.02)
      // Bounds from spec section 5: at most 4px of blur in total.
      layer.blurPx = Math.min(layer.blurPx + 1, 4)
    } else {
      layer.scale = layer.scale * 0.95
      layer.blurPx = Math.min(layer.blurPx + 2, 4)
    }
  }
  return { ...plan, layers }
}

const clamp01 = (value: number): number => Math.min(0.97, Math.max(0.03, value))

/** Source, matte and gate one layer. Returns the first candidate that passes. */
async function sourceLayer(layer: LayerWithId, ctx: SourceCtx): Promise<ChosenAsset | null> {
  const { item, store, cache, config, guard, budget } = ctx
  const manifest = store.manifest
  const sources = sourcePlan(layer.kind, Boolean(item.photoPath) && layer.kind === 'hero')

  for (const source of sources) {
    if (source === 'generate') {
      for (let round = 1; round <= RULES.generationRoundsPerLayer; round++) {
        if (budget.calls >= RULES.generationBudgetPerItem) {
          manifest.note({ stage: 'generate', layer: layer.id, result: 'budget-exhausted' })
          break
        }
        if (!guard.canSpend()) {
          manifest.stop('needs-review', 'spend-limit')
          return null
        }
        let generated
        try {
          generated = await generateCandidates(item.id, layer, ctx.briefLight, round, config, cache)
        } catch (error) {
          manifest.note({ stage: 'generate', layer: layer.id, round, result: 'failed', error: message(error) })
          guard.charge()
          continue
        }
        for (const candidate of generated) {
          if (budget.calls >= RULES.generationBudgetPerItem) break
          budget.calls++
          guard.charge()
          const candidateId = `${layer.id}-gen-${round}-${candidate.index}`
          const matte = await matter(candidate.image, sha256(Buffer.from(candidate.image.data.buffer)), config, cache, {
            simulateEmptyMatte: config.dryRun && shouldSimulateEmpty(item, layer),
          })
          if (matte.empty) {
            manifest.note({ stage: 'generate', layer: layer.id, round, seed: candidate.seed, result: 'empty-matte' })
            continue
          }
          const meta = measure(layer, matte.image, candidateId)
          const gate = gateAsset(meta)
          manifest.note({
            stage: 'generate',
            layer: layer.id,
            round,
            seed: candidate.seed,
            candidateId,
            gate,
          })
          if (gate.ok) {
            const source = generatedSource(candidate, item.id)
            return await storeChosen(layer, meta, gate, matte.image, source, ctx)
          }
        }
      }
      continue
    }

    let candidates: Candidate[]
    try {
      candidates = await findCandidates(source, layer.assetLabel, item, config)
    } catch (error) {
      manifest.note({ stage: 'scout', layer: layer.id, source, result: 'search-failed', error: message(error) })
      continue
    }
    const ranked = rank(keepCandidates(candidates)).slice(0, RULES.scoutDownloadTopN)

    for (const candidate of ranked) {
      if (!hasUsableLicence(candidate) && candidate.source !== 'owner-photo') {
        manifest.note({ stage: 'scout', layer: layer.id, source, candidateId: candidate.id, result: 'no-licence' })
        continue
      }
      let downloaded
      try {
        if (candidate.source === 'owner-photo' && !config.dryRun) {
          const file = path.isAbsolute(candidate.url) ? candidate.url : path.join(ctx.baseDir, candidate.url)
          const bytes = await readFile(file)
          downloaded = { image: await decodeImage(bytes), sha256: sha256(bytes) }
        } else {
          downloaded = await downloadCandidate(candidate, cache, { dryRun: config.dryRun, itemId: item.id })
        }
      } catch (error) {
        manifest.note({ stage: 'scout', layer: layer.id, source, candidateId: candidate.id, result: 'download-failed', error: message(error) })
        continue
      }
      const matte = await matter(downloaded.image, downloaded.sha256, config, cache, {
        simulateEmptyMatte: config.dryRun && shouldSimulateEmpty(item, layer),
      })
      if (matte.empty) {
        manifest.note({ stage: 'scout', layer: layer.id, source, candidateId: candidate.id, result: 'empty-matte' })
        continue
      }
      const meta = measure(layer, matte.image, candidate.id)
      const gate = gateAsset(meta)
      manifest.note({ stage: 'scout', layer: layer.id, source, candidateId: candidate.id, gate })
      if (gate.ok) {
        return await storeChosen(layer, meta, gate, matte.image, candidateSource(candidate), ctx)
      }
    }
  }
  return null
}

function shouldSimulateEmpty(item: DryItem, layer: LayerWithId): boolean {
  if (item.simulate?.failEveryCandidate) return true
  return Boolean(item.simulate?.emptyMatteFor?.some((label) => label.toLowerCase() === layer.assetLabel.toLowerCase()))
}

async function findCandidates(
  source: 'owner-photo' | 'openverse' | 'wikimedia',
  label: string,
  item: DryItem,
  config: PipelineConfig,
): Promise<Candidate[]> {
  if (source === 'owner-photo') {
    return [
      {
        id: 'owner-photo',
        source: 'owner-photo',
        title: item.photoPath ?? 'owner photo',
        tags: [],
        url: item.photoPath ?? '',
        width: 1600,
        height: 1200,
        filetype: 'jpg',
        licence: 'owner-supplied',
        licenceUrl: null,
        creator: 'owner',
        sourceUrl: null,
      },
    ]
  }
  if (config.dryRun) {
    if (item.simulate?.failEveryCandidate) return []
    if (item.simulate?.failSourceFor?.some((value) => value.toLowerCase() === label.toLowerCase())) return []
    return dryItemCandidates(item, label)
  }
  return source === 'openverse' ? searchOpenverse(label) : searchWikimedia(label)
}

function measure(layer: LayerWithId, image: Rgba, id: string): AssetMeta {
  const measured = measureAlpha(image.data, image.width, image.height)
  return {
    id,
    kind: kindToAssetKind(layer.kind),
    width: image.width,
    height: image.height,
    alphaCoverage: measured.alphaCoverage,
    touchesEdge: measured.touchesEdge,
    sharpness: measured.sharpness,
    intentionalBlur: layer.intentionalBlur,
  }
}

async function storeChosen(
  layer: LayerWithId,
  meta: AssetMeta,
  gate: { ok: boolean; reasons: string[] },
  image: Rgba,
  source: ChosenAsset['source'],
  ctx: SourceCtx,
): Promise<ChosenAsset> {
  // The composer addresses layers by `meta.id`, and the sidecar must agree.
  meta.id = layer.id
  const sidecar: AssetSidecar = {
    id: layer.id,
    kind: meta.kind,
    meta,
    gate: gate as AssetSidecar['gate'],
    source,
    createdAt: new Date().toISOString(),
  }
  await ctx.store.writeAsset(layer.id, image, sidecar)
  return { layer, meta, path: ctx.store.assetPath(layer.id), source }
}
