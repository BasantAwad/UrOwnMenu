/**
 * Pipeline contracts. Every agent in docs/PIPELINE.md reads and writes these
 * shapes, so each stage can be replaced without touching the others.
 *
 * Coordinates are normalised to the stage: x and y run 0..1 from the top-left,
 * scale 1 means "one-third of the stage width" for an ingredient.
 */

export type AssetKind = 'hero' | 'ingredient' | 'splash' | 'accent' | 'background'

/** What the Analyst agent extracts from the owner's item. Owner text only. */
export type ItemAnalysis = {
  item: string
  /** The single thing the dish is about, e.g. "strawberry yogurt". */
  hero: string
  /** Only the ingredients the owner listed. Never invented. */
  ingredients: string[]
  /** Mood words the layout may use to choose a palette and motion. */
  mood: 'fresh' | 'rich' | 'crisp' | 'playful' | 'elegant' | 'warm'
  /** Dominant colours of the hero, as hex, from pixel analysis when a photo exists. */
  palette: string[]
}

/** Measured properties of a transparent cutout. Produced by measureAlpha. */
export type AssetMeta = {
  id: string
  kind: AssetKind
  width: number
  height: number
  /** Fraction of pixels with alpha above 200. 0..1. */
  alphaCoverage: number
  /** True when opaque pixels touch the image border (the matte is not clean). */
  touchesEdge: boolean
  /** Normalised sharpness, 0 (blurred) .. 1 (crisp). From the Laplacian variance. */
  sharpness: number
  /** True for deliberately motion-blurred or out-of-focus stock, e.g. falling leaves. */
  intentionalBlur: boolean
}

export type GateReason =
  | 'too-small'
  | 'no-cutout'
  | 'fills-frame'
  | 'dirty-edge'
  | 'soft-focus'
  | 'nothing-visible'

export type GateResult = { ok: boolean; reasons: GateReason[] }

/** A rectangle the layout must keep clear, e.g. the copy block. Normalised. */
export type Zone = { x: number; y: number; w: number; h: number }

export type Stage = {
  /** Width / height of the viewport the layout is built for. */
  aspect: number
  /** Reserved for text and the hero's footprint. Nothing else may overlap it. */
  copyZone: Zone
}

/** One placed object. Rendered back to front, sorted by z. */
export type Layer = {
  assetId: string
  kind: AssetKind
  x: number
  y: number
  /** Relative size. 1 = one-third of stage width. Ingredients 0.4..1.0, hero about 1.0, splash about 3.3. */
  scale: number
  rotation: number
  /** 0 = farthest from the camera, 1 = closest. Drives blur, size and parallax. */
  depth: number
  /** Foreground defocus in px. Only applied to layers with depth above 0.75. */
  blurPx: number
  /** Scroll parallax speed: near layers move more, far layers less. */
  parallax: number
  z: number
}

export type LayerPlan = {
  seed: number
  layers: Layer[]
  /** Reasons the planner dropped an asset (overlap, no room). Empty when all placed. */
  dropped: { assetId: string; reason: string }[]
}

/** ------------------------------------------------------------------------ */
/** Briefs and model outputs. Every one is validated by schemas.ts first.    */
/** ------------------------------------------------------------------------ */

export type LayerKind = 'hero' | 'splash' | 'accent'

/** What one layer should show. Written by the Art Director, capped by code. */
export type LayerBrief = {
  kind: LayerKind
  /** Must match an analysis ingredient for accents; free text for hero/splash. */
  assetLabel: string
  visual: string
  negative: string
  intentionalBlur: boolean
}

export type ArtBrief = {
  layers: LayerBrief[]
  /** One lighting sentence, copied into every generation prompt. */
  lightSentence: string
}

export type CriticFinding = {
  /** Must be a layer in the plan being reviewed. */
  layerId: string
  check: number
  problem: string
  action: 'fix' | 'regenerate'
}

export type CriticResult = {
  verdict: 'pass' | 'fix' | 'regenerate'
  checks: { n: number; ok: boolean; reason: string }[]
  findings: CriticFinding[]
}

export type MotionDecision = {
  clipPrompt: string
  durationSeconds: number
  endFrameDescription: string
}

/** Where a stored asset came from. Missing licence means rejected. */
export type AssetSource = {
  source: 'owner-photo' | 'openverse' | 'wikimedia' | 'generate'
  sourceId: string
  creator: string | null
  licence: string | null
  licenceUrl: string | null
  sourceUrl: string | null
  model?: string
  modelLicence?: string
  prompt?: string
  seed?: number
}

/** One layer that passed the gate, ready for the Composer. */
export type ChosenAsset = {
  layer: LayerBrief
  meta: AssetMeta
  /** Absolute path to the stored transparent PNG. */
  path: string
  source: AssetSource
}

/** Sidecar written next to every stored asset. */
export type AssetSidecar = {
  id: string
  kind: AssetKind
  meta: AssetMeta
  gate: GateResult
  source: AssetSource
  createdAt: string
}

