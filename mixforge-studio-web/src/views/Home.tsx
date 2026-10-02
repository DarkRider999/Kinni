import { useStore } from '../state/store'

interface HomeProps {
  onNavigate: (view: string) => void
}

const TILES = [
  { id: 'beat', label: 'New Beat', color: 'var(--forge-cyan)', desc: 'AI Beat Generator' },
  { id: 'melody', label: 'New Melody', color: 'var(--synth-violet)', desc: 'Melody & Bassline Creator' },
  { id: 'mixer', label: 'DJ Mixer', color: 'var(--forge-cyan)', desc: 'Two decks, live mixing' },
  { id: 'samples', label: 'Sample Library', color: 'var(--hologram-magenta)', desc: 'Browse the starter kit' },
]

export function Home({ onNavigate }: HomeProps) {
  const { beats, melodies } = useStore()
  return (
    <section className="view">
      <h1 className="glow-text" style={{ color: 'var(--forge-cyan)' }}>
        MixForge Studio
      </h1>
      <p className="view-sub">AI music creation + DJ mixing + Stem Lab — web preview build.</p>

      <div className="home-tiles">
        {TILES.map((tile) => (
          <button key={tile.id} className="home-tile" style={{ borderColor: tile.color }} onClick={() => onNavigate(tile.id)}>
            <span className="home-tile-label" style={{ color: tile.color }}>
              {tile.label}
            </span>
            <span className="home-tile-desc">{tile.desc}</span>
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 24, padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem', color: 'var(--text-dim)' }}>Project</h2>
        <p>
          {beats.length} beat{beats.length === 1 ? '' : 's'} · {melodies.length} melody part{melodies.length === 1 ? '' : 's'} saved
          this session.
        </p>
      </div>
    </section>
  )
}
