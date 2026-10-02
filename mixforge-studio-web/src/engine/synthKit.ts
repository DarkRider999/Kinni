// Procedurally synthesized placeholder sample kit. No licensed audio is bundled -- every
// sound here is generated on the fly with oscillators/noise/envelopes via an OfflineAudioContext
// and baked into an AudioBuffer once, then reused everywhere (Beat Generator pads, Sample
// Library, DJ Mixer sampler). This stands in for the 10,000+ licensed catalog described in the
// product spec (docs/mixforge-studio/SPEC.md Sec 2F) until real licensed content is sourced --
// the same honest placeholder approach already used by dj-radicalmix-web's sampler.

export type OneShotId =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'hihatClosed'
  | 'hihatOpen'
  | 'bassHit'
  | 'rimshot'
  | 'stab'
  | 'tomLow'
  | 'tomHigh'
  | 'conga'
  | 'shaker'
  | 'cowbell'
  | 'pluck'
  | 'riser'
  | 'impact'
  | 'subBass'

const SAMPLE_RATE = 44100

async function renderOneShot(duration: number, build: (ctx: OfflineAudioContext, dest: AudioNode) => void): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE)
  build(ctx, ctx.destination)
  return ctx.startRendering()
}

function noiseBuffer(ctx: BaseAudioContext, duration: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(duration * ctx.sampleRate), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function expDecayGain(param: AudioParam, startTime: number, peak: number, decay: number) {
  param.cancelScheduledValues(startTime)
  param.setValueAtTime(peak, startTime)
  param.exponentialRampToValueAtTime(Math.max(peak * 0.001, 0.0001), startTime + decay)
}

async function buildKick(): Promise<AudioBuffer> {
  return renderOneShot(0.5, (ctx, dest) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, 0)
    osc.frequency.exponentialRampToValueAtTime(40, 0.15)
    const gain = ctx.createGain()
    expDecayGain(gain.gain, 0, 1, 0.35)
    osc.connect(gain).connect(dest)
    osc.start(0)
    osc.stop(0.5)
  })
}

async function buildSnare(): Promise<AudioBuffer> {
  return renderOneShot(0.3, (ctx, dest) => {
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer(ctx, 0.3)
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'highpass'
    noiseFilter.frequency.value = 1000
    const noiseGain = ctx.createGain()
    expDecayGain(noiseGain.gain, 0, 0.9, 0.18)
    noise.connect(noiseFilter).connect(noiseGain).connect(dest)
    noise.start(0)

    const tone = ctx.createOscillator()
    tone.type = 'triangle'
    tone.frequency.value = 180
    const toneGain = ctx.createGain()
    expDecayGain(toneGain.gain, 0, 0.4, 0.1)
    tone.connect(toneGain).connect(dest)
    tone.start(0)
    tone.stop(0.3)
  })
}

async function buildClap(): Promise<AudioBuffer> {
  return renderOneShot(0.35, (ctx, dest) => {
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1200
    filter.Q.value = 1.2
    filter.connect(dest)
    ;[0, 0.012, 0.024, 0.045].forEach((offset) => {
      const noise = ctx.createBufferSource()
      noise.buffer = noiseBuffer(ctx, 0.15)
      const gain = ctx.createGain()
      expDecayGain(gain.gain, offset, 0.7, 0.12)
      noise.connect(gain).connect(filter)
      noise.start(offset)
    })
  })
}

async function buildHiHat(open: boolean): Promise<AudioBuffer> {
  const duration = open ? 0.4 : 0.08
  return renderOneShot(duration, (ctx, dest) => {
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer(ctx, duration)
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 7000
    const gain = ctx.createGain()
    expDecayGain(gain.gain, 0, 0.5, duration * 0.8)
    noise.connect(filter).connect(gain).connect(dest)
    noise.start(0)
  })
}

async function buildBassHit(): Promise<AudioBuffer> {
  return renderOneShot(0.6, (ctx, dest) => {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 55
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 400
    const gain = ctx.createGain()
    expDecayGain(gain.gain, 0, 0.8, 0.5)
    osc.connect(filter).connect(gain).connect(dest)
    osc.start(0)
    osc.stop(0.6)
  })
}

async function buildRimshot(): Promise<AudioBuffer> {
  return renderOneShot(0.12, (ctx, dest) => {
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 420
    const gain = ctx.createGain()
    expDecayGain(gain.gain, 0, 0.6, 0.06)
    osc.connect(gain).connect(dest)
    osc.start(0)
    osc.stop(0.12)
  })
}

async function buildStab(): Promise<AudioBuffer> {
  return renderOneShot(0.4, (ctx, dest) => {
    const gain = ctx.createGain()
    expDecayGain(gain.gain, 0, 0.5, 0.3)
    gain.connect(dest)
    ;[0, 4, 7].forEach((semi) => {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = 220 * Math.pow(2, semi / 12)
      osc.connect(gain)
      osc.start(0)
      osc.stop(0.4)
    })
  })
}

async function buildTom(lowPitch: boolean): Promise<AudioBuffer> {
  const startFreq = lowPitch ? 120 : 220
  const endFreq = lowPitch ? 55 : 110
  return renderOneShot(0.45, (ctx, dest) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(startFreq, 0)
    osc.frequency.exponentialRampToValueAtTime(endFreq, 0.25)
    const gain = ctx.createGain()
    expDecayGain(gain.gain, 0, 0.9, 0.4)
    osc.connect(gain).connect(dest)
    osc.start(0)
    osc.stop(0.45)
  })
}

async function buildConga(): Promise<AudioBuffer> {
  return renderOneShot(0.3, (ctx, dest) => {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(320, 0)
    osc.frequency.exponentialRampToValueAtTime(180, 0.08)
    const gain = ctx.createGain()
    expDecayGain(gain.gain, 0, 0.8, 0.22)
    osc.connect(gain).connect(dest)
    osc.start(0)
    osc.stop(0.3)
  })
}

async function buildShaker(): Promise<AudioBuffer> {
  const duration = 0.18
  return renderOneShot(duration, (ctx, dest) => {
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer(ctx, duration)
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 9000
    filter.Q.value = 0.8
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, 0)
    gain.gain.linearRampToValueAtTime(0.4, 0.015)
    expDecayGain(gain.gain, 0.015, 0.4, 0.12)
    noise.connect(filter).connect(gain).connect(dest)
    noise.start(0)
  })
}

async function buildCowbell(): Promise<AudioBuffer> {
  return renderOneShot(0.3, (ctx, dest) => {
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 800
    filter.Q.value = 2
    const gain = ctx.createGain()
    expDecayGain(gain.gain, 0, 0.6, 0.22)
    gain.connect(filter).connect(dest)
    ;[540, 800].forEach((freq) => {
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = freq
      osc.connect(gain)
      osc.start(0)
      osc.stop(0.3)
    })
  })
}

async function buildPluck(): Promise<AudioBuffer> {
  return renderOneShot(0.5, (ctx, dest) => {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 330
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(4000, 0)
    filter.frequency.exponentialRampToValueAtTime(400, 0.35)
    const gain = ctx.createGain()
    expDecayGain(gain.gain, 0, 0.6, 0.4)
    osc.connect(filter).connect(gain).connect(dest)
    osc.start(0)
    osc.stop(0.5)
  })
}

async function buildRiser(): Promise<AudioBuffer> {
  const duration = 1.5
  return renderOneShot(duration, (ctx, dest) => {
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer(ctx, duration)
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 0.9
    filter.frequency.setValueAtTime(300, 0)
    filter.frequency.exponentialRampToValueAtTime(9000, duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, 0)
    gain.gain.exponentialRampToValueAtTime(0.7, duration * 0.9)
    gain.gain.linearRampToValueAtTime(0, duration)
    noise.connect(filter).connect(gain).connect(dest)
    noise.start(0)
  })
}

async function buildImpact(): Promise<AudioBuffer> {
  return renderOneShot(1.1, (ctx, dest) => {
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(90, 0)
    sub.frequency.exponentialRampToValueAtTime(35, 0.5)
    const subGain = ctx.createGain()
    expDecayGain(subGain.gain, 0, 1, 0.9)
    sub.connect(subGain).connect(dest)
    sub.start(0)
    sub.stop(1.1)

    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer(ctx, 0.4)
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = 2500
    const noiseGain = ctx.createGain()
    expDecayGain(noiseGain.gain, 0, 0.8, 0.3)
    noise.connect(noiseFilter).connect(noiseGain).connect(dest)
    noise.start(0)
  })
}

async function buildSubBass(): Promise<AudioBuffer> {
  return renderOneShot(0.8, (ctx, dest) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 45
    const gain = ctx.createGain()
    expDecayGain(gain.gain, 0, 0.9, 0.7)
    osc.connect(gain).connect(dest)
    osc.start(0)
    osc.stop(0.8)
  })
}

export const ONE_SHOT_BUILDERS: Record<OneShotId, () => Promise<AudioBuffer>> = {
  kick: buildKick,
  snare: buildSnare,
  clap: buildClap,
  hihatClosed: () => buildHiHat(false),
  hihatOpen: () => buildHiHat(true),
  bassHit: buildBassHit,
  rimshot: buildRimshot,
  stab: buildStab,
  tomLow: () => buildTom(true),
  tomHigh: () => buildTom(false),
  conga: buildConga,
  shaker: buildShaker,
  cowbell: buildCowbell,
  pluck: buildPluck,
  riser: buildRiser,
  impact: buildImpact,
  subBass: buildSubBass,
}

let kitPromise: Promise<Record<OneShotId, AudioBuffer>> | null = null

export function loadSynthKit(): Promise<Record<OneShotId, AudioBuffer>> {
  if (!kitPromise) {
    kitPromise = (async () => {
      const entries = await Promise.all(
        (Object.keys(ONE_SHOT_BUILDERS) as OneShotId[]).map(async (id) => [id, await ONE_SHOT_BUILDERS[id]()] as const),
      )
      return Object.fromEntries(entries) as Record<OneShotId, AudioBuffer>
    })()
  }
  return kitPromise
}

/** A synth voice (not a one-shot) for melody/bassline playback at an arbitrary pitch. */
export function playSynthNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  frequencyHz: number,
  startTime: number,
  duration: number,
  waveform: OscillatorType = 'sawtooth',
) {
  const osc = ctx.createOscillator()
  osc.type = waveform
  osc.frequency.value = frequencyHz
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 2200
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(0.35, startTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.connect(filter).connect(gain).connect(dest)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.05)
}
