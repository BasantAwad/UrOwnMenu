/** Analyst agent: owner facts in, a validated ItemAnalysis out. */
import type { ItemAnalysis } from '../../src/pipeline/contracts.ts'
import { validateAnalysis } from '../../src/pipeline/schemas.ts'
import { callJsonModel } from '../llm.ts'
import type { PipelineConfig } from '../models.ts'
import type { Cache } from '../cache.ts'
import { dryAnalysis, type DryItem } from '../fixtures.ts'

export const PROMPT_VERSION = 'analyst-v1'

export const PROMPT = `You analyse one menu item for a restaurant website. You output JSON only.

Facts you may use: the item name, description, ingredient list and palette given
below. You must not add any ingredient, claim, price, origin, health statement or
description that is not in the input.

Rules:
1. "ingredients" in your output must be a subset of the input ingredient list.
   Keep the input spelling. Drop nothing you can see is in the list; drop only
   items that are not in the list (you should never need to).
2. "hero" is a noun phrase of at most four words, lowercase, describing what the
   dish is made of, taken from the name or ingredients. No quality adjectives.
3. "mood" must be one of: fresh, rich, crisp, playful, elegant, warm.
   - fresh: salads, fruit, juice, light bowls
   - rich: chocolate, cheese, cream desserts, burgers
   - crisp: fried or baked items with crust, chips, pastry
   - playful: kids items, pancakes, donuts
   - elegant: plated desserts, fine items
   - warm: soups, coffee, tea, stews
4. "palette" must be copied exactly from the input. Do not change it.
5. Output one JSON object with keys: item, hero, ingredients, mood, palette.
   No prose. No markdown fences.

Input:
{INPUT_JSON}`

export type AnalystInput = {
  item: {
    id: string
    name: string
    description: string
    ingredients: string[]
    photoPath: string | null
  }
  venue: { name: string; tone: string }
  photoStats: { palette: string[] } | null
}

export async function runAnalyst(
  input: AnalystInput,
  owner: DryItem,
  config: PipelineConfig,
  cache: Cache,
): Promise<{ value: ItemAnalysis; attempts: number; cached: boolean }> {
  return callJsonModel<ItemAnalysis>({
    role: 'analyst',
    stage: 'analyst',
    prompt: PROMPT.replace('{INPUT_JSON}', JSON.stringify(input)),
    fixture: () => dryAnalysis({ ...owner, palette: input.photoStats?.palette ?? owner.palette }),
    validate: (raw) => validateAnalysis(raw, input.item.ingredients),
    promptVersion: PROMPT_VERSION,
    cache,
    config,
  })
}
