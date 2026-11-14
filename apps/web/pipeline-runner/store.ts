/**
 * Artifact folder and manifest writer (docs/PIPELINE_BUILD_SPEC.md section 7).
 *
 * One item owns one folder. Every event is appended and flushed, so a crashed
 * run still leaves a readable manifest. File writes go through a temp file and
 * a rename so a killed process never leaves a half-written JSON that the next
 * run would happily read.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { AssetSidecar } from '../src/pipeline/contracts.ts'
import type { Rgba } from './imaging.ts'
import { writePng } from './imaging.ts'
import { createHash } from 'node:crypto'

export type RunStatus = 'running' | 'done' | 'needs-assets' | 'needs-review' | 'failed'

export type ManifestEvent = {
  t: string
  stage: string
  result?: string
  [key: string]: unknown
}

export type ManifestData = {
  itemId: string
  startedAt: string
  finishedAt?: string
  status: RunStatus
  events: ManifestEvent[]
  generationCalls: number
  /** Model spend recorded by the runner's guard; 0 when calls are free/dry. */
  spendUsd: number
  warnings: string[]
  needsDecision?: string
}

export function sha256(text: string | Buffer): string {
  return createHash('sha256').update(text).digest('hex')
}

export class Manifest {
  readonly data: ManifestData
  private file: string | null = null

  constructor(itemId: string) {
    this.data = {
      itemId,
      startedAt: new Date().toISOString(),
      status: 'running',
      events: [],
      generationCalls: 0,
      spendUsd: 0,
      warnings: [],
    }
  }

  attach(file: string): void {
    this.file = file
  }

  note(event: { stage: string; result?: string; t?: string } & Record<string, unknown>): void {
    this.data.events.push({ ...event, t: event.t ?? new Date().toISOString() })
  }

  warn(message: string): void {
    this.data.warnings.push(message)
    this.note({ stage: 'warning', result: 'warn', message })
  }

  /** Record a stop condition from section 13 without guessing a resolution. */
  stop(status: RunStatus, reason: string): void {
    this.data.status = status
    this.data.needsDecision = reason
    this.note({ stage: 'halt', result: status, reason })
  }

  finish(status: RunStatus): void {
    this.data.status = status
    this.data.finishedAt = new Date().toISOString()
  }

  async flush(): Promise<void> {
    if (!this.file) return
    await atomicWrite(this.file, JSON.stringify(this.data, null, 2))
  }
}

export async function atomicWrite(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.tmp`
  await writeFile(temp, text)
  await rename(temp, file)
}

export class ItemStore {
  readonly dir: string
  readonly assetsDir: string
  readonly cacheDir: string
  readonly scrubDir: string
  readonly manifest: Manifest

  constructor(outRoot: string, itemId: string) {
    this.dir = path.join(outRoot, itemId)
    this.assetsDir = path.join(this.dir, 'assets')
    this.cacheDir = path.join(this.dir, 'cache')
    this.scrubDir = path.join(this.dir, 'scrub')
    this.manifest = new Manifest(itemId)
  }

  async init(): Promise<void> {
    await Promise.all([
      mkdir(this.assetsDir, { recursive: true }),
      mkdir(this.cacheDir, { recursive: true }),
      mkdir(this.scrubDir, { recursive: true }),
    ])
    this.manifest.attach(this.path('manifest.json'))
    await this.manifest.flush()
  }

  path(name: string): string {
    return path.join(this.dir, name)
  }

  assetPath(layerId: string): string {
    return path.join(this.assetsDir, `${layerId}.png`)
  }

  async writeJson(name: string, value: unknown): Promise<void> {
    await atomicWrite(this.path(name), JSON.stringify(value, null, 2))
  }

  async readJson<T>(name: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(this.path(name), 'utf8')) as T
    } catch {
      return null
    }
  }

  async writeAsset(layerId: string, image: Rgba, sidecar: AssetSidecar): Promise<void> {
    await writePng(this.assetPath(layerId), image)
    await this.writeJson(`assets/${layerId}.meta.json`, sidecar)
  }

  async readAsset(layerId: string): Promise<Rgba> {
    const { readPng } = await import('./imaging.ts')
    return readPng(this.assetPath(layerId))
  }

  /** Cheap file cache used for downloads, generations and model answers. */
  cachePath(key: string, extension: string): string {
    return path.join(this.cacheDir, `${key}.${extension}`)
  }
}
