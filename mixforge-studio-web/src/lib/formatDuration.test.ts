import { describe, expect, it } from 'vitest'
import { formatDuration } from './formatDuration'

describe('formatDuration', () => {
  it('formats sub-minute durations as 0:ss', () => {
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(59)).toBe('0:59')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(600)).toBe('10:00')
  })

  it('formats past an hour as h:mm:ss', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })

  it('clamps negative/invalid input to zero', () => {
    expect(formatDuration(-5)).toBe('0:00')
  })
})
