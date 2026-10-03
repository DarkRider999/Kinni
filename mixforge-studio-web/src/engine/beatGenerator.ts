import { chance, hashSeed, mulberry32 } from '../lib/rng.ts'

/** Drum voices a kit can trigger. Every genre profile below defines a per-step probability for
 * each of these, so adding a new kit piece only means adding one more row -- not touching the
 * generator loop itself. */
export type DrumVoice = 'kick' | 'snare' | 'clap' | 'hatClosed' | 'hatOpen' | 'perc' | 'sub' | 'crash'

export const DRUM_VOICES: readonly DrumVoice[] = ['kick', 'snare', 'clap', 'hatClosed', 'hatOpen', 'perc', 'sub', 'crash']

export interface DrumHit {
  step: number
  velocity: number // 0..1
}

export const STEPS_PER_BAR = 16

export interface BeatPattern {
  genre: string
  bpm: number
  energy: number // 1..10
  kit: string
  bars: number
  stepsPerBar: number
  tracks: Record<DrumVoice, DrumHit[]>
  seed: number
}

/** Per-step base probability (length STEPS_PER_BAR) that a voice fires, before energy scaling.
 * This is the "genre sounds like genre" knob -- a four-on-the-floor kick for house/techno/trance,
 * a syncopated kick/snare for hip-hop, a sparse kick with dense triplet-ish hats for trap. */
interface GenreProfile {
  bpmRange: readonly [number, number]
  probabilities: Partial<Record<DrumVoice, readonly number[]>>
  swingSteps?: readonly number[] // steps nudged late for groove (not modeled in timing yet, reserved)
}

function steady(everyN: number, offset = 0): number[] {
  return Array.from({ length: STEPS_PER_BAR }, (_, i) => (i % everyN === offset ? 0.95 : 0))
}

function constant(value: number): number[] {
  return Array.from({ length: STEPS_PER_BAR }, () => value)
}

export const GENRES: Record<string, GenreProfile> = {
  house: {
    bpmRange: [118, 128],
    probabilities: {
      kick: steady(4),
      clap: [0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0],
      hatClosed: constant(0.55),
      hatOpen: [0, 0, 0.3, 0, 0, 0, 0.3, 0, 0, 0, 0.3, 0, 0, 0, 0.3, 0],
      perc: constant(0.12),
    },
  },
  techno: {
    bpmRange: [125, 145],
    probabilities: {
      kick: steady(4),
      clap: [0, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0],
      hatClosed: constant(0.65),
      hatOpen: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.35, 0],
      perc: constant(0.2),
      sub: steady(4),
    },
  },
  trance: {
    bpmRange: [132, 142],
    probabilities: {
      kick: steady(4),
      clap: [0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0],
      hatClosed: constant(0.7),
      hatOpen: [0, 0, 0.4, 0, 0, 0, 0.4, 0, 0, 0, 0.4, 0, 0, 0, 0.4, 0],
      perc: constant(0.15),
    },
  },
  psytrance: {
    bpmRange: [138, 148],
    probabilities: {
      kick: steady(4),
      hatClosed: constant(0.8),
      perc: constant(0.4),
      sub: steady(4),
    },
  },
  hiphop: {
    bpmRange: [80, 100],
    probabilities: {
      kick: [0.9, 0, 0, 0, 0, 0, 0.4, 0, 0, 0, 0.3, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0.2],
      hatClosed: constant(0.5),
      hatOpen: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.25, 0],
      perc: constant(0.1),
    },
  },
  trap: {
    bpmRange: [68, 76], // felt double-time; UI/players treat this as the half-time trap feel
    probabilities: {
      kick: [0.9, 0, 0, 0.3, 0, 0, 0.4, 0, 0, 0, 0.3, 0, 0, 0.3, 0, 0],
      snare: [0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0],
      hatClosed: constant(0.85),
      hatOpen: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0],
      sub: [0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  },
}

export const GENRE_NAMES = Object.keys(GENRES)

export interface GenerateBeatParams {
  genre: string
  bpm: number
  energy: number // 1..10
  kit: string
  bars?: number
  seed?: number
}

function energyScale(energy: number, base: number): number {
  const e = Math.max(1, Math.min(10, energy))
  // Energy mostly thins or thickens hats/perc; the backbone (kick) stays close to the genre's
  // signature even at low energy so the beat never stops "sounding like" the genre.
  const scale = 0.5 + (e / 10) * 0.7
  return Math.max(0, Math.min(1, base * scale))
}

/** Generates a one-bar (or multi-bar, looped identically per bar) pattern. Deterministic for a
 * given seed -- same inputs always produce the same pattern, which is what makes "regenerate"
 * (new seed) vs. hand-editing (mutate the result) meaningfully different actions. */
export function generateBeat(params: GenerateBeatParams): BeatPattern {
  const profile = GENRES[params.genre] ?? GENRES.house
  const bars = params.bars ?? 1
  const seed = params.seed ?? hashSeed(`${params.genre}:${params.bpm}:${params.energy}:${params.kit}:${Date.now()}`)
  const rand = mulberry32(seed)

  const tracks = {} as Record<DrumVoice, DrumHit[]>
  for (const voice of DRUM_VOICES) {
    tracks[voice] = []
  }

  for (let bar = 0; bar < bars; bar++) {
    for (const voice of DRUM_VOICES) {
      const row = profile.probabilities[voice]
      if (!row) continue
      for (let step = 0; step < STEPS_PER_BAR; step++) {
        const base = row[step]
        if (base <= 0) continue
        if (chance(rand, energyScale(params.energy, base))) {
          const velocity = Math.min(1, 0.65 + rand() * 0.35)
          tracks[voice].push({ step: bar * STEPS_PER_BAR + step, velocity })
        }
      }
    }
  }

  return {
    genre: params.genre,
    bpm: params.bpm,
    energy: params.energy,
    kit: params.kit,
    bars,
    stepsPerBar: STEPS_PER_BAR,
    tracks,
    seed,
  }
}

/** Regenerates only one voice's hits, in place semantics (returns a new pattern), leaving every
 * other voice's hand edits untouched -- the drum-pattern analogue of the melody's
 * "regenerate this bar." */
export function regenerateVoice(pattern: BeatPattern, voice: DrumVoice, seed?: number): BeatPattern {
  const nextSeed = seed ?? hashSeed(`${pattern.seed}:${voice}:${Date.now()}`)
  const regenerated = generateBeat({
    genre: pattern.genre,
    bpm: pattern.bpm,
    energy: pattern.energy,
    kit: pattern.kit,
    bars: pattern.bars,
    seed: nextSeed,
  })
  return {
    ...pattern,
    tracks: { ...pattern.tracks, [voice]: regenerated.tracks[voice] },
  }
}

/** Toggle a single step for hand editing (step sequencer click) -- never touches generation. */
export function toggleStep(pattern: BeatPattern, voice: DrumVoice, step: number): BeatPattern {
  const hits = pattern.tracks[voice]
  const existingIndex = hits.findIndex((h) => h.step === step)
  const nextHits =
    existingIndex >= 0 ? hits.filter((_, i) => i !== existingIndex) : [...hits, { step, velocity: 0.9 }].sort((a, b) => a.step - b.step)
  return { ...pattern, tracks: { ...pattern.tracks, [voice]: nextHits } }
}
