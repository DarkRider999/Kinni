/** Music-theory primitives shared by the Beat Generator (kit tuning) and the Melody/Bassline
 * Creator (scale-locking). Kept dependency-free and pure so it's trivially unit-testable. */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export type NoteName = (typeof NOTE_NAMES)[number]

export type ScaleName =
  | 'major'
  | 'natural_minor'
  | 'harmonic_minor'
  | 'dorian'
  | 'phrygian'
  | 'minor_pentatonic'

/** Semitone offsets from the root, within one octave. */
export const SCALES: Record<ScaleName, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  minor_pentatonic: [0, 3, 5, 7, 10],
}

export interface Key {
  root: NoteName
  scale: ScaleName
}

export function parseKey(label: string): Key {
  // "A minor" -> { root: 'A', scale: 'natural_minor' }; "C# major" -> major; defaults to major.
  const m = /^([A-G]#?)\s*(.*)$/i.exec(label.trim())
  const rootRaw = (m?.[1] ?? 'C').toUpperCase()
  const root = (NOTE_NAMES.find((n) => n === rootRaw) ?? 'C') as NoteName
  const qualifier = (m?.[2] ?? '').toLowerCase()
  let scale: ScaleName = 'major'
  if (qualifier.includes('harmonic')) scale = 'harmonic_minor'
  else if (qualifier.includes('dorian')) scale = 'dorian'
  else if (qualifier.includes('phrygian')) scale = 'phrygian'
  else if (qualifier.includes('pentatonic')) scale = 'minor_pentatonic'
  else if (qualifier.includes('minor')) scale = 'natural_minor'
  return { root, scale }
}

export function keyLabel(key: Key): string {
  const names: Record<ScaleName, string> = {
    major: 'major',
    natural_minor: 'minor',
    harmonic_minor: 'harmonic minor',
    dorian: 'dorian',
    phrygian: 'phrygian',
    minor_pentatonic: 'minor pentatonic',
  }
  return `${key.root} ${names[key.scale]}`
}

function rootMidi(root: NoteName): number {
  return NOTE_NAMES.indexOf(root)
}

/** All scale-degree MIDI note numbers within [minMidi, maxMidi], ascending. */
export function scaleNotesInRange(key: Key, minMidi: number, maxMidi: number): number[] {
  const offsets = SCALES[key.scale]
  const root = rootMidi(key.root)
  const notes: number[] = []
  for (let octaveBase = -12; octaveBase <= 132; octaveBase += 12) {
    for (const off of offsets) {
      const n = root + octaveBase + off
      if (n >= minMidi && n <= maxMidi) notes.push(n)
    }
  }
  return [...new Set(notes)].sort((a, b) => a - b)
}

/** Snap an arbitrary MIDI note to the nearest in-scale note. */
export function snapToScale(key: Key, midi: number): number {
  const candidates = scaleNotesInRange(key, midi - 12, midi + 12)
  if (candidates.length === 0) return midi
  return candidates.reduce((best, n) => (Math.abs(n - midi) < Math.abs(best - midi) ? n : best))
}

/** Diatonic triads (as scale-degree indices, 0-based) for a simple, genre-flavored progression
 * pool. Degrees are indices into the scale's note list (mod length), not semitone offsets. */
export const PROGRESSIONS: Record<string, readonly (readonly number[])[]> = {
  pop: [
    [0, 4, 5, 3],
    [0, 3, 4, 4],
    [5, 3, 0, 4],
  ],
  dance: [
    [0, 5, 3, 4],
    [0, 4, 5, 5],
  ],
  dark: [
    [0, 2, 5, 4],
    [0, 6, 2, 4],
  ],
  chill: [
    [0, 3, 4, 3],
    [5, 4, 0, 0],
  ],
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function noteName(midi: number): string {
  const n = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${n}${octave}`
}
