/**
 * File cache for the runner. Key = SHA-256 of a payload from
 * `src/pipeline/cache.ts`. A cache hit is only used after the caller validates
 * it again, so an old answer that no longer matches the schema is evicted
 * (build spec section 9.3).
 */
import { readFile, unlink, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { sha256 } from './store.ts'

export class Cache {
  readonly dir: string

  constructor(dir: string) {
    this.dir = dir
  }

  key(payload: string): string {
    return sha256(payload)
  }

  private file(key: string, extension: string): string {
    return path.join(this.dir, `${key}.${extension}`)
  }

  async readJson<T>(key: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(this.file(key, 'json'), 'utf8')) as T
    } catch {
      return null
    }
  }

  async writeJson(key: string, value: unknown): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    await writeFile(this.file(key, 'json'), JSON.stringify(value, null, 2))
  }

  async readBytes(key: string, extension = 'bin'): Promise<Buffer | null> {
    try {
      return await readFile(this.file(key, extension))
    } catch {
      return null
    }
  }

  async writeBytes(key: string, bytes: Buffer, extension = 'bin'): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    await writeFile(this.file(key, extension), bytes)
  }

  async evict(key: string, extension = 'json'): Promise<void> {
    try {
      await unlink(this.file(key, extension))
    } catch {
      /* already gone */
    }
  }
}
