import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/design-tokens.css'
import { TemplateRenderer, paletteVars } from '../src/templates'
import { fixture } from './fixture'

const q = new URLSearchParams(location.search)
const t = (q.get('t') || 'ingredient-story') as any
const snap = fixture(t, (q.get('p') || 'espresso-cream') as any)
createRoot(document.getElementById('root')!).render(
  <div className="public" style={paletteVars(snap) as any}><main className="public__canvas"><TemplateRenderer template={t} snapshot={snap} /></main></div>,
)
