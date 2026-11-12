import { createClient } from './mcp-client.mjs'
import fs from 'node:fs'

const client = createClient()
await client.initialize()

const styles = {
  mollie: '73ec75d6-edec-4ed2-bc09-debb261b6ee0',
  milanote: 'bea59438-bb4f-47ea-9484-f41caf6eb685',
  graphite: 'fd36bae9-dbf4-4b0f-a48b-e8c6f92edca3',
  glyphs: '67bb82e2-d81c-4ead-a882-a8a2534eb221',
}

const out = {}
for (const [name, id] of Object.entries(styles)) {
  console.log('\n=== ' + name + ' ===')
  const res = await client.callTool('refero_get_design_md', { style_id: id })
  const text = (res.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('\n')
  out[name] = text
  console.log(text.slice(0, 2600))
}

fs.writeFileSync('refero-design-systems.md', Object.entries(out)
  .map(([k, v]) => '# ' + k + '\n\n' + v)
  .join('\n\n---\n\n'))
client.close()
process.exit(0)
