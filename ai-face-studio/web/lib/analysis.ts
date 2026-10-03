/**
 * Real pixel-level heuristics (SPEC §21 — "AI estimate", never stated as fact). These compute
 * genuine numbers from the uploaded image's pixel data; they are deliberately simple stand-ins
 * for the real computer-vision models the spec describes, not a simulation that fakes a number.
 */

export interface AnalysisReport {
  headline: string;
  confidence: number; // 0-100, always shown next to the estimate
  rows: { label: string; value: string }[];
  suggestion?: string;
}

function loadImageData(dataUrl: string, maxSize = 320): Promise<{ data: ImageData; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas 2D context unavailable'));
      ctx.drawImage(img, 0, 0, width, height);
      resolve({ data: ctx.getImageData(0, 0, width, height), width, height });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function brightnessContrast(dataUrl: string) {
  const { data, width, height } = await loadImageData(dataUrl);
  let sum = 0;
  const lums: number[] = [];
  for (let i = 0; i < data.data.length; i += 4) {
    const l = luminance(data.data[i], data.data[i + 1], data.data[i + 2]);
    lums.push(l);
    sum += l;
  }
  const mean = sum / lums.length;
  const variance = lums.reduce((acc, l) => acc + (l - mean) ** 2, 0) / lums.length;
  return { mean, stdDev: Math.sqrt(variance), width, height };
}

export async function analyzePhotoQuality(dataUrl: string, naturalWidth: number, naturalHeight: number): Promise<AnalysisReport> {
  const { mean, stdDev } = await brightnessContrast(dataUrl);
  const megapixels = (naturalWidth * naturalHeight) / 1_000_000;
  const brightnessLabel = mean < 70 ? 'Dark' : mean > 190 ? 'Bright' : 'Balanced';
  const contrastLabel = stdDev < 35 ? 'Low' : stdDev > 70 ? 'High' : 'Balanced';
  return {
    headline: `${brightnessLabel} · ${contrastLabel} contrast · ${megapixels.toFixed(1)} MP`,
    confidence: 70,
    rows: [
      { label: 'Resolution', value: `${naturalWidth} × ${naturalHeight}px (${megapixels.toFixed(1)} MP)` },
      { label: 'Brightness (0–255)', value: mean.toFixed(0) },
      { label: 'Contrast (std. dev.)', value: stdDev.toFixed(1) },
    ],
    suggestion:
      mean < 70
        ? 'Try Low-Light Enhancement.'
        : stdDev < 35
        ? 'Try AI Photo Enhancer to add contrast.'
        : 'This photo is in good shape for any tool.',
  };
}

export async function analyzeSymmetry(dataUrl: string): Promise<AnalysisReport> {
  const { data, width, height } = await loadImageData(dataUrl, 240);
  const half = Math.floor(width / 2);
  let diffSum = 0;
  let samples = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < half; x += 2) {
      const leftIdx = (y * width + x) * 4;
      const rightIdx = (y * width + (width - 1 - x)) * 4;
      const l = luminance(data.data[leftIdx], data.data[leftIdx + 1], data.data[leftIdx + 2]);
      const r = luminance(data.data[rightIdx], data.data[rightIdx + 1], data.data[rightIdx + 2]);
      diffSum += Math.abs(l - r);
      samples++;
    }
  }
  const avgDiff = diffSum / Math.max(1, samples);
  const symmetryScore = Math.max(0, Math.min(100, 100 - avgDiff));
  return {
    headline: `${symmetryScore.toFixed(0)}% left/right symmetry (heuristic)`,
    confidence: 55,
    rows: [{ label: 'Avg. left/right luminance difference', value: avgDiff.toFixed(1) }],
    suggestion: 'This compares pixel brightness only, not real facial landmarks — see SPEC §21.',
  };
}

export async function analyzeFaceShape(dataUrl: string, naturalWidth: number, naturalHeight: number): Promise<AnalysisReport> {
  const ratio = naturalWidth / naturalHeight;
  let shape = 'Oval';
  if (ratio > 0.95) shape = 'Round';
  else if (ratio < 0.68) shape = 'Oblong';
  else if (ratio < 0.78) shape = 'Heart';
  else shape = 'Oval';
  return {
    headline: `Possible face shape: ${shape}`,
    confidence: 40,
    rows: [{ label: 'Frame aspect ratio', value: ratio.toFixed(2) }],
    suggestion: 'Estimated from the photo frame, not real facial landmarks — a placeholder for the model in SPEC §21.',
  };
}

export async function analyzeStyle(dataUrl: string): Promise<AnalysisReport> {
  const { data } = await loadImageData(dataUrl, 160);
  const buckets = new Array(12).fill(0);
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i] / 255, g = data.data[i + 1] / 255, b = data.data[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max - min < 0.04) continue; // near-greyscale pixel, skip for hue
    let h = 0;
    if (max === r) h = ((g - b) / (max - min)) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    h = (h * 60 + 360) % 360;
    buckets[Math.floor(h / 30)]++;
  }
  const names = ['Red', 'Orange', 'Amber', 'Yellow', 'Lime', 'Green', 'Teal', 'Cyan', 'Blue', 'Indigo', 'Violet', 'Magenta'];
  const top = buckets
    .map((count, i) => ({ name: names[i], count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .filter((b) => b.count > 0);
  const palette = top.map((b) => b.name).join(', ') || 'Neutral / low-saturation';
  return {
    headline: `Dominant palette: ${palette}`,
    confidence: 50,
    rows: top.map((b) => ({ label: b.name, value: `${b.count} sampled px` })),
    suggestion:
      top[0]?.name === 'Blue' || top[0]?.name === 'Teal' || top[0]?.name === 'Cyan'
        ? 'Cool palette detected — try a Cyberpunk Character or Neon City background.'
        : top[0]?.name === 'Amber' || top[0]?.name === 'Orange'
        ? 'Warm palette detected — try the Luxury portrait preset.'
        : 'Try AI Portrait Generator to see this in a few different styles.',
  };
}
