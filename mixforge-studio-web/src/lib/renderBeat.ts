import { renderMix } from '../engine/mastering'
import { DRUM_LANES, STEPS_PER_BAR, type BeatPattern, type DrumLane } from './beatPatterns'

/** Bounce a step pattern to a single loopable stereo AudioBuffer, shared by the Beat Generator's
 * own playback-export flow and the DJ Mixer's "load generated beat to a deck" flow. `oneShots` is
 * keyed by lane rather than by a fixed sample id so a lane's sound can be swapped (Sample Library
 * drag-and-drop, SPEC Sec 2F) without changing this function. */
export async function renderBeatPatternToBuffer(
  pattern: BeatPattern,
  bpm: number,
  oneShots: Record<DrumLane, AudioBuffer>,
): Promise<AudioBuffer> {
  const secondsPerStep = 60 / bpm / 4
  const placements: Array<{ buffer: AudioBuffer; time: number }> = []
  for (let step = 0; step < STEPS_PER_BAR; step++) {
    for (const lane of DRUM_LANES) {
      if (pattern[lane][step]) placements.push({ buffer: oneShots[lane], time: step * secondsPerStep })
    }
  }
  return renderMix(placements, STEPS_PER_BAR * secondsPerStep)
}
