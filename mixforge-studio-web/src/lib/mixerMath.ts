// Pure DSP-adjacent math kept out of the view layer so it's unit-testable without an AudioContext.

/** Equal-power crossfade curve: position -1 = full Deck A, 0 = center (both ~0.707), 1 = full
 * Deck B. Equal-power (rather than a linear fade) keeps perceived loudness constant through the
 * center of the fade -- the standard DJ-mixer crossfader curve. */
export function equalPowerCrossfade(position: number): [gainA: number, gainB: number] {
  const clamped = Math.max(-1, Math.min(1, position))
  const theta = ((clamped + 1) / 2) * (Math.PI / 2) // 0..pi/2
  return [Math.cos(theta), Math.sin(theta)]
}
