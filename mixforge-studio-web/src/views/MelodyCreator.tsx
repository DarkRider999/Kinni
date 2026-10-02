import { useEffect, useRef, useState } from 'react'
import { PianoRoll } from '../components/PianoRoll'
import { getAudioContext } from '../engine/context'
import { playSynthNote } from '../engine/synthKit'
import { StepScheduler } from '../engine/scheduler'
import {
  NOTE_NAMES,
  STEPS_PER_BAR,
  generateMelody,
  noteToFrequency,
  randomSeed,
  regenerateRange,
  SCALES,
  type MelodyNote,
  type MelodyPartType,
  type NoteName,
  type ScaleId,
} from '../lib/melodyPatterns'
import { useStore } from '../state/store'

const SCALE_LABELS: Record<ScaleId, string> = {
  major: 'Major',
  naturalMinor: 'Natural Minor',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  harmonicMinor: 'Harmonic Minor',
}

const PART_LABELS: Record<MelodyPartType, string> = {
  melody: 'Melody',
  bassline: 'Bassline',
  chords: 'Chords',
}

export function MelodyCreator() {
  const { audioReady, saveMelody } = useStore()
  const [rootNote, setRootNote] = useState<NoteName>('A')
  const [scale, setScale] = useState<ScaleId>('naturalMinor')
  const [partType, setPartType] = useState<MelodyPartType>('melody')
  const [bpm, setBpm] = useState(128)
  const [notes, setNotes] = useState<MelodyNote[]>(() => generateMelody({ rootNote: 'A', scale: 'naturalMinor', partType: 'melody', bpm: 128, seed: 1 }))
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState('')

  const schedulerRef = useRef<StepScheduler | null>(null)
  const notesRef = useRef(notes)
  notesRef.current = notes

  useEffect(() => () => schedulerRef.current?.stop(), [])

  function regenerateAll() {
    setNotes(generateMelody({ rootNote, scale, partType, bpm, seed: randomSeed() }))
  }

  function regenerateHalf(half: 0 | 1) {
    const start = half === 0 ? 0 : STEPS_PER_BAR / 2
    const end = half === 0 ? STEPS_PER_BAR / 2 : STEPS_PER_BAR
    setNotes((prev) => regenerateRange(prev, partType, start, end, randomSeed()))
  }

  function toggleNote(step: number, degree: number) {
    setNotes((prev) => {
      const existing = prev.find((n) => n.step === step && n.scaleDegree === degree)
      if (existing) return prev.filter((n) => n !== existing)
      return [...prev, { step, scaleDegree: degree, octave: 0, durationSteps: 2 }]
    })
  }

  function togglePlay() {
    if (!audioReady) return
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
        const secondsPerStep = 60 / bpm / 4
        for (const note of notesRef.current) {
          if (note.step !== step) continue
          const freq = noteToFrequency(rootNote, partType === 'bassline' ? 2 : 4, scale, note.scaleDegree, note.octave)
          playSynthNote(ctx, ctx.destination, freq, time, note.durationSteps * secondsPerStep, partType === 'bassline' ? 'sawtooth' : 'triangle')
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

  function keep() {
    saveMelody({ id: `mel_${Date.now()}`, name: `${rootNote} ${SCALE_LABELS[scale]} ${PART_LABELS[partType]}`, rootNote, scale, partType, bpm, notes })
    setStatus('Saved to project.')
    setTimeout(() => setStatus(''), 3000)
  }

  return (
    <section className="view">
      <h1 className="glow-text" style={{ color: 'var(--synth-violet)' }}>
        Melody &amp; Bassline Creator
      </h1>
      <p className="view-sub">Scale-locked generation — every note is guaranteed in-key.</p>

      <div className="panel controls-row">
        <label>
          Root
          <select value={rootNote} onChange={(e) => setRootNote(e.target.value as NoteName)}>
            {NOTE_NAMES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Scale
          <select value={scale} onChange={(e) => setScale(e.target.value as ScaleId)}>
            {(Object.keys(SCALES) as ScaleId[]).map((s) => (
              <option key={s} value={s}>
                {SCALE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Part
          <select value={partType} onChange={(e) => setPartType(e.target.value as MelodyPartType)}>
            {(Object.keys(PART_LABELS) as MelodyPartType[]).map((p) => (
              <option key={p} value={p}>
                {PART_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label>
          BPM <span className="value-pill">{bpm}</span>
          <input type="range" min={60} max={200} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
        </label>
        <button className="btn-primary" onClick={regenerateAll}>
          Regenerate
        </button>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <PianoRoll notes={notes} stepsPerBar={STEPS_PER_BAR} activeStep={playing ? activeStep : null} onToggleNote={toggleNote} />
      </div>

      <div className="controls-row" style={{ marginTop: 16 }}>
        <button className="btn-primary" onClick={togglePlay} disabled={!audioReady}>
          {playing ? 'Stop' : 'Play'}
        </button>
        <button onClick={() => regenerateHalf(0)}>Regenerate bars 1-2</button>
        <button onClick={() => regenerateHalf(1)}>Regenerate bars 3-4</button>
        <button onClick={keep}>Keep &amp; Send to Project</button>
      </div>
      {status && <p className="status-line">{status}</p>}
    </section>
  )
}
