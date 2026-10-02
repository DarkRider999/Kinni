// Lookahead step scheduler -- the standard "look ahead and schedule audio events slightly in the
// future" pattern (see Chris Wilson, "A Tale of Two Clocks"). A plain setInterval/setTimeout loop
// is not sample-accurate on its own because the JS event loop can jitter by tens of milliseconds;
// scheduling actual audio-graph events against AudioContext.currentTime (which IS sample-accurate)
// and only using the timer to decide *when to schedule*, not *when to sound*, avoids that drift.
// Used by both the Beat Generator's step grid and the Melody Creator's piano roll.

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD_SEC = 0.1

export interface StepSchedulerOptions {
  audioContext: AudioContext
  stepsPerBar: number
  onScheduleStep: (stepIndex: number, time: number) => void
  onVisualStep?: (stepIndex: number) => void
}

export class StepScheduler {
  private ctx: AudioContext
  private stepsPerBar: number
  private onScheduleStep: (stepIndex: number, time: number) => void
  private onVisualStep?: (stepIndex: number) => void

  private bpm = 120
  private nextStepTime = 0
  private currentStep = 0
  private timerId: number | null = null
  private running = false

  constructor(opts: StepSchedulerOptions) {
    this.ctx = opts.audioContext
    this.stepsPerBar = opts.stepsPerBar
    this.onScheduleStep = opts.onScheduleStep
    this.onVisualStep = opts.onVisualStep
  }

  setBpm(bpm: number) {
    this.bpm = bpm
  }

  get secondsPerStep(): number {
    // 16th-note steps: one beat = 4 steps.
    return 60 / this.bpm / 4
  }

  start() {
    if (this.running) return
    this.running = true
    this.currentStep = 0
    this.nextStepTime = this.ctx.currentTime + 0.05
    this.tick()
  }

  stop() {
    this.running = false
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId)
      this.timerId = null
    }
  }

  get isRunning() {
    return this.running
  }

  private tick = () => {
    if (!this.running) return
    while (this.nextStepTime < this.ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      this.onScheduleStep(this.currentStep, this.nextStepTime)
      const stepIndex = this.currentStep
      const delayMs = Math.max(0, (this.nextStepTime - this.ctx.currentTime) * 1000)
      if (this.onVisualStep) {
        window.setTimeout(() => this.onVisualStep?.(stepIndex), delayMs)
      }
      this.nextStepTime += this.secondsPerStep
      this.currentStep = (this.currentStep + 1) % this.stepsPerBar
    }
    this.timerId = window.setTimeout(this.tick, LOOKAHEAD_MS)
  }
}
