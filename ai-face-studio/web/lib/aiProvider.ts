import type { Locks, QcVerdict, StudioId } from './types';

/**
 * Provider-agnostic interface (SPEC §8.3). A real face-swap / diffusion model would implement
 * this same shape as a separate adapter — nothing above this interface would need to change.
 */
export interface AIProvider {
  runTransform(input: TransformInput): Promise<{ resultDataUrl: string }>;
  runQualityCheck(simulateFailure: boolean): Promise<{ verdict: QcVerdict; reason?: string }>;
}

export interface TransformInput {
  sourceDataUrl: string;
  toolId: string;
  studio: StudioId;
  locks?: Locks;
  identityStrength?: number; // 0-100
  preset?: string; // named preset or a #hex color
  intensity?: number; // 0-100
}

function hashHue(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) % 360;
  return h;
}

function isHexColor(value: string | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/** Builds the canvas `filter` string for a given tool/studio + params. This is the whole "model": a
 *  real adapter would replace buildFilter + the tint pass with an actual network call. */
function buildFilter(input: TransformInput): string {
  const intensity = (input.intensity ?? 60) / 100;
  const identity = (input.identityStrength ?? 90) / 100;

  switch (input.studio) {
    case 'face':
      // Lower identity strength -> visibly more hue drift, so the slider has a real, visible effect.
      return `contrast(${1 + intensity * 0.1}) saturate(${1 + intensity * 0.15}) hue-rotate(${(1 - identity) * 40}deg)`;
    case 'character': {
      const hue = input.preset ? hashHue(input.preset) : 200;
      return `saturate(1.7) contrast(1.25) hue-rotate(${hue}deg) brightness(${1 + intensity * 0.1})`;
    }
    case 'body':
      return `contrast(${1 + intensity * 0.08}) saturate(1.05)`;
    case 'restore':
      if (input.toolId === 'colorize') return `sepia(0.35) saturate(${1 + intensity * 0.6}) contrast(1.05)`;
      if (input.toolId === 'low-light-enhance') return `brightness(${1 + intensity * 0.5}) contrast(1.08) saturate(1.1)`;
      return `contrast(${1 + intensity * 0.1}) saturate(1.05) brightness(1.03)`;
    case 'photo':
      if (input.toolId === 'background-remover') return 'none';
      if (input.toolId === 'upscaler') return `contrast(${1 + intensity * 0.05}) saturate(1.03)`;
      if (input.toolId === 'object-remover') return `blur(${intensity * 0.6}px) contrast(1.02)`;
      return `contrast(${1 + intensity * 0.12}) saturate(${1 + intensity * 0.15}) brightness(${1 + intensity * 0.05})`;
    case 'hair':
    case 'fashion':
    default:
      return `contrast(1.05) saturate(1.08)`;
  }
}

/** For hair/clothing/background "color" or named tints we overlay a translucent tint instead of (or
 *  in addition to) a filter — this is what makes a chosen hair color or background scene visible. */
function overlayTint(input: TransformInput): { color: string; blend: GlobalCompositeOperation; alpha: number; region: 'top' | 'bottom' | 'full' } | null {
  const intensity = (input.intensity ?? 60) / 100;

  if (input.toolId === 'hair-color-changer' && isHexColor(input.preset)) {
    return { color: input.preset, blend: 'color', alpha: 0.85, region: 'top' };
  }
  if ((input.toolId === 'background-changer' || input.toolId === 'ai-creator') && input.preset) {
    const hue = hashHue(input.preset);
    return { color: `hsl(${hue}, 70%, 35%)`, blend: 'overlay', alpha: 0.35, region: 'bottom' };
  }
  if (input.toolId === 'makeup-studio') {
    return { color: 'hsl(350, 70%, 55%)', blend: 'soft-light', alpha: 0.15 + intensity * 0.25, region: 'full' };
  }
  if (input.toolId === 'clothes-changer' || input.toolId === 'accessory-changer') {
    const hue = input.preset ? hashHue(input.preset) : 220;
    return { color: `hsl(${hue}, 55%, 30%)`, blend: 'multiply', alpha: 0.25, region: 'bottom' };
  }
  return null;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockLocalProvider implements AIProvider {
  async runTransform(input: TransformInput): Promise<{ resultDataUrl: string }> {
    await delay(900 + Math.random() * 500);

    const img = await loadImage(input.sourceDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.filter = buildFilter(input);
    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';

    const tint = overlayTint(input);
    if (tint) {
      const h = canvas.height;
      const y = tint.region === 'top' ? 0 : tint.region === 'bottom' ? h * 0.45 : 0;
      const bandHeight = tint.region === 'full' ? h : h * 0.6;
      ctx.save();
      ctx.globalCompositeOperation = tint.blend;
      ctx.globalAlpha = tint.alpha;
      ctx.fillStyle = tint.color;
      ctx.fillRect(0, y, canvas.width, bandHeight);
      ctx.restore();
    }

    if (input.studio === 'photo' && input.toolId === 'background-remover') {
      // Real alpha-matte removal needs a segmentation model; this placeholder fades the edges
      // so the result is visibly different without pretending to do real segmentation.
      const grad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.32,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.62,
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    return { resultDataUrl: canvas.toDataURL('image/png') };
  }

  async runQualityCheck(simulateFailure: boolean): Promise<{ verdict: QcVerdict; reason?: string }> {
    await delay(250);
    if (simulateFailure) {
      return { verdict: 'fail', reason: 'Simulated: detected unnatural edge blending near the jawline.' };
    }
    return { verdict: 'pass' };
  }
}

export const aiProvider: AIProvider = new MockLocalProvider();
