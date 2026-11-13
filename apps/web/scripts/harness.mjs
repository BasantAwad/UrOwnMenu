/**
 * Template harness: render any public template against a fixture menu and
 * screenshot it, with no API, database or login.
 *
 *   node scripts/harness.mjs assets                 # make fixture images once
 *   node scripts/harness.mjs shoot ingredient-story # screenshot to ./shots
 *   node scripts/harness.mjs shoot orbital-menu --w 390 --h 844 --palette tomato-parchment
 *
 * Needs the web dev server running (`npm run dev`, default :5173). Override
 * with HARNESS_BASE=http://localhost:5199. On a machine where Playwright's
 * bundled Chromium is not installed, set CHROMIUM_PATH to any Chrome/Chromium.
 *
 * What it gives you that reading code does not: the rendered pixels. Every
 * design decision in docs/AI_BUILDER_PLAYBOOK.md is checked by looking at
 * these screenshots at 390, 820 and 1440 wide.
 */
import { chromium } from 'playwright'
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WEB = path.resolve(HERE, '..')
const BASE = process.env.HARNESS_BASE || 'http://localhost:5173'

const args = process.argv.slice(2)
const cmd = args[0]
const flag = (name, fallback) => {
  const i = args.indexOf('--' + name)
  return i >= 0 ? args[i + 1] : fallback
}

const launch = () =>
  chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})

async function assets() {
  const out = path.join(WEB, 'public', 'harness')
  await mkdir(out, { recursive: true })
  const browser = await launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } })

  // 1. Illustrated dishes as transparent PNG cutouts (stand-ins for real cutouts).
  await page.goto(BASE + '/harness/assets.html')
  await page.waitForSelector('.cell')
  for (const id of await page.$$eval('.cell', (n) => n.map((x) => x.id))) {
    await (await page.$('#' + id)).screenshot({ path: path.join(out, id + '.png'), omitBackground: true })
  }

  // 2. Procedural macro backgrounds (stand-ins for Openverse ingredient photos).
  const shot = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  for (const m of ['cold-brew', 'dark-chocolate', 'orange']) {
    await shot.goto(BASE + '/harness/macro.html#' + m)
    await shot.reload()
    await shot.waitForTimeout(500)
    await shot.screenshot({ path: path.join(out, `macro-${m}.jpg`), type: 'jpeg', quality: 82 })
  }
  await browser.close()

  // 3. Two real photographs that already ship with the repo.
  for (const f of ['drink.png', 'food.png']) {
    await copyFile(path.join(WEB, '..', 'api', 'test-assets', f), path.join(out, f))
  }
  console.log('fixture assets written to', out)
}

async function shoot() {
  const template = args[1]
  if (!template) throw new Error('usage: harness.mjs shoot <template-key> [--w N] [--h N] [--palette key] [--viewport-only]')
  const w = Number(flag('w', 1280))
  const h = Number(flag('h', 900))
  const palette = flag('palette', 'espresso-cream')
  const fullPage = !args.includes('--viewport-only')
  const outDir = path.join(WEB, 'shots')
  await mkdir(outDir, { recursive: true })
  const file = flag('out', path.join(outDir, `${template}-${w}.png`))

  const browser = await launch()
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const problems = []
  page.on('pageerror', (e) => problems.push('script error: ' + e.message))
  page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()}: ${r.url().replace(BASE, '')}`))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && problems.push('console: ' + m.text()))
  page.on('requestfailed', (r) => problems.push('request failed: ' + r.url().slice(0, 90)))

  await page.goto(`${BASE}/harness/index.html?t=${template}&p=${palette}`)
  await page.waitForTimeout(1500)

  // Scroll through once so scroll-linked and lazy states resolve before the capture.
  const total = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < total; y += Math.max(300, h / 2)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y)
    await page.waitForTimeout(100)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  await page.screenshot({ path: file, fullPage })
  await browser.close()

  console.log(`${template} @${w}px  page height ${total}px  horizontal overflow ${overflow}px`)
  console.log('screenshot:', file)
  if (overflow > 0) console.log('WARNING: page scrolls sideways by', overflow, 'px')
  if (problems.length) console.log('PROBLEMS:\n  ' + [...new Set(problems)].slice(0, 8).join('\n  '))
}

if (cmd === 'assets') await assets()
else if (cmd === 'shoot') await shoot()
else console.log('usage: node scripts/harness.mjs assets | shoot <template-key> [--w N --h N --palette key --out file --viewport-only]')
