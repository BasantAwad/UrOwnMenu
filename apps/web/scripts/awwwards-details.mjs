import { createClient } from './mcp-client.mjs'
import fs from 'node:fs'

const client = createClient()
await client.initialize()

const slugs = ['agrumea-farm', 'tengile-malamala-collection', 'casa-momo', 'giacosa-firenze']
const out = {}

console.log('--- site details ---')
const det = await client.callTool('get_site_details', { slugs })
out.details = (det.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('\n')
console.log(out.details.slice(0, 5000))

for (const slug of slugs) {
  console.log('\n--- structure: ' + slug + ' ---')
  try {
    const res = await client.callTool('analyze_page_structure', {
      url: slug === 'agrumea-farm' ? 'https://www.agrumeafarm.it/en'
        : slug === 'tengile-malamala-collection' ? 'https://tengilemalamala.com'
        : slug === 'casa-momo' ? 'https://www.casamomo.at/'
        : 'https://www.giacosafirenze.com/en',
      viewport: 'desktop',
    })
    const text = (res.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('\n')
    out['structure_' + slug] = text
    console.log(text.slice(0, 2500))
  } catch (e) {
    console.log('ERROR', e.message.slice(0, 300))
  }
}

fs.writeFileSync('awwwards-details.json', JSON.stringify(out, null, 2))
client.close()
process.exit(0)
