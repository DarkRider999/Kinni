import { describe, expect, it } from 'vitest'
import { keyLabel, midiToFrequency, noteName, parseKey, scaleNotesInRange, snapToScale } from './theory.ts'

describe('parseKey', () => {
  it('parses "A minor"', () => {
    expect(parseKey('A minor')).toEqual({ root: 'A', scale: 'natural_minor' })
  })
  it('parses "C# major"', () => {
    expect(parseKey('C# major')).toEqual({ root: 'C#', scale: 'major' })
  })
  it('defaults an unrecognized qualifier to major', () => {
    expect(parseKey('G')).toEqual({ root: 'G', scale: 'major' })
  })
  it('round-trips through keyLabel', () => {
    expect(keyLabel(parseKey('D dorian'))).toBe('D dorian')
  })
})

describe('scaleNotesInRange', () => {
  it('only returns notes that are in the scale', () => {
    const key = parseKey('C major')
    const notes = scaleNotesInRange(key, 60, 72)
    // C major in [60,72]: C4 D4 E4 F4 G4 A4 B4 C5
    expect(notes).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
  })

  it('is empty for a degenerate range', () => {
    const key = parseKey('C major')
    expect(scaleNotesInRange(key, 61, 61)).toEqual([])
  })
})

describe('snapToScale', () => {
  it('leaves an in-scale note untouched', () => {
    const key = parseKey('C major')
    expect(snapToScale(key, 64)).toBe(64) // E4
  })

  it('snaps an out-of-scale note to the nearest scale tone', () => {
    const key = parseKey('C major')
    expect(snapToScale(key, 66)).toBe(65) // F#4 -> F4 (closer than G4)
    expect(snapToScale(key, 68)).toBe(67) // G#4 -> G4
  })
})

describe('midiToFrequency', () => {
  it('A4 (midi 69) is 440Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 5)
  })
  it('one octave up doubles frequency', () => {
    expect(midiToFrequency(81)).toBeCloseTo(880, 5)
  })
})

describe('noteName', () => {
  it('names middle C as C4', () => {
    expect(noteName(60)).toBe('C4')
  })
  it('names A4', () => {
    expect(noteName(69)).toBe('A4')
  })
})
