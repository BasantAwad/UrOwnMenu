/**
 * Scout: finds candidate images. It never decides quality — the gate does.
 *
 * Source order is fixed by the build spec (section 3.3):
 *   owner-photo -> openverse -> wikimedia -> generate
 *
 * Search text is deterministic, results are filtered by the reject-word list
 * and ranked by the exact scoring in the spec. Dry runs return deterministic
 * candidates and synthetic pixels so the whole chain runs offline.
 */
import { RULES } from '../../src/pipeline/rules.ts'
import { fnv1a32 } from '../../src/pipeline/hash.ts'
import type { AssetSource } from '../../src/pipeline/contracts.ts'
import type { Rgba } from '../imaging.ts'
import { decodeImage, syntheticCutout } from '../imaging.ts'
import type { Cache } from '../cache.ts'
import { sha256 } from '../store.ts'
import { downloadKeyPayload } from '../../src/pipeline/cache.ts'
import type { DryItem } from '../fixtures.ts'

export type SourceName = 'owner-photo' | 'openverse' | 'wikimedia' | 'generate'

export type Candidate = {
  id: string
  source: SourceName
  title: string
  tags: string[]
  url: string
  width: number
  height: number
  filetype: string
  licence: string | null
  licenceUrl: string | null
  creator: string | null
  sourceUrl: string | null
}

const CC0_LICENCES = /^(cc0|pdm|public domain)/i

export function titleRejected(title: string, tags: string[] = []): boolean {
  const haystack = `${title} ${tags.join(' ')}`.toLowerCase()
  return RULES.rejectTitleWords.some((word) => haystack.includes(word))
}

/** Exact scoring from build spec 3.3. Higher is better; ties sort by id. */
export function rank(candidates: Candidate[]): Candidate[] {
  const score = (c: Candidate): number => {
    let total = 0
    if (/png/i.test(c.filetype)) total += 2
    if (c.width >= 1000) total += 1
    const aspect = c.width / Math.max(1, c.height)
    if (aspect >= 0.6 && aspect <= 1.7) total += 1
    if (c.licence && CC0_LICENCES.test(c.licence)) total += 1
    return total
  }
  return [...candidates].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
}

export function keepCandidates(candidates: Candidate[]): Candidate[] {
  return candidates.filter((candidate) => !titleRejected(candidate.title, candidate.tags))
}

/** Openverse search. Returns up to RULES.scoutSearchResults results. */
export async function searchOpenverse(label: string): Promise<Candidate[]> {
  const url =
    'https://api.openverse.org/v1/images/?' +
    new URLSearchParams({
      q: `${label} isolated`,
      license: 'cc0,pdm,by,by-sa',
      page_size: String(RULES.scoutSearchResults),
      mature: 'false',
    })
  const response = await fetch(url, { headers: { 'user-agent': 'UrOwnMenu-pipeline/1.0' } })
  if (!response.ok) return []
  const json = (await response.json()) as {
    results?: {
      id: string
      title?: string
      url: string
      width?: number
      height?: number
      filetype?: string
      license?: string
      license_url?: string
      creator?: string
      foreign_landing_url?: string
      tags?: { name?: string }[]
    }[]
  }
  return (json.results ?? []).map((item) => ({
    id: `ov_${item.id}`,
    source: 'openverse' as const,
    title: item.title ?? '',
    tags: (item.tags ?? []).map((tag) => tag.name ?? ''),
    url: item.url,
    width: item.width ?? 0,
    height: item.height ?? 0,
    filetype: item.filetype ?? '',
    licence: item.license ?? null,
    licenceUrl: item.license_url ?? null,
    creator: item.creator ?? null,
    sourceUrl: item.foreign_landing_url ?? null,
  }))
}

/** Wikimedia Commons search, licence read from extmetadata. */
export async function searchWikimedia(label: string): Promise<Candidate[]> {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrsearch: label,
      gsrnamespace: '6',
      gsrlimit: String(RULES.scoutSearchResults),
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
    })
  const response = await fetch(url)
  if (!response.ok) return []
  const json = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string
          imageinfo?: {
            url?: string
            width?: number
            height?: number
            extmetadata?: Record<string, { value?: string }>
          }[]
        }
      >
    }
  }
  const pages = Object.entries(json.query?.pages ?? {})
  const out: Candidate[] = []
  for (const [pageId, page] of pages) {
    const info = page.imageinfo?.[0]
    if (!info?.url) continue
    const meta = info.extmetadata ?? {}
    const licence = meta.LicenseShortName?.value ?? null
    out.push({
      id: `wm_${pageId}`,
      source: 'wikimedia',
      title: page.title ?? '',
      tags: [],
      url: info.url,
      width: info.width ?? 0,
      height: info.height ?? 0,
      filetype: info.url.split('.').pop() ?? '',
      licence,
      licenceUrl: meta.LicenseUrl?.value ?? null,
      creator: meta.Artist?.value?.replace(/<[^>]+>/g, '').trim() ?? null,
      sourceUrl: meta.Credit?.value ?? null,
    })
  }
  return out
}

/** Dry-run candidates. Two per label, ranked so PNG 1024 beats JPEG 640. */
export function dryCandidates(label: string, seedBase: string): Candidate[] {
  const seed = fnv1a32(`${seedBase}|${label}`)
  return [
    {
      id: `dry_${seed}_a`,
      source: 'openverse',
      title: `${label} on white`,
      tags: ['food'],
      url: `fixture://${label}/a.png`,
      width: 1024,
      height: 1024,
      filetype: 'png',
      licence: 'cc0',
      licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      creator: 'dry-run fixture',
      sourceUrl: null,
    },
    {
      id: `dry_${seed}_b`,
      source: 'wikimedia',
      title: `${label} studio`,
      tags: ['food'],
      url: `fixture://${label}/b.jpg`,
      width: 640,
      height: 640,
      filetype: 'jpg',
      licence: 'cc-by-sa',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      creator: 'dry-run fixture',
      sourceUrl: null,
    },
  ]
}

/** Download (or synthesise in dry-run) one candidate into RGBA. */
export async function downloadCandidate(
  candidate: Candidate,
  cache: Cache,
  opts: { dryRun: boolean; itemId: string },
): Promise<{ image: Rgba; sha256: string }> {
  if (opts.dryRun) {
    const seed = fnv1a32(`${opts.itemId}|${candidate.id}`)
    const image = syntheticCutout({
      width: Math.max(1024, candidate.width || 1024),
      height: Math.max(1024, candidate.height || 1024),
      seed,
    })
    return { image, sha256: sha256(Buffer.from(image.data.buffer)) }
  }

  const key = cache.key(downloadKeyPayload(candidate.id, candidate.url))
  const cached = await cache.readBytes(key, 'img')
  const bytes = cached ?? Buffer.from(await (await fetch(candidate.url)).arrayBuffer())
  if (!cached) await cache.writeBytes(key, bytes, 'img')
  return { image: await decodeImage(bytes), sha256: sha256(bytes) }
}

/** Everything the Scout tried for one layer, in order, ready for the manifest. */
export function sourcePlan(kind: 'hero' | 'splash' | 'accent', hasOwnerPhoto: boolean): SourceName[] {
  if (kind === 'splash') return ['generate']
  const plan: SourceName[] = []
  if (hasOwnerPhoto) plan.push('owner-photo')
  plan.push('openverse', 'wikimedia', 'generate')
  return plan
}

export function candidateSource(candidate: Candidate): AssetSource {
  return {
    source: candidate.source,
    sourceId: candidate.id,
    creator: candidate.creator,
    licence: candidate.licence,
    licenceUrl: candidate.licenceUrl,
    sourceUrl: candidate.sourceUrl,
  }
}

/** Source fields are required; an asset with no licence is rejected upstream. */
export function hasUsableLicence(candidate: Candidate): boolean {
  return Boolean(candidate.licence && candidate.licence.trim().length > 0)
}

export function dryItemCandidates(item: DryItem, label: string): Candidate[] {
  return dryCandidates(label, item.id)
}
