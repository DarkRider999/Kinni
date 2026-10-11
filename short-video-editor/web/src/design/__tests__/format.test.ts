import { describe, expect, it } from 'vitest'
import { clamp, formatDuration, snapToStep } from '../format'

describe('format helpers', () => {
  it('clamps to range', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    expect(clamp(2, 0, 3)).toBe(2)
  })

  it('snaps to step without float noise', () => {
    expect(snapToStep(0.1 + 0.2, 0.1)).toBe(0.3)
    expect(snapToStep(1.26, 0.25)).toBe(1.25)
    expect(snapToStep(7, 5)).toBe(5)
  })

  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(723_450, true)).toBe('12:03.4')
    expect(formatDuration(-20)).toBe('0:00')
  })
})
