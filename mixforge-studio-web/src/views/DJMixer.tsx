import { useEffect, useRef, useState } from 'react'
import { Waveform } from '../components/Waveform'
import { getAudioContext } from '../engine/context'
import { Deck } from '../engine/deck'
import { formatDuration } from '../lib/formatDuration'
import { equalPowerCrossfade } from '../lib/mixerMath'
import { renderBeatPatternToBuffer } from '../lib/renderBeat'
import { downloadBlob } from '../lib/wav'
import { useStore, type SavedBeat, type SavedSession } from '../state/store'

type DeckId = 'A' | 'B'

interface DeckUiState {
  name: string
  bpm: number
  playing: boolean
  filter: number
  echo: number
  reverb: number
  flanger: number
  progress: number
}

const INITIAL_DECK_STATE: DeckUiState = {
  name: 'Empty',
  bpm: 0,
  playing: false,
  filter: 0,
  echo: 0,
  reverb: 0,
  flanger: 0,
  progress: 0,
}

export function DJMixer() {
  const { audioReady, oneShots, beats, sessions, saveSession, deleteSession } = useStore()
  const deckARef = useRef<Deck | null>(null)
  const deckBRef = useRef<Deck | null>(null)
  const bufferARef = useRef<AudioBuffer | null>(null)
  const bufferBRef = useRef<AudioBuffer | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const crossGainARef = useRef<GainNode | null>(null)
  const crossGainBRef = useRef<GainNode | null>(null)
  const recordDestRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordStartRef = useRef<number>(0)

  const [deckA, setDeckA] = useState<DeckUiState>(INITIAL_DECK_STATE)
  const [deckB, setDeckB] = useState<DeckUiState>(INITIAL_DECK_STATE)
  const [crossfader, setCrossfader] = useState(0)
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!audioReady) return
    const ctx = getAudioContext()
    const master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)
    const recordDest = ctx.createMediaStreamDestination()
    master.connect(recordDest)
    masterGainRef.current = master
    recordDestRef.current = recordDest

    const deckA = new Deck(ctx)
    const deckB = new Deck(ctx)
    const gainA = ctx.createGain()
    const gainB = ctx.createGain()
    deckA.output.connect(gainA).connect(master)
    deckB.output.connect(gainB).connect(master)
    deckARef.current = deckA
    deckBRef.current = deckB
    crossGainARef.current = gainA
    crossGainBRef.current = gainB
    const [gA, gB] = equalPowerCrossfade(0)
    gainA.gain.value = gA
    gainB.gain.value = gB

    return () => {
      deckA.stop()
      deckB.stop()
      master.disconnect()
    }
  }, [audioReady])

  useEffect(() => {
    const [gA, gB] = equalPowerCrossfade(crossfader)
    crossGainARef.current?.gain.setTargetAtTime(gA, getAudioContext().currentTime, 0.02)
    crossGainBRef.current?.gain.setTargetAtTime(gB, getAudioContext().currentTime, 0.02)
  }, [crossfader])

  useEffect(() => {
    let raf: number
    const tick = () => {
      const a = deckARef.current
      const b = deckBRef.current
      setDeckA((prev) => (a?.loaded ? { ...prev, progress: a.duration ? (a.currentTime % a.duration) / a.duration : 0 } : prev))
      setDeckB((prev) => (b?.loaded ? { ...prev, progress: b.duration ? (b.currentTime % b.duration) / b.duration : 0 } : prev))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  async function loadBeat(deckId: DeckId, beat: SavedBeat) {
    if (!oneShots) return
    setStatus(`Rendering "${beat.name}" to Deck ${deckId}…`)
    const buffer = await renderBeatPatternToBuffer(beat.pattern, beat.bpm, oneShots)
    const deck = deckId === 'A' ? deckARef.current : deckBRef.current
    if (!deck) return
    deck.loadBuffer(buffer, beat.bpm)
    if (deckId === 'A') bufferARef.current = buffer
    else bufferBRef.current = buffer
    const setDeck = deckId === 'A' ? setDeckA : setDeckB
    setDeck((prev) => ({ ...prev, name: beat.name, bpm: beat.bpm, playing: false, progress: 0 }))
    setStatus('')
  }

  async function loadFile(deckId: DeckId, file: File) {
    const ctx = getAudioContext()
    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    const guessedBpm = 120
    const deck = deckId === 'A' ? deckARef.current : deckBRef.current
    if (!deck) return
    deck.loadBuffer(audioBuffer, guessedBpm)
    if (deckId === 'A') bufferARef.current = audioBuffer
    else bufferBRef.current = audioBuffer
    const setDeck = deckId === 'A' ? setDeckA : setDeckB
    setDeck((prev) => ({ ...prev, name: file.name, bpm: guessedBpm, playing: false, progress: 0 }))
  }

  function togglePlay(deckId: DeckId) {
    const deck = deckId === 'A' ? deckARef.current : deckBRef.current
    const setDeck = deckId === 'A' ? setDeckA : setDeckB
    if (!deck?.loaded) return
    if (deck.playing) {
      deck.pause()
      setDeck((prev) => ({ ...prev, playing: false }))
    } else {
      deck.play()
      setDeck((prev) => ({ ...prev, playing: true }))
    }
  }

  function sync(deckId: DeckId) {
    const source = deckId === 'A' ? deckBRef.current : deckARef.current
    const target = deckId === 'A' ? deckARef.current : deckBRef.current
    if (!source?.bpm || !target) return
    target.syncTo(source.bpm)
    setStatus(`Deck ${deckId} synced to ${source.bpm} BPM.`)
    setTimeout(() => setStatus(''), 2500)
  }

  function setFilter(deckId: DeckId, value: number) {
    const deck = deckId === 'A' ? deckARef.current : deckBRef.current
    deck?.setFilter(value)
    const setDeck = deckId === 'A' ? setDeckA : setDeckB
    setDeck((prev) => ({ ...prev, filter: value }))
  }

  function setEcho(deckId: DeckId, value: number) {
    const deck = deckId === 'A' ? deckARef.current : deckBRef.current
    deck?.setEchoWet(value)
    const setDeck = deckId === 'A' ? setDeckA : setDeckB
    setDeck((prev) => ({ ...prev, echo: value }))
  }

  function setReverb(deckId: DeckId, value: number) {
    const deck = deckId === 'A' ? deckARef.current : deckBRef.current
    deck?.setReverbWet(value)
    const setDeck = deckId === 'A' ? setDeckA : setDeckB
    setDeck((prev) => ({ ...prev, reverb: value }))
  }

  function setFlanger(deckId: DeckId, value: number) {
    const deck = deckId === 'A' ? deckARef.current : deckBRef.current
    deck?.setFlangerWet(value)
    const setDeck = deckId === 'A' ? setDeckA : setDeckB
    setDeck((prev) => ({ ...prev, flanger: value }))
  }

  function toggleRecord() {
    const dest = recordDestRef.current
    if (!dest) return
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    chunksRef.current = []
    recordStartRef.current = Date.now()
    const recorder = new MediaRecorder(dest.stream)
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const durationSeconds = (Date.now() - recordStartRef.current) / 1000
      saveSession({
        id: `session_${Date.now()}`,
        name: `DJ Session ${sessions.length + 1}`,
        blob,
        durationSeconds,
        createdAt: Date.now(),
      })
      setRecording(false)
      setStatus('Session saved to project — see Recorded Sessions below.')
      setTimeout(() => setStatus(''), 4000)
    }
    recorder.start()
    recorderRef.current = recorder
    setRecording(true)
  }

  return (
    <section className="view">
      <h1 className="glow-text" style={{ color: 'var(--forge-cyan)' }}>
        DJ Mixer
      </h1>
      <p className="view-sub">Two decks, auto-sync, neon waveforms, filter/echo/reverb/flanger FX.</p>

      <div className="deck-row">
        <DeckPanel
          id="A"
          color="#00f5ff"
          state={deckA}
          buffer={bufferARef.current}
          beats={beats}
          disabled={!audioReady}
          onLoadBeat={(beat) => loadBeat('A', beat)}
          onLoadFile={(f) => loadFile('A', f)}
          onTogglePlay={() => togglePlay('A')}
          onSync={() => sync('A')}
          onFilter={(v) => setFilter('A', v)}
          onEcho={(v) => setEcho('A', v)}
          onReverb={(v) => setReverb('A', v)}
          onFlanger={(v) => setFlanger('A', v)}
        />
        <div className="crossfader-col">
          <span className="value-pill">Crossfader</span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={crossfader}
            onChange={(e) => setCrossfader(Number(e.target.value))}
            className="crossfader-slider"
          />
          <button className={recording ? 'btn-danger' : 'btn-primary'} onClick={toggleRecord} disabled={!audioReady}>
            {recording ? 'Stop Rec' : 'Record'}
          </button>
        </div>
        <DeckPanel
          id="B"
          color="#ff2dd1"
          state={deckB}
          buffer={bufferBRef.current}
          beats={beats}
          disabled={!audioReady}
          onLoadBeat={(beat) => loadBeat('B', beat)}
          onLoadFile={(f) => loadFile('B', f)}
          onTogglePlay={() => togglePlay('B')}
          onSync={() => sync('B')}
          onFilter={(v) => setFilter('B', v)}
          onEcho={(v) => setEcho('B', v)}
          onReverb={(v) => setReverb('B', v)}
          onFlanger={(v) => setFlanger('B', v)}
        />
      </div>
      {status && <p className="status-line">{status}</p>}

      <SessionsPanel sessions={sessions} onDelete={deleteSession} />
    </section>
  )
}

function SessionsPanel({ sessions, onDelete }: { sessions: SavedSession[]; onDelete: (id: string) => void }) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  function playPreview(session: SavedSession) {
    if (playingId === session.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(session.blob)
    urlRef.current = url
    const audio = audioRef.current ?? new Audio()
    audioRef.current = audio
    audio.src = url
    audio.onended = () => setPlayingId(null)
    void audio.play()
    setPlayingId(session.id)
  }

  if (sessions.length === 0) {
    return (
      <div className="panel" style={{ marginTop: 20, padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem', color: 'var(--text-dim)' }}>Recorded Sessions</h2>
        <p className="hint-line" style={{ padding: 0 }}>
          Hit Record above to capture a mix — saved sessions (with playback and download) show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="panel" style={{ marginTop: 20, padding: 16 }}>
      <h2 style={{ marginTop: 0, fontSize: '1rem', color: 'var(--text-dim)' }}>Recorded Sessions</h2>
      <ul className="session-list">
        {sessions.map((session) => (
          <li key={session.id} className="session-row">
            <span className="session-name">{session.name}</span>
            <span className="value-pill">{formatDuration(session.durationSeconds)}</span>
            <button onClick={() => playPreview(session)}>{playingId === session.id ? 'Stop' : 'Play'}</button>
            <button onClick={() => downloadBlob(session.blob, `${session.name.replace(/\s+/g, '-').toLowerCase()}.webm`)}>
              Download
            </button>
            <button onClick={() => onDelete(session.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface DeckPanelProps {
  id: DeckId
  color: string
  state: DeckUiState
  buffer: AudioBuffer | null
  beats: SavedBeat[]
  disabled: boolean
  onLoadBeat: (beat: SavedBeat) => void
  onLoadFile: (file: File) => void
  onTogglePlay: () => void
  onSync: () => void
  onFilter: (value: number) => void
  onEcho: (value: number) => void
  onReverb: (value: number) => void
  onFlanger: (value: number) => void
}

function DeckPanel(props: DeckPanelProps) {
  const { id, color, state, buffer, beats, disabled, onLoadBeat, onLoadFile, onTogglePlay, onSync, onFilter, onEcho, onReverb, onFlanger } =
    props
  return (
    <div className="panel deck-panel">
      <div className="deck-header">
        <span style={{ color }}>Deck {id}</span>
        <span className="value-pill">{state.bpm ? `${Math.round(state.bpm)} BPM` : '--'}</span>
      </div>
      <p className="deck-track-name">{state.name}</p>
      <Waveform buffer={buffer} progress={state.progress} color={color} />
      <div className="deck-controls">
        <button className="btn-primary" onClick={onTogglePlay} disabled={disabled}>
          {state.playing ? '⏸' : '▶'}
        </button>
        <button onClick={onSync} disabled={disabled}>
          Sync
        </button>
        <select
          disabled={disabled || beats.length === 0}
          defaultValue=""
          onChange={(e) => {
            const beat = beats.find((b) => b.id === e.target.value)
            if (beat) onLoadBeat(beat)
          }}
        >
          <option value="" disabled>
            Load a saved beat…
          </option>
          {beats.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <label className="file-btn">
          Import file
          <input
            type="file"
            accept="audio/*"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onLoadFile(file)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      <label className="fx-slider">
        Filter
        <input type="range" min={-1} max={1} step={0.01} value={state.filter} onChange={(e) => onFilter(Number(e.target.value))} />
      </label>
      <label className="fx-slider">
        Echo
        <input type="range" min={0} max={1} step={0.01} value={state.echo} onChange={(e) => onEcho(Number(e.target.value))} />
      </label>
      <label className="fx-slider">
        Reverb
        <input type="range" min={0} max={1} step={0.01} value={state.reverb} onChange={(e) => onReverb(Number(e.target.value))} />
      </label>
      <label className="fx-slider">
        Flanger
        <input type="range" min={0} max={1} step={0.01} value={state.flanger} onChange={(e) => onFlanger(Number(e.target.value))} />
      </label>
    </div>
  )
}
