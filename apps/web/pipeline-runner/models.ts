/**
 * Model registry and licence gate (build spec section 8).
 *
 * The builder must not invent licence facts: every entry starts
 * `commercialOk: false` with `checkedOn: null`, and the runner refuses a real
 * (non-dry) call for that role until the owner opens the model card, fills the
 * fields in `models.json`, and confirms it. Dry runs never consult this gate.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type ModelRole = 'analyst' | 'art-director' | 'critic' | 'generate' | 'matting' | 'video'

export type ModelEntry = {
  role: ModelRole
  id: string
  licence: string
  commercialOk: boolean
  checkedOn: string | null
  /** Generation only: sampler steps. */
  steps?: number
  notes?: string
}

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REGISTRY = path.join(HERE, 'models.json')

const ENV_BY_ROLE: Record<ModelRole, string> = {
  analyst: 'PIPELINE_LLM_MODEL',
  'art-director': 'PIPELINE_LLM_MODEL',
  critic: 'PIPELINE_VISION_MODEL',
  generate: 'PIPELINE_GEN_MODEL',
  matting: 'PIPELINE_MATTE_MODEL',
  video: 'PIPELINE_VIDEO_MODEL',
}

export type PipelineConfig = {
  dryRun: boolean
  outDir: string
  llmUrl: string | null
  llmKey: string | null
  genUrl: string | null
  matteUrl: string | null
  videoUrl: string | null
  maxSpendUsd: number
  costPerCallUsd: number
  models: Record<ModelRole, ModelEntry>
}

export function readEnv(name: string): string | null {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : null
}

export function isDryRun(override?: boolean): boolean {
  if (typeof override === 'boolean') return override
  const env = readEnv('PIPELINE_DRY_RUN')
  return env === '1' || env === 'true'
}

export async function loadConfig(opts: { dryRun?: boolean; outDir?: string } = {}): Promise<PipelineConfig> {
  const raw = JSON.parse(await readFile(REGISTRY, 'utf8')) as Record<string, Omit<ModelEntry, 'role'>>
  const models = {} as Record<ModelRole, ModelEntry>
  for (const role of Object.keys(ENV_BY_ROLE) as ModelRole[]) {
    const entry = raw[role]
    if (!entry) throw new Error(`models.json is missing role "${role}"`)
    const id = readEnv(ENV_BY_ROLE[role]) ?? entry.id
    models[role] = { ...entry, id, role }
  }
  return {
    dryRun: isDryRun(opts.dryRun),
    outDir: opts.outDir ?? readEnv('PIPELINE_OUT') ?? 'pipeline-out',
    llmUrl: readEnv('PIPELINE_LLM_URL'),
    llmKey: readEnv('PIPELINE_LLM_KEY'),
    genUrl: readEnv('PIPELINE_GEN_URL'),
    matteUrl: readEnv('PIPELINE_MATTE_URL'),
    videoUrl: readEnv('PIPELINE_VIDEO_URL'),
    maxSpendUsd: Number(readEnv('PIPELINE_MAX_SPEND_USD') ?? Number.POSITIVE_INFINITY),
    costPerCallUsd: Number(readEnv('PIPELINE_COST_PER_CALL_USD') ?? 0),
    models,
  }
}

/**
 * Refuse a model whose licence the owner has not confirmed. Returns the entry
 * or throws the exact stop-condition message from spec section 13.
 */
export function requireLicensed(config: PipelineConfig, role: ModelRole): ModelEntry {
  const entry = config.models[role]
  if (config.dryRun) return entry
  if (!entry.commercialOk || !entry.checkedOn || /unverified|unknown/i.test(entry.licence)) {
    throw new Error(
      `model-licence-unverified: role "${role}" (${entry.id}) has licence "${entry.licence}" and commercialOk=${entry.commercialOk}. ` +
        `Read the model card, fill licence/commercialOk/checkedOn in pipeline-runner/models.json, then rerun.`,
    )
  }
  return entry
}
