/** Critic: a vision model reviews the composed stage (build spec 3.7). */
import type { ArtBrief, CriticResult, LayerPlan } from '../../src/pipeline/contracts.ts'
import { validateCritic } from '../../src/pipeline/schemas.ts'
import { callJsonModel, type SpendGuard } from '../llm.ts'
import type { PipelineConfig } from '../models.ts'
import type { Cache } from '../cache.ts'
import { dryCritic, type DryItem } from '../fixtures.ts'

export const PROMPT_VERSION = 'critic-v1'

export const PROMPT = `You review one composed food image for a menu website. You output JSON only.

You see: the image, the layer brief (what each layer should be), and the layer
plan (where each layer is). Answer the checklist below for the whole image, one
answer per check, then give findings.

Checklist (answer each as true or false, with a one-line reason):
1. Does every layer read as the ingredient named in its brief, not a different food?
2. Is there one light direction across all layers and shadows?
3. Is there a rectangular shadow or a halo around any cutout?
4. Is the copy readable over every part of the frame?
5. Is the hero the largest sharp object?
6. Are accent sizes consistent with depth (nearer = larger)?
7. Is any element clipped by the viewport or by another layer's edge?

Verdict rules:
- "pass": all checks are true.
- "fix": one or more checks are false, and each can be fixed by moving, resizing,
  or blurring the layer. Use layerId from the plan.
- "regenerate": a check is false because the food itself is wrong (check 1), or
  a cutout has a visible defect (check 3) that moving will not fix.

Output: {"verdict": ..., "checks": [{"n": 1, "ok": true, "reason": "..."}, ...],
"findings": [{"layerId": ..., "check": n, "problem": ..., "action": "fix"|"regenerate"}]}

Input:
{INPUT_JSON}`

export async function runCritic(
  input: { png: Buffer; pngSha256: string; brief: ArtBrief; plan: LayerPlan; run: number },
  owner: DryItem,
  config: PipelineConfig,
  cache: Cache,
  guard?: SpendGuard,
): Promise<{ value: CriticResult; attempts: number; cached: boolean }> {
  const payload = {
    brief: input.brief,
    plan: input.plan,
    run: input.run,
  }
  return callJsonModel<CriticResult>({
    role: 'critic',
    stage: 'critic',
    prompt: `PNG sha256: ${input.pngSha256}\n` + PROMPT.replace('{INPUT_JSON}', JSON.stringify(payload)),
    fixture: () => dryCritic(input.run, input.plan, owner.simulate),
    validate: (raw) => validateCritic(raw, input.plan),
    promptVersion: PROMPT_VERSION,
    cache,
    config,
    images: [`data:image/png;base64,${input.png.toString('base64')}`],
    guard,
  })
}
