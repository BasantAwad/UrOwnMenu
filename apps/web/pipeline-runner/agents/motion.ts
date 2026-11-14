/**
 * Motion: only the item the owner flags `homepageHero` gets a scrub clip
 * (build spec 3.8). A model writes the prompt; code decides whether to run.
 *
 * The clip is post-processed with exactly the ffmpeg command in
 * scripts/make-scrub-video.sh (all frames keyframes, faststart). The shell
 * script stays the canonical entry point for manual runs; this module invokes
 * the same arguments directly so it also works on Windows.
 */
import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ArtBrief, ItemAnalysis, MotionDecision } from '../../src/pipeline/contracts.ts'
import { validateMotion } from '../../src/pipeline/schemas.ts'
import { callJsonModel, type SpendGuard } from '../llm.ts'
import type { PipelineConfig } from '../models.ts'
import { requireLicensed } from '../models.ts'
import type { Cache } from '../cache.ts'
import { dryMotion, type DryItem } from '../fixtures.ts'

export const PROMPT_VERSION = 'motion-v1'

export const PROMPT = `You write one short video prompt for a menu homepage hero.
You output JSON only.

You are given one menu item analysis and art brief. Write:
- clipPrompt: one sentence, under 40 words, describing the dish's layers
  separating and floating in slow motion, a slow camera orbit, and the dish's
  light sentence. Use only foods that appear in the analysis.
- durationSeconds: a number from 4 to 10.
- endFrameDescription: one sentence describing the fully assembled dish, centred.

Output one JSON object with keys: clipPrompt, durationSeconds, endFrameDescription.
No prose. No markdown fences.

Input:
{INPUT_JSON}`

export async function runMotion(
  input: { analysis: ItemAnalysis; brief: ArtBrief; item: DryItem },
  config: PipelineConfig,
  cache: Cache,
  guard?: SpendGuard,
): Promise<{ value: MotionDecision; attempts: number; cached: boolean }> {
  return callJsonModel<MotionDecision>({
    // The clip prompt is written by the text LLM; the video role is only used
    // by renderClip when there is a real endpoint.
    role: 'analyst',
    stage: 'motion',
    prompt: PROMPT.replace('{INPUT_JSON}', JSON.stringify(input)),
    fixture: () => dryMotion(input.analysis),
    validate: validateMotion,
    promptVersion: PROMPT_VERSION,
    cache,
    config,
    guard,
  })
}

export async function renderClip(
  decision: MotionDecision,
  outDir: string,
  config: PipelineConfig,
): Promise<{ rawPath: string; scrubPath: string }> {
  const rawPath = path.join(outDir, 'raw.mp4')
  const scrubPath = path.join(outDir, 'scrub.mp4')
  await import('node:fs/promises').then(({ mkdir }) => mkdir(outDir, { recursive: true }))

  if (config.dryRun) {
    // Deterministic stand-in clip so the post-process and ScrollScrub are real.
    await ffmpeg([
      '-y',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      `testsrc2=size=960x540:rate=30:duration=${decision.durationSeconds}`,
      '-pix_fmt',
      'yuv420p',
      rawPath,
    ])
  } else {
    const entry = requireLicensed(config, 'video')
    if (!config.videoUrl) throw new Error('PIPELINE_VIDEO_URL is not set')
    const response = await fetch(config.videoUrl.replace(/\/$/, '') + '/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: entry.id,
        prompt: decision.clipPrompt,
        durationSeconds: decision.durationSeconds,
        width: 1280,
        height: 720,
        endFrameDescription: decision.endFrameDescription,
      }),
    })
    if (!response.ok) throw new Error(`video-http-${response.status}`)
    await writeFile(rawPath, Buffer.from(await response.arrayBuffer()))
  }

  await prepareScrubVideo(rawPath, scrubPath, 1080)
  return { rawPath, scrubPath }
}

/** Identical to scripts/make-scrub-video.sh: every frame a keyframe, faststart. */
export async function prepareScrubVideo(input: string, output: string, height = 1080): Promise<void> {
  await ffmpeg([
    '-y',
    '-loglevel',
    'error',
    '-i',
    input,
    '-an',
    '-vf',
    `scale=-2:min(${height}\\,ih),fps=30`,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '24',
    '-pix_fmt',
    'yuv420p',
    '-g',
    '1',
    '-keyint_min',
    '1',
    '-sc_threshold',
    '0',
    '-movflags',
    '+faststart',
    output,
  ])
}

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.FFMPEG_PATH ?? 'ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`))
    })
  })
}

/** Cached clip bytes, used by the manual visual check. */
export async function readClip(pathName: string): Promise<Buffer> {
  return readFile(pathName)
}
