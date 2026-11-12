import { createClient } from './mcp-client.mjs'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const API = 'http://127.0.0.1:8787'
const EMAIL = process.argv[2] || 'nour@cairo.test'
const PASSWORD = process.argv[3] || 'TestPass123'
const templates = [
  'editorial-showcase',
  'orbital-menu',
  'ingredient-universe',
  'endless-table',
  'magazine',
  'ingredient-story',
  'cafe',
  'mosaic',
]

async function call(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (options.token) headers['Authorization'] = 'Bearer ' + options.token
  // The local worker occasionally resets a pooled keep-alive socket, so
  // retry rather than fail the run.
  let lastError = null
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(API + path, { ...options, headers })
      const text = await res.text()
      let body = null
      try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
      if (!res.ok) throw new Error(path + ' -> ' + res.status + ' ' + (body && body.error))
      return body
    } catch (e) {
      lastError = e
      await new Promise((r) => setTimeout(r, 600))
    }
  }
  throw lastError
}

const login = await call('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const token = login.session
const restaurants = await call('/api/restaurants', { token })
const restaurant = restaurants.restaurants[0]

for (const template of templates) {
  const published = await call('/api/publish', {
    method: 'POST',
    token,
    body: JSON.stringify({ restaurant_id: restaurant.id, template }),
  })
  console.log('\n### ' + template + ' -> ' + published.publishedUrl)

  for (const viewport of ['desktop', 'mobile']) {
    const out = 'shot-' + template + '-' + viewport
    try {
      const text = execFileSync(
        process.execPath,
        ['scripts/awwwards-capture.mjs', published.publishedUrl, viewport, out],
        { encoding: 'utf8' },
      )
      const m = /saved to ([^\r\n]+?)(?:\s|$)/.exec(text)
      if (m) {
        const src = m[1].trim()
        fs.copyFileSync(src, out + '.png')
        const size = fs.statSync(out + '.png').size
        console.log('  ' + viewport + ': ' + out + '.png (' + Math.round(size / 1024) + ' KB)')
      }
    } catch (e) {
      console.log('  ' + viewport + ': CAPTURE FAILED ' + String(e.message).slice(0, 200))
    }
  }
}

process.exit(0)
