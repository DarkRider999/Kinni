import { describe, expect, it } from 'vitest'
import { parseKey, scaleNotesInRange } from '../lib/theory.ts'
import { addNote, deleteNote, generateMelodyPart, regenerateBarRange, STEPS_PER_BAR, updateNote } from './melodyGenerator.ts'

const key = parseKey('A minor')

describe('generateMelodyPart', () => {
  it('is deterministic for a fixed seed', () => {
    const a = generateMelodyPart({ key, bpm: 128, genre: 'trance', part: 'melody', bars: 4, seed: 10 })
    const b = generateMelodyPart({ key, bpm: 128, genre: 'trance', part: 'melody', bars: 4, seed: 10 })
    expect(a.notes).toEqual(b.notes)
  })

  it('every melody/lead note is in the active scale', () => {
    const part = generateMelodyPart({ key, bpm: 128, genre: 'trance', part: 'melody', bars: 8, seed: 3 })
    const inScale = new Set(scaleNotesInRange(key, 0, 127))
    for (const note of part.notes) {
      expect(inScale.has(note.pitch)).toBe(true)
    }
  })

  it('bassline notes stay in a low register', () => {
    const part = generateMelodyPart({ key, bpm: 128, genre: 'techno', part: 'bassline', bars: 4, seed: 4 })
    for (const note of part.notes) {
      expect(note.pitch).toBeGreaterThanOrEqual(28)
      expect(note.pitch).toBeLessThanOrEqual(64) // root or octave-bounced root
    }
  })

  it('chords produce a held triad per bar', () => {
    const part = generateMelodyPart({ key, bpm: 128, genre: 'house', part: 'chords', bars: 2, seed: 5 })
    const bar0 = part.notes.filter((n) => n.step === 0)
    const bar1 = part.notes.filter((n) => n.step === STEPS_PER_BAR)
    expect(bar0.length).toBe(3)
    expect(bar1.length).toBe(3)
    for (const n of part.notes) expect(n.length).toBe(STEPS_PER_BAR)
  })

  it('keeps all notes within the requested bar count', () => {
    const part = generateMelodyPart({ key, bpm: 128, genre: 'hiphop', part: 'melody', bars: 3, seed: 6 })
    for (const n of part.notes) {
      expect(n.step).toBeLessThan(3 * STEPS_PER_BAR)
    }
  })
})

describe('regenerateBarRange', () => {
  it('only replaces notes inside the requested bar range', () => {
    const part = generateMelodyPart({ key, bpm: 128, genre: 'trance', part: 'melody', bars: 4, seed: 20 })
    const untouchedBefore = part.notes.filter((n) => n.step < STEPS_PER_BAR)
    const untouchedAfter = part.notes.filter((n) => n.step >= 3 * STEPS_PER_BAR)

    const regenerated = regenerateBarRange(part, 1, 3, 999)

    expect(regenerated.notes.filter((n) => n.step < STEPS_PER_BAR)).toEqual(untouchedBefore)
    expect(regenerated.notes.filter((n) => n.step >= 3 * STEPS_PER_BAR)).toEqual(untouchedAfter)
  })
})

describe('note editing', () => {
  const base = generateMelodyPart({ key, bpm: 128, genre: 'trance', part: 'melody', bars: 1, seed: 1 })

  it('updateNote patches one note only', () => {
    if (base.notes.length === 0) return
    const updated = updateNote(base, 0, { pitch: 72 })
    expect(updated.notes[0].pitch).toBe(72)
    expect(updated.notes.length).toBe(base.notes.length)
  })

  it('deleteNote removes exactly one note', () => {
    if (base.notes.length === 0) return
    const deleted = deleteNote(base, 0)
    expect(deleted.notes.length).toBe(base.notes.length - 1)
  })

  it('addNote appends and keeps notes sorted by step', () => {
    const added = addNote(base, { step: 2, length: 1, pitch: 69, velocity: 0.9 })
    expect(added.notes.length).toBe(base.notes.length + 1)
    for (let i = 1; i < added.notes.length; i++) {
      expect(added.notes[i].step).toBeGreaterThanOrEqual(added.notes[i - 1].step)
    }
  })
})
