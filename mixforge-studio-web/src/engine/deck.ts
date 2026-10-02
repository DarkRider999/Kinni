// A single DJ-mixer deck: loads an AudioBuffer (a generated beat render or a sample-library
// one-shot/loop), plays it with a filter + echo/reverb/flanger FX rack, and exposes a BPM so the
// mixer can auto-sync the other deck's playback rate to it (Beginner-Friendly DJ Mixer + FX Rack,
// SPEC Sec 2D/5E).

/** A synthetic reverb impulse response (exponentially-decaying stereo noise) -- the standard
 * trick for feeding a ConvolverNode without shipping a recorded IR file. Exported so it's
 * independently unit-testable (decay.test.ts) without needing a live AudioContext. */
export function createReverbImpulse(ctx: BaseAudioContext, duration = 2.2, decay = 3.5): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  return impulse
}

export class Deck {
  readonly ctx: AudioContext
  private source: AudioBufferSourceNode | null = null
  private buffer: AudioBuffer | null = null

  private gainNode: GainNode
  private filterNode: BiquadFilterNode
  private delayNode: DelayNode
  private delayFeedback: GainNode
  private delayWet: GainNode
  private reverbNode: ConvolverNode
  private reverbWet: GainNode
  private flangerDelay: DelayNode
  private flangerFeedback: GainNode
  private flangerWet: GainNode
  private flangerLfo: OscillatorNode
  private dryGain: GainNode
  output: GainNode

  bpm = 120
  private startedAt = 0
  private startOffset = 0
  private _playing = false

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.gainNode = ctx.createGain()
    this.filterNode = ctx.createBiquadFilter()
    this.filterNode.type = 'allpass'

    this.delayNode = ctx.createDelay(1.0)
    this.delayNode.delayTime.value = 0.25
    this.delayFeedback = ctx.createGain()
    this.delayFeedback.gain.value = 0.25
    this.delayWet = ctx.createGain()
    this.delayWet.gain.value = 0

    this.reverbNode = ctx.createConvolver()
    this.reverbNode.buffer = createReverbImpulse(ctx)
    this.reverbWet = ctx.createGain()
    this.reverbWet.gain.value = 0

    // A short modulated delay with feedback -- the classic flanger topology. The LFO runs
    // continuously from construction (silent until flangerWet is opened) rather than being
    // started/stopped per use, since an OscillatorNode can only ever be started once.
    this.flangerDelay = ctx.createDelay(0.02)
    this.flangerDelay.delayTime.value = 0.004
    this.flangerFeedback = ctx.createGain()
    this.flangerFeedback.gain.value = 0.35
    this.flangerWet = ctx.createGain()
    this.flangerWet.gain.value = 0
    this.flangerLfo = ctx.createOscillator()
    this.flangerLfo.type = 'sine'
    this.flangerLfo.frequency.value = 0.25
    const flangerLfoDepth = ctx.createGain()
    flangerLfoDepth.gain.value = 0.003
    this.flangerLfo.connect(flangerLfoDepth).connect(this.flangerDelay.delayTime)
    this.flangerLfo.start()

    this.dryGain = ctx.createGain()
    this.dryGain.gain.value = 1

    this.output = ctx.createGain()

    // gain -> filter -> dry, plus three parallel FX sends (echo, reverb, flanger) -> output.
    this.gainNode.connect(this.filterNode)
    this.filterNode.connect(this.dryGain).connect(this.output)

    this.filterNode.connect(this.delayNode)
    this.delayNode.connect(this.delayFeedback).connect(this.delayNode)
    this.delayNode.connect(this.delayWet).connect(this.output)

    this.filterNode.connect(this.reverbNode)
    this.reverbNode.connect(this.reverbWet).connect(this.output)

    this.filterNode.connect(this.flangerDelay)
    this.flangerDelay.connect(this.flangerFeedback).connect(this.flangerDelay)
    this.flangerDelay.connect(this.flangerWet).connect(this.output)
  }

  loadBuffer(buffer: AudioBuffer, bpm: number) {
    this.stop()
    this.buffer = buffer
    this.bpm = bpm
    this.startOffset = 0
  }

  get loaded() {
    return this.buffer !== null
  }

  get playing() {
    return this._playing
  }

  get duration() {
    return this.buffer?.duration ?? 0
  }

  get currentTime(): number {
    if (!this._playing) return this.startOffset
    const elapsed = (this.ctx.currentTime - this.startedAt) * this.source!.playbackRate.value
    return this.startOffset + elapsed
  }

  play() {
    if (!this.buffer || this._playing) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.buffer
    src.loop = true
    src.connect(this.gainNode)
    src.start(0, this.startOffset % this.buffer.duration)
    this.source = src
    this.startedAt = this.ctx.currentTime
    this._playing = true
  }

  pause() {
    if (!this._playing || !this.source) return
    this.startOffset = this.currentTime
    this.source.stop()
    this.source.disconnect()
    this.source = null
    this._playing = false
  }

  stop() {
    if (this.source) {
      try {
        this.source.stop()
      } catch {
        // already stopped
      }
      this.source.disconnect()
      this.source = null
    }
    this._playing = false
    this.startOffset = 0
  }

  setVolume(value: number) {
    this.gainNode.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01)
  }

  /** -1 = full low-pass sweep, 0 = neutral (allpass), 1 = full high-pass sweep. */
  setFilter(value: number) {
    const clamped = Math.max(-1, Math.min(1, value))
    if (clamped < -0.02) {
      this.filterNode.type = 'lowpass'
      this.filterNode.frequency.setTargetAtTime(20000 * Math.pow(2, clamped * 9), this.ctx.currentTime, 0.01)
    } else if (clamped > 0.02) {
      this.filterNode.type = 'highpass'
      this.filterNode.frequency.setTargetAtTime(20 * Math.pow(2, clamped * 9), this.ctx.currentTime, 0.01)
    } else {
      this.filterNode.type = 'allpass'
    }
  }

  setEchoWet(value: number) {
    this.delayWet.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.ctx.currentTime, 0.01)
  }

  setReverbWet(value: number) {
    this.reverbWet.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.ctx.currentTime, 0.01)
  }

  setFlangerWet(value: number) {
    this.flangerWet.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.ctx.currentTime, 0.01)
  }

  /** Match this deck's playback rate so its effective BPM equals targetBpm (DJ Mixer auto-sync). */
  syncTo(targetBpm: number) {
    if (!this.source || !this.bpm) return
    const ratio = targetBpm / this.bpm
    this.source.playbackRate.setTargetAtTime(ratio, this.ctx.currentTime, 0.05)
  }

  resetSpeed() {
    this.source?.playbackRate.setTargetAtTime(1, this.ctx.currentTime, 0.05)
  }
}
