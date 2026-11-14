import { createRoot } from 'react-dom/client'
import { ScrollScrub } from '../src/ScrollScrub'

const src = new URLSearchParams(location.search).get('v') || '/harness/scrub-test.mp4'
createRoot(document.getElementById('root')!).render(
  <>
    <ScrollScrub src={src} height="300vh">
      <p style={{ margin: 0, textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>Scroll to scrub</p>
    </ScrollScrub>
    <div style={{ height: '40vh', background: '#111' }} />
  </>,
)
