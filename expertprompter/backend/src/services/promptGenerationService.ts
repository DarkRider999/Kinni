// PromptGenerationService: turns raw input into a structured, expert prompt.
// Pure, deterministic code — no external AI calls.
//
// Algorithm
//  1. Analyse the input (clean, strip filler, detect language/locations).
//  2. Select a task template for the category (e.g. "resignation letter",
//     "business plan"); fall back to the category default.
//  3. Build the task sentence:
//       - imperative input ("Write a resignation letter ...") is kept, and the
//         style adjective is inserted after the article
//         ("Write a professional resignation letter ...");
//       - a noun phrase ("business plan for a cloud kitchen") gets the
//         template's verb ("Create a professional business plan for ...");
//       - a question is wrapped ("Answer the following question ...").
//  4. Merge tone words: user tone -> template tone -> style tone (deduped).
//  5. Emit a one-paragraph summary prompt (task + tone + what to include +
//     format), then structured sections: Role, Task & Context, What to
//     Include, Tone & Style, Constraints, Output Format, Quality Checklist.
//  6. Image / video / music templates use a media-specific layout instead
//     (a single descriptive prompt + parameters + negative prompt), since
//     generators like Midjourney or Suno need that shape.
//  7. `variation` seeds a PRNG that picks alternative phrasings, lighting,
//     compositions etc. The same input + variation always gives the same
//     output; "Regenerate" just bumps the variation.

import { analyzeInput, type InputAnalysis } from './inputAnalysisService';
import { selectTemplate, type TaskTemplate } from './promptTemplates';
import type { Category, PromptOptions, PromptStyle } from '../types';

export interface GeneratePromptInput {
  rawInput: string;
  category: Category;
  promptStyle?: PromptStyle;
  options?: PromptOptions;
  variation?: number;
}

export interface StyleProfile {
  adjective: string;
  tone: string[];
  guidance: string[];
  imageStyle: string[];
}

export const STYLE_PROFILES: Record<PromptStyle, StyleProfile> = {
  PROFESSIONAL: {
    adjective: 'professional',
    tone: ['polished'],
    guidance: ['Use clear, confident, business-appropriate language.', 'Prefer short paragraphs and precise wording over flourish.', 'Be credible: specific facts and figures beat vague claims.'],
    imageStyle: ['clean', 'polished', 'commercial-quality'],
  },
  CREATIVE: {
    adjective: 'creative',
    tone: ['imaginative'],
    guidance: ['Take bold, original angles and avoid clichés.', 'Use vivid imagery, metaphor and storytelling where it serves the goal.', 'Vary sentence rhythm to keep the reader engaged.'],
    imageStyle: ['imaginative', 'artistic', 'bold colour choices', 'expressive'],
  },
  TECHNICAL: {
    adjective: 'technically precise',
    tone: ['precise'],
    guidance: ['Use accurate domain terminology and define it where needed.', 'Be exhaustive about edge cases, assumptions and limitations.', 'Prefer structured lists, tables and code/formulas over prose.'],
    imageStyle: ['hyper-detailed', 'accurate proportions', 'sharp focus', 'technical precision'],
  },
  EDUCATIONAL: {
    adjective: 'easy-to-follow',
    tone: ['encouraging'],
    guidance: ['Explain step by step, building from fundamentals.', 'Use analogies and worked examples for every key idea.', 'Summarise key takeaways at the end.'],
    imageStyle: ['clear', 'diagrammatic', 'labelled', 'simple shapes', 'educational illustration'],
  },
};

const LENGTH_RULES: Record<string, string> = {
  short: 'Keep it concise: roughly 150–250 words.',
  medium: 'Aim for a medium length: roughly 400–700 words.',
  long: 'Be thorough: roughly 1,000–1,500 words.',
  detailed: 'Be comprehensive: 1,500+ words, covering every section in depth.',
};

// Extra formatting rules keyed by words that may appear in the format option.
const FORMAT_RULES: Array<[RegExp, string]> = [
  [/markdown|headings/i, 'Use Markdown headings (##), bold for key terms, and bullet lists.'],
  [/table/i, 'Present comparative or numeric information in Markdown tables.'],
  [/bullet|list/i, 'Use concise bullet points; one idea per bullet.'],
  [/json/i, 'Return only valid JSON (no commentary), with a documented schema.'],
  [/letter/i, 'Include date, recipient block, salutation, body paragraphs and a formal sign-off.'],
  [/email/i, 'Start with a "Subject:" line, then greeting, body and sign-off.'],
  [/code/i, 'Put all code in fenced code blocks with the language specified.'],
  [/slide|deck/i, 'Structure the output slide by slide, with a headline and bullets per slide.'],
];

const ROLE_OPENERS = ['You are', 'Act as', 'Take on the role of'];
const APPROACH_LINES = [
  'Before writing, think through the goal, the audience and the key message; then produce the final result.',
  'Plan the structure first, then write the complete result in one pass.',
  'Work step by step: outline, draft, then review against the checklist below before answering.',
];
const LIGHTING = ['soft golden-hour light', 'dramatic studio lighting', 'diffused natural daylight', 'moody cinematic lighting', 'bright even lighting'];
const COMPOSITION = ['rule-of-thirds composition', 'centered symmetrical composition', 'low-angle hero shot', 'close-up with shallow depth of field', 'wide establishing shot'];
const CAMERA_MOVES = ['slow dolly-in', 'smooth tracking shot', 'gentle orbit around the subject', 'static tripod shot', 'drone push-in from above'];
const MUSIC_TEMPOS = ['mid-tempo ~100 BPM', 'upbeat ~120 BPM', 'slow ~75 BPM', 'driving ~128 BPM'];

// ------------------------------------------------------------------ helpers

/** Deterministic PRNG (mulberry32) so a given variation always renders the same. */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pick<T>(items: T[], rng: () => number, variation: number): T {
  // Variation 0 always yields the first ("canonical") option.
  return variation === 0 ? items[0] : items[Math.floor(rng() * items.length)];
}

export function articleFor(word: string): 'a' | 'an' {
  const w = word.toLowerCase();
  if (/^(hour|honest|honou?r|heir)/.test(w)) return 'an';
  if (/^(uni|use|usu|eu|one|once|ur)/.test(w)) return 'a';
  return /^[aeiou]/.test(w) ? 'an' : 'a';
}

export function joinList(items: string[]): string {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] ?? '';
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ensurePeriod(s: string): string {
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

function withArticle(phrase: string): string {
  if (/^(a|an|the|my|our|your|his|her|their|this|that|some)\b/i.test(phrase)) return phrase;
  return `${articleFor(phrase)} ${phrase}`;
}

function splitTone(tone?: string): string[] {
  if (!tone) return [];
  return tone.split(/,|\band\b|\//).map((t) => t.trim().toLowerCase()).filter(Boolean);
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const CREATION_VERBS = /^(write|draft|create|generate|make|build|design|develop|compose|produce|prepare|plan|craft|outline)$/i;

/**
 * Builds the core instruction sentence. Exported for unit tests.
 * "write a resignation letter for a logistics coordinator" + PROFESSIONAL
 *   -> "Write a professional resignation letter for a logistics coordinator."
 */
export function buildTaskSentence(analysis: InputAnalysis, template: TaskTemplate, style: PromptStyle): string {
  const adjective = STYLE_PROFILES[style].adjective;
  let task = analysis.task.replace(/[.!]+$/, '').trim();
  const firstLine = task.split('\n')[0];
  const rest = task.slice(firstLine.length); // keep pasted code/context below the first line intact
  task = firstLine;

  // Questions: keep the wording, ask for a complete answer.
  if (/\?$/.test(task) || /^(what|why|how|when|where|who|which|is|are|does|do|can|should)\b/i.test(task)) {
    return `Answer the following question thoroughly and accurately: "${task.replace(/\?*$/, '?')}"${rest}`;
  }

  const alreadyStyled = task.toLowerCase().includes(adjective.split(' ')[0]);

  if (analysis.isImperative) {
    const match = task.match(/^(\S+)\s+(a|an)\s+(.+)$/i);
    if (match && CREATION_VERBS.test(match[1]) && !alreadyStyled) {
      const [, verb, , remainder] = match;
      return `${capitalize(verb.toLowerCase())} ${articleFor(adjective)} ${adjective} ${remainder}.${rest}`;
    }
    return `${ensurePeriod(capitalize(task))}${rest}`;
  }

  // Noun phrase: prepend the template's verb and the style adjective.
  // The head noun is the last word before the first preposition
  // ("birthday party ideas for kids" -> "ideas"); plurals take no article.
  const head = task.split(/\s+(?:for|about|on|in|of|to|with|that|which)\s+/i)[0].split(/\s+/).pop()!.toLowerCase();
  const looksPlural = /[^s]s$/.test(head) && !/(ss|us|is)$/.test(head);
  // General requests ("birthday party ideas") read oddly with a style adjective.
  if (template.category === 'GENERAL_WRITING') {
    return `${template.defaultVerb} ${looksPlural || /^(the|my|our|your|this|a|an)\b/i.test(task) ? task : withArticle(task)}.${rest}`;
  }
  let phrase: string;
  if (alreadyStyled) phrase = looksPlural ? task : withArticle(task);
  else if (/^(a|an)\s+/i.test(task)) phrase = task.replace(/^(a|an)\s+/i, `${articleFor(adjective)} ${adjective} `);
  else if (/^(the|my|our|your|this)\b/i.test(task)) phrase = task;
  else phrase = looksPlural ? `${adjective} ${task}` : `${articleFor(adjective)} ${adjective} ${task}`;
  return `${template.defaultVerb} ${phrase}.${rest}`;
}

function lengthRule(length?: string): string | null {
  if (!length) return null;
  const key = length.trim().toLowerCase();
  return LENGTH_RULES[key] ?? `Target length: ${length.trim()}.`;
}

function contextLines(analysis: InputAnalysis, options: PromptOptions): string[] {
  const lines: string[] = [];
  for (const place of analysis.locations) {
    lines.push(`Tailor everything to ${place}: local market conditions, regulations, costs (in local currency), culture and customer behaviour.`);
  }
  if (options.audience) lines.push(`The intended audience is ${options.audience.trim()}; match their knowledge level and priorities.`);
  return lines;
}

// ----------------------------------------------------------- text prompts

function buildTextPrompt(
  analysis: InputAnalysis,
  template: TaskTemplate,
  style: PromptStyle,
  options: PromptOptions,
  rng: () => number,
  variation: number,
): string {
  const profile = STYLE_PROFILES[style];
  const taskSentence = buildTaskSentence(analysis, template, style);
  const tones = uniq([...splitTone(options.tone), ...template.defaultTone, ...profile.tone]).slice(0, 4);
  const format = options.format?.trim() || template.defaultFormat;
  const language = options.language?.trim() || analysis.detectedLanguage;

  // 1) The one-paragraph summary prompt (usable on its own).
  const summary = [
    taskSentence.split('\n')[0],
    `The tone should be ${joinList(tones)}.`,
    `Include ${joinList(template.sections.map((sec) => sec.label))}.`,
    `Format it as ${withArticle(format)}.`,
  ];
  if (options.audience) summary.push(`Write it for ${options.audience.trim()}.`);
  const length = lengthRule(options.length);
  if (length) summary.push(length);

  const out: string[] = [summary.join(' '), '', '---', ''];

  // 2) Structured, detailed version.
  out.push('## Role', `${pick(ROLE_OPENERS, rng, variation)} ${template.role}.`, '');

  out.push('## Task', taskSentence);
  const context = contextLines(analysis, options);
  if (context.length) out.push('', ...context.map((c) => `- ${c}`));
  out.push('');

  out.push('## What to Include');
  template.sections.forEach((sec, i) => out.push(`${i + 1}. ${sec.detail}`));
  out.push('');

  out.push('## Tone & Style', `- Tone: ${tones.join(', ')}.`, `- Style: ${capitalize(style.toLowerCase())}.`);
  profile.guidance.forEach((g) => out.push(`- ${g}`));
  out.push('');

  out.push('## Constraints');
  if (length) out.push(`- Length: ${length}`);
  if (options.audience) out.push(`- Audience: ${options.audience.trim()}.`);
  out.push(`- Language: write the entire response in ${language}.`);
  out.push('- Do not invent facts, statistics or quotes; mark estimates and assumptions clearly.');
  out.push('- If essential information is missing, use clearly marked [placeholders] and list your assumptions at the end.');
  out.push('');

  out.push('## Output Format', `- Deliver the result as ${withArticle(format)}.`);
  for (const [pattern, rule] of FORMAT_RULES) {
    if (pattern.test(format)) out.push(`- ${rule}`);
  }
  out.push('');

  out.push('## Quality Checklist');
  template.qualityChecks.forEach((q) => out.push(`- ${q}`));
  out.push(`- ${pick(APPROACH_LINES, rng, variation)}`);

  return out.join('\n').trim();
}

// ---------------------------------------------------------- media prompts

/** Removes "create an image of" style lead-ins, leaving the subject. */
function extractSubject(task: string): string {
  return task
    .replace(/[.!]+$/, '')
    .replace(/^(please\s+)?(create|generate|make|design|draw|paint|illustrate|render|produce|compose|write|animate|film)\s+/i, '')
    .replace(/^(me\s+)?(a|an|the)?\s*(high[- ]quality\s+)?(image|picture|photo|illustration|drawing|painting|artwork|video|clip|animation|song|track|music)\s+(of|about|for|showing|with)\s+/i, '')
    .trim();
}

function aspectFromFormat(format: string | undefined, fallback: string): string {
  if (!format) return fallback;
  const f = format.toLowerCase();
  const explicit = f.match(/\b(\d{1,2}:\d{1,2})\b/);
  if (explicit) return explicit[1];
  if (/square|instagram post|profile/.test(f)) return '1:1';
  if (/portrait|vertical|story|reel|short|tiktok|pinterest|poster/.test(f)) return '9:16';
  if (/landscape|widescreen|youtube|thumbnail|banner|desktop/.test(f)) return '16:9';
  return fallback;
}

function buildImagePrompt(analysis: InputAnalysis, template: TaskTemplate, style: PromptStyle, options: PromptOptions, rng: () => number, variation: number): string {
  const profile = STYLE_PROFILES[style];
  const subject = extractSubject(analysis.task);
  const mood = uniq([...splitTone(options.tone), ...template.defaultTone]);
  const lighting = pick(LIGHTING, rng, variation);
  const composition = pick(COMPOSITION, rng, variation);
  const aspect = aspectFromFormat(options.format, template.aspectRatio ?? '1:1');

  const descriptors = uniq([
    subject,
    ...template.sections.map((sec) => sec.detail),
    ...profile.imageStyle,
    `${joinList(mood)} mood`,
    ...(template.flatGraphic ? [] : [composition, lighting]),
    template.flatGraphic ? 'crisp vector edges' : 'high resolution, highly detailed',
  ]);
  const mainPrompt = descriptors.join(', ');

  return [
    `Image prompt: ${mainPrompt}`,
    '',
    '---',
    '',
    '## Subject', capitalize(subject) + (options.audience ? ` (designed for ${options.audience.trim()})` : ''), '',
    '## Style', `- Visual style: ${profile.imageStyle.join(', ')}`, `- Mood: ${mood.join(', ')}`, '',
    ...(template.flatGraphic ? [] : ['## Composition & Lighting', `- ${capitalize(composition)}`, `- ${capitalize(lighting)}`, '']),
    '## Parameters',
    `- Aspect ratio: ${aspect}`,
    `- Midjourney: append \`--ar ${aspect} --style raw --v 7\``,
    '- DALL·E / ChatGPT: paste the image prompt and state the aspect ratio in words.',
    '- Stable Diffusion: 30–40 steps, CFG 6–8.', '',
    '## Negative Prompt', 'blurry, low resolution, distorted anatomy, extra fingers, watermark, jpeg artifacts, cluttered background, misspelled text', '',
    '## Quality Checklist', ...template.qualityChecks.map((q) => `- ${q}`),
    '- Generate 4 variations, pick the best, then upscale or iterate on it.',
  ].join('\n');
}

function buildVideoPrompt(analysis: InputAnalysis, template: TaskTemplate, style: PromptStyle, options: PromptOptions, rng: () => number, variation: number): string {
  const profile = STYLE_PROFILES[style];
  const subject = extractSubject(analysis.task);
  const mood = uniq([...splitTone(options.tone), ...template.defaultTone]);
  const camera = pick(CAMERA_MOVES, rng, variation);
  const lighting = pick(LIGHTING, rng, variation);
  const aspect = aspectFromFormat(options.format, template.aspectRatio ?? '16:9');
  const duration = options.length && /\d/.test(options.length) ? options.length : '5–10 seconds';

  return [
    `Video prompt: ${capitalize(subject)}. ${capitalize(camera)}, ${lighting}, ${mood.join(', ')} atmosphere, ${profile.imageStyle.slice(0, 2).join(', ')} look, smooth natural motion, ${aspect}.`,
    '',
    '---',
    '',
    '## Shot Description', `- Subject & action: ${subject}`, `- Camera: ${camera}`, `- Lighting: ${lighting}`, `- Mood: ${mood.join(', ')}`,
    ...template.sections.map((sec) => `- ${capitalize(sec.detail)}`), '',
    '## Technical Settings', `- Aspect ratio: ${aspect}`, `- Duration: ${duration}`, '- One continuous shot; describe motion, not cuts.', '',
    '## Audio (optional)', '- Ambient sound design matching the mood; add voiceover separately (e.g. ElevenLabs).', '',
    '## Avoid', 'morphing faces, flickering, warped hands, text artifacts, sudden cuts', '',
    '## Quality Checklist', ...template.qualityChecks.map((q) => `- ${q}`),
  ].join('\n');
}

function buildMusicPrompt(analysis: InputAnalysis, template: TaskTemplate, style: PromptStyle, options: PromptOptions, rng: () => number, variation: number): string {
  const subject = extractSubject(analysis.task);
  const mood = uniq([...splitTone(options.tone), ...template.defaultTone]).slice(0, 3);
  const tempo = pick(MUSIC_TEMPOS, rng, variation);
  const language = options.language?.trim() || analysis.detectedLanguage;
  const genreMatch = analysis.task.match(/\b(pop|rock|hip[- ]?hop|rap|lo-?fi|edm|jazz|country|r&b|metal|folk|indie|classical|orchestral|reggaeton|k-pop|bollywood|synthwave|afrobeats?)\b/i);
  const genre = genreMatch ? genreMatch[1] : style === 'CREATIVE' ? 'indie pop' : 'modern pop';

  return [
    `Style prompt: ${genre}, ${mood.join(', ')}, ${tempo}, catchy hook, polished modern production, clear ${language} vocals`,
    '',
    '---',
    '',
    '## Song Brief', `Write an original song about: ${subject}.`, options.audience ? `Audience: ${options.audience.trim()}.` : '', '',
    '## Lyrics Requirements', `- Language: ${language}`, ...template.sections.map((sec) => `- ${capitalize(sec.detail)}`),
    '- Mark every section with tags like [Verse 1], [Chorus] so Suno/Udio follow the structure.', '',
    '## Sound', `- Genre: ${genre}`, `- Mood: ${mood.join(', ')}`, `- Tempo: ${tempo}`, '- Instrumentation: describe 2–4 lead instruments that fit the genre.', '',
    '## Output Format', '1. Song title', '2. Style prompt (under 200 characters, for the style field)', '3. Full lyrics with section tags', '',
    '## Quality Checklist', ...template.qualityChecks.map((q) => `- ${q}`), '- Lyrics are 100% original (no existing song lyrics).',
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
}

// ------------------------------------------------------------------ public

export interface GeneratedPrompt {
  prompt: string;
  templateKey: string;
  title: string;
  detectedLanguage: string;
}

export function generatePromptDetailed(input: GeneratePromptInput): GeneratedPrompt {
  const analysis = analyzeInput(input.rawInput);
  const style = input.promptStyle ?? 'PROFESSIONAL';
  const options = input.options ?? {};
  const variation = Math.max(0, Math.floor(input.variation ?? 0));
  const template = selectTemplate(input.category, analysis.task);
  const rng = createRng(hashString(analysis.task) + variation * 7919);

  const builders = { text: buildTextPrompt, image: buildImagePrompt, video: buildVideoPrompt, music: buildMusicPrompt };
  const prompt = builders[template.mode](analysis, template, style, options, rng, variation);

  const words = analysis.task.split(/\s+/);
  const title = words.slice(0, 10).join(' ') + (words.length > 10 ? '…' : '');

  return { prompt, templateKey: template.key, title: title.slice(0, 160), detectedLanguage: analysis.detectedLanguage };
}

/** Public API required by the spec: returns the structured prompt string. */
export function generatePrompt(input: GeneratePromptInput): string {
  return generatePromptDetailed(input).prompt;
}
