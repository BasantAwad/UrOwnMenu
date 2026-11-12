import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PublicMenu from './PublicMenu.tsx'

/**
 * Route resolution:
 *   /m/:slug          -> public menu (no authentication required)
 *   /m/:slug/:version -> public menu pinned to an immutable snapshot
 *   everything else   -> owner studio
 */
function Root() {
  const pathname = window.location.pathname

  if (/^\/m\/[^/]+/.test(pathname)) {
    const slug = pathname.split('/')[2] || ''
    return <PublicMenu slug={slug} />
  }

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
