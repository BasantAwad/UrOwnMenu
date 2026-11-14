/**
 * Critic and Motion schema checks (build spec 10.2).
 *   node --experimental-strip-types scripts/verify-critic.mjs
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateCritic, validateMotion } from '../src/pipeline/schemas.ts'
import { RULES } from '../src/pipeline/rules.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const fixtures = path.join(HERE, '..', 'harness', 'pipeline-fixtures')
const read = async (name) => JSON.parse(await readFile(path.join(fixtures, name), 'utf8'))

const plan = {
  seed: 1,
  layers: [
    { assetId: 'hero', kind: 'hero', x: 0.7, y: 0.45, scale: 1, rotation: 0, depth: 0.5, blurPx: 0, parallax: 0.5, z: 10 },
    { assetId: 'accent-1', kind: 'accent', x: 0.85, y: 0.3, scale: 0.6, rotation: 0, depth: 0.2, blurPx: 0, parallax: 0.3, z: 30 },
  ],
  dropped: [],
}

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

const pass = await read('critic-pass.json')
const badVerdict = await read('critic-invalid-verdict.json')

check('a pass verdict with a complete checklist validates', () => {
  const result = validateCritic(pass, plan)
  assert.equal(result.verdict, 'pass')
  assert.equal(result.checks.length, 7)
})

check('a verdict outside the enum is rejected', () => {
  assert.throws(() => validateCritic(badVerdict, plan), /verdict must be pass, fix or regenerate/)
})

check('a finding for a layer that is not in the plan is rejected', () => {
  const bad = {
    ...pass,
    verdict: 'fix',
    findings: [{ layerId: 'accent-9', check: 4, problem: 'on the copy', action: 'fix' }],
  }
  assert.throws(() => validateCritic(bad, plan), /accent-9 is not in the plan/)
})

check('a pass verdict cannot carry a regenerate finding', () => {
  const bad = {
    ...pass,
    findings: [{ layerId: 'accent-1', check: 1, problem: 'wrong food', action: 'regenerate' }],
  }
  assert.throws(() => validateCritic(bad, plan), /cannot carry a regenerate finding/)
})

check('a fix finding validates against the plan', () => {
  const fix = {
    ...pass,
    verdict: 'fix',
    checks: pass.checks.map((c) => (c.n === 4 ? { ...c, ok: false } : c)),
    findings: [{ layerId: 'accent-1', check: 4, problem: 'accent on copy edge', action: 'fix' }],
  }
  assert.equal(validateCritic(fix, plan).verdict, 'fix')
})

check('motion duration outside RULES is rejected', () => {
  const valid = { clipPrompt: 'a bowl', durationSeconds: 6, endFrameDescription: 'centred bowl' }
  assert.equal(validateMotion(valid).durationSeconds, 6)
  assert.throws(() => validateMotion({ ...valid, durationSeconds: RULES.videoDurationSeconds.min - 1 }), /between 4 and 10/)
  assert.throws(() => validateMotion({ ...valid, durationSeconds: RULES.videoDurationSeconds.max + 1 }), /between 4 and 10/)
})

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`)
