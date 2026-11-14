/**
 * Analyst and Art Director schema checks (build spec 10.2 and 3.1/3.2 tests).
 *   node --experimental-strip-types scripts/verify-analyst.mjs
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { capAccents, enforceSplash, validateAnalysis, validateBrief } from '../src/pipeline/schemas.ts'
import { isLiquidBased } from '../src/pipeline/rules.ts'
import { dryAnalysis, dryBrief } from '../pipeline-runner/fixtures.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const fixtures = path.join(HERE, '..', 'harness', 'pipeline-fixtures')
const read = async (name) => JSON.parse(await readFile(path.join(fixtures, name), 'utf8'))

let passed = 0
const check = (name, fn) => {
  try {
    fn()
    passed++
    console.log('ok  ', name)
  } catch (error) {
    console.log('FAIL', name, '\n     ', error.message)
    process.exitCode = 1
  }
}

const owner = ['Greek yogurt', 'strawberries', 'granola']
const valid = await read('analyst-valid.json')
const invented = await read('analyst-invalid-ingredient.json')
const badMood = await read('analyst-invalid-mood.json')
const briefFixture = await read('art-brief-valid.json')

check('a valid analyst answer passes and keeps the owner spelling', () => {
  const analysis = validateAnalysis(valid, owner)
  assert.deepEqual(analysis.ingredients, owner)
  assert.equal(analysis.mood, 'fresh')
})

check('an invented ingredient is rejected with a specific message', () => {
  assert.throws(() => validateAnalysis(invented, owner), /blueberries is not in the input list/)
})

check('an empty owner ingredient list stays empty and rejects additions', () => {
  const empty = validateAnalysis({ ...valid, ingredients: [] }, [])
  assert.deepEqual(empty.ingredients, [])
  assert.throws(() => validateAnalysis({ ...valid, ingredients: ['lemon'] }, []), /not in the input list/)
})

check('a mood outside the enum is rejected', () => {
  assert.throws(() => validateAnalysis(badMood, owner), /mood must be one of/)
})

check('a hero longer than four words or with capitals is rejected', () => {
  assert.throws(() => validateAnalysis({ ...valid, hero: 'one two three four five' }, owner), /four words/)
  assert.throws(() => validateAnalysis({ ...valid, hero: 'Strawberry Yogurt' }, owner), /lowercase/)
})

check('a valid art brief passes with accents in ingredient order', () => {
  const analysis = validateAnalysis(valid, owner)
  const brief = validateBrief(briefFixture, analysis, 6)
  assert.equal(brief.layers.filter((layer) => layer.kind === 'accent').length, 3)
  assert.equal(brief.lightSentence, 'soft key light from upper left, no hard shadow on background')
})

check('accents are capped in code and the trim is reported', () => {
  const analysis = validateAnalysis(valid, owner)
  const brief = validateBrief(briefFixture, analysis, 2)
  const capped = capAccents(brief, 2)
  assert.equal(capped.brief.layers.filter((layer) => layer.kind === 'accent').length, 2)
  assert.equal(capped.trimmed, 1)
})

check('an accent that is not an analysis ingredient is rejected', () => {
  const analysis = validateAnalysis(valid, owner)
  const bad = { ...briefFixture, layers: briefFixture.layers.map((layer, i) => (i === 4 ? { ...layer, assetLabel: 'blueberries' } : layer)) }
  assert.throws(() => validateBrief(bad, analysis, 6), /does not match an analysis ingredient/)
})

check('accents out of ingredient order are rejected', () => {
  const analysis = validateAnalysis(valid, owner)
  const layers = briefFixture.layers.filter((layer) => layer.kind !== 'accent')
  const accents = briefFixture.layers.filter((layer) => layer.kind === 'accent')
  const reordered = { ...briefFixture, layers: [...layers, accents[1], accents[0], accents[2]] }
  assert.throws(() => validateBrief(reordered, analysis, 6), /out of order/)
})

check('a dry item gets no splash; a liquid item gets one added by code', () => {
  assert.equal(isLiquidBased('Caesar Salad', 'caesar salad'), false)
  assert.equal(isLiquidBased('Strawberry Yogurt Bowl', 'strawberry yogurt'), true)

  const caesar = dryAnalysis({ id: 'c', name: 'Caesar Salad', ingredients: ['romaine', 'parmesan', 'croutons'] })
  const caesarDraft = dryBrief(caesar, 6)
  const caesarBrief = enforceSplash(caesarDraft, isLiquidBased(caesar.item, caesar.hero), caesar)
  assert.equal(caesarBrief.layers.some((layer) => layer.kind === 'splash'), false)

  const bowl = dryAnalysis({ id: 'b', name: 'Strawberry Yogurt Bowl', ingredients: owner })
  const liquidBrief = dryBrief(bowl, 6)
  assert.equal(liquidBrief.layers.some((layer) => layer.kind === 'splash'), true)
  assert.equal(enforceSplash(liquidBrief, true, bowl).layers.filter((layer) => layer.kind === 'splash').length, 1)
})

check('the dry-run art brief passes the same validator as a real answer', () => {
  const analysis = dryAnalysis({ id: 'x', name: 'Crispy Fries', ingredients: ['potatoes', 'sea salt', 'vegetable oil'] })
  const brief = dryBrief(analysis, 6)
  assert.doesNotThrow(() => validateBrief(brief, analysis, 6))
})

check('when the hero is also an ingredient, its visual is differentiated (spec 4.2)', () => {
  const analysis = dryAnalysis({ id: 'f', name: 'Potatoes', ingredients: ['potatoes', 'sea salt'] })
  const brief = dryBrief(analysis, 6)
  const hero = brief.layers.find((layer) => layer.kind === 'hero')
  const accent = brief.layers.find((layer) => layer.kind === 'accent' && layer.assetLabel === 'potatoes')
  assert.match(hero.visual, /pile of potatoes/)
  assert.match(accent.visual, /single potatoes/)
  assert.notEqual(hero.visual, accent.visual)
})

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`)
