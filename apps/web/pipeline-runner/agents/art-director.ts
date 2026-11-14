/** Art Director agent: analysis in, a validated ArtBrief out (capped by code). */
import type { ArtBrief, ItemAnalysis } from '../../src/pipeline/contracts.ts'
import { validateBrief } from '../../src/pipeline/schemas.ts'
import { callJsonModel } from '../llm.ts'
import type { PipelineConfig } from '../models.ts'
import type { Cache } from '../cache.ts'
import { dryBrief } from '../fixtures.ts'

export const PROMPT_VERSION = 'art-director-v1'

export const PROMPT = `You write visual briefs for food photography cutouts used in a menu website.
You output JSON only.

You are given an analysis of one menu item. Write one layer brief per layer:
- one "hero" (if hasOwnerHeroCutout is false),
- one "splash" only if the item is liquid-based (yogurt, milk, juice, sauce,
  smoothie, soup, coffee, tea, syrup),
- one "accent" per ingredient in analysis.ingredients, in the same order, up to
  maxAccents accents in total.

For each layer give: kind, assetLabel, visual, negative, intentionalBlur.
- visual: one sentence, under 30 words, describing only the food shown. Do not
  mention any food that is not in the analysis.
- negative: always include "no text, no logo, no hands". Add "no packaging".
- intentionalBlur: true only if the ingredient is naturally shown falling or in
  motion; otherwise false.

Also give one lightSentence used for all layers. Use exactly this lightSentence
unless the palette clearly needs a warm one: "soft key light from upper left, no
hard shadow on background".

Do not invent ingredients, prices, or claims.

Input:
{INPUT_JSON}`

export type ArtDirectorInput = {
  analysis: ItemAnalysis
  hasOwnerHeroCutout: boolean
  stageAspects: number[]
  maxAccents: number
  brandPalette: string[]
}

export async function runArtDirector(
  input: ArtDirectorInput,
  config: PipelineConfig,
  cache: Cache,
): Promise<{ value: ArtBrief; attempts: number; cached: boolean }> {
  return callJsonModel<ArtBrief>({
    role: 'art-director',
    stage: 'art-director',
    prompt: PROMPT.replace('{INPUT_JSON}', JSON.stringify(input)),
    fixture: () => dryBrief(input.analysis, input.maxAccents),
    validate: (raw) => validateBrief(raw, input.analysis, input.maxAccents),
    promptVersion: PROMPT_VERSION,
    cache,
    config,
  })
}
