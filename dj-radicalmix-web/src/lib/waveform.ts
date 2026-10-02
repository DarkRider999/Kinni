// Downsamples decoded audio into a fixed number of min/max bins for a
// waveform display -- the computation that addresses the "slow waveform
// rendering" pain point (docs/dj-radicalmix Sec 2 Issue 10): compute once at
// load time, render from a fixed-size array every frame instead of touching
// the raw sample buffer in the render loop.
export interface WaveformPeaks {
  min: Float32Array;
  max: Float32Array;
}

export function computeWaveformPeaks(channels: Float32Array[], bins: number): WaveformPeaks {
  const length = channels[0]?.length ?? 0;
  const min = new Float32Array(bins);
  const max = new Float32Array(bins);
  if (length === 0 || bins <= 0) return { min, max };

  const samplesPerBin = Math.max(1, Math.floor(length / bins));
  for (let b = 0; b < bins; b++) {
    const start = b * samplesPerBin;
    const end = Math.min(length, start + samplesPerBin);
    let lo = 1;
    let hi = -1;
    for (let i = start; i < end; i++) {
      for (const ch of channels) {
        const s = ch[i];
        if (s < lo) lo = s;
        if (s > hi) hi = s;
      }
    }
    if (end > start) {
      min[b] = lo;
      max[b] = hi;
    }
  }
  return { min, max };
}
