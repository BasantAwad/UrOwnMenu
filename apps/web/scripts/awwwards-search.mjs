import { createClient } from './mcp-client.mjs'
import fs from 'node:fs'

const client = createClient()
await client.initialize()

const searches = [
  { label: 'food-drink', args: { tags: ['food-drink'], count: 10, responseMode: 'compact', sortBy: 'score' } },
  { label: 'hotel-restaurant', args: { tags: ['hotel-restaurant'], count: 10, responseMode: 'compact', sortBy: 'score' } },
  { label: 'menu-vertical', args: { tags: ['menu-vertical'], count: 10, responseMode: 'compact', sortBy: 'score' } },
  { label: 'magazine', args: { tags: ['magazine-newspaper-blog'], count: 10, responseMode: 'compact', sortBy: 'score' } },
  { label: 'scrolling', args: { tags: ['scrolling', 'storytelling'], count: 8, responseMode: 'compact', sortBy: 'score' } },
]

const out = {}
for (const s of searches) {
  console.log('\n=== ' + s.label + ' ===')
  try {
    const res = await client.callTool('search_sites', s.args)
    const text = (res.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('\n')
    out[s.label] = text
    console.log(text.slice(0, 2200))
  } catch (e) {
    console.log('ERROR', e.message.slice(0, 300))
  }
}

fs.writeFileSync('awwwards-search.json', JSON.stringify(out, null, 2))
client.close()
process.exit(0)
