// AI Melody & Bassline Creator -- note generation logic (SPEC Sec 2B / 5B). Same honesty note as
// beatPatterns.ts: this is a scale-constrained, seeded procedural generator, not a trained model.
// It guarantees every generated note is in-key (the product's core promise: "never off-scale")
// and plugs into the same piano-roll editing / regenerate-a-range UX described in the spec.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export type NoteName = (typeof NOTE_NAMES)[number]

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
} as const
export type ScaleId = keyof typeof SCALES

export type MelodyPartType = 'melody' | 'bassline' | 'chords'

export const STEPS_PER_BAR = 16

export interface MelodyNote {
  step: number
  scaleDegree: number // index into the scale (can exceed array length -> octave wraps)
  octave: number // relative to a base octave (0 = base)
  durationSteps: number
}

export interface MelodyGenParams {
  rootNote: NoteName
  scale: ScaleId
  partType: MelodyPartType
  bpm: number
  seed: number
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function scaleDegreeToSemitone(scale: ScaleId, degree: number): number {
  const intervals = SCALES[scale]
  const octave = Math.floor(degree / intervals.length)
  const indexInScale = ((degree % intervals.length) + intervals.length) % intervals.length
  return octave * 12 + intervals[indexInScale]
}

export function noteToFrequency(rootNote: NoteName, baseOctave: number, scale: ScaleId, degree: number, octaveOffset: number): number {
  const rootIndex = NOTE_NAMES.indexOf(rootNote)
  const semitoneFromC0 = rootIndex + baseOctave * 12 + scaleDegreeToSemitone(scale, degree) + octaveOffset * 12
  // A4 (MIDI 69) = 440Hz; MIDI note number = semitoneFromC0 + 12 (C0 = MIDI 12).
  const midi = semitoneFromC0 + 12
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function generateRange(
  partType: MelodyPartType,
  startStep: number,
  endStepExclusive: number,
  rng: () => number,
): MelodyNote[] {
  const notes: MelodyNote[] = []

  if (partType === 'bassline') {
    for (let step = startStep; step < endStepExclusive; step += 4) {
      const degree = Math.floor(rng() * 5) // stay within a comfortable low-register range
      notes.push({ step, scaleDegree: degree, octave: -1, durationSteps: 3 })
    }
    return notes
  }

  if (partType === 'chords') {
    for (let step = startStep; step < endStepExclusive; step += 8) {
      const rootDegree = Math.floor(rng() * 7)
      // A triad: root, third, fifth (scale degrees +2 / +4 track thirds/fifths diatonically).
      ;[rootDegree, rootDegree + 2, rootDegree + 4].forEach((degree) => {
        notes.push({ step, scaleDegree: degree, octave: 0, durationSteps: 7 })
      })
    }
    return notes
  }

  // melody: a walking line with occasional rests, biased to move by small steps.
  let currentDegree = 2
  let step = startStep
  while (step < endStepExclusive) {
    if (rng() < 0.2) {
      step += 2 // rest
      continue
    }
    const move = Math.floor(rng() * 5) - 2 // -2..+2 scale-degree step
    currentDegree = Math.max(0, Math.min(13, currentDegree + move))
    const duration = rng() < 0.7 ? 2 : 1
    notes.push({ step, scaleDegree: currentDegree, octave: 0, durationSteps: duration })
    step += duration
  }
  return notes
}

export function generateMelody(params: MelodyGenParams): MelodyNote[] {
  const rng = mulberry32(params.seed)
  return generateRange(params.partType, 0, STEPS_PER_BAR, rng)
}

/** Regenerate only [startStep, endStep) of an existing pattern, leaving the rest untouched --
 * backs the piano roll's "regenerate this bar" action (SPEC Sec 2B). */
export function regenerateRange(
  existing: MelodyNote[],
  partType: MelodyPartType,
  startStep: number,
  endStep: number,
  seed: number,
): MelodyNote[] {
  const rng = mulberry32(seed)
  const kept = existing.filter((n) => n.step < startStep || n.step >= endStep)
  const regenerated = generateRange(partType, startStep, endStep, rng)
  return [...kept, ...regenerated].sort((a, b) => a.step - b.step)
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}
