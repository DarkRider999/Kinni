import { describe, expect, it } from 'vitest'
import { DRUM_LANES, STEPS_PER_BAR, defaultBpmForGenre, generateBeatPattern } from './beatPatterns'

describe('generateBeatPattern', () => {
  it('produces every lane at STEPS_PER_BAR length', () => {
    const pattern = generateBeatPattern({ genre: 'techno', bpm: 128, energy: 5, seed: 42 })
    for (const lane of DRUM_LANES) {
      expect(pattern[lane]).toHaveLength(STEPS_PER_BAR)
    }
  })

  it('is deterministic for a given seed', () => {
    const a = generateBeatPattern({ genre: 'house', bpm: 124, energy: 7, seed: 7 })
    const b = generateBeatPattern({ genre: 'house', bpm: 124, energy: 7, seed: 7 })
    expect(a).toEqual(b)
  })

  it('different seeds usually produce different fill patterns', () => {
    const a = generateBeatPattern({ genre: 'trap', bpm: 140, energy: 8, seed: 1 })
    const b = generateBeatPattern({ genre: 'trap', bpm: 140, energy: 8, seed: 2 })
    expect(a).not.toEqual(b)
  })

  it('always includes the genre template base hits (techno four-on-the-floor kick)', () => {
    const pattern = generateBeatPattern({ genre: 'techno', bpm: 128, energy: 1, seed: 99 })
    expect(pattern.kick[0]).toBe(true)
    expect(pattern.kick[4]).toBe(true)
    expect(pattern.kick[8]).toBe(true)
    expect(pattern.kick[12]).toBe(true)
  })

  it('higher energy never produces fewer active steps than lower energy on average', () => {
    let lowCount = 0
    let highCount = 0
    for (let seed = 0; seed < 50; seed++) {
      const low = generateBeatPattern({ genre: 'edm', bpm: 128, energy: 1, seed })
      const high = generateBeatPattern({ genre: 'edm', bpm: 128, energy: 10, seed })
      lowCount += DRUM_LANES.reduce((sum, lane) => sum + low[lane].filter(Boolean).length, 0)
      highCount += DRUM_LANES.reduce((sum, lane) => sum + high[lane].filter(Boolean).length, 0)
    }
    expect(highCount).toBeGreaterThan(lowCount)
  })
})

describe('defaultBpmForGenre', () => {
  it('returns a BPM within a sane musical range for every genre', () => {
    const genres = ['techno', 'house', 'trance', 'psytrance', 'hiphop', 'trap', 'edm'] as const
    for (const genre of genres) {
      const bpm = defaultBpmForGenre(genre)
      expect(bpm).toBeGreaterThanOrEqual(60)
      expect(bpm).toBeLessThanOrEqual(200)
    }
  })
})
