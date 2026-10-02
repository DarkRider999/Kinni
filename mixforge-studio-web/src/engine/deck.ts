// A single DJ-mixer deck: loads an AudioBuffer (a generated beat render or a sample-library
// one-shot/loop), plays it with a filter + echo FX chain, and exposes a BPM so the mixer can
// auto-sync the other deck's playback rate to it (Issue: Beginner-Friendly DJ Mixer, SPEC Sec 2D).

export class Deck {
  readonly ctx: AudioContext
  private source: AudioBufferSourceNode | null = null
  private buffer: AudioBuffer | null = null

  private gainNode: GainNode
  private filterNode: BiquadFilterNode
  private delayNode: DelayNode
  private delayFeedback: GainNode
  private delayWet: GainNode
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
    this.dryGain = ctx.createGain()
    this.dryGain.gain.value = 1

    this.output = ctx.createGain()

    // gain -> filter -> split to dry + delay (feedback loop) -> output
    this.gainNode.connect(this.filterNode)
    this.filterNode.connect(this.dryGain).connect(this.output)
    this.filterNode.connect(this.delayNode)
    this.delayNode.connect(this.delayFeedback).connect(this.delayNode)
    this.delayNode.connect(this.delayWet).connect(this.output)
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
