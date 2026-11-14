/**
 * Every number and fixed word list the pipeline uses, in one place.
 *
 * The build spec (docs/PIPELINE_BUILD_SPEC.md section 6) makes this the single
 * source of truth: gate.ts, planner callers, the Scout, the Generator and the
 * Critic all read from here. A test that changes a value here and watches a
 * gate result change proves nothing is hard-coded elsewhere.
 *
 * Deliberately mutable: the verify scripts temporarily patch a value to prove
 * that the gate reads this object and not a private copy.
 */

export type StageName = 'desktop' | 'mobile'

export type Rules = {
  maxAccents: { desktop: number; mobile: number }
  generationBudgetPerItem: number
  generationCandidatesPerCall: number
  generationRoundsPerLayer: number
  scoutDownloadTopN: number
  scoutSearchResults: number
  rejectTitleWords: string[]
  minShortEdge: { hero: number; splash: number; background: number; ingredient: number; accent: number }
  alpha: { nothingVisible: number; noCutout: number; fillsFrame: number }
  liquidWords: string[]
  sharpnessMin: number
  criticMaxRuns: number
  analystAttempts: number
  artDirectorAttempts: number
  videoDurationSeconds: { min: number; max: number }
  hashSeedSalt: number
  stages: {
    desktop: { aspect: number; copyZone: { x: number; y: number; w: number; h: number } }
    mobile: { aspect: number; copyZone: { x: number; y: number; w: number; h: number } }
  }
}

export const RULES: Rules = {
  maxAccents: { desktop: 6, mobile: 4 },
  generationBudgetPerItem: 12,
  generationCandidatesPerCall: 4,
  generationRoundsPerLayer: 3,
  scoutDownloadTopN: 4,
  scoutSearchResults: 20,
  rejectTitleWords: [
    'logo',
    'diagram',
    'map',
    'drawing',
    'illustration',
    'poster',
    'packaging',
    'text',
    'vector',
    'clipart',
  ],
  minShortEdge: { hero: 800, splash: 700, background: 800, ingredient: 400, accent: 300 },
  alpha: { nothingVisible: 0.01, noCutout: 0.92, fillsFrame: 0.6 },
  liquidWords: [
    'yogurt',
    'yoghurt',
    'milk',
    'juice',
    'sauce',
    'smoothie',
    'soup',
    'coffee',
    'tea',
    'syrup',
    'shake',
    'lemonade',
    'broth',
    'latte',
  ],
  sharpnessMin: 0.15,
  criticMaxRuns: 2,
  analystAttempts: 2,
  artDirectorAttempts: 2,
  videoDurationSeconds: { min: 4, max: 10 },
  hashSeedSalt: 0x9e3779b9,
  stages: {
    desktop: { aspect: 1.6, copyZone: { x: 0.04, y: 0.2, w: 0.36, h: 0.6 } },
    mobile: { aspect: 0.5625, copyZone: { x: 0.06, y: 0.56, w: 0.88, h: 0.36 } },
  },
}

/** True when the item name or hero contains a liquid word (code decides splash). */
export function isLiquidBased(name: string, hero: string): boolean {
  const haystack = ` ${name} ${hero} `.toLowerCase()
  return RULES.liquidWords.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(haystack))
}
