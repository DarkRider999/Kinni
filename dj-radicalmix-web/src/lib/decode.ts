// Decodes an audio file/blob into per-channel Float32Arrays using the
// browser's own decoder (MP3/WAV/FLAC/AAC/OGG support follows the browser,
// same as any <audio> element). Reused for both library import (analysis)
// and loading a track onto a deck, so a file is only ever decoded once per
// use rather than twice.
export interface DecodedAudio {
  channels: Float32Array[];
  sampleRate: number;
  durationSec: number;
}

let sharedCtx: AudioContext | null = null;

function decodeCtx(): AudioContext {
  if (!sharedCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

export async function decodeAudioFile(file: Blob): Promise<DecodedAudio> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = decodeCtx();
  const buf = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const channels: Float32Array[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c));
  return { channels, sampleRate: buf.sampleRate, durationSec: buf.duration };
}

/** Stereo pair at the engine's rate; mono input is duplicated to both channels. */
export function toEngineStereo(decoded: DecodedAudio): { left: Float32Array; right: Float32Array } {
  const left = decoded.channels[0];
  const right = decoded.channels[1] ?? decoded.channels[0];
  return { left: left.slice(), right: right.slice() };
}
