import { describe, expect, it } from 'vitest'
import { audioBufferToWavBlob } from './wav'

function fakeAudioBuffer(samples: number[], sampleRate = 44100): AudioBuffer {
  const data = Float32Array.from(samples)
  return {
    numberOfChannels: 1,
    sampleRate,
    length: data.length,
    duration: data.length / sampleRate,
    getChannelData: () => data,
  } as unknown as AudioBuffer
}

describe('audioBufferToWavBlob', () => {
  it('produces a RIFF/WAVE blob with the correct byte length', async () => {
    const buffer = fakeAudioBuffer([0, 0.5, -0.5, 1, -1])
    const blob = audioBufferToWavBlob(buffer)
    expect(blob.type).toBe('audio/wav')
    // 44-byte header + 5 samples * 2 bytes (16-bit mono)
    expect(blob.size).toBe(44 + 5 * 2)

    const bytes = new Uint8Array(await blob.arrayBuffer())
    const header = String.fromCharCode(...bytes.slice(0, 4))
    expect(header).toBe('RIFF')
    const wave = String.fromCharCode(...bytes.slice(8, 12))
    expect(wave).toBe('WAVE')
  })

  it('clamps sample values to the int16 range without overflow', async () => {
    const buffer = fakeAudioBuffer([2, -2]) // out-of-range input, should clamp to [-1, 1]
    const blob = audioBufferToWavBlob(buffer)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const view = new DataView(bytes.buffer)
    const first = view.getInt16(44, true)
    const second = view.getInt16(46, true)
    expect(first).toBe(0x7fff)
    expect(second).toBe(-0x8000)
  })
})
