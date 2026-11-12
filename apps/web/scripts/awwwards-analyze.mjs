import { createClient } from './mcp-client.mjs'

const client = createClient()
await client.initialize()

for (const vp of ['desktop', 'mobile']) {
  console.log('\n=== ' + vp + ' ===')
  const res = await client.callTool('analyze_page_structure', {
    url: 'http://localhost:5173/m/cairo-coffee-house',
    viewport: vp,
  })
  const text = (res.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('\n')
  try {
    const j = JSON.parse(text)
    console.log('totalHeight:', j.totalHeight, ' bands:', j.bands.length)
    for (const b of j.bands) {
      console.log(
        '  #' + b.index + ' ' + String(b.height).padStart(5) + 'px  ' +
        b.background.padEnd(22) + ' ' + (b.label || b.tag) +
        (b.textStart ? '  text: "' + b.textStart.slice(0, 44) + '"' : ''),
      )
    }
  } catch (e) {
    console.log(text.slice(0, 1500))
  }
}
client.close()
process.exit(0)
