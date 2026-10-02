import { describe, expect, it } from 'vitest'
import { SCALES, generateMelody, noteToFrequency, regenerateRange, scaleDegreeToSemitone } from './melodyPatterns'

describe('scaleDegreeToSemitone', () => {
  it('matches the raw interval table within one octave', () => {
    for (let d = 0; d < SCALES.major.length; d++) {
      expect(scaleDegreeToSemitone('major', d)).toBe(SCALES.major[d])
    }
  })

  it('adds 12 semitones per octave', () => {
    const base = scaleDegreeToSemitone('naturalMinor', 2)
    const octaveUp = scaleDegreeToSemitone('naturalMinor', 2 + SCALES.naturalMinor.length)
    expect(octaveUp - base).toBe(12)
  })
})

describe('noteToFrequency', () => {
  it('A4 (root A, scale degree 0, octave 4, no offset) is 440Hz', () => {
    const freq = noteToFrequency('A', 4, 'major', 0, 0)
    expect(freq).toBeCloseTo(440, 1)
  })

  it('one octave offset doubles the frequency', () => {
    const base = noteToFrequency('C', 4, 'major', 0, 0)
    const up = noteToFrequency('C', 4, 'major', 0, 1)
    expect(up / base).toBeCloseTo(2, 5)
  })
})

describe('generateMelody', () => {
  it('bassline notes stay within the low scale-degree range', () => {
    const notes = generateMelody({ rootNote: 'E', scale: 'phrygian', partType: 'bassline', bpm: 140, seed: 3 })
    for (const note of notes) {
      expect(note.scaleDegree).toBeGreaterThanOrEqual(0)
      expect(note.scaleDegree).toBeLessThan(5)
    }
  })

  it('is deterministic for a given seed', () => {
    const a = generateMelody({ rootNote: 'C', scale: 'dorian', partType: 'melody', bpm: 120, seed: 11 })
    const b = generateMelody({ rootNote: 'C', scale: 'dorian', partType: 'melody', bpm: 120, seed: 11 })
    expect(a).toEqual(b)
  })
})

describe('regenerateRange', () => {
  it('leaves notes outside the range untouched', () => {
    const original = generateMelody({ rootNote: 'A', scale: 'naturalMinor', partType: 'melody', bpm: 128, seed: 5 })
    const untouched = original.filter((n) => n.step < 8)
    const result = regenerateRange(original, 'melody', 8, 16, 123)
    const resultUntouched = result.filter((n) => n.step < 8)
    expect(resultUntouched).toEqual(untouched)
  })

  it('only places notes inside [start, end) for the regenerated portion', () => {
    const original = generateMelody({ rootNote: 'A', scale: 'naturalMinor', partType: 'melody', bpm: 128, seed: 5 })
    const result = regenerateRange(original, 'melody', 8, 16, 123)
    for (const note of result.filter((n) => n.step >= 8)) {
      expect(note.step).toBeGreaterThanOrEqual(8)
      expect(note.step).toBeLessThan(16)
    }
  })
})
