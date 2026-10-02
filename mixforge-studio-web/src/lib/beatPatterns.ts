// AI Beat Generator -- pattern logic (SPEC Sec 2A / 5A). This is a genre-conditioned, rule-based
// procedural generator (fixed per-genre templates + a seeded pseudo-random fill pass weighted by
// the chosen energy), **not** a trained generative model -- the product spec's `/generateBeat`
// cloud endpoint (Sec 6) is the real target architecture; a trained sequence model needs GPU
// workers and training data this environment doesn't have. Kept pure/deterministic-by-seed so it
// is unit-testable and so "regenerate" always producing something different is a real guarantee,
// not a UI illusion.

export type DrumLane = 'kick' | 'snare' | 'clap' | 'hihatClosed' | 'hihatOpen' | 'bassHit' | 'rimshot'

export const DRUM_LANES: DrumLane[] = ['kick', 'snare', 'clap', 'hihatClosed', 'hihatOpen', 'bassHit', 'rimshot']

export const GENRES = ['techno', 'house', 'trance', 'psytrance', 'hiphop', 'trap', 'edm'] as const
export type Genre = (typeof GENRES)[number]

export const STEPS_PER_BAR = 16

export type BeatPattern = Record<DrumLane, boolean[]>

export interface BeatGenParams {
  genre: Genre
  bpm: number
  energy: number // 1-10
  seed: number
}

// A tiny deterministic PRNG (mulberry32) so the same seed always yields the same pattern --
// needed both for "regenerate" to be meaningfully different each time (new seed) and for tests.
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

interface GenreTemplate {
  defaultBpm: [number, number]
  // Fixed base hits per lane (always present), as step indices 0-15.
  base: Partial<Record<DrumLane, number[]>>
  // Candidate fill steps per lane; how many get turned on scales with energy.
  fillCandidates: Partial<Record<DrumLane, number[]>>
}

const TEMPLATES: Record<Genre, GenreTemplate> = {
  techno: {
    defaultBpm: [125, 135],
    base: { kick: [0, 4, 8, 12], hihatClosed: [2, 6, 10, 14] },
    fillCandidates: { clap: [4, 12], hihatOpen: [3, 7, 11, 15], rimshot: [1, 5, 9, 13], bassHit: [0, 8] },
  },
  house: {
    defaultBpm: [122, 128],
    base: { kick: [0, 4, 8, 12], clap: [4, 12], hihatClosed: [2, 6, 10, 14] },
    fillCandidates: { hihatOpen: [2, 6, 10, 14], rimshot: [7, 15], bassHit: [0, 4, 8, 12] },
  },
  trance: {
    defaultBpm: [136, 142],
    base: { kick: [0, 4, 8, 12], hihatClosed: [0, 2, 4, 6, 8, 10, 12, 14] },
    fillCandidates: { clap: [4, 12], hihatOpen: [3, 7, 11, 15], bassHit: [2, 6, 10, 14] },
  },
  psytrance: {
    defaultBpm: [142, 148],
    base: { kick: [0, 2, 4, 6, 8, 10, 12, 14], bassHit: [1, 3, 5, 7, 9, 11, 13, 15] },
    fillCandidates: { hihatClosed: [0, 4, 8, 12], hihatOpen: [2, 6, 10, 14], rimshot: [15] },
  },
  hiphop: {
    defaultBpm: [85, 95],
    base: { kick: [0, 10], snare: [4, 12] },
    fillCandidates: { hihatClosed: [0, 2, 4, 6, 8, 10, 12, 14], hihatOpen: [7, 15], rimshot: [6, 14], bassHit: [0, 10] },
  },
  trap: {
    defaultBpm: [130, 145],
    base: { kick: [0, 7], snare: [4, 12] },
    fillCandidates: {
      hihatClosed: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      hihatOpen: [10],
      bassHit: [0, 7],
      rimshot: [8],
    },
  },
  edm: {
    defaultBpm: [126, 130],
    base: { kick: [0, 4, 8, 12], clap: [4, 12] },
    fillCandidates: { hihatClosed: [2, 6, 10, 14], hihatOpen: [3, 11], rimshot: [7, 15], bassHit: [0, 8] },
  },
}

export function defaultBpmForGenre(genre: Genre): number {
  const [lo, hi] = TEMPLATES[genre].defaultBpm
  return Math.round((lo + hi) / 2)
}

export function generateBeatPattern(params: BeatGenParams): BeatPattern {
  const template = TEMPLATES[params.genre]
  const rng = mulberry32(params.seed)
  const energyRatio = Math.max(0, Math.min(1, (params.energy - 1) / 9))

  const pattern = Object.fromEntries(DRUM_LANES.map((lane) => [lane, new Array(STEPS_PER_BAR).fill(false)])) as BeatPattern

  for (const lane of DRUM_LANES) {
    for (const step of template.base[lane] ?? []) {
      pattern[lane][step] = true
    }
  }

  for (const lane of DRUM_LANES) {
    const candidates = template.fillCandidates[lane] ?? []
    for (const step of candidates) {
      if (pattern[lane][step]) continue
      // Higher energy raises the chance a candidate fill step gets turned on.
      const chance = 0.15 + energyRatio * 0.65
      if (rng() < chance) pattern[lane][step] = true
    }
  }

  return pattern
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}
