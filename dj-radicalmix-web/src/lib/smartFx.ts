// "Smart" FX: one-tap presets, so a DJ (or Auto-Mix) gets a musically
// reasonable flanger/reverb instantly instead of dialing in beats/depth/wet
// by hand. Not AI-generated from a trained model (docs/dj-radicalmix Sec 5's
// "AI-generated FX presets based on track type" needs a genre classifier this
// build doesn't have) -- these are fixed, well-chosen defaults applied
// automatically, which is the part of "smart" this environment can deliver
// for real: zero manual tuning, not a model inferring the genre.
import { FxType } from "../engine/types";

export interface FxPreset {
  type: number;
  beats: number;
  depth: number;
  wet: number;
}

/** A classic flanger whoosh: sweeps every 2 beats, present but not overwhelming. */
export function smartFlangerPreset(): FxPreset {
  return { type: FxType.FLANGER, beats: 2, depth: 0.6, wet: 0.4 };
}

/** A hall-length wash, good for smoothing an outro or a breakdown. */
export function smartReverbPreset(): FxPreset {
  return { type: FxType.REVERB, beats: 1, depth: 0.7, wet: 0.5 };
}
