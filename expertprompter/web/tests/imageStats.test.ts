import { describe, expect, it } from 'vitest';
import { analyzePixels, buildLocalDescription, cleanCaption, colorName, lightingPhrase, orientationPhrase } from '../lib/imageStats';
import { generatePrompt } from '../lib/server/services/promptGenerationService';

/** RGBA pixels: `count` copies of each colour. */
function pixels(...parts: Array<[number, number, number, number]>) {
  const out: number[] = [];
  for (const [r, g, b, count] of parts) for (let i = 0; i < count; i++) out.push(r, g, b, 255);
  return out;
}

describe('colorName', () => {
  it.each([
    [[255, 255, 255], 'white'], [[0, 0, 0], 'black'], [[128, 128, 128], 'grey'], [[40, 40, 45], 'charcoal'],
    [[200, 30, 30], 'red'], [[240, 140, 30], 'orange'], [[30, 160, 60], 'green'], [[30, 60, 200], 'blue'],
    [[110, 70, 40], 'brown'], [[225, 205, 175], 'beige'], [[250, 190, 210], 'pink'], [[20, 60, 30], 'dark green'],
  ] as const)('%j -> %s', (rgb, name) => {
    expect(colorName(rgb[0], rgb[1], rgb[2])).toBe(name);
  });
});

describe('analyzePixels', () => {
  it('ranks dominant colours and ignores specks', () => {
    const s = analyzePixels(pixels([30, 60, 200, 60], [240, 140, 30, 37], [200, 30, 30, 3]));
    expect(s.colors).toEqual(['blue', 'orange']);
  });

  it('measures brightness, warmth and contrast', () => {
    const bright = analyzePixels(pixels([250, 230, 200, 100]));
    expect(lightingPhrase(bright)).toBe('bright, high-key light, warm tones, soft, low contrast');
    const dark = analyzePixels(pixels([10, 20, 60, 50], [230, 235, 250, 10]));
    expect(lightingPhrase(dark)).toMatch(/^dark, low-key light, cool tones, high contrast$/);
  });

  it('skips transparent pixels', () => {
    expect(analyzePixels([255, 0, 0, 0, 255, 0, 0, 0]).colors).toEqual([]);
  });
});

describe('captions from the on-device model', () => {
  it('removes openers and repeated sentences', () => {
    expect(cleanCaption('The image shows a green car parked outside. The car is green. The car is green. A yellow building is behind it.')).toEqual([
      'A green car parked outside.', 'The car is green.', 'A yellow building is behind it.',
    ]);
  });

  it('builds a description with a recreate prompt from caption + pixels', () => {
    const stats = analyzePixels(pixels([150, 210, 180, 50], [240, 200, 60, 50]));
    const d = buildLocalDescription(1600, 1200, stats, 'A small mint green car is parked in front of a yellow building. The street is cobblestone.');
    expect(d.subject).toBe('A small mint green car is parked in front of a yellow building');
    expect(d.details).toBe('The street is cobblestone.');
    expect(d.composition).toBe('landscape framing (4:3)');
    expect(d.prompt).toMatch(/^A small mint green car .* The street is cobblestone, .*light.*, colour palette: /);
  });

  it('without a caption it still measures colours, light and shape, but has no recreate prompt', () => {
    const d = buildLocalDescription(1080, 1350, analyzePixels(pixels([20, 20, 20, 10])));
    expect(d.prompt).toBe('');
    expect(d.colors).toEqual(['black']);
    expect(orientationPhrase(1080, 1350)).toBe('portrait framing (4:5)');
  });
});

describe('prompts from on-device descriptions', () => {
  const stats = analyzePixels(pixels([150, 210, 180, 50], [240, 200, 60, 50]));

  it('uses the caption-based recreate prompt and the photo tool steps', () => {
    const d = buildLocalDescription(1080, 1350, stats, 'A woman in a red coat walks down a snowy street.');
    const prompt = generatePrompt({ rawInput: 'Recreate this photo', category: 'IMAGE', attachments: [{ name: 'me.jpg', role: 'source', kind: 'image', width: 1080, height: 1350, description: d }] });
    expect(prompt.split('\n')[0]).toMatch(/^Image prompt: A woman in a red coat walks down a snowy street, /);
    expect(prompt).toContain('Aspect ratio: 4:5');
    expect(prompt).toContain('Closest match: give the tool the photo itself (me.jpg)');
    expect(prompt).toContain('--iw 2');
    expect(prompt).toContain('img2img with denoising strength 0.3–0.5');
  });

  it('with pixels only, keeps the user subject and adds the measured palette and light', () => {
    const d = buildLocalDescription(1080, 1350, stats);
    const prompt = generatePrompt({ rawInput: 'A portrait of an old fisherman', category: 'IMAGE', attachments: [{ name: 'look.jpg', role: 'source', kind: 'image', width: 1080, height: 1350, description: d }] });
    const first = prompt.split('\n')[0];
    expect(first).toMatch(/^Image prompt: A portrait of an old fisherman,/);
    expect(first).toContain(`colour palette: ${d.colors.join(', ')}`);
    expect(first).toContain(d.lighting);
    expect(prompt).not.toContain('Recreate prompt:');
    expect(prompt).toContain('colours and light measured');
  });
});
