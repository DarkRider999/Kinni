// InputAnalysisService: cleans raw user text and extracts cheap signals
// (language, leading verb, location, subject) that the other services reuse.

export interface InputAnalysis {
  original: string;
  cleaned: string;
  /** Cleaned text with conversational filler removed ("can you please ..."). */
  task: string;
  /** Lower-cased tokens used by keyword matching. */
  tokens: string[];
  /** Lower-cased first word of `task`, e.g. "write". */
  leadingVerb: string | null;
  isImperative: boolean;
  /** ISO-ish language name guess, e.g. "English", "Spanish". */
  detectedLanguage: string;
  /** Place names found after "in"/"for" ("in Dubai" -> "Dubai"). */
  locations: string[];
  wordCount: number;
}

// Verbs that start a directly usable instruction.
export const IMPERATIVE_VERBS = new Set([
  'write', 'draft', 'create', 'generate', 'make', 'build', 'design', 'develop', 'compose',
  'produce', 'plan', 'prepare', 'outline', 'summarize', 'summarise', 'explain', 'teach',
  'describe', 'analyze', 'analyse', 'compare', 'review', 'fix', 'debug', 'refactor',
  'optimize', 'optimise', 'translate', 'rewrite', 'edit', 'improve', 'brainstorm', 'list',
  'research', 'find', 'draw', 'paint', 'illustrate', 'render', 'animate', 'record', 'code',
  'implement', 'convert', 'calculate', 'forecast', 'suggest', 'propose', 'help', 'give',
  'define', 'evaluate', 'test', 'launch', 'market', 'pitch', 'script', 'visualize',
  'visualise', 'model', 'predict', 'critique', 'proofread', 'craft', 'set', 'setup',
]);

// Conversational openers we strip so the task reads as an instruction.
const FILLER_PREFIXES: RegExp[] = [
  /^(hi|hello|hey)[,!.\s]+/i,
  /^(can|could|would|will) you( please)?\s+/i,
  /^please\s+/i,
  /^i (want|need|would like|'d like) (you )?to\s+/i,
  /^i (want|need) (a|an|some)\s+/i,
  /^(help me|help us)( to)?\s+/i,
  /^(i'm|i am) looking for\s+/i,
  /^(let's|lets)\s+/i,
];

// Words that carry little meaning for classification.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'with',
  'from', 'my', 'our', 'your', 'me', 'us', 'i', 'we', 'you', 'it', 'is', 'are', 'be', 'that',
  'this', 'these', 'those', 'as', 'about', 'into', 'some', 'any', 'can', 'please',
]);

// Very small language fingerprints: common function words per language.
const LANGUAGE_MARKERS: Record<string, string[]> = {
  Spanish: ['el', 'la', 'los', 'las', 'de', 'que', 'y', 'para', 'una', 'un', 'por', 'con', 'escribe', 'crea'],
  French: ['le', 'la', 'les', 'des', 'et', 'pour', 'une', 'un', 'est', 'avec', 'écris', 'crée', 'du'],
  German: ['der', 'die', 'das', 'und', 'für', 'ein', 'eine', 'mit', 'ist', 'schreibe', 'erstelle'],
  Portuguese: ['o', 'os', 'as', 'de', 'que', 'e', 'para', 'uma', 'um', 'com', 'escreva', 'crie', 'não'],
  Italian: ['il', 'lo', 'gli', 'di', 'che', 'e', 'per', 'una', 'un', 'con', 'scrivi', 'crea'],
  English: ['the', 'and', 'for', 'a', 'an', 'of', 'to', 'with', 'write', 'create', 'my', 'is'],
};

// Scripts that identify a language without needing word lists.
const SCRIPT_MARKERS: Array<[RegExp, string]> = [
  [/[؀-ۿ]/, 'Arabic'],
  [/[ऀ-ॿ]/, 'Hindi'],
  [/[一-鿿]/, 'Chinese'],
  [/[぀-ヿ]/, 'Japanese'],
  [/[가-힯]/, 'Korean'],
  [/[Ѐ-ӿ]/, 'Russian'],
  [/[஀-௿]/, 'Tamil'],
  [/[ഀ-ൿ]/, 'Malayalam'],
];

export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[​-‍﻿]/g, '') // zero-width characters
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

export function stripFiller(text: string): string {
  let result = text;
  let changed = true;
  // Apply repeatedly: "Hi, can you please help me write..." has several layers.
  while (changed) {
    changed = false;
    for (const pattern of FILLER_PREFIXES) {
      const next = result.replace(pattern, '');
      if (next !== result) {
        result = next;
        changed = true;
      }
    }
  }
  return result.trim() || text.trim();
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+#.-]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ''))
    .filter(Boolean);
}

export function detectLanguage(text: string): string {
  for (const [pattern, language] of SCRIPT_MARKERS) {
    if (pattern.test(text)) return language;
  }
  const tokens = tokenize(text);
  if (tokens.length === 0) return 'English';

  let best = 'English';
  let bestScore = 0;
  for (const [language, markers] of Object.entries(LANGUAGE_MARKERS)) {
    const markerSet = new Set(markers);
    const score = tokens.filter((t) => markerSet.has(t)).length;
    // English wins ties because it is the most common input language.
    if (score > bestScore || (score === bestScore && language === 'English' && score > 0)) {
      best = language;
      bestScore = score;
    }
  }
  return best;
}

export function extractLocations(text: string): string[] {
  const found = new Set<string>();
  // Capitalised word sequences after a locative preposition: "in Dubai", "for New York".
  const pattern = /\b(?:in|for|across|around|near|based in)\s+((?:[A-Z][\p{L}'-]+)(?:\s+[A-Z][\p{L}'-]+){0,2})/gu;
  for (const match of text.matchAll(pattern)) {
    const candidate = match[1].trim();
    // Skip common capitalised non-places.
    if (/^(I|My|The|A|An|English|Python|JavaScript|Java|React|Excel|Instagram|YouTube|TikTok|Amazon|LinkedIn|Facebook)$/.test(candidate)) continue;
    found.add(candidate);
  }
  return [...found];
}

export function analyzeInput(raw: string): InputAnalysis {
  const cleaned = cleanText(raw);
  const task = stripFiller(cleaned);
  const tokens = tokenize(task);
  const firstWord = tokens[0] ?? null;
  return {
    original: raw,
    cleaned,
    task,
    tokens: tokens.filter((t) => !STOPWORDS.has(t)),
    leadingVerb: firstWord,
    isImperative: firstWord !== null && IMPERATIVE_VERBS.has(firstWord),
    detectedLanguage: detectLanguage(cleaned),
    locations: extractLocations(task),
    wordCount: tokens.length,
  };
}
