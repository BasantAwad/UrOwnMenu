import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/design-tokens.css'
import { TemplateRenderer, paletteVars } from '../src/templates'
import { fixture, setAssetResolver } from './fixture'

const files = import.meta.glob('../public/harness/min/*', { query: '?inline', import: 'default', eager: true }) as Record<string, string>
const byName: Record<string, string> = {}
for (const [path, uri] of Object.entries(files)) byName[path.split('/').pop()!.replace(/\.(webp|jpg)$/, '')] = uri
// Fixture asks for "iced-coffee.png" etc.; resolve by stem.
setAssetResolver((f) => byName[f.replace(/\.(png|jpg|webp)$/, '')] ?? '')

const snap = fixture('ingredient-story' as any, 'espresso-cream' as any)
createRoot(document.getElementById('root')!).render(
  <div className="public" style={paletteVars(snap) as any}><main className="public__canvas"><TemplateRenderer template={'ingredient-story' as any} snapshot={snap} /></main></div>,
)
