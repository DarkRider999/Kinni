import { useState } from 'react'
import './App.css'
import { BeatGenerator } from './views/BeatGenerator'
import { DJMixer } from './views/DJMixer'
import { Home } from './views/Home'
import { Logo } from './components/Logo'
import { MelodyCreator } from './views/MelodyCreator'
import { SampleLibrary } from './views/SampleLibrary'
import { StoreProvider, useStore } from './state/store'

type ViewId = 'home' | 'beat' | 'melody' | 'mixer' | 'samples'

const NAV: Array<{ id: ViewId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'beat', label: 'Beat Generator' },
  { id: 'melody', label: 'Melody' },
  { id: 'mixer', label: 'DJ Mixer' },
  { id: 'samples', label: 'Samples' },
]

function Shell() {
  const { audioReady, kitReady, startAudio } = useStore()
  const [view, setView] = useState<ViewId>('home')

  if (!audioReady || !kitReady) {
    return (
      <div className="gate">
        <div className="splash-logo">
          <Logo size={120} animated />
        </div>
        <h1 className="glow-text splash-title" style={{ color: 'var(--forge-cyan)' }}>
          MixForge Studio
        </h1>
        <p className="splash-byline">by SplitFire Production</p>
        <p className="splash-hint">Browsers require a tap before audio can start.</p>
        <button className="btn-primary btn-large splash-button" onClick={() => void startAudio()}>
          Enter the Studio
        </button>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <span className="brand glow-text">
          <Logo size={22} className="brand-logo" />
          MixForge
        </span>
        {NAV.map((item) => (
          <button key={item.id} className={view === item.id ? 'nav-btn active' : 'nav-btn'} onClick={() => setView(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>
      <main className="app-main">
        {view === 'home' && <Home onNavigate={(v) => setView(v as ViewId)} />}
        {view === 'beat' && <BeatGenerator />}
        {view === 'melody' && <MelodyCreator />}
        {view === 'mixer' && <DJMixer />}
        {view === 'samples' && <SampleLibrary />}
      </main>
    </div>
  )
}

function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

export default App
