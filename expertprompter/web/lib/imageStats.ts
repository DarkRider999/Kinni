// No-AI photo analysis: colour palette, lighting and shape from the pixels.
// Also turns an on-device caption into the same description shape the server
// AI returns, so the prompt builder treats both the same way.

import { nearestAspectRatio } from './aspect';
import type { PhotoDescription } from './types';

export interface PixelStats {
  colors: string[];
  /** 0 (black) .. 1 (white) average luminance. */
  brightness: number;
  /** Standard deviation of luminance, 0 .. ~0.5. */
  contrast: number;
  /** Average (red - blue), -1 (cool) .. 1 (warm). */
  warmth: number;
}

function toHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

/** A plain-English colour name for one RGB value, e.g. "dark teal" or "beige". */
export function colorName(r: number, g: number, b: number): string {
  const [h, s, l] = toHsl(r, g, b);
  if (l > 0.93) return 'white';
  if (l < 0.08) return 'black';
  if (s < 0.12) return l > 0.7 ? 'light grey' : l > 0.4 ? 'grey' : 'charcoal';
  if (h >= 15 && h < 50 && l < 0.42) return l < 0.22 ? 'dark brown' : 'brown';
  if (h >= 20 && h < 55 && s < 0.5 && l > 0.62) return 'beige';
  if ((h >= 330 || h < 15) && l > 0.7) return 'pink';
  const hue =
    h < 15 ? 'red' : h < 40 ? 'orange' : h < 65 ? 'yellow' : h < 90 ? 'yellow-green' : h < 150 ? 'green'
    : h < 185 ? 'teal' : h < 205 ? 'sky blue' : h < 250 ? 'blue' : h < 285 ? 'purple' : h < 330 ? 'magenta' : 'red';
  const tone = l < 0.3 ? 'dark ' : l > 0.75 ? 'light ' : s < 0.35 ? 'muted ' : '';
  return `${tone}${hue}`;
}

/** Stats from RGBA pixels (e.g. a 64x64 canvas). */
export function analyzePixels(data: Uint8ClampedArray | number[]): PixelStats {
  const counts = new Map<string, number>();
  let n = 0;
  let lumSum = 0;
  let lumSq = 0;
  let warmSum = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // skip transparent pixels
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    lumSum += lum;
    lumSq += lum * lum;
    warmSum += (r - b) / 255;
    const name = colorName(r, g, b);
    counts.set(name, (counts.get(name) ?? 0) + 1);
    n++;
  }
  if (!n) return { colors: [], brightness: 0.5, contrast: 0, warmth: 0 };
  const brightness = lumSum / n;
  const colors = [...counts.entries()]
    .filter(([, c]) => c / n >= 0.04) // ignore specks
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);
  return {
    colors,
    brightness,
    contrast: Math.sqrt(Math.max(0, lumSq / n - brightness * brightness)),
    warmth: warmSum / n,
  };
}

/** E.g. "bright, high-key light, warm tones, soft contrast". */
export function lightingPhrase(s: PixelStats): string {
  const key = s.brightness > 0.62 ? 'bright, high-key light' : s.brightness < 0.3 ? 'dark, low-key light' : 'balanced light';
  const tones = s.warmth > 0.08 ? 'warm tones' : s.warmth < -0.08 ? 'cool tones' : 'neutral tones';
  const contrast = s.contrast > 0.27 ? 'high contrast' : s.contrast < 0.12 ? 'soft, low contrast' : 'moderate contrast';
  return `${key}, ${tones}, ${contrast}`;
}

export function orientationPhrase(width: number, height: number): string {
  const ratio = nearestAspectRatio(width, height);
  const shape = width === height || ratio === '1:1' ? 'square' : width > height ? 'landscape' : 'portrait';
  return `${shape} framing (${ratio})`;
}

/** Tidies a model caption: drops "The image shows…" openers and repeated sentences. */
export function cleanCaption(caption: string): string[] {
  const text = caption
    .replace(/\s+/g, ' ')
    .replace(/^\s*(the (image|picture|photo) (shows|is|features|depicts)|this (image|picture|photo) (shows|is)|in this (image|picture|photo),?)\s*/i, '')
    .trim();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/(?<=[.!?])\s+/)) {
    const sentence = raw.trim();
    const key = sentence.toLowerCase().replace(/[^a-z ]/g, '').replace(/\b(the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(sentence.charAt(0).toUpperCase() + sentence.slice(1));
    if (out.length === 6) break;
  }
  return out;
}

/** Description built from pixels only, optionally enriched with an on-device caption. */
export function buildLocalDescription(width: number, height: number, stats: PixelStats, caption?: string): PhotoDescription {
  const sentences = caption ? cleanCaption(caption) : [];
  const lighting = lightingPhrase(stats);
  const palette = stats.colors.join(', ');
  const body = sentences.join(' ').replace(/[.\s]*$/, '');
  return {
    subject: sentences[0]?.replace(/[.\s]*$/, '') ?? '',
    details: sentences.slice(1).join(' '),
    setting: '',
    composition: orientationPhrase(width, height),
    camera: '',
    lighting,
    colors: stats.colors,
    style: '',
    mood: '',
    text: '',
    prompt: body ? `${body}, ${lighting}, colour palette: ${palette}` : '',
  };
}
