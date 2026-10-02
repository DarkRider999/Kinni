import { useEffect, useMemo, useRef, useState } from 'react'
import { StepGrid } from '../components/StepGrid'
import { getAudioContext } from '../engine/context'
import { masterBuffer, type MasteringPresetId, MASTERING_PRESETS } from '../engine/mastering'
import { StepScheduler } from '../engine/scheduler'
import type { OneShotId } from '../engine/synthKit'
import { downloadBlob, audioBufferToWavBlob } from '../lib/wav'
import { renderBeatPatternToBuffer } from '../lib/renderBeat'
import {
  DRUM_LANES,
  GENRES,
  STEPS_PER_BAR,
  defaultBpmForGenre,
  generateBeatPattern,
  randomSeed,
  type BeatPattern,
  type DrumLane,
  type Genre,
} from '../lib/beatPatterns'
import { useStore } from '../state/store'

function clonePattern(pattern: BeatPattern): BeatPattern {
  return Object.fromEntries(DRUM_LANES.map((lane) => [lane, [...pattern[lane]]])) as BeatPattern
}

function defaultLaneSounds(): Record<DrumLane, OneShotId> {
  return Object.fromEntries(DRUM_LANES.map((lane) => [lane, lane])) as Record<DrumLane, OneShotId>
}

export function BeatGenerator() {
  const { oneShots, saveBeat } = useStore()
  const [genre, setGenre] = useState<Genre>('techno')
  const [bpm, setBpm] = useState(defaultBpmForGenre('techno'))
  const [energy, setEnergy] = useState(6)
  const [pattern, setPattern] = useState<BeatPattern>(() => generateBeatPattern({ genre: 'techno', bpm: 128, energy: 6, seed: 1 }))
  const [laneSounds, setLaneSounds] = useState<Record<DrumLane, OneShotId>>(defaultLaneSounds)
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState('')

  const schedulerRef = useRef<StepScheduler | null>(null)
  const patternRef = useRef(pattern)
  patternRef.current = pattern
  const laneSoundsRef = useRef(laneSounds)
  laneSoundsRef.current = laneSounds

  const effectiveOneShots = useMemo<Record<DrumLane, AudioBuffer> | null>(() => {
    if (!oneShots) return null
    return Object.fromEntries(DRUM_LANES.map((lane) => [lane, oneShots[laneSounds[lane]]])) as Record<DrumLane, AudioBuffer>
  }, [oneShots, laneSounds])

  useEffect(() => {
    return () => schedulerRef.current?.stop()
  }, [])

  function regenerate() {
    const next = generateBeatPattern({ genre, bpm, energy, seed: randomSeed() })
    setPattern(next)
  }

  function handleGenreChange(next: Genre) {
    setGenre(next)
    const nextBpm = defaultBpmForGenre(next)
    setBpm(nextBpm)
    setPattern(generateBeatPattern({ genre: next, bpm: nextBpm, energy, seed: randomSeed() }))
  }

  function toggleStep(lane: DrumLane, step: number) {
    setPattern((prev) => {
      const next = clonePattern(prev)
      next[lane][step] = !next[lane][step]
      return next
    })
  }

  function dropSampleOnLane(lane: DrumLane, sampleId: OneShotId) {
    setLaneSounds((prev) => ({ ...prev, [lane]: sampleId }))
  }

  function togglePlay() {
    if (!oneShots) return
    const ctx = getAudioContext()
    if (playing) {
      schedulerRef.current?.stop()
      setPlaying(false)
      setActiveStep(null)
      return
    }
    const scheduler = new StepScheduler({
      audioContext: ctx,
      stepsPerBar: STEPS_PER_BAR,
      onScheduleStep: (step, time) => {
        const current = patternRef.current
        const sounds = laneSoundsRef.current
        for (const lane of DRUM_LANES) {
          if (current[lane][step]) {
            const src = ctx.createBufferSource()
            src.buffer = oneShots[sounds[lane]]
            src.connect(ctx.destination)
            src.start(time)
          }
        }
      },
      onVisualStep: (step) => setActiveStep(step),
    })
    scheduler.setBpm(bpm)
    scheduler.start()
    schedulerRef.current = scheduler
    setPlaying(true)
  }

  useEffect(() => {
    schedulerRef.current?.setBpm(bpm)
  }, [bpm])

  function sendToProject() {
    saveBeat({ id: `beat_${Date.now()}`, name: `${genre} ${bpm}bpm`, genre, bpm, energy, pattern })
    setStatus(`Saved "${genre} ${bpm}bpm" — open it from DJ Mixer or Sample Library.`)
    setTimeout(() => setStatus(''), 4000)
  }

  async function exportLoop(preset: MasteringPresetId) {
    if (!effectiveOneShots) return
    setStatus('Rendering + mastering…')
    const bounced = await renderBeatPatternToBuffer(pattern, bpm, effectiveOneShots)
    const mastered = await masterBuffer(bounced, preset)
    downloadBlob(audioBufferToWavBlob(mastered), `mixforge-beat-${genre}-${bpm}bpm.wav`)
    setStatus('Exported.')
    setTimeout(() => setStatus(''), 3000)
  }

  return (
    <section className="view">
      <h1 className="glow-text" style={{ color: 'var(--forge-cyan)' }}>
        AI Beat Generator
      </h1>
      <p className="view-sub">Procedural, genre-conditioned pattern generation — editable MIDI-style grid.</p>

      <div className="panel controls-row">
        <label>
          Genre
          <select value={genre} onChange={(e) => handleGenreChange(e.target.value as Genre)}>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label>
          BPM <span className="value-pill">{bpm}</span>
          <input type="range" min={60} max={200} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
        </label>
        <label>
          Energy <span className="value-pill">{energy}</span>
          <input type="range" min={1} max={10} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} />
        </label>
        <button className="btn-primary" onClick={regenerate}>
          ⟳ Regenerate
        </button>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <StepGrid
          pattern={pattern}
          activeStep={playing ? activeStep : null}
          onToggle={toggleStep}
          laneSounds={laneSounds}
          onDropSample={dropSampleOnLane}
        />
        <p className="hint-line">Drag a sample from the Sample Library onto a lane name to swap its sound.</p>
      </div>

      <div className="controls-row" style={{ marginTop: 16 }}>
        <button className="btn-primary" onClick={togglePlay} disabled={!oneShots}>
          {playing ? '⏸ Stop' : '▶ Play'}
        </button>
        <button onClick={sendToProject}>Keep &amp; Send to Project</button>
        {(Object.keys(MASTERING_PRESETS) as MasteringPresetId[]).map((id) => (
          <button key={id} onClick={() => exportLoop(id)}>
            Export — {MASTERING_PRESETS[id].label}
          </button>
        ))}
      </div>
      {status && <p className="status-line">{status}</p>}
    </section>
  )
}
