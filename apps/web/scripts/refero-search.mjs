import { createClient } from './mcp-client.mjs'
import fs from 'node:fs'

const client = createClient()
await client.initialize()

const queries = ['editorial restaurant menu', 'minimal food menu', 'magazine food editorial', 'dark luxury restaurant']
const found = {}

for (const q of queries) {
  console.log('\n=== search:', q, '===')
  const res = await client.callTool('refero_search_styles', { query: q, limit: 6, expand: 40 })
  const text = (res.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('\n')
  console.log(text.slice(0, 2200))
  found[q] = text
}

fs.writeFileSync('refero-search.json', JSON.stringify(found, null, 2))
client.close()
process.exit(0)
