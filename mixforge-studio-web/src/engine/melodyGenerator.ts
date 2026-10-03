import { chance, hashSeed, mulberry32, pick } from '../lib/rng.ts'
import { type Key, PROGRESSIONS, scaleNotesInRange } from '../lib/theory.ts'

export type MelodyPartKind = 'melody' | 'chords' | 'bassline'

export interface MelodyNote {
  step: number // absolute 16th-note step across the whole part (bar * 16 + offset)
  length: number // in steps
  pitch: number // MIDI note number
  velocity: number // 0..1
}

export const STEPS_PER_BAR = 16

export interface MelodyPart {
  key: Key
  bpm: number
  genre: string
  part: MelodyPartKind
  bars: number
  notes: MelodyNote[]
  seed: number
}

/** Maps a beat/melody genre onto one of the chord-progression "moods" in theory.ts, so new
 * genres only need one new line here rather than a whole new progression pool. */
const GENRE_PROGRESSION_BUCKET: Record<string, keyof typeof PROGRESSIONS> = {
  house: 'dance',
  techno: 'dark',
  trance: 'dance',
  psytrance: 'dark',
  hiphop: 'chill',
  trap: 'dark',
}

function bucketFor(genre: string): keyof typeof PROGRESSIONS {
  return GENRE_PROGRESSION_BUCKET[genre] ?? 'pop'
}

/** Degree indices (into the key's scale-note list within a register) for one bar, cycling
 * through a genre-appropriate progression. */
function buildProgression(genre: string, bars: number, rand: () => number): number[] {
  const pool = PROGRESSIONS[bucketFor(genre)]
  const progression = pick(rand, pool)
  return Array.from({ length: bars }, (_, i) => progression[i % progression.length])
}

function triadFromDegree(scaleNotes: number[], degree: number): number[] {
  const len = scaleNotes.length
  const i0 = ((degree % len) + len) % len
  return [scaleNotes[i0], scaleNotes[(i0 + 2) % len], scaleNotes[(i0 + 4) % len]]
}

interface MelodicDensity {
  register: readonly [number, number]
  noteStarts: readonly number[] // which of the 16 steps in a bar can start a note (base probability)
}

const MELODY_DENSITY: Record<string, MelodicDensity> = {
  dance: { register: [67, 84], noteStarts: [0.8, 0, 0.5, 0, 0.7, 0, 0.5, 0, 0.8, 0, 0.5, 0, 0.7, 0, 0.5, 0.2] },
  dark: { register: [60, 76], noteStarts: [0.7, 0, 0, 0.3, 0.6, 0, 0, 0.3, 0.7, 0, 0, 0.3, 0.6, 0, 0.3, 0] },
  chill: { register: [62, 78], noteStarts: [0.6, 0, 0, 0, 0.5, 0, 0, 0, 0.6, 0, 0, 0, 0.4, 0, 0, 0] },
  pop: { register: [64, 81], noteStarts: [0.75, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.75, 0, 0.4, 0, 0.6, 0, 0.4, 0.2] },
}

function densityFor(genre: string): MelodicDensity {
  return MELODY_DENSITY[bucketFor(genre)] ?? MELODY_DENSITY.pop
}

export interface GenerateMelodyParams {
  key: Key
  bpm: number
  genre: string
  part: MelodyPartKind
  bars?: number
  seed?: number
}

export function generateMelodyPart(params: GenerateMelodyParams): MelodyPart {
  const bars = params.bars ?? 4
  const seed = params.seed ?? hashSeed(`${params.genre}:${params.part}:${params.key.root}:${Date.now()}`)
  const rand = mulberry32(seed)
  const progression = buildProgression(params.genre, bars, rand)

  const notes: MelodyNote[] =
    params.part === 'chords'
      ? generateChords(params.key, progression, rand)
      : params.part === 'bassline'
        ? generateBassline(params.key, progression, params.genre, rand)
        : generateLead(params.key, progression, params.genre, rand)

  return { key: params.key, bpm: params.bpm, genre: params.genre, part: params.part, bars, notes, seed }
}

function generateChords(key: Key, progression: number[], rand: () => number): MelodyNote[] {
  const scaleNotes = scaleNotesInRange(key, 48, 96)
  const notes: MelodyNote[] = []
  progression.forEach((degree, bar) => {
    const triad = triadFromDegree(scaleNotes, degree + 7) // +7 scale-steps lands roughly in a mid register
    for (const pitch of triad) {
      notes.push({ step: bar * STEPS_PER_BAR, length: STEPS_PER_BAR, pitch, velocity: 0.55 + rand() * 0.1 })
    }
  })
  return notes
}

function generateBassline(key: Key, progression: number[], genre: string, rand: () => number): MelodyNote[] {
  const scaleNotes = scaleNotesInRange(key, 28, 52)
  const notes: MelodyNote[] = []
  const rhythmic = genre === 'trap' || genre === 'techno' || genre === 'psytrance'
  progression.forEach((degree, bar) => {
    const root = scaleNotes[((degree % scaleNotes.length) + scaleNotes.length) % scaleNotes.length]
    if (!rhythmic) {
      notes.push({ step: bar * STEPS_PER_BAR, length: STEPS_PER_BAR, pitch: root, velocity: 0.8 })
      return
    }
    // A simple four-on-the-floor-locked bass pulse, octave-bounced for interest.
    for (let s = 0; s < STEPS_PER_BAR; s += 4) {
      const pitch = chance(rand, 0.25) ? root + 12 : root
      notes.push({ step: bar * STEPS_PER_BAR + s, length: 3, pitch, velocity: 0.7 + rand() * 0.2 })
    }
  })
  return notes
}

function generateLead(key: Key, progression: number[], genre: string, rand: () => number): MelodyNote[] {
  const density = densityFor(genre)
  const scaleNotes = scaleNotesInRange(key, density.register[0], density.register[1])
  const notes: MelodyNote[] = []
  let cursor = Math.floor(scaleNotes.length / 2)

  progression.forEach((degree, bar) => {
    const triad = triadFromDegree(scaleNotes, degree)
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const base = density.noteStarts[s]
      if (base <= 0 || !chance(rand, base)) continue
      // Walk by a small step, biased back toward a current chord tone so the line resolves.
      const step = pick(rand, [-2, -1, -1, 0, 1, 1, 2] as const)
      cursor = Math.max(0, Math.min(scaleNotes.length - 1, cursor + step))
      const useChordTone = chance(rand, 0.4)
      const pitch = useChordTone ? pick(rand, triad) : scaleNotes[cursor]
      const length = pick(rand, [1, 1, 2, 2, 4] as const)
      notes.push({ step: bar * STEPS_PER_BAR + s, length, pitch, velocity: 0.6 + rand() * 0.3 })
    }
  })
  return notes
}

/** Regenerates only the notes whose step falls within [barStart, barEnd) bars, leaving every
 * note outside that range (including hand edits) untouched. */
export function regenerateBarRange(part: MelodyPart, barStart: number, barEnd: number, seed?: number): MelodyPart {
  const nextSeed = seed ?? hashSeed(`${part.seed}:${barStart}:${barEnd}:${Date.now()}`)
  const regenerated = generateMelodyPart({
    key: part.key,
    bpm: part.bpm,
    genre: part.genre,
    part: part.part,
    bars: part.bars,
    seed: nextSeed,
  })

  const lo = barStart * STEPS_PER_BAR
  const hi = barEnd * STEPS_PER_BAR
  const kept = part.notes.filter((n) => n.step < lo || n.step >= hi)
  const replaced = regenerated.notes.filter((n) => n.step >= lo && n.step < hi)
  return { ...part, notes: [...kept, ...replaced].sort((a, b) => a.step - b.step) }
}

/** Hand edit: move/resize/retune a single note (piano-roll drag). */
export function updateNote(part: MelodyPart, index: number, patch: Partial<MelodyNote>): MelodyPart {
  const notes = part.notes.map((n, i) => (i === index ? { ...n, ...patch } : n))
  return { ...part, notes }
}

export function deleteNote(part: MelodyPart, index: number): MelodyPart {
  return { ...part, notes: part.notes.filter((_, i) => i !== index) }
}

export function addNote(part: MelodyPart, note: MelodyNote): MelodyPart {
  return { ...part, notes: [...part.notes, note].sort((a, b) => a.step - b.step) }
}
