import { useState } from 'react'
import { getAudioContext } from '../engine/context'
import type { OneShotId } from '../engine/synthKit'
import { useStore } from '../state/store'

type Category = 'drums' | 'perc' | 'bass' | 'melodic' | 'fx'

interface SampleMeta {
  id: OneShotId
  label: string
  category: Category
  genreTags: string[]
  moodTags: string[]
}

const CATALOG: SampleMeta[] = [
  { id: 'kick', label: 'Forge Kick', category: 'drums', genreTags: ['techno', 'house', 'edm'], moodTags: ['dark', 'uplifting'] },
  { id: 'snare', label: 'Hologram Snare', category: 'drums', genreTags: ['house', 'hiphop'], moodTags: ['uplifting'] },
  { id: 'clap', label: 'Neon Clap', category: 'drums', genreTags: ['house', 'edm'], moodTags: ['uplifting'] },
  { id: 'hihatClosed', label: 'Crystal Hat (closed)', category: 'drums', genreTags: ['techno', 'trance', 'house'], moodTags: ['chill', 'uplifting'] },
  { id: 'hihatOpen', label: 'Crystal Hat (open)', category: 'drums', genreTags: ['techno', 'trance'], moodTags: ['dark'] },
  { id: 'rimshot', label: 'Rim Tick', category: 'drums', genreTags: ['hiphop', 'trap'], moodTags: ['chill'] },
  { id: 'tomLow', label: 'Low Tom', category: 'drums', genreTags: ['hiphop', 'trap', 'techno'], moodTags: ['dark'] },
  { id: 'tomHigh', label: 'High Tom', category: 'drums', genreTags: ['hiphop', 'trap'], moodTags: ['uplifting'] },
  { id: 'conga', label: 'Neon Conga', category: 'perc', genreTags: ['house', 'psytrance'], moodTags: ['uplifting', 'chill'] },
  { id: 'shaker', label: 'Crystal Shaker', category: 'perc', genreTags: ['house', 'psytrance', 'edm'], moodTags: ['chill', 'uplifting'] },
  { id: 'cowbell', label: 'Forge Cowbell', category: 'perc', genreTags: ['house', 'techno'], moodTags: ['uplifting'] },
  { id: 'bassHit', label: 'Sub Forge Bass', category: 'bass', genreTags: ['psytrance', 'trap', 'techno'], moodTags: ['dark'] },
  { id: 'subBass', label: 'Deep Sub', category: 'bass', genreTags: ['trap', 'techno', 'edm'], moodTags: ['dark'] },
  { id: 'stab', label: 'Violet Stab', category: 'melodic', genreTags: ['trance', 'edm'], moodTags: ['uplifting'] },
  { id: 'pluck', label: 'Hologram Pluck', category: 'melodic', genreTags: ['trance', 'house', 'psytrance'], moodTags: ['uplifting', 'chill'] },
  { id: 'riser', label: 'Neon Riser', category: 'fx', genreTags: ['edm', 'trance', 'techno'], moodTags: ['uplifting'] },
  { id: 'impact', label: 'Forge Impact', category: 'fx', genreTags: ['edm', 'trap', 'techno'], moodTags: ['dark'] },
]

const GENRE_FILTERS = ['all', 'techno', 'house', 'trance', 'psytrance', 'hiphop', 'trap', 'edm'] as const
const MOOD_FILTERS = ['all', 'dark', 'uplifting', 'chill'] as const
const CATEGORY_FILTERS = ['all', 'drums', 'perc', 'bass', 'melodic', 'fx'] as const
const CATEGORY_LABELS: Record<Category, string> = {
  drums: 'Drums',
  perc: 'Percussion',
  bass: 'Bass',
  melodic: 'Melodic',
  fx: 'FX / Transitions',
}

export function SampleLibrary() {
  const { oneShots, audioReady } = useStore()
  const [genreFilter, setGenreFilter] = useState<(typeof GENRE_FILTERS)[number]>('all')
  const [moodFilter, setMoodFilter] = useState<(typeof MOOD_FILTERS)[number]>('all')
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORY_FILTERS)[number]>('all')

  const filtered = CATALOG.filter(
    (s) =>
      (genreFilter === 'all' || s.genreTags.includes(genreFilter)) &&
      (moodFilter === 'all' || s.moodTags.includes(moodFilter)) &&
      (categoryFilter === 'all' || s.category === categoryFilter),
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
        {CATALOG.length} starter one-shots standing in for the 10,000+ royalty-free catalog in the product spec
        — the genre/mood/category browsing and drag-to-place UX is real, the content behind it isn't licensed
        yet.
      </p>

      <div className="panel controls-row">
        <label>
          Category
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}>
            {CATEGORY_FILTERS.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'all' : CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
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
            <span className="sample-category">{CATEGORY_LABELS[sample.category]}</span>
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
