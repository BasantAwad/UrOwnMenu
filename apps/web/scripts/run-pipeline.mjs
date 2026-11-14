/**
 * CLI for the visual pipeline.
 *
 *   node --experimental-strip-types scripts/run-pipeline.mjs <item-file.json>
 *   node ... scripts/run-pipeline.mjs fixtures.json --dry-run --out ./pipeline-out
 *
 * The item file is one item object or an array of them. Dry run is the default
 * when PIPELINE_DRY_RUN=1; pass --dry-run to force it without env changes.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { loadConfig } from '../pipeline-runner/models.ts'
import { runItem } from '../pipeline-runner/run-item.ts'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = args.indexOf('--' + name)
  return index >= 0 ? args[index + 1] : fallback
}
const has = (name) => args.includes('--' + name)

const file = args.find((arg) => !arg.startsWith('--') && arg !== flag('out') && arg !== flag('item') && arg !== flag('base-dir'))
if (!file) {
  console.error('usage: run-pipeline.mjs <items.json> [--stage desktop|mobile] [--out dir] [--dry-run] [--item id] [--base-dir dir]')
  process.exit(2)
}

const raw = JSON.parse(await readFile(file, 'utf8'))
const items = (Array.isArray(raw) ? raw : [raw]).filter(Boolean)
const only = flag('item', null)
const selected = only ? items.filter((item) => item.id === only) : items

const config = await loadConfig({
  dryRun: has('dry-run') || process.env.PIPELINE_DRY_RUN === '1',
  outDir: flag('out', undefined),
})

// Build spec section 13: more than one homepage hero is the owner's call.
const heroes = selected.filter((item) => item.homepageHero === true)
if (heroes.length > 1) {
  console.error(
    `needs-decision: ${heroes.length} items are flagged homepageHero (${heroes
      .map((item) => item.id)
      .join(', ')}). A scrub clip is made for one item only; clear the flag on all but one.`,
  )
  process.exit(2)
}

if (!config.dryRun) {
  console.log('real run: model endpoints and licences from pipeline-runner/models.json must be configured')
}
console.log(`pipeline: ${selected.length} item(s) -> ${config.outDir}${config.dryRun ? ' (dry run)' : ''}\n`)

let failures = 0
for (const item of selected) {
  const started = Date.now()
  try {
    const result = await runItem(item, {
      config,
      baseDir: flag('base-dir', path.dirname(path.resolve(file))),
    })
    const seconds = ((Date.now() - started) / 1000).toFixed(1)
    console.log(
      `${result.status.padEnd(12)} ${result.itemId.padEnd(28)} ${String(result.generationCalls).padStart(2)} generations  ${seconds}s  ${result.reason ?? ''}`,
    )
    for (const warning of result.warnings) console.log(`  warn: ${warning}`)
    if (result.status === 'failed') failures++
  } catch (error) {
    failures++
    console.log(`failed       ${item.id}  ${error instanceof Error ? error.message : String(error)}`)
  }
}

process.exit(failures > 0 ? 1 : 0)
