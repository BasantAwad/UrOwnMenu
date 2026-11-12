import { createClient } from './mcp-client.mjs'
import fs from 'node:fs'

const client = createClient()
await client.initialize()

const url = process.argv[2] || 'http://localhost:5173/m/cairo-coffee-house'
const viewport = process.argv[3] || 'desktop'
const outName = process.argv[4] || 'capture'

const res = await client.callTool('capture_live_site', { url, viewport, inline: false })
const text = (res.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('\n')
console.log(text.slice(0, 2000))

// The tool reports where it saved the file.
try {
  const j = JSON.parse(text)
  const file = j.file || j.path || (j.files && j.files[0])
  if (file) {
    fs.copyFileSync(file, outName + '.png')
    console.log('COPIED to', outName + '.png')
  }
} catch (e) {
  console.log('(not json)')
}
client.close()
process.exit(0)
