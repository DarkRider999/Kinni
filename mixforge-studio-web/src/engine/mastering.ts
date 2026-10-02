// One-Tap Mastering (SPEC Sec 2G / 5G): a deterministic DSP chain (EQ -> compressor -> makeup
// gain -> limiter) rendered offline over the whole buffer. In the full product spec, a cloud AI
// job *selects* these parameters per genre/loudness target and the deterministic chain executes
// them locally (Sec 4.1/4.3 "Mastering Module") -- that split is preserved here: `MASTERING_PRESETS`
// stands in for the cloud parameter-selection call (rule-based, not a trained model, since no
// backend/GPU workers exist in this environment), and the OfflineAudioContext chain below is the
// real, working, deterministic part.

export type MasteringPresetId = 'streaming' | 'club' | 'gentle'

export interface MasteringPreset {
  label: string
  lowShelfGainDb: number
  highShelfGainDb: number
  compressorThresholdDb: number
  compressorRatio: number
  makeupGainDb: number
  limiterCeiling: number
}

export const MASTERING_PRESETS: Record<MasteringPresetId, MasteringPreset> = {
  streaming: {
    label: 'Streaming Loudness',
    lowShelfGainDb: 1.5,
    highShelfGainDb: 1,
    compressorThresholdDb: -18,
    compressorRatio: 3,
    makeupGainDb: 4,
    limiterCeiling: 0.95,
  },
  club: {
    label: 'Club System',
    lowShelfGainDb: 3,
    highShelfGainDb: 2,
    compressorThresholdDb: -22,
    compressorRatio: 4.5,
    makeupGainDb: 6,
    limiterCeiling: 0.97,
  },
  gentle: {
    label: 'Gentle / Acoustic',
    lowShelfGainDb: 0.5,
    highShelfGainDb: 0.5,
    compressorThresholdDb: -14,
    compressorRatio: 2,
    makeupGainDb: 2,
    limiterCeiling: 0.9,
  },
}

export async function masterBuffer(source: AudioBuffer, presetId: MasteringPresetId): Promise<AudioBuffer> {
  const preset = MASTERING_PRESETS[presetId]
  const offlineCtx = new OfflineAudioContext(source.numberOfChannels, source.length, source.sampleRate)

  const src = offlineCtx.createBufferSource()
  src.buffer = source

  const lowShelf = offlineCtx.createBiquadFilter()
  lowShelf.type = 'lowshelf'
  lowShelf.frequency.value = 120
  lowShelf.gain.value = preset.lowShelfGainDb

  const highShelf = offlineCtx.createBiquadFilter()
  highShelf.type = 'highshelf'
  highShelf.frequency.value = 8000
  highShelf.gain.value = preset.highShelfGainDb

  const compressor = offlineCtx.createDynamicsCompressor()
  compressor.threshold.value = preset.compressorThresholdDb
  compressor.ratio.value = preset.compressorRatio
  compressor.attack.value = 0.003
  compressor.release.value = 0.25
  compressor.knee.value = 6

  const makeup = offlineCtx.createGain()
  makeup.gain.value = Math.pow(10, preset.makeupGainDb / 20)

  // A fast brickwall-ish limiter: a second, harder compressor stage catching anything the first
  // stage let through, so the render never clips above the preset's ceiling.
  const limiter = offlineCtx.createDynamicsCompressor()
  limiter.threshold.value = -1
  limiter.ratio.value = 20
  limiter.attack.value = 0.001
  limiter.release.value = 0.05
  limiter.knee.value = 0

  const ceilingGain = offlineCtx.createGain()
  ceilingGain.gain.value = preset.limiterCeiling

  src.connect(lowShelf).connect(highShelf).connect(compressor).connect(makeup).connect(limiter).connect(ceilingGain).connect(offlineCtx.destination)
  src.start(0)

  return offlineCtx.startRendering()
}

/** Render a sequence of (buffer, startTime) placements down to a single stereo buffer -- used to
 * bounce a Beat Generator pattern or a DJ session recording before mastering/export. */
export async function renderMix(
  placements: Array<{ buffer: AudioBuffer; time: number; gain?: number }>,
  totalDuration: number,
  sampleRate = 44100,
): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate)
  for (const { buffer, time, gain = 1 } of placements) {
    const src = offlineCtx.createBufferSource()
    src.buffer = buffer
    const g = offlineCtx.createGain()
    g.gain.value = gain
    src.connect(g).connect(offlineCtx.destination)
    src.start(time)
  }
  return offlineCtx.startRendering()
}
