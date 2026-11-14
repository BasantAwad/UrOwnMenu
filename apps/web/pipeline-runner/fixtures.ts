/**
 * Dry-run stand-ins for the four model calls (build spec section 8).
 *
 * They are deterministic functions of the owner's item, not random text, so a
 * dry run exercises the same validation the real models must satisfy. The
 * schema fixtures in `apps/web/harness/pipeline-fixtures/` are separate files
 * used by the schema tests.
 */
import type { ArtBrief, ItemAnalysis, LayerBrief, LayerPlan, MotionDecision } from '../src/pipeline/contracts.ts'
import { isLiquidBased } from '../src/pipeline/rules.ts'

export type DryItem = {
  id: string
  name: string
  description?: string
  ingredients: string[]
  photoPath?: string
  homepageHero?: boolean
  venue?: { name: string; tone: string }
  palette?: string[]
  /** Test-only switches. Never set by the CLI. */
  simulate?: {
    failSourceFor?: string[]
    failEveryCandidate?: boolean
    criticFirst?: 'fix' | 'regenerate'
    emptyMatteFor?: string[]
  }
}

const QUALITY = /\b(delicious|best|amazing|fresh(est)?|crispy|crunchy|perfect|signature|classic|homemade|hand-cut|handmade)\b/gi

function cleanWords(text: string): string[] {
  return text
    .replace(QUALITY, ' ')
    .replace(/[^a-z0-9\s-]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function dryAnalysis(item: DryItem): ItemAnalysis {
  const words = cleanWords(item.name).slice(0, 4)
  const hero = (words.length > 0 ? words.join(' ') : item.ingredients[0] ?? item.name).toLowerCase()
  const haystack = `${item.name} ${item.description ?? ''} ${item.ingredients.join(' ')}`.toLowerCase()

  let mood: ItemAnalysis['mood'] = 'warm'
  if (/chocolate|cheese|cream|burger|cake/.test(haystack)) mood = 'rich'
  else if (/fried|baked|crust|chip|pastry|fries/.test(haystack)) mood = 'crisp'
  else if (/pancake|donut|kids|cookie/.test(haystack)) mood = 'playful'
  else if (/salad|fruit|juice|bowl|lemonade/.test(haystack)) mood = 'fresh'
  else if (/soup|coffee|tea|stew|latte/.test(haystack)) mood = 'warm'
  else if (/plated|tart|fine/.test(haystack)) mood = 'elegant'

  return {
    item: item.name,
    hero,
    ingredients: [...item.ingredients],
    mood,
    palette: item.palette ?? ['#e8a7a0', '#f5f0e8', '#7a1f2b'],
  }
}

export function dryBrief(analysis: ItemAnalysis, maxAccents: number): ArtBrief {
  const liquid = isLiquidBased(analysis.item, analysis.hero)
  const heroIsIngredient = analysis.ingredients.some(
    (name) => name.toLowerCase() === analysis.hero.toLowerCase(),
  )
  const layers: LayerBrief[] = [
    {
      kind: 'hero',
      assetLabel: analysis.hero,
      visual: heroIsIngredient
        ? `a pile of ${analysis.hero} arranged in a shallow ceramic dish, centred`
        : `${analysis.hero}, the whole dish, plated simply and centred`,
      negative: 'no text, no logo, no hands, no second dish, no packaging',
      intentionalBlur: false,
    },
  ]
  if (liquid) {
    layers.push({
      kind: 'splash',
      assetLabel: `${analysis.hero} splash`,
      visual: `a frozen liquid splash of ${analysis.hero} mid-motion, crown shape, against plain white`,
      negative: 'no text, no logo, no hands, no fruit, no packaging',
      intentionalBlur: false,
    })
  }
  analysis.ingredients.slice(0, maxAccents).forEach((ingredient, index) => {
    layers.push({
      kind: 'accent',
      assetLabel: ingredient,
      visual: `a single ${ingredient} floating mid-air, slight tilt, sharp focus`,
      negative: 'no text, no logo, no hands, no packaging, no other objects',
      intentionalBlur: /smoothie|juice|salad/i.test(analysis.item) || index > 2,
    })
  })
  return { layers, lightSentence: 'soft key light from upper left, no hard shadow on background' }
}

export function dryCritic(
  run: number,
  plan: LayerPlan,
  simulate?: DryItem['simulate'],
): unknown {
  const check = (n: number) => ({ n, ok: true, reason: 'reads correctly in the dry-run composite' })
  const checks = [1, 2, 3, 4, 5, 6, 7].map(check)
  if (run === 1 && simulate?.criticFirst) {
    const accent = plan.layers.find((layer) => layer.kind === 'accent' || layer.kind === 'ingredient')
    if (accent) {
      const fix = simulate.criticFirst === 'fix'
      return {
        verdict: fix ? 'fix' : 'regenerate',
        checks: checks.map((c) => (c.n === 4 ? { n: 4, ok: false, reason: 'copy edge is crowded' } : c)),
        findings: [
          {
            layerId: accent.assetId,
            check: 4,
            problem: 'accent sits on the copy zone edge',
            action: fix ? 'fix' : 'regenerate',
          },
        ],
      }
    }
  }
  return { verdict: 'pass', checks, findings: [] }
}

export function dryMotion(analysis: ItemAnalysis): MotionDecision {
  return {
    clipPrompt: `a bowl of ${analysis.hero}, layers separating and floating in slow motion, camera slowly orbiting, soft key light from upper left`,
    durationSeconds: 6,
    endFrameDescription: `the fully assembled ${analysis.hero}, centred`,
  }
}
