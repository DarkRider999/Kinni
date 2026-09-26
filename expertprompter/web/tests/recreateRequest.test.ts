import { describe, expect, it } from 'vitest';
import { userChange } from '../lib/server/services/promptGenerationService';
import { runGeneration } from '../lib/server/services/expertPrompterService';

const description = {
  subject: 'a golden retriever puppy',
  details: 'fluffy fur, red collar',
  setting: 'grassy park',
  composition: 'centered close-up',
  camera: 'eye level, 85mm, shallow depth of field',
  lighting: 'soft golden hour backlight',
  colors: ['golden', 'green', 'red'],
  style: 'photorealistic pet photography',
  mood: 'joyful',
  text: '',
  prompt: 'A photo of a golden retriever puppy with a red collar sitting on grass in a park, golden hour backlight.',
};
const photo = (desc?: Partial<typeof description>) => ({ name: 'dog.jpg', role: 'source' as const, kind: 'image' as const, size: 1000, width: 1024, height: 1280, ...(desc ? { description: { ...description, ...desc } } : {}) });

describe('recreate requests for an attached photo', () => {
  it.each([
    'provide me a prompt to generate any picture to the one reference i have attached',
    'Give me a prompt to get an output that looks 99% similar to the attached photo',
    'Recreate this photo',
    'prompt for the uploaded image please',
    'I need the exact same picture as my reference',
  ])('"%s" asks for no change', (text) => {
    expect(userChange(text)).toBeNull();
  });

  it.each([
    ['give me a prompt to recreate the attached photo but in anime style', 'in anime style'],
    ['Recreate this photo as a watercolor painting', 'as a watercolor painting'],
    ['make it a watercolor painting', 'make it a watercolor painting'],
    ['same photo at night with snow', 'same photo at night with snow'],
  ])('"%s" keeps the change "%s"', (text, change) => {
    expect(userChange(text)).toBe(change);
  });

  it('uses the photo description, not the request sentence, as the image prompt', () => {
    const r = runGeneration({
      rawInput: 'provide me a prompt to generate any picture to the one reference i have attached',
      promptStyle: 'PROFESSIONAL',
      attachments: [photo(description)],
    });
    expect(r.detectedCategory).toBe('IMAGE');
    const first = r.generatedPrompt.split('\n')[0];
    expect(first).toMatch(/^Image prompt: A photo of a golden retriever puppy/);
    expect(first).toContain('same framing, pose, lighting and colours as the original photo');
    expect(first).not.toContain('provide me');
    expect(r.generatedPrompt).toContain('Closest match: give the tool the photo itself');
  });

  it('puts a requested change first', () => {
    const r = runGeneration({ rawInput: 'give me a prompt to recreate the attached photo but in anime style', promptStyle: 'PROFESSIONAL', attachments: [photo(description)] });
    expect(r.generatedPrompt.split('\n')[0]).toMatch(/^Image prompt: in anime style, a photo of a golden retriever/);
  });

  it('without an AI caption, the photo is still the subject', () => {
    const r = runGeneration({
      rawInput: 'provide me a prompt to generate any picture to the one reference i have attached',
      promptStyle: 'PROFESSIONAL',
      attachments: [photo({ prompt: '', subject: '' })],
    });
    expect(r.generatedPrompt).toContain('the scene in the attached photo (dog.jpg)');
    expect(r.generatedPrompt).not.toContain('Provide me a prompt');
  });
});
