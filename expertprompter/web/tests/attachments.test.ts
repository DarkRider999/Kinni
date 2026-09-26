import { afterEach, describe, expect, it } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import { generatePrompt } from '../lib/server/services/promptGenerationService';
import { SOURCE_CHARS_PER_FILE } from '../lib/server/services/attachmentSections';
import generate from '../pages/api/generate-prompt';

const savedDb = process.env.DATABASE_URL;
afterEach(() => {
  if (savedDb === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = savedDb;
});

describe('attachments in prompts', () => {
  it('puts source text in a fenced Source Material section and mentions it in the summary', () => {
    const prompt = generatePrompt({
      rawInput: 'Summarize this report for my manager',
      category: 'RESEARCH',
      attachments: [{ name: 'q3.pdf', role: 'source', kind: 'text', text: 'Revenue grew 12%.' }],
    });
    expect(prompt.split('\n')[0]).toContain('Base your work on the attached source material (q3.pdf).');
    expect(prompt).toContain('## Source Material');
    expect(prompt).toContain('### q3.pdf\n```\nRevenue grew 12%.\n```');
    expect(prompt.indexOf('## Source Material')).toBeLessThan(prompt.indexOf('## What to Include'));
  });

  it('uses a longer fence when the file itself contains backticks', () => {
    const prompt = generatePrompt({
      rawInput: 'Fix the bug in this code',
      category: 'CODING',
      attachments: [{ name: 'app.py', role: 'source', kind: 'text', text: 'print("```")' }],
    });
    expect(prompt).toContain('````python\nprint("```")\n````');
  });

  it('trims long source files and says so', () => {
    const prompt = generatePrompt({
      rawInput: 'Summarize this book',
      category: 'RESEARCH',
      attachments: [{ name: 'book.txt', role: 'source', kind: 'text', text: 'a'.repeat(SOURCE_CHARS_PER_FILE + 500) }],
    });
    expect(prompt).toMatch(/Trimmed: showing the first 12,000 of 12,500 characters/);
  });

  it('lists references as excerpts and images to attach, without copying instructions', () => {
    const prompt = generatePrompt({
      rawInput: 'Write a blog post about sleep',
      category: 'WRITING',
      attachments: [
        { name: 'old-post.md', role: 'reference', kind: 'text', text: 'My voice is casual.\nShort lines.' },
        { name: 'mood.png', role: 'reference', kind: 'image' },
      ],
    });
    expect(prompt).toContain('## Reference Files');
    expect(prompt).toContain('Do not copy their content.');
    expect(prompt).toContain('- **old-post.md** (document):\n  > My voice is casual.\n  > Short lines.');
    expect(prompt).toContain('- **mood.png** (image): attach it alongside this prompt as a visual reference.');
  });

  it('adds reference-image settings to image prompts and keeps the main line pasteable', () => {
    const prompt = generatePrompt({
      rawInput: 'Logo for a coffee shop',
      category: 'IMAGE',
      attachments: [{ name: 'sketch.jpg', role: 'reference', kind: 'image' }],
    });
    expect(prompt.split('\n')[0]).not.toContain('sketch.jpg');
    expect(prompt).toContain('- Reference images: sketch.jpg');
    expect(prompt).toContain('--sref <image URL>');
  });

  it('uses a source image as the first frame for video prompts', () => {
    const prompt = generatePrompt({
      rawInput: 'Video of this product rotating',
      category: 'VIDEO',
      attachments: [{ name: 'product.png', role: 'source', kind: 'image' }],
    });
    expect(prompt).toContain('first frame (image-to-video)');
  });

  it('is unchanged when there are no attachments', () => {
    const input = { rawInput: 'Write a poem about rain', category: 'WRITING' as const };
    expect(generatePrompt({ ...input, attachments: [] })).toBe(generatePrompt(input));
    expect(generatePrompt(input)).not.toContain('## Source Material');
  });
});

async function post(body: unknown) {
  const out = { status: 200, body: undefined as any };
  let sent = false;
  const res = {
    get headersSent() { return sent; },
    status(c: number) { out.status = c; return res; },
    json(b: unknown) { out.body = b; sent = true; return res; },
    end() { sent = true; return res; },
    setHeader() { return res; },
  };
  const req = { method: 'POST', body, query: {}, url: '/api/generate-prompt', headers: { 'x-forwarded-for': `10.7.${Math.floor(Math.random() * 250)}.1` }, socket: {} };
  await generate(req as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return out;
}

describe('attachment validation (API)', () => {
  it('accepts attachments and returns a prompt using them', async () => {
    delete process.env.DATABASE_URL;
    const res = await post({ rawInput: 'Summarize this', attachments: [{ name: 'notes.txt', role: 'source', kind: 'text', text: 'Hello' }] });
    expect(res.status).toBe(200);
    expect(res.body.generatedPrompt).toContain('### notes.txt');
  });

  it('rejects more than 8 files', async () => {
    delete process.env.DATABASE_URL;
    const files = Array.from({ length: 9 }, (_, i) => ({ name: `f${i}.txt`, role: 'reference', kind: 'text', text: 'x' }));
    expect((await post({ rawInput: 'Summarize this', attachments: files })).status).toBe(400);
  });

  it('rejects oversized text and unknown roles', async () => {
    delete process.env.DATABASE_URL;
    expect((await post({ rawInput: 'Summarize this', attachments: [{ name: 'big.txt', role: 'source', kind: 'text', text: 'a'.repeat(40_001) }] })).status).toBe(400);
    expect((await post({ rawInput: 'Summarize this', attachments: [{ name: 'x.txt', role: 'boss', kind: 'text' }] })).status).toBe(400);
  });
});

describe('AI photo descriptions', () => {
  const d = {
    subject: 'a smiling woman holding a coffee cup', details: 'cream sweater', setting: 'cafe window seat',
    composition: 'medium close-up, rule of thirds', camera: 'eye level, 50mm, f/1.8', lighting: 'soft window light from the right',
    colors: ['warm beige', 'sage green'], style: 'candid lifestyle photography', mood: 'calm and cosy', text: '',
    prompt: 'A candid lifestyle photo of a smiling woman holding a coffee cup at a cafe window, soft window light.',
  };
  const photo = { name: 'me.jpg', role: 'source' as const, kind: 'image' as const, width: 1080, height: 1350, description: d };

  it('uses the photo description as the image prompt and matches its aspect ratio', async () => {
    const { runGeneration } = await import('../lib/server/services/expertPrompterService');
    const r = runGeneration({ rawInput: 'Recreate this photo', attachments: [photo] });
    expect(r.detectedCategory).toBe('IMAGE');
    expect(r.generatedPrompt.split('\n')[0]).toBe(`Image prompt: ${d.prompt.replace(/\.$/, '')}, high resolution, highly detailed`);
    expect(r.generatedPrompt).toContain('Aspect ratio: 4:5');
    expect(r.generatedPrompt).toContain('- Camera: eye level, 50mm, f/1.8');
  });

  it('puts the requested change before the photo description', async () => {
    const { runGeneration } = await import('../lib/server/services/expertPrompterService');
    const r = runGeneration({ rawInput: 'Make this photo look like a Pixar 3D character', attachments: [photo] });
    expect(r.generatedPrompt.split('\n')[0]).toMatch(/^Image prompt: Make this photo look like a Pixar 3D character, a candid lifestyle photo/);
  });

  it('treats a vague request with an uploaded photo as an image task', async () => {
    const { runGeneration } = await import('../lib/server/services/expertPrompterService');
    expect(runGeneration({ rawInput: 'same again please', attachments: [photo] }).detectedCategory).toBe('IMAGE');
  });

  it('uses a described reference photo for style, lighting and colours', () => {
    const prompt = generatePrompt({
      rawInput: 'A portrait of an old fisherman', category: 'IMAGE',
      attachments: [{ ...photo, role: 'reference' }],
    });
    const first = prompt.split('\n')[0];
    expect(first).toContain('candid lifestyle photography');
    expect(first).toContain('colour palette: warm beige, sage green');
    expect(first).toContain('soft window light from the right');
    expect(prompt).toContain('match its look, not its content');
  });

  it('describes the photo for text tasks such as captions', () => {
    const prompt = generatePrompt({ rawInput: 'Write an Instagram caption for this photo', category: 'MARKETING', attachments: [photo] });
    expect(prompt).toContain('(photo, described by AI) The attached photo shows:');
    expect(prompt).toContain('- Subject: a smiling woman holding a coffee cup');
  });

  it('rejects oversized descriptions in the API', async () => {
    delete process.env.DATABASE_URL;
    const res = await post({ rawInput: 'Recreate this photo', attachments: [{ ...photo, description: { ...d, prompt: 'x'.repeat(3001) } }] });
    expect(res.status).toBe(400);
  });
});
