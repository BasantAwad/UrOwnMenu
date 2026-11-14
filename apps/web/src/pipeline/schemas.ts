/**
 * Validators for every model output. The runner never passes model text
 * downstream: it parses JSON, validates it here, and on failure retries once
 * with the validation message (docs/PIPELINE_BUILD_SPEC.md section 3).
 *
 * These are plain functions with no dependencies so they run in Node's
 * type-stripping mode, in the browser, and in tests.
 */
import type {
  ArtBrief,
  CriticResult,
  ItemAnalysis,
  LayerBrief,
  LayerKind,
  LayerPlan,
  MotionDecision,
} from './contracts.ts'
import { RULES } from './rules.ts'

export class SchemaError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'SchemaError'
    this.code = code
  }
}

const fail = (code: string, message: string): never => {
  throw new SchemaError(code, message)
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const nonEmpty = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || v.trim().length === 0) fail('missing-string', `${name} must be a non-empty string`)
  return v as string
}

const hex = (v: unknown): string | null =>
  typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : null

/** Parse a raw model string as a JSON object. Markdown fences are stripped. */
export function parseJsonObject(raw: string): Record<string, unknown> {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return fail('not-json', 'output is not valid JSON')
  }
  if (!isRecord(parsed)) return fail('not-object', 'output must be one JSON object')
  return parsed
}

/**
 * Validate the Analyst output against the owner's own ingredient list.
 * `ownerIngredients` is the only allowed source of ingredients.
 */
export function validateAnalysis(raw: unknown, ownerIngredients: string[]): ItemAnalysis {
  if (!isRecord(raw)) return fail('not-object', 'analysis must be an object')
  const item = nonEmpty(raw.item, 'item')
  const hero = nonEmpty(raw.hero, 'hero')
  if (hero.split(/\s+/).length > 4) fail('hero-too-long', 'hero must be at most four words')
  if (/[A-Z]/.test(hero)) fail('hero-case', 'hero must be lowercase')

  const moods = ['fresh', 'rich', 'crisp', 'playful', 'elegant', 'warm'] as const
  if (!moods.includes(raw.mood as (typeof moods)[number])) {
    fail('mood-invalid', `mood must be one of ${moods.join(', ')}`)
  }

  if (!Array.isArray(raw.ingredients)) fail('ingredients-type', 'ingredients must be an array')
  const allowed = new Map(ownerIngredients.map((name) => [name.toLowerCase(), name]))
  const ingredients: string[] = []
  for (const value of raw.ingredients as unknown[]) {
    if (typeof value !== 'string') return fail('ingredient-type', 'each ingredient must be a string')
    const canonical = allowed.get(value.toLowerCase())
    if (!canonical) return fail('ingredient-invented', `ingredient ${value} is not in the input list`)
    if (!ingredients.includes(canonical)) ingredients.push(canonical)
  }
  // Empty owner list must stay empty. A missing owner ingredient is allowed to be
  // dropped by the model only if it is not in the input at all; we do not require
  // the model to keep every one, but we never accept an invented one.

  if (!Array.isArray(raw.palette)) fail('palette-type', 'palette must be an array')
  const palette: string[] = []
  for (const value of raw.palette as unknown[]) {
    const colour = hex(value)
    if (!colour) return fail('palette-invalid', 'palette entries must be #rrggbb')
    if (!palette.includes(colour)) palette.push(colour)
  }

  return {
    item,
    hero,
    ingredients,
    mood: raw.mood as ItemAnalysis['mood'],
    palette,
  }
}

/** Validate the Art Director output. Accent capping happens in code afterwards. */
export function validateBrief(raw: unknown, analysis: ItemAnalysis, maxAccents: number): ArtBrief {
  if (!isRecord(raw)) return fail('not-object', 'brief must be an object')
  if (!Array.isArray(raw.layers)) fail('layers-type', 'layers must be an array')
  const lightSentence = nonEmpty(raw.lightSentence, 'lightSentence')

  const layers: LayerBrief[] = []
  const accents: string[] = []
  let heroes = 0
  let splashes = 0

  for (const value of raw.layers as unknown[]) {
    if (!isRecord(value)) return fail('layer-type', 'each layer must be an object')
    const kind = value.kind
    if (kind !== 'hero' && kind !== 'splash' && kind !== 'accent') {
      return fail('layer-kind', 'layer kind must be hero, splash or accent')
    }
    const typedKind = kind as LayerKind
    if (typedKind === 'hero') heroes++
    if (typedKind === 'splash') splashes++
    if (heroes > 1) return fail('duplicate-hero', 'at most one hero layer is allowed')
    if (splashes > 1) return fail('duplicate-splash', 'at most one splash layer is allowed')

    const assetLabel = nonEmpty(value.assetLabel, 'assetLabel')
    const visual = nonEmpty(value.visual, 'visual')
    const negative = nonEmpty(value.negative, 'negative')
    if (typeof value.intentionalBlur !== 'boolean') return fail('blur-type', 'intentionalBlur must be a boolean')
    if (!/no text/i.test(negative) || !/no logo/i.test(negative) || !/no hands/i.test(negative)) {
      return fail('negative-missing', 'negative must include "no text, no logo, no hands"')
    }

    if (typedKind === 'accent') {
      const match = analysis.ingredients.find(
        (name) => name.toLowerCase() === assetLabel.toLowerCase(),
      )
      if (!match) return fail('accent-not-ingredient', `accent ${assetLabel} does not match an analysis ingredient`)
      // Same order as analysis.ingredients, one per ingredient, no duplicates.
      const expected = analysis.ingredients[accents.length]
      if (expected && expected.toLowerCase() !== match.toLowerCase()) {
        return fail('accent-order', `accent ${assetLabel} is out of order; expected ${expected}`)
      }
      if (accents.some((name) => name.toLowerCase() === match.toLowerCase())) {
        return fail('accent-duplicate', `accent ${assetLabel} appears twice`)
      }
      accents.push(match)
      layers.push({ kind: 'accent', assetLabel: match, visual, negative, intentionalBlur: value.intentionalBlur })
    } else {
      layers.push({ kind: typedKind, assetLabel, visual, negative, intentionalBlur: value.intentionalBlur })
    }
  }

  void maxAccents // capped by applyAccentCap in run-item.ts, not silently here
  return { layers, lightSentence }
}

/** Validate a Critic verdict against the plan it reviewed. */
export function validateCritic(raw: unknown, plan: LayerPlan): CriticResult {
  if (!isRecord(raw)) return fail('not-object', 'critic must be an object')
  const verdict = raw.verdict
  if (verdict !== 'pass' && verdict !== 'fix' && verdict !== 'regenerate') {
    return fail('verdict-invalid', 'verdict must be pass, fix or regenerate')
  }
  if (!Array.isArray(raw.checks)) return fail('checks-type', 'checks must be an array')
  const checks = (raw.checks as unknown[]).map((value) => {
    if (!isRecord(value)) return fail('check-type', 'each check must be an object')
    if (typeof value.n !== 'number' || typeof value.ok !== 'boolean' || typeof value.reason !== 'string') {
      return fail('check-shape', 'checks need n, ok and reason')
    }
    return { n: value.n, ok: value.ok, reason: value.reason }
  })

  if (!Array.isArray(raw.findings)) return fail('findings-type', 'findings must be an array')
  const ids = new Set(plan.layers.map((layer) => layer.assetId))
  const findings = (raw.findings as unknown[]).map((value) => {
    if (!isRecord(value)) return fail('finding-type', 'each finding must be an object')
    const layerId = nonEmpty(value.layerId, 'findings[].layerId')
    if (!ids.has(layerId)) return fail('finding-unknown-layer', `findings layerId ${layerId} is not in the plan`)
    if (typeof value.check !== 'number') return fail('finding-check', 'finding check must be a number')
    const check = value.check
    const problem = nonEmpty(value.problem, 'finding problem')
    if (value.action !== 'fix' && value.action !== 'regenerate') {
      return fail('finding-action', 'finding action must be fix or regenerate')
    }
    return { layerId, check, problem, action: value.action as 'fix' | 'regenerate' }
  })

  if (verdict === 'pass' && findings.some((finding) => finding.action === 'regenerate')) {
    return fail('verdict-conflict', 'a pass verdict cannot carry a regenerate finding')
  }
  return { verdict: verdict as CriticResult['verdict'], checks, findings }
}

/** Validate the Motion agent output. Duration is bounded by RULES. */
export function validateMotion(raw: unknown): MotionDecision {
  if (!isRecord(raw)) return fail('not-object', 'motion must be an object')
  const clipPrompt = nonEmpty(raw.clipPrompt, 'clipPrompt')
  const endFrameDescription = nonEmpty(raw.endFrameDescription, 'endFrameDescription')
  const durationSeconds = raw.durationSeconds
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)) {
    return fail('duration-type', 'durationSeconds must be a number')
  }
  const { min, max } = RULES.videoDurationSeconds
  if (durationSeconds < min || durationSeconds > max) {
    return fail('duration-range', `durationSeconds must be between ${min} and ${max}`)
  }
  return { clipPrompt, durationSeconds, endFrameDescription }
}

/** Cap accents at maxAccents, in analysis order. Returns what was trimmed. */
export function capAccents(brief: ArtBrief, maxAccents: number): { brief: ArtBrief; trimmed: number } {
  let kept = 0
  const layers = brief.layers.filter((layer) => {
    if (layer.kind !== 'accent') return true
    kept++
    return kept <= maxAccents
  })
  return { brief: { ...brief, layers }, trimmed: Math.max(0, kept - maxAccents) }
}

/** Enforce the code-owned splash decision on the Art Director's brief. */
export function enforceSplash(brief: ArtBrief, liquid: boolean, analysis: ItemAnalysis): ArtBrief {
  const existing = brief.layers.find((layer) => layer.kind === 'splash')
  const without = brief.layers.filter((layer) => layer.kind !== 'splash')
  if (!liquid) return { ...brief, layers: without }
  if (existing) return { ...brief, layers: [...without, existing] }
  without.push({
    kind: 'splash',
    assetLabel: `${analysis.hero} splash`,
    visual: `a frozen liquid splash of the item's main liquid, against plain white`,
    negative: 'no text, no logo, no hands, no fruit, no packaging',
    intentionalBlur: false,
  })
  return { ...brief, layers: without }
}
