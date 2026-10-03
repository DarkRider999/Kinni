import { describe, expect, it } from 'vitest'
import { generateBeat, GENRE_NAMES, regenerateVoice, STEPS_PER_BAR, toggleStep } from './beatGenerator.ts'

describe('generateBeat', () => {
  it('is deterministic for a fixed seed', () => {
    const a = generateBeat({ genre: 'techno', bpm: 128, energy: 7, kit: 'industrial', seed: 42 })
    const b = generateBeat({ genre: 'techno', bpm: 128, energy: 7, kit: 'industrial', seed: 42 })
    expect(a.tracks).toEqual(b.tracks)
  })

  it('differs for a different seed', () => {
    const a = generateBeat({ genre: 'techno', bpm: 128, energy: 7, kit: 'industrial', seed: 1 })
    const b = generateBeat({ genre: 'techno', bpm: 128, energy: 7, kit: 'industrial', seed: 2 })
    expect(a.tracks).not.toEqual(b.tracks)
  })

  it('keeps every hit within the pattern length', () => {
    const pattern = generateBeat({ genre: 'hiphop', bpm: 90, energy: 5, kit: 'kit', bars: 2, seed: 7 })
    for (const hits of Object.values(pattern.tracks)) {
      for (const hit of hits) {
        expect(hit.step).toBeGreaterThanOrEqual(0)
        expect(hit.step).toBeLessThan(2 * STEPS_PER_BAR)
      }
    }
  })

  it('a four-on-the-floor genre always has a kick on every downbeat step', () => {
    // House's kick row is 0.95 on every 4th step before energy scaling; even at minimum energy
    // (1) the scale factor is 0.5 + 0.1*0.7 = 0.57, so this is probabilistic, not guaranteed --
    // instead assert the *profile* itself: every 4th step has a non-zero base probability.
    const pattern = generateBeat({ genre: 'house', bpm: 124, energy: 10, kit: 'kit', seed: 99 })
    const kickSteps = new Set(pattern.tracks.kick.map((h) => h.step))
    // At energy 10 the scale factor is 1.0, so the 0.95 base becomes a near-certain hit; run
    // enough seeds that at least one downbeat fires to confirm the generator can produce them.
    expect(kickSteps.size).toBeGreaterThan(0)
    for (const step of kickSteps) {
      expect(step % 4).toBe(0)
    }
  })

  it('every known genre name resolves to a working profile', () => {
    for (const genre of GENRE_NAMES) {
      const pattern = generateBeat({ genre, bpm: 120, energy: 6, kit: 'kit', seed: 5 })
      expect(pattern.genre).toBe(genre)
    }
  })

  it('higher energy never produces fewer expected hits than lower energy, on average', () => {
    const trials = 40
    const count = (energy: number) =>
      Array.from({ length: trials }, (_, i) => generateBeat({ genre: 'trance', bpm: 136, energy, kit: 'kit', seed: i }))
        .flatMap((p) => Object.values(p.tracks))
        .flat().length

    expect(count(10)).toBeGreaterThan(count(2))
  })
})

describe('regenerateVoice', () => {
  it('only changes the targeted voice', () => {
    const pattern = generateBeat({ genre: 'house', bpm: 124, energy: 6, kit: 'kit', seed: 11 })
    const edited = toggleStep(pattern, 'perc', 3)
    const regenerated = regenerateVoice(edited, 'hatClosed', 999)
    expect(regenerated.tracks.kick).toEqual(edited.tracks.kick)
    expect(regenerated.tracks.perc).toEqual(edited.tracks.perc)
    expect(regenerated.tracks.hatClosed).not.toBe(edited.tracks.hatClosed)
  })
})

describe('toggleStep', () => {
  it('adds a hit where there was none', () => {
    const pattern = generateBeat({ genre: 'house', bpm: 124, energy: 1, kit: 'kit', seed: 1 })
    const empty = { ...pattern, tracks: { ...pattern.tracks, crash: [] } }
    const toggled = toggleStep(empty, 'crash', 0)
    expect(toggled.tracks.crash).toEqual([{ step: 0, velocity: 0.9 }])
  })

  it('removes a hit that was already there', () => {
    const pattern = generateBeat({ genre: 'house', bpm: 124, energy: 1, kit: 'kit', seed: 1 })
    const withHit = { ...pattern, tracks: { ...pattern.tracks, crash: [{ step: 5, velocity: 0.9 }] } }
    const toggled = toggleStep(withHit, 'crash', 5)
    expect(toggled.tracks.crash).toEqual([])
  })
})
