import { useEffect, useState } from 'react'
import { ToastProvider, TooltipProvider } from './design/primitives'
import { DesignGallery } from './routes/DesignGallery'

// Hash routing keeps the static Vercel deploy simple until the editor routes
// (S01 /, S03 /editor/:id) land in /replica-build.
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-10) var(--space-6)', display: 'grid', gap: 'var(--space-4)' }}>
      <h1 style={{ fontSize: 'var(--text-2xl-size)', lineHeight: 'var(--text-2xl-line)', fontWeight: 700 }}>Short Video Editor</h1>
      <p className="text-muted">The editor is being built screen by screen. The design system is ready to review.</p>
      <p>
        <a href="#/design" style={{ color: 'var(--color-accent)' }}>Open the design system →</a>
      </p>
    </main>
  )
}

export function App() {
  const route = useHashRoute()
  return (
    <TooltipProvider>
      <ToastProvider>{route === '#/design' ? <DesignGallery /> : <Home />}</ToastProvider>
    </TooltipProvider>
  )
}
