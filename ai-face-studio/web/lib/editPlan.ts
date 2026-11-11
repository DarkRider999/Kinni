import type { EditPlanField, StudioId } from './types';

/**
 * A small keyword matcher standing in for the real NLP/LLM-based plan compiler in SPEC §5.2.
 * It genuinely parses the typed text (no network call, no LLM) — good enough to prove the UX
 * (plan shown and editable before generating), not good enough to understand arbitrary language.
 */

const HAIR_COLORS: Record<string, string> = {
  silver: '#C0C0C8', platinum: '#E8E4D8', blonde: '#D9A441', black: '#1C1C1E',
  brown: '#4A2E1E', red: '#B22234', blue: '#3B82F6', purple: '#8B5CF6',
  pink: '#EC4899', white: '#F5F5F7', green: '#34D399',
};

const SCENES = [
  'cyberpunk city', 'neon city', 'dubai skyline', 'beach sunset', 'desert sunset',
  'city', 'cyberpunk', 'beach', 'forest', 'office', 'studio', 'mountain', 'space', 'dubai', 'desert', 'snow', 'rooftop', 'sunset', 'neon',
];
const LIGHTING = ['neon', 'dramatic', 'soft', 'warm', 'cinematic', 'moody', 'bright', 'golden'];
const CLOTHING = ['suit', 'dress', 'jacket', 'uniform', 'costume', 'outfit', 'streetwear', 'gown'];

/** Prefers the longest matching phrase (so "cyberpunk city" wins over the lone word "city"),
 *  tie-broken by whichever appears earliest in the text. */
function findFirst(text: string, words: string[]): string | undefined {
  const matches = words
    .map((w) => ({ w, i: text.indexOf(w) }))
    .filter((m) => m.i !== -1);
  if (matches.length === 0) return undefined;
  matches.sort((a, b) => b.w.length - a.w.length || a.i - b.i);
  return matches[0].w;
}

export function parsePrompt(prompt: string): EditPlanField[] {
  const text = prompt.toLowerCase();
  const mentionsHair = text.includes('hair');
  const hairColorWord = Object.keys(HAIR_COLORS).find((c) => text.includes(c));
  const scene = findFirst(text, SCENES);
  const lighting = findFirst(text, LIGHTING);
  const clothing = findFirst(text, CLOTHING);

  const fields: EditPlanField[] = [
    { field: 'face', action: 'preserve', enabled: true },
    mentionsHair && hairColorWord
      ? { field: 'hair', action: 'change', value: `Color → ${hairColorWord}`, enabled: true }
      : { field: 'hair', action: 'preserve', enabled: true },
    clothing
      ? { field: 'clothing', action: 'change', value: `Outfit → ${clothing}`, enabled: true }
      : { field: 'clothing', action: 'preserve', enabled: true },
    scene
      ? { field: 'background', action: 'change', value: `Scene → ${scene}`, enabled: true }
      : { field: 'background', action: 'preserve', enabled: true },
    lighting
      ? { field: 'lighting', action: 'change', value: `Style → ${lighting}`, enabled: true }
      : { field: 'lighting', action: 'preserve', enabled: true },
  ];

  return fields;
}

export function hairColorHex(word: string): string | undefined {
  return HAIR_COLORS[word];
}

export interface CreatorPass {
  toolId: string;
  studio: StudioId;
  preset?: string;
}

/** Turns the editable plan into a chain of mock-provider passes — each enabled "change" row becomes
 *  one pass, feeding the previous pass's output into the next (same AIProvider.runTransform call a
 *  real multi-model pipeline would use, just chained client-side here). */
export function planToPasses(fields: EditPlanField[]): CreatorPass[] {
  const passes: CreatorPass[] = [];

  const hair = fields.find((f) => f.field === 'hair');
  if (hair?.enabled && hair.action === 'change' && hair.value) {
    const word = hair.value.split('→')[1]?.trim();
    const hex = word ? hairColorHex(word) : undefined;
    if (hex) passes.push({ toolId: 'hair-color-changer', studio: 'hair', preset: hex });
  }

  const clothing = fields.find((f) => f.field === 'clothing');
  if (clothing?.enabled && clothing.action === 'change') {
    passes.push({ toolId: 'clothes-changer', studio: 'fashion', preset: clothing.value?.split('→')[1]?.trim() });
  }

  const background = fields.find((f) => f.field === 'background');
  if (background?.enabled && background.action === 'change' && background.value) {
    passes.push({ toolId: 'background-changer', studio: 'photo', preset: background.value.split('→')[1]?.trim() });
  }

  const lighting = fields.find((f) => f.field === 'lighting');
  if (lighting?.enabled && lighting.action === 'change') {
    passes.push({ toolId: 'photo-enhancer', studio: 'photo' });
  }

  if (passes.length === 0) passes.push({ toolId: 'photo-enhancer', studio: 'photo' });
  return passes;
}
