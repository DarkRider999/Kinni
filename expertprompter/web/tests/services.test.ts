import { describe, expect, it } from 'vitest';
import { analyzeInput, cleanText, detectLanguage, extractLocations, stripFiller } from '../lib/server/services/inputAnalysisService';
import { detectCategory, scoreCategories } from '../lib/server/services/categoryDetectionService';
import { generatePrompt, articleFor, joinList } from '../lib/server/services/promptGenerationService';
import { recommendTools } from '../lib/server/services/aiRecommendationService';
import { runGeneration } from '../lib/server/services/expertPrompterService';

describe('InputAnalysisService', () => {
  it('normalises whitespace and quotes', () => {
    expect(cleanText('  hello   “world”  \n\n\n\n next ')).toBe('hello "world"\n\nnext');
  });
  it('strips layered conversational filler', () => {
    expect(stripFiller('Hi, can you please help me write a poem')).toBe('write a poem');
  });
  it('detects language heuristically', () => {
    expect(detectLanguage('Write a blog post about the ocean')).toBe('English');
    expect(detectLanguage('Escribe una carta para el cliente de la empresa')).toBe('Spanish');
    expect(detectLanguage('اكتب رسالة')).toBe('Arabic');
  });
  it('extracts locations after prepositions', () => {
    expect(extractLocations('Create a business plan for a cloud kitchen in Dubai.')).toEqual(['Dubai']);
    expect(extractLocations('Open a cafe in New York City')).toEqual(['New York City']);
  });
  it('flags imperative input', () => {
    expect(analyzeInput('Write a letter').isImperative).toBe(true);
    expect(analyzeInput('a letter to my boss').isImperative).toBe(false);
  });
});

describe('CategoryDetectionService', () => {
  it.each([
    ['Write a resignation letter for a logistics coordinator.', 'WRITING'],
    ['Create a business plan for a cloud kitchen in Dubai.', 'BUSINESS'],
    ['Fix the bug in my Python function that parses JSON', 'CODING'],
    ['Design a logo for a coffee shop', 'IMAGE'],
    ['Instagram ad campaign for a new sneaker brand', 'MARKETING'],
    ['Explain photosynthesis to 10 year old students', 'EDUCATION'],
    ['A lofi song about rainy nights', 'MUSIC'],
    ['A cinematic video of waves crashing at sunset', 'VIDEO'],
    ['Analyze this sales spreadsheet and find trends', 'DATA_ANALYSIS'],
    ['Literature review on remote work productivity studies', 'RESEARCH'],
    ['Write a KDP ebook about gardening for beginners', 'WRITING'],
    ['how does a car engine work?', 'EDUCATION'],
  ])('%s -> %s', (input, expected) => {
    expect(detectCategory(input)).toBe(expected);
  });

  it('falls back to GENERAL_WRITING for vague input', () => {
    const result = scoreCategories('birthday party ideas');
    expect(result.category).toBe('GENERAL_WRITING');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('breaks near-ties toward the more specific category', () => {
    // "poster" (Image) vs "write" (Writing): Image is more tool-sensitive.
    expect(detectCategory('poster for a concert')).toBe('IMAGE');
  });

  it('matches prefixes and symbols correctly', () => {
    expect(detectCategory('help with my C++ compiler errors')).toBe('CODING');
    // "ad" must not match inside other words like "read" or "made".
    expect(scoreCategories('I read a book I made').scores.MARKETING).toBeUndefined();
  });
});

describe('PromptGenerationService', () => {
  it('reproduces the spec resignation-letter example', () => {
    const prompt = generatePrompt({
      rawInput: 'Write a resignation letter for a logistics coordinator.',
      category: 'WRITING',
      promptStyle: 'PROFESSIONAL',
      options: { tone: 'polite', format: 'formal letter' },
    });
    const summary = prompt.split('\n')[0];
    expect(summary).toContain('Write a professional resignation letter for a logistics coordinator.');
    expect(summary).toContain('The tone should be polite, appreciative, concise');
    expect(summary).toContain('Include notice period, gratitude for opportunities, willingness to support transition, and a positive closing.');
    expect(summary).toContain('Format it as a formal letter.');
    for (const heading of ['## Role', '## Task', '## What to Include', '## Tone & Style', '## Constraints', '## Output Format', '## Quality Checklist']) {
      expect(prompt).toContain(heading);
    }
  });

  it('turns a noun phrase into an instruction', () => {
    const prompt = generatePrompt({ rawInput: 'business plan for a bakery', category: 'BUSINESS' });
    expect(prompt.startsWith('Create a professional business plan for a bakery.')).toBe(true);
  });

  it('uses the correct article for the style adjective', () => {
    const prompt = generatePrompt({ rawInput: 'Write a guide to composting', category: 'EDUCATION', promptStyle: 'EDUCATIONAL' });
    expect(prompt.startsWith('Write an easy-to-follow guide to composting.')).toBe(true);
  });

  it('applies length, audience and language constraints', () => {
    const prompt = generatePrompt({
      rawInput: 'Write a blog post about sleep',
      category: 'WRITING',
      options: { length: 'short', audience: 'busy parents', language: 'Spanish' },
    });
    expect(prompt).toContain('roughly 150–250 words');
    expect(prompt).toContain('busy parents');
    expect(prompt).toContain('write the entire response in Spanish');
  });

  it('adds location context', () => {
    const prompt = generatePrompt({ rawInput: 'Create a business plan for a cloud kitchen in Dubai.', category: 'BUSINESS' });
    expect(prompt).toContain('Tailor everything to Dubai');
    expect(prompt).toContain('financial projections');
  });

  it('builds media-style prompts for images', () => {
    const prompt = generatePrompt({ rawInput: 'Create an image of a fox in a snowy forest', category: 'IMAGE', options: { format: 'portrait' } });
    expect(prompt.startsWith('Image prompt: a fox in a snowy forest')).toBe(true);
    expect(prompt).toContain('--ar 9:16');
    expect(prompt).toContain('## Negative Prompt');
  });

  it('builds Suno-style prompts for music', () => {
    const prompt = generatePrompt({ rawInput: 'a hip-hop song about chasing dreams', category: 'MUSIC' });
    expect(prompt.startsWith('Style prompt: hip-hop')).toBe(true);
    expect(prompt).toContain('[Chorus]');
  });

  it('is deterministic per variation and varies across variations', () => {
    const base = { rawInput: 'A castle on a cliff at night', category: 'IMAGE' as const };
    expect(generatePrompt({ ...base, variation: 3 })).toBe(generatePrompt({ ...base, variation: 3 }));
    const outputs = new Set([0, 1, 2, 3, 4, 5].map((variation) => generatePrompt({ ...base, variation })));
    expect(outputs.size).toBeGreaterThan(1);
  });

  it('helpers', () => {
    expect(articleFor('easy')).toBe('an');
    expect(articleFor('professional')).toBe('a');
    expect(articleFor('unique')).toBe('a');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b, and c');
  });
});

describe('AIRecommendationService', () => {
  it('maps categories to tools', () => {
    expect(recommendTools('CODING')).toContain('GitHub Copilot');
    expect(recommendTools('IMAGE').slice(0, 3)).toEqual(['Midjourney', 'DALL·E / ChatGPT Images', 'Stable Diffusion']);
    expect(recommendTools('MUSIC').slice(0, 2)).toEqual(['Suno', 'Udio']);
    expect(recommendTools('VIDEO').slice(0, 2)).toEqual(['Runway', 'Pika']);
  });
  it('falls back for unknown categories', () => {
    expect(recommendTools('NOPE')).toContain('ChatGPT');
  });
  it('boosts tools from contextual keywords', () => {
    expect(recommendTools('IMAGE', 'a logo with the text ACME').slice(0, 2)).toContain('Ideogram');
  });
  it('returns at most 5 tools', () => {
    expect(recommendTools('BUSINESS', 'pitch deck with latest market size for excel').length).toBeLessThanOrEqual(5);
  });
});

describe('runGeneration (end-to-end, no DB)', () => {
  it('produces the full cloud-kitchen response', () => {
    const result = runGeneration({ rawInput: 'Create a business plan for a cloud kitchen in Dubai.' });
    expect(result.detectedCategory).toBe('BUSINESS');
    expect(result.categoryLabel).toBe('Business');
    expect(result.recommendedTools.slice(0, 2)).toEqual(['ChatGPT', 'Claude']);
    expect(result.toolDetails[0]).toMatchObject({ name: 'ChatGPT', rank: 1 });
    expect(result.generatedPrompt).toContain('Create a professional business plan for a cloud kitchen in Dubai.');
  });
  it('honours a category override', () => {
    const result = runGeneration({ rawInput: 'birthday party ideas', categoryOverride: 'MARKETING' });
    expect(result.detectedCategory).toBe('MARKETING');
    expect(result.confidence).toBe(1);
  });
});
