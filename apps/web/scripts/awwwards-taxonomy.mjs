import { createClient } from './mcp-client.mjs'
import fs from 'node:fs'

const client = createClient()
await client.initialize()

const res = await client.callTool('list_categories', {})
const text = (res.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('\n')
fs.writeFileSync('awwwards-taxonomy.json', text)
// Print only the parts useful for a menu product.
try {
  const j = JSON.parse(text)
  const pick = (o) => (Array.isArray(o) ? o : [])
  console.log('TOP LEVEL KEYS:', Object.keys(j).join(', '))
  for (const k of Object.keys(j)) {
    const v = j[k]
    if (Array.isArray(v) && v.length && typeof v[0] === 'string') {
      console.log('\n' + k + ' (' + v.length + '):')
      console.log(v.join(', '))
    }
  }
} catch (e) {
  console.log(text.slice(0, 4000))
}
client.close()
process.exit(0)
