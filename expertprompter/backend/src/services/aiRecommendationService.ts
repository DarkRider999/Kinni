// AIRecommendationService: maps a category (plus light signals from the
// request) to an ordered list of AI tools.
//
// How it works
//  - TOOL_CATALOG holds every tool once, with a short description and URL.
//  - CATEGORY_TOOLS lists, per category, tool ids in rank order with a reason.
//  - STYLE_BOOSTS / keyword boosts nudge a tool up when the request suggests it
//    (e.g. "python" in a Technical request promotes Claude; "logo" promotes Ideogram,
//    which renders text in images well). Ties keep the base order.
//  - Output: `recommendTools()` returns plain names (string[]) as the spec asks;
//    `recommendToolDetails()` returns the richer objects the UI renders as cards.

import type { AITool, Category, PromptStyle, RecommendedTool } from '../types';

export const TOOL_CATALOG: Record<string, AITool> = {
  chatgpt: { id: 'chatgpt', name: 'ChatGPT', vendor: 'OpenAI', description: 'Versatile general assistant for drafting, brainstorming and iteration.', url: 'https://chat.openai.com' },
  claude: { id: 'claude', name: 'Claude', vendor: 'Anthropic', description: 'Strong at long-form writing, careful reasoning, large documents and code.', url: 'https://claude.ai' },
  gemini: { id: 'gemini', name: 'Gemini', vendor: 'Google', description: 'Google-integrated assistant, good with Docs/Sheets and current information.', url: 'https://gemini.google.com' },
  copilot: { id: 'copilot', name: 'Microsoft Copilot', vendor: 'Microsoft', description: 'Assistant inside Word, Excel, PowerPoint and Outlook.', url: 'https://copilot.microsoft.com' },
  githubCopilot: { id: 'githubCopilot', name: 'GitHub Copilot', vendor: 'GitHub', description: 'AI pair programmer inside your editor.', url: 'https://github.com/features/copilot' },
  claudeCode: { id: 'claudeCode', name: 'Claude Code', vendor: 'Anthropic', description: 'Agentic coding tool that works across a whole repository from the terminal or IDE.', url: 'https://claude.com/claude-code' },
  cursor: { id: 'cursor', name: 'Cursor', vendor: 'Anysphere', description: 'AI-first code editor with codebase-aware chat and edits.', url: 'https://cursor.com' },
  perplexity: { id: 'perplexity', name: 'Perplexity', vendor: 'Perplexity AI', description: 'Answer engine with live web search and citations.', url: 'https://www.perplexity.ai' },
  midjourney: { id: 'midjourney', name: 'Midjourney', vendor: 'Midjourney', description: 'High-aesthetic image generation for art and concept visuals.', url: 'https://www.midjourney.com' },
  dalle: { id: 'dalle', name: 'DALL·E / ChatGPT Images', vendor: 'OpenAI', description: 'Image generation that follows detailed instructions, inside ChatGPT.', url: 'https://openai.com/dall-e-3' },
  stableDiffusion: { id: 'stableDiffusion', name: 'Stable Diffusion', vendor: 'Stability AI', description: 'Open model with fine control (LoRAs, ControlNet, local runs).', url: 'https://stability.ai' },
  ideogram: { id: 'ideogram', name: 'Ideogram', vendor: 'Ideogram', description: 'Image generation that renders legible text — good for logos and posters.', url: 'https://ideogram.ai' },
  canva: { id: 'canva', name: 'Canva Magic Studio', vendor: 'Canva', description: 'Design templates plus AI for social posts, thumbnails and decks.', url: 'https://www.canva.com' },
  runway: { id: 'runway', name: 'Runway', vendor: 'Runway', description: 'Text/image-to-video generation and AI video editing.', url: 'https://runwayml.com' },
  pika: { id: 'pika', name: 'Pika', vendor: 'Pika Labs', description: 'Fast, stylised short video clips from text or images.', url: 'https://pika.art' },
  sora: { id: 'sora', name: 'Sora', vendor: 'OpenAI', description: 'Text-to-video model for realistic, cinematic clips.', url: 'https://openai.com/sora' },
  heygen: { id: 'heygen', name: 'HeyGen', vendor: 'HeyGen', description: 'AI avatar presenters and video translation.', url: 'https://www.heygen.com' },
  elevenlabs: { id: 'elevenlabs', name: 'ElevenLabs', vendor: 'ElevenLabs', description: 'Natural AI voiceovers and voice cloning.', url: 'https://elevenlabs.io' },
  suno: { id: 'suno', name: 'Suno', vendor: 'Suno', description: 'Full songs with vocals from a text prompt and lyrics.', url: 'https://suno.com' },
  udio: { id: 'udio', name: 'Udio', vendor: 'Udio', description: 'High-fidelity AI music generation with style control.', url: 'https://www.udio.com' },
  jasper: { id: 'jasper', name: 'Jasper', vendor: 'Jasper', description: 'Marketing copy with brand-voice controls and campaign workflows.', url: 'https://www.jasper.ai' },
  notebooklm: { id: 'notebooklm', name: 'NotebookLM', vendor: 'Google', description: 'Grounded study/research assistant over your own sources.', url: 'https://notebooklm.google.com' },
  khanmigo: { id: 'khanmigo', name: 'Khanmigo', vendor: 'Khan Academy', description: 'Tutor-style AI designed for teachers and learners.', url: 'https://www.khanmigo.ai' },
  juliusAi: { id: 'juliusAi', name: 'Julius AI', vendor: 'Julius', description: 'Upload data files and get charts, stats and analysis.', url: 'https://julius.ai' },
  grammarly: { id: 'grammarly', name: 'Grammarly', vendor: 'Grammarly', description: 'Polishes grammar, clarity and tone of finished drafts.', url: 'https://www.grammarly.com' },
  gamma: { id: 'gamma', name: 'Gamma', vendor: 'Gamma', description: 'Generates presentation decks and one-pagers from a prompt.', url: 'https://gamma.app' },
};

type Pick = [toolId: string, reason: string];

export const CATEGORY_TOOLS: Record<Category, Pick[]> = {
  WRITING: [
    ['claude', 'Excellent long-form prose and nuanced tone control.'],
    ['chatgpt', 'Quick drafts and easy back-and-forth revisions.'],
    ['copilot', 'Writes directly inside Word and Outlook.'],
    ['grammarly', 'Final polish for grammar and tone.'],
  ],
  GENERAL_WRITING: [
    ['chatgpt', 'Flexible all-rounder for open-ended requests.'],
    ['claude', 'Thoughtful, well-structured answers.'],
    ['gemini', 'Handy if you work in Google Docs.'],
  ],
  BUSINESS: [
    ['chatgpt', 'Fast structured drafts, tables and frameworks.'],
    ['claude', 'Deep reasoning for plans, strategy and long documents.'],
    ['copilot', 'Turns output into Excel models and PowerPoint decks.'],
    ['perplexity', 'Cited market data and competitor research.'],
    ['gamma', 'Converts the plan into a pitch deck.'],
  ],
  CODING: [
    ['githubCopilot', 'Inline completions and chat inside your IDE.'],
    ['claudeCode', 'Multi-file changes across a whole repository.'],
    ['chatgpt', 'Explaining concepts and quick snippets.'],
    ['claude', 'Careful reasoning over large code pastes.'],
    ['cursor', 'Editor with codebase-aware refactors.'],
  ],
  IMAGE: [
    ['midjourney', 'Best-in-class aesthetics for artistic images.'],
    ['dalle', 'Follows detailed instructions; edit by chatting.'],
    ['stableDiffusion', 'Maximum control and local generation.'],
    ['ideogram', 'Renders readable text inside images.'],
    ['canva', 'Finish the image into a ready-to-post design.'],
  ],
  VIDEO: [
    ['runway', 'Text/image-to-video plus editing tools.'],
    ['pika', 'Fast stylised clips for social content.'],
    ['sora', 'Realistic cinematic shots.'],
    ['heygen', 'Talking-avatar presenters for explainers.'],
    ['elevenlabs', 'Voiceover narration for your video.'],
  ],
  MUSIC: [
    ['suno', 'Complete songs with vocals from lyrics + style.'],
    ['udio', 'High-fidelity tracks with fine style control.'],
    ['elevenlabs', 'Voice and sound-effect generation.'],
    ['chatgpt', 'Writing and refining the lyrics first.'],
  ],
  MARKETING: [
    ['chatgpt', 'Rapid copy variations for testing.'],
    ['jasper', 'Brand-voice consistency across campaigns.'],
    ['claude', 'Strategy and long-form marketing content.'],
    ['canva', 'Turn copy into social creatives.'],
    ['copilot', 'Campaign docs and email in Microsoft 365.'],
  ],
  EDUCATION: [
    ['chatgpt', 'Explanations, quizzes and lesson materials.'],
    ['claude', 'Patient, step-by-step explanations.'],
    ['notebooklm', 'Study guides grounded in your own notes.'],
    ['khanmigo', 'Tutor-style guidance built for education.'],
  ],
  DATA_ANALYSIS: [
    ['chatgpt', 'Runs Python on uploaded files (advanced data analysis).'],
    ['juliusAi', 'Charts and statistics from spreadsheets.'],
    ['claude', 'Reasoning about results and writing the narrative.'],
    ['copilot', 'Formulas and pivot tables inside Excel.'],
    ['gemini', 'Analysis directly in Google Sheets.'],
  ],
  RESEARCH: [
    ['perplexity', 'Live web search with citations.'],
    ['claude', 'Synthesising long papers and documents.'],
    ['chatgpt', 'Deep research mode and brainstorming.'],
    ['notebooklm', 'Answers grounded in the sources you upload.'],
  ],
};

// Some templates need a different toolset than their category: a YouTube
// *script* is a writing job even though it lives under Video.
export const TEMPLATE_TOOLS: Record<string, Pick[]> = {
  'video.youtube-script': [
    ['claude', 'Long, well-paced scripts with consistent voice.'],
    ['chatgpt', 'Fast hooks, titles and outline variations.'],
    ['elevenlabs', 'Turn the script into a natural voiceover.'],
    ['heygen', 'Present the script with an AI avatar (faceless channels).'],
    ['canva', 'Design the matching thumbnail.'],
  ],
  'writing.ebook': [
    ['claude', 'Keeps voice and structure consistent across long manuscripts.'],
    ['chatgpt', 'Outlines, chapter drafts and title brainstorming.'],
    ['grammarly', 'Proofreading before you publish.'],
    ['canva', 'Design the book cover and interior graphics.'],
  ],
  'marketing.product-listing': [
    ['chatgpt', 'Keyword-rich title and bullet variations.'],
    ['claude', 'Persuasive, policy-safe long descriptions.'],
    ['jasper', 'Consistent brand voice across listings.'],
    ['perplexity', 'Research competitor listings and keywords.'],
  ],
};

// Contextual boosts: [pattern in input, toolId, score bonus, extra reason].
const KEYWORD_BOOSTS: Array<[RegExp, string, number, string]> = [
  [/\b(logo|poster|typography|text on|lettering|banner)\b/i, 'ideogram', 3, 'Your request involves text in the image.'],
  [/\b(thumbnail|instagram|social post|flyer)\b/i, 'canva', 2, 'Ideal for platform-sized social graphics.'],
  [/\b(repo|repository|codebase|refactor|migrate|multiple files)\b/i, 'claudeCode', 2, 'Your task spans a codebase.'],
  [/\b(excel|spreadsheet|powerpoint|word doc|outlook)\b/i, 'copilot', 2, 'Works inside the Office app you mentioned.'],
  [/\b(google sheets|google docs|gmail)\b/i, 'gemini', 2, 'Works inside Google Workspace.'],
  [/\b(latest|current|202\d|statistics|market size|competitors?|sources|citations?)\b/i, 'perplexity', 2, 'Needs up-to-date, cited information.'],
  [/\b(voice ?over|narrat\w*|podcast)\b/i, 'elevenlabs', 2, 'Needs a natural AI voice.'],
  [/\b(avatar|presenter|talking head|spokesperson)\b/i, 'heygen', 2, 'Needs an on-screen presenter.'],
  [/\b(deck|presentation|slides|pitch)\b/i, 'gamma', 2, 'Can be turned into slides automatically.'],
  [/\b(lyrics|vocals?|singer)\b/i, 'suno', 1, 'Generates sung vocals from lyrics.'],
];

const STYLE_BOOSTS: Partial<Record<PromptStyle, Partial<Record<string, number>>>> = {
  TECHNICAL: { claude: 1, claudeCode: 1 },
  CREATIVE: { midjourney: 1, claude: 0.5 },
  EDUCATIONAL: { notebooklm: 1, khanmigo: 1 },
};

const MAX_TOOLS = 5;

export function recommendToolDetails(
  category: Category,
  opts: { rawInput?: string; style?: PromptStyle; templateKey?: string } = {},
): RecommendedTool[] {
  const base =
    (opts.templateKey && TEMPLATE_TOOLS[opts.templateKey]) || CATEGORY_TOOLS[category] || CATEGORY_TOOLS.GENERAL_WRITING;
  // Base score descends by rank so boosts can reorder but not wildly.
  const scored = new Map<string, { score: number; reason: string }>();
  base.forEach(([id, reason], i) => scored.set(id, { score: base.length - i, reason }));

  const input = opts.rawInput ?? '';
  for (const [pattern, id, bonus, reason] of KEYWORD_BOOSTS) {
    if (!pattern.test(input)) continue;
    const existing = scored.get(id);
    // Only boost tools that belong to this category's list, plus research/office
    // helpers which are useful across categories.
    if (existing) existing.score += bonus;
    else if (['perplexity', 'copilot', 'gemini', 'gamma', 'elevenlabs', 'canva'].includes(id)) scored.set(id, { score: bonus, reason });
  }
  for (const [id, bonus] of Object.entries(opts.style ? STYLE_BOOSTS[opts.style] ?? {} : {})) {
    const existing = scored.get(id);
    if (existing) existing.score += bonus ?? 0;
  }

  return [...scored.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, MAX_TOOLS)
    .map(([id, { reason }], i) => ({ ...TOOL_CATALOG[id], reason, rank: i + 1 }));
}

/** Public API required by the spec: category -> list of tool names. */
export function recommendTools(category: Category | string, rawInput = ''): string[] {
  const cat = (category in CATEGORY_TOOLS ? category : 'GENERAL_WRITING') as Category;
  return recommendToolDetails(cat, { rawInput }).map((t) => t.name);
}
