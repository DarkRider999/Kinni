// Placeholder shell -- the real Home/Beat/Melody/Stem Lab/DJ Mixer/FX/Sample Library/Settings
// views land here as the rest of the engine (synth playback, FX, mastering, DJ mixer) is wired
// up. Kept intentionally minimal so `npm run build`/`dev` stay green between work sessions.
export default function App() {
  return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="panel" style={{ padding: '32px 40px', textAlign: 'center', maxWidth: 480 }}>
        <h1 className="neon-text" style={{ margin: 0, fontSize: 28 }}>
          MixForge Studio
        </h1>
        <p style={{ color: 'var(--ink-dim)' }}>
          Work in progress -- the beat and melody generation engines are built and tested; the playable UI (step
          sequencer, piano roll, Stem Lab, DJ Mixer, FX Rack, Sample Library, Mastering) is still being wired up.
        </p>
      </div>
    </div>
  )
}
