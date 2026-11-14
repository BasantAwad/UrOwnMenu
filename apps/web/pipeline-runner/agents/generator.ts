/**
 * Generator: render four candidates for a layer that no source could satisfy
 * (build spec 3.4). The prompt is built here, not by a model. Seeds are
 * deterministic, so a rerun requests the same four images.
 */
import type { LayerBrief } from '../../src/pipeline/contracts.ts'
import { RULES } from '../../src/pipeline/rules.ts'
import { fnv1a32 } from '../../src/pipeline/hash.ts'
import { generateKeyPayload } from '../../src/pipeline/cache.ts'
import type { PipelineConfig } from '../models.ts'
import { requireLicensed } from '../models.ts'
import type { Cache } from '../cache.ts'
import type { Rgba } from '../imaging.ts'
import { decodeImage, syntheticCutout } from '../imaging.ts'

export type GeneratedCandidate = {
  index: number
  seed: number
  prompt: string
  image: Rgba
  model: string
  modelLicence: string
}

const SPLASH_SIZE = { width: 1024, height: 768 }
const SQUARE_SIZE = { width: 1024, height: 1024 }

export function buildPrompt(layer: LayerBrief, lightSentence: string): string {
  return `${layer.visual}, ${lightSentence}, isolated on a plain white background, sharp focus, studio product photography, realistic, ${layer.negative}`
}

export function generationSeed(itemId: string, layer: LayerBrief, round: number, index: number): number {
  return fnv1a32(`${itemId}|${layer.kind}|${layer.assetLabel}|${round}|${index}`)
}

export async function generateCandidates(
  itemId: string,
  layer: LayerBrief,
  lightSentence: string,
  round: number,
  config: PipelineConfig,
  cache: Cache,
): Promise<GeneratedCandidate[]> {
  const prompt = buildPrompt(layer, lightSentence)
  const size = layer.kind === 'splash' ? SPLASH_SIZE : SQUARE_SIZE
  const entry = config.dryRun ? config.models.generate : requireLicensed(config, 'generate')
  const out: GeneratedCandidate[] = []

  for (let index = 0; index < RULES.generationCandidatesPerCall; index++) {
    const seed = generationSeed(itemId, layer, round, index)
    if (config.dryRun) {
      out.push({
        index,
        seed,
        prompt,
        image: syntheticCutout({
          width: size.width,
          height: size.height,
          seed,
          coverage: layer.kind === 'splash' ? 0.42 : 0.33,
        }),
        model: entry.id,
        modelLicence: entry.licence,
      })
      continue
    }

    const key = cache.key(generateKeyPayload(prompt, entry.id, seed, size.width, size.height))
    const cached = await cache.readBytes(key, 'png')
    if (cached) {
      out.push({ index, seed, prompt, image: await decodeImage(cached), model: entry.id, modelLicence: entry.licence })
      continue
    }
    if (!config.genUrl) throw new Error('PIPELINE_GEN_URL is not set')
    const response = await fetch(config.genUrl.replace(/\/$/, '') + '/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: entry.id,
        prompt,
        negative_prompt: layer.negative,
        width: size.width,
        height: size.height,
        steps: entry.steps ?? 28,
        n: 1,
        seed,
      }),
    })
    if (!response.ok) throw new Error(`generate-http-${response.status}`)
    const json = (await response.json()) as { images?: string[]; image?: string }
    const b64 = json.images?.[0] ?? json.image
    if (!b64) throw new Error('generate-empty-response')
    const bytes = Buffer.from(b64, 'base64')
    await cache.writeBytes(key, bytes, 'png')
    out.push({ index, seed, prompt, image: await decodeImage(bytes), model: entry.id, modelLicence: entry.licence })
  }
  return out
}

/** Source fields for the sidecar. Generated images have no human creator. */
export function generatedSource(candidate: GeneratedCandidate, itemId: string) {
  return {
    source: 'generate' as const,
    sourceId: `${itemId}|${candidate.seed}`,
    creator: null,
    licence: candidate.modelLicence,
    licenceUrl: null,
    sourceUrl: null,
    model: candidate.model,
    modelLicence: candidate.modelLicence,
    prompt: candidate.prompt,
    seed: candidate.seed,
  }
}
