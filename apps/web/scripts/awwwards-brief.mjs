import { createClient } from './mcp-client.mjs'
import fs from 'node:fs'

const client = createClient()
await client.initialize()

const slugs = [
  'lajoya-foods',
  'giacosa-firenze',
  'agrumea-farm',
  'tengile-malamala-collection',
  'casa-momo',
]

const goal = [
  'A digital menu for a restaurant, built by the owner and read by customers on a phone after scanning a QR code.',
  'Five template modes: (1) Editorial Showcase - cinematic hero, restaurant identity, concise statement, an "Explore menu" action, signature dishes, categories, full menu, visit block;',
  '(2) Orbital Menu - dishes on an ellipse orbit, selected dish moves to a focal zone, title/description/price/marker transition together, centered/horizontal/vertical variants;',
  '(3) Ingredient Universe - a hero glass with owner-named ingredients on front/middle/back depth planes, connector lines, labels, contact shadows;',
  '(4) Endless Table - continuous vertical scroll, alternating image/text, category chapters, active category indicator, compact list mode;',
  '(5) Menu Magazine - editorial spreads, page numbers, category tabs, 2D page turn, list fallback.',
  'Needs the Wove-style numbered orbital category navigation: a thin elliptical orbit with markers, one prominent active marker, oversized active number, bold title and light supporting copy beside it, generous negative space and asymmetry.',
  'Constraints: free and open-source only, no paid services, no WebGL, must work without JS for reading, fast on mobile data, plain CSS + React, no CSS framework.',
].join(' ')

console.log('creating brief...')
const res = await client.callTool('create_design_brief', {
  slugs,
  goal,
  audience: 'Restaurant owners publishing menus, and their customers scanning a QR code on a phone',
  constraints: [
    'No CSS framework - plain CSS with design tokens',
    'No WebGL - CSS 3D transforms only',
    'Must be readable with JavaScript disabled',
    'Fast on mobile data - no heavy assets',
    'Free and open-source dependencies only',
  ],
  includeStructure: true,
  viewport: 'desktop',
  maxBands: 14,
})

const text = (res.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('\n')
fs.writeFileSync('design-brief.md', text)
console.log('BRIEF LENGTH:', text.length)
console.log(text.slice(0, 6000))
client.close()
process.exit(0)
