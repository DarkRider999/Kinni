// Shapes mirroring djnw_deck()/djnw_engine()/djnw_fx() field order in
// dj-nexus-pro/engine/src/web/djnexus_web.cpp -- keep in sync with that file
// and with the field-order arrays in public/engine/djnexus-runtime.js.

export interface DeckState {
  loaded: number;
  playing: number;
  keyLock: number;
  sync: number;
  slip: number;
  reverse: number;
  looping: number;
  master: number;
  position: number;
  duration: number;
  trackBpm: number;
  effectiveBpm: number;
  rate: number;
  beatPhase: number;
  loopStart: number;
  loopEnd: number;
  cue: number;
  peakL: number;
  peakR: number;
}

export interface FxState {
  on: number;
  type: number;
  target: number;
  tail: number;
  beats: number;
  depth: number;
  wet: number;
}

export interface EngineState {
  decks: DeckState[];
  fx: FxState[];
  masterPeakL: number;
  masterPeakR: number;
  limiterDb: number;
  dspLoad: number;
  masterDeck: number;
  clockBpm: number;
  samplerLoadedLo: number;
  samplerLoadedHi: number;
  samplerPlayingLo: number;
  samplerPlayingHi: number;
  colorFx: number;
  colorParam: number;
  macro: number;
  macroTarget: number;
  macroProgress: number;
  macroBeatsLeft: number;
  samplerLoaded: (slot: number) => number;
  samplerPlaying: (slot: number) => number;
}

// djn_fx_type (djnexus.h)
export const FxType = {
  ECHO: 0, DELAY: 1, PING_PONG: 2, REVERB: 3, FLANGER: 4, PHASER: 5,
  ROLL: 6, STUTTER: 7, TRANS: 8, PITCH: 9, DISTORTION: 10, CRUSH: 11,
} as const;

export const FX_TARGET_MASTER = -1;

// djn_color_fx
export const ColorFx = {
  FILTER: 0, NOISE: 1, DUB_ECHO: 2, PITCH: 3, CRUSH: 4, SPACE: 5,
} as const;

// djn_macro
export const Macro = { RISER: 0, BUILD_UP: 1, DROP: 2 } as const;

// djn_pad_mode
export const PadMode = { ONE_SHOT: 0, GATE: 1, LOOP: 2, TOGGLE: 3 } as const;

export const SAMPLER_TO_MASTER = -1;
