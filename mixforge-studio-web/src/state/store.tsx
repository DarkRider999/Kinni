import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { ensureAudioRunning } from '../engine/context'
import { loadSynthKit, type OneShotId } from '../engine/synthKit'
import type { BeatPattern, Genre } from '../lib/beatPatterns'
import type { MelodyNote, MelodyPartType, NoteName, ScaleId } from '../lib/melodyPatterns'

export interface SavedBeat {
  id: string
  name: string
  genre: Genre
  bpm: number
  energy: number
  pattern: BeatPattern
}

export interface SavedMelody {
  id: string
  name: string
  rootNote: NoteName
  scale: ScaleId
  partType: MelodyPartType
  bpm: number
  notes: MelodyNote[]
}

/** A recorded DJ Mixer set, saved to the in-session project (SPEC Sec 5D "DJSession") rather
 * than only auto-downloaded. The audio stays as a Blob in memory -- there's no backend/IndexedDB
 * to persist it across reloads in this build, same honest limitation as beats/melodies. */
export interface SavedSession {
  id: string
  name: string
  blob: Blob
  durationSeconds: number
  createdAt: number
}

interface StoreState {
  audioReady: boolean
  kitReady: boolean
  oneShots: Record<OneShotId, AudioBuffer> | null
  beats: SavedBeat[]
  melodies: SavedMelody[]
  sessions: SavedSession[]
}

interface StoreApi extends StoreState {
  startAudio: () => Promise<void>
  saveBeat: (beat: SavedBeat) => void
  saveMelody: (melody: SavedMelody) => void
  saveSession: (session: SavedSession) => void
  deleteSession: (id: string) => void
}

const StoreContext = createContext<StoreApi | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [audioReady, setAudioReady] = useState(false)
  const [kitReady, setKitReady] = useState(false)
  const [oneShots, setOneShots] = useState<Record<OneShotId, AudioBuffer> | null>(null)
  const [beats, setBeats] = useState<SavedBeat[]>([])
  const [melodies, setMelodies] = useState<SavedMelody[]>([])
  const [sessions, setSessions] = useState<SavedSession[]>([])

  const startAudio = useCallback(async () => {
    await ensureAudioRunning()
    setAudioReady(true)
    if (!oneShots) {
      const kit = await loadSynthKit()
      setOneShots(kit)
      setKitReady(true)
    }
  }, [oneShots])

  const saveBeat = useCallback((beat: SavedBeat) => {
    setBeats((prev) => [beat, ...prev.filter((b) => b.id !== beat.id)])
  }, [])

  const saveMelody = useCallback((melody: SavedMelody) => {
    setMelodies((prev) => [melody, ...prev.filter((m) => m.id !== melody.id)])
  }, [])

  const saveSession = useCallback((session: SavedSession) => {
    setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)])
  }, [])

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const value = useMemo<StoreApi>(
    () => ({
      audioReady,
      kitReady,
      oneShots,
      beats,
      melodies,
      sessions,
      startAudio,
      saveBeat,
      saveMelody,
      saveSession,
      deleteSession,
    }),
    [audioReady, kitReady, oneShots, beats, melodies, sessions, startAudio, saveBeat, saveMelody, saveSession, deleteSession],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
