import { describe, expect, it } from 'vitest'
import { createReverbImpulse } from './deck'

// A minimal BaseAudioContext stand-in -- jsdom has no real Web Audio API, but createBuffer's
// semantics are simple enough to fake for this pure-data test.
function fakeAudioContext(sampleRate = 44100) {
  return {
    sampleRate,
    createBuffer(numberOfChannels: number, length: number, rate: number) {
      const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
      return {
        numberOfChannels,
        length,
        sampleRate: rate,
        getChannelData: (ch: number) => channels[ch],
      }
    },
  } as unknown as BaseAudioContext
}

describe('createReverbImpulse', () => {
  it('produces a stereo buffer of the requested duration', () => {
    const ctx = fakeAudioContext()
    const impulse = createReverbImpulse(ctx, 1, 3)
    expect(impulse.numberOfChannels).toBe(2)
    expect(impulse.length).toBe(44100)
  })

  it('decays -- later samples have lower average magnitude than earlier ones', () => {
    const ctx = fakeAudioContext()
    const impulse = createReverbImpulse(ctx, 1, 3)
    const data = impulse.getChannelData(0)
    const avgAbs = (arr: Float32Array, start: number, end: number) => {
      let sum = 0
      for (let i = start; i < end; i++) sum += Math.abs(arr[i])
      return sum / (end - start)
    }
    const head = avgAbs(data, 0, 1000)
    const tail = avgAbs(data, data.length - 1000, data.length)
    expect(tail).toBeLessThan(head)
  })

  it('channels are independently randomized (not identical)', () => {
    const ctx = fakeAudioContext()
    const impulse = createReverbImpulse(ctx, 0.1, 3)
    const left = impulse.getChannelData(0)
    const right = impulse.getChannelData(1)
    expect(Array.from(left)).not.toEqual(Array.from(right))
  })
})
