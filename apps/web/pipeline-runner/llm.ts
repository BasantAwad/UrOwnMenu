/**
 * The one place a model is called with JSON expectations (build spec 3, 9.3).
 *
 * callJsonModel:
 *   - dry run: returns the fixture, validated exactly like a real answer
 *   - real run: caches by prompt+model+promptVersion, validates, and on a
 *     validation failure retries once with the validator's message appended
 *   - a second failure throws `model-invalid`; the caller halts the stage
 *
 * Nothing downstream ever sees the model's raw text.
 */
import type { PipelineConfig, ModelRole } from './models.ts'
import { requireLicensed } from './models.ts'
import type { Cache } from './cache.ts'

export class SpendGuard {
  private spent = 0
  private readonly maxUsd: number
  private readonly costPerCallUsd: number

  constructor(maxUsd: number, costPerCallUsd: number) {
    this.maxUsd = maxUsd
    this.costPerCallUsd = costPerCallUsd
  }

  canSpend(): boolean {
    if (!Number.isFinite(this.maxUsd) || this.costPerCallUsd <= 0) return true
    return this.spent + this.costPerCallUsd <= this.maxUsd
  }

  charge(): void {
    this.spent += this.costPerCallUsd
  }

  get total(): number {
    return this.spent
  }
}

export type JsonCall<T> = {
  role: ModelRole
  /** Human label used in the manifest, e.g. "analyst". */
  stage: string
  prompt: string
  /** Deterministic stand-in used by dry-run. */
  fixture: () => unknown
  validate: (raw: unknown) => T
  promptVersion: string
  cache: Cache
  config: PipelineConfig
  /** Image data URLs for vision models. */
  images?: string[]
  guard?: SpendGuard
}

export type JsonResult<T> = {
  value: T
  attempts: number
  cached: boolean
}

function llmEndpoint(base: string): string {
  return base.replace(/\/$/, '') + '/chat/completions'
}

async function postOnce(config: PipelineConfig, body: unknown): Promise<string> {
  if (!config.llmUrl) throw new Error('PIPELINE_LLM_URL is not set')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)
  try {
    const response = await fetch(llmEndpoint(config.llmUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.llmKey ? { authorization: `Bearer ${config.llmKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      const error = new Error(`llm-http-${response.status}: ${text.slice(0, 400)}`)
      ;(error as Error & { status?: number }).status = response.status
      throw error
    }
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error('llm-empty-response')
    return content
  } finally {
    clearTimeout(timer)
  }
}

const TRANSIENT = new Set([429, 500, 502, 503, 504])

export async function callJsonModel<T>(call: JsonCall<T>): Promise<JsonResult<T>> {
  if (call.config.dryRun) {
    return { value: call.validate(call.fixture()), attempts: 1, cached: false }
  }

  const entry = requireLicensed(call.config, call.role)
  if (call.guard && !call.guard.canSpend()) {
    throw new Error(`spend-limit: PIPELINE_MAX_SPEND_USD would be exceeded before ${call.stage}`)
  }

  const { modelKeyPayload } = await import('../src/pipeline/cache.ts')
  const key = call.cache.key(
    modelKeyPayload(call.stage === 'art-director' ? 'art-dir' : call.stage === 'critic' ? 'critic' : 'analyst', call.prompt, entry.id, call.promptVersion),
  )
  const cached = await call.cache.readJson<unknown>(key)
  if (cached) {
    try {
      return { value: call.validate(cached), attempts: 1, cached: true }
    } catch {
      await call.cache.evict(key)
    }
  }

  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: call.prompt },
  ]
  for (const image of call.images ?? []) content.push({ type: 'image_url', image_url: { url: image } })

  let lastError: unknown = null
  let prompt = call.prompt
  for (let attempt = 1; attempt <= 2; attempt++) {
    call.guard?.charge()
    let raw: string
    try {
      raw = await postOnce(call.config, {
        model: entry.id,
        temperature: 0,
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: call.images?.length ? content : prompt }],
      })
    } catch (error) {
      const status = (error as Error & { status?: number }).status
      if (status && TRANSIENT.has(status) && attempt === 1) {
        lastError = error
        continue
      }
      throw error
    }

    try {
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
      const value = call.validate(parsed)
      await call.cache.writeJson(key, parsed)
      return { value, attempts: attempt, cached: false }
    } catch (error) {
      lastError = error
      if (attempt === 1) {
        const message = error instanceof Error ? error.message : String(error)
        prompt = `${call.prompt}\n\nYour previous answer was rejected: ${message}\nReturn only corrected JSON.`
      }
    }
  }
  throw new Error(`model-invalid: ${call.stage}: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}
