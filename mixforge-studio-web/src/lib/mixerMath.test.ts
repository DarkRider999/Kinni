import { describe, expect, it } from 'vitest'
import { equalPowerCrossfade } from './mixerMath'

describe('equalPowerCrossfade', () => {
  it('center position gives equal, non-unity gain to both decks', () => {
    const [a, b] = equalPowerCrossfade(0)
    expect(a).toBeCloseTo(b, 5)
    expect(a).toBeCloseTo(Math.SQRT1_2, 5)
  })

  it('full left (-1) is all Deck A', () => {
    const [a, b] = equalPowerCrossfade(-1)
    expect(a).toBeCloseTo(1, 5)
    expect(b).toBeCloseTo(0, 5)
  })

  it('full right (1) is all Deck B', () => {
    const [a, b] = equalPowerCrossfade(1)
    expect(a).toBeCloseTo(0, 5)
    expect(b).toBeCloseTo(1, 5)
  })

  it('power (a^2 + b^2) stays close to 1 across the whole range', () => {
    for (let p = -1; p <= 1; p += 0.1) {
      const [a, b] = equalPowerCrossfade(p)
      expect(a * a + b * b).toBeCloseTo(1, 5)
    }
  })

  it('clamps out-of-range input', () => {
    expect(equalPowerCrossfade(5)).toEqual(equalPowerCrossfade(1))
    expect(equalPowerCrossfade(-5)).toEqual(equalPowerCrossfade(-1))
  })
})
