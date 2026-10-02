import { useState } from 'react'
import { getAudioContext } from '../engine/context'
import type { OneShotId } from '../engine/synthKit'
import { useStore } from '../state/store'

interface SampleMeta {
  id: OneShotId
  label: string
  genreTags: string[]
  moodTags: string[]
}

const CATALOG: SampleMeta[] = [
  { id: 'kick', label: 'Forge Kick', genreTags: ['techno', 'house', 'edm'], moodTags: ['dark', 'uplifting'] },
  { id: 'snare', label: 'Hologram Snare', genreTags: ['house', 'hiphop'], moodTags: ['uplifting'] },
  { id: 'clap', label: 'Neon Clap', genreTags: ['house', 'edm'], moodTags: ['uplifting'] },
  { id: 'hihatClosed', label: 'Crystal Hat (closed)', genreTags: ['techno', 'trance', 'house'], moodTags: ['chill', 'uplifting'] },
  { id: 'hihatOpen', label: 'Crystal Hat (open)', genreTags: ['techno', 'trance'], moodTags: ['dark'] },
  { id: 'bassHit', label: 'Sub Forge Bass', genreTags: ['psytrance', 'trap', 'techno'], moodTags: ['dark'] },
  { id: 'rimshot', label: 'Rim Tick', genreTags: ['hiphop', 'trap'], moodTags: ['chill'] },
  { id: 'stab', label: 'Violet Stab', genreTags: ['trance', 'edm'], moodTags: ['uplifting'] },
]

const GENRE_FILTERS = ['all', 'techno', 'house', 'trance', 'psytrance', 'hiphop', 'trap', 'edm'] as const
const MOOD_FILTERS = ['all', 'dark', 'uplifting', 'chill'] as const

export function SampleLibrary() {
  const { oneShots, audioReady } = useStore()
  const [genreFilter, setGenreFilter] = useState<(typeof GENRE_FILTERS)[number]>('all')
  const [moodFilter, setMoodFilter] = useState<(typeof MOOD_FILTERS)[number]>('all')

  const filtered = CATALOG.filter(
    (s) => (genreFilter === 'all' || s.genreTags.includes(genreFilter)) && (moodFilter === 'all' || s.moodTags.includes(moodFilter)),
  )

  function preview(id: OneShotId) {
    if (!oneShots) return
    const ctx = getAudioContext()
    const src = ctx.createBufferSource()
    src.buffer = oneShots[id]
    src.connect(ctx.destination)
    src.start()
  }

  return (
    <section className="view">
      <h1 className="glow-text" style={{ color: 'var(--hologram-magenta)' }}>
        Sample Library
      </h1>
      <p className="view-sub">
        A starter one-shot kit standing in for the 10,000+ royalty-free catalog in the product spec — the
        genre/mood browsing and drag-to-place UX is real, the content behind it isn't licensed yet.
      </p>

      <div className="panel controls-row">
        <label>
          Genre
          <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value as typeof genreFilter)}>
            {GENRE_FILTERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mood
          <select value={moodFilter} onChange={(e) => setMoodFilter(e.target.value as typeof moodFilter)}>
            {MOOD_FILTERS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="sample-grid">
        {filtered.map((sample) => (
          <div
            key={sample.id}
            className="panel sample-card"
            draggable={audioReady}
            onDragStart={(e) => e.dataTransfer.setData('text/mixforge-sample', sample.id)}
            onClick={() => preview(sample.id)}
          >
            <span className="sample-name">{sample.label}</span>
            <span className="sample-tags">
              {[...sample.genreTags, ...sample.moodTags].map((t) => (
                <span key={t} className="tag-pill">
                  {t}
                </span>
              ))}
            </span>
            <span className="sample-play">▶ preview</span>
          </div>
        ))}
      </div>
    </section>
  )
}
