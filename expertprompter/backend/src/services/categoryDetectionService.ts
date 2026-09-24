// CategoryDetectionService: rule-based classifier.
//
// Algorithm
//  1. Normalise the input (lower-case, punctuation -> spaces, padded with spaces).
//  2. For every category, sum the weights of matching rules:
//       phrase rules  (multi-word, e.g. "business plan")  -> weight 3
//       strong words  (e.g. "bug", "logo", "campaign")     -> weight 2
//       weak words    (e.g. "design", "story", "plan")     -> weight 1
//     A trailing "*" makes a rule a prefix match ("market*" hits "marketing").
//  3. Add a bonus for the leading verb ("debug ..." -> Coding, "draw ..." -> Image).
//  4. Pick the highest score. Near-ties (within TIE_MARGIN) are broken with
//     PRIORITY: specific, tool-sensitive categories (Image, Coding...) beat
//     generic ones (Writing), because a wrong specialised tool costs the user more.
//  5. If the best score is below MIN_SCORE the input is too vague, so we fall
//     back to GENERAL_WRITING, which works with any general-purpose LLM.

import { analyzeInput } from './inputAnalysisService';
import type { Category } from '../types';

interface CategoryRules {
  phrases: string[];
  strong: string[];
  weak: string[];
}

export const CATEGORY_RULES: Record<Exclude<Category, 'GENERAL_WRITING'>, CategoryRules> = {
  WRITING: {
    phrases: ['cover letter', 'resignation letter', 'blog post', 'short story', 'thank you note', 'personal statement', 'wedding speech', 'job description'],
    strong: ['letter', 'essay', 'article', 'story', 'poem', 'novel', 'email', 'resignation', 'speech', 'biography', 'bio', 'proofread', 'rewrite', 'paraphrase', 'blog', 'chapter', 'ebook', 'screenplay', 'resume', 'cv', 'memoir', 'kdp', 'manuscript', 'eulogy', 'toast', 'invitation'],
    weak: ['write', 'draft', 'compose', 'text', 'paragraph', 'edit', 'content', 'words', 'tone', 'narrative', 'book', 'announcement', 'message', 'note', 'caption'],
  },
  BUSINESS: {
    phrases: ['business plan', 'pitch deck', 'swot analysis', 'go to market', 'go-to-market', 'business model', 'financial model', 'market research', 'cash flow', 'profit and loss', 'value proposition', 'executive summary', 'cloud kitchen', 'unit economics'],
    strong: ['business', 'startup', 'company', 'revenue', 'investor', 'investors', 'funding', 'strategy', 'entrepreneur*', 'franchise', 'profit*', 'pricing', 'budget', 'proposal', 'okr*', 'kpi*', 'stakeholder*', 'b2b', 'saas', 'restaurant', 'ecommerce', 'e-commerce', 'operations', 'procurement', 'logistics', 'hiring', 'negotiat*', 'consulting', 'forecast*', 'invoice', 'contract'],
    weak: ['plan', 'market', 'customers', 'growth', 'team', 'meeting', 'sales', 'store', 'shop', 'product', 'service', 'launch', 'costs', 'management', 'report'],
  },
  CODING: {
    phrases: ['rest api', 'unit test', 'unit tests', 'system design', 'data structure', 'pull request', 'stack trace', 'web app', 'mobile app', 'sql query', 'regular expression', 'command line'],
    strong: ['code', 'coding', 'bug', 'bugs', 'debug*', 'function', 'api', 'apis', 'endpoint', 'python', 'javascript', 'typescript', 'java', 'kotlin', 'swift', 'rust', 'golang', 'c++', 'c#', 'react', 'next.js', 'nextjs', 'node', 'nodejs', 'express', 'django', 'flask', 'sql', 'database', 'refactor*', 'compile*', 'algorithm', 'script', 'regex', 'repository', 'git', 'docker', 'kubernetes', 'backend', 'frontend', 'html', 'css', 'programming', 'program', 'developer', 'deploy*', 'exception', 'error', 'class', 'component', 'library', 'framework', 'android', 'ios', 'bash', 'shell', 'json', 'graphql', 'microservice*', 'devops', 'ci/cd', 'terraform', 'prisma'],
    weak: ['app', 'software', 'build', 'implement', 'test', 'tests', 'website', 'server', 'install', 'automate', 'automation', 'bot', 'extension', 'plugin', 'integration'],
  },
  IMAGE: {
    phrases: ['logo design', 'digital art', 'concept art', 'product photo', 'profile picture', 'book cover', 'album cover', 'youtube thumbnail', 'oil painting', 'pixel art', 'character design', 'wall art'],
    strong: ['image', 'images', 'logo', 'art', 'artwork', 'illustration', 'illustrate', 'drawing', 'draw', 'painting', 'paint', 'photo', 'photograph', 'picture', 'poster', 'thumbnail', 'wallpaper', 'icon', 'sticker', 'mockup', 'render', 'portrait', 'midjourney', 'dall-e', 'dalle', 'watercolor', 'watercolour', 'anime', 'cartoon', '3d', 'photorealistic', 'banner', 'infographic', 'tattoo', 'sketch'],
    weak: ['design', 'visual', 'cover', 'cinematic', 'aesthetic', 'style', 'colorful', 'scene', 'background', 'character'],
  },
  VIDEO: {
    phrases: ['youtube video', 'explainer video', 'short film', 'music video', 'product video', 'youtube short', 'youtube shorts', 'instagram reel', 'b-roll', 'text to video'],
    strong: ['video', 'videos', 'film', 'footage', 'clip', 'clips', 'animation', 'animate', 'reel', 'reels', 'tiktok', 'storyboard', 'cinematography', 'vlog', 'trailer', 'runway', 'sora', 'shots', 'scene-by-scene', 'voiceover', 'voice-over', 'subtitles'],
    weak: ['youtube', 'shorts', 'channel', 'motion', 'camera', 'edit', 'episode'],
  },
  MUSIC: {
    phrases: ['song lyrics', 'background music', 'theme song', 'jingle for', 'chord progression', 'beat for'],
    strong: ['song', 'songs', 'music', 'lyrics', 'melody', 'beat', 'beats', 'jingle', 'soundtrack', 'rap', 'chorus', 'verse', 'instrumental', 'lofi', 'lo-fi', 'hip-hop', 'hiphop', 'edm', 'orchestral', 'suno', 'udio', 'bpm', 'album', 'track', 'podcast'],
    weak: ['audio', 'sound', 'rhythm', 'vocal', 'vocals', 'guitar', 'piano', 'genre'],
  },
  MARKETING: {
    phrases: ['social media', 'marketing plan', 'ad copy', 'email campaign', 'landing page', 'brand voice', 'content calendar', 'product description', 'call to action', 'target audience', 'google ads', 'facebook ads', 'amazon listing', 'press release', 'seo strategy', 'book description', 'kdp description', 'kdp listing', 'a+ content'],
    strong: ['marketing', 'campaign', 'campaigns', 'ad', 'ads', 'advert*', 'seo', 'slogan', 'tagline', 'brand*', 'promotion', 'promote', 'newsletter', 'copywriting', 'copy', 'influencer', 'engagement', 'conversion', 'funnel', 'hashtag*', 'instagram', 'linkedin', 'facebook', 'followers', 'viral', 'listing', 'leads'],
    weak: ['audience', 'post', 'posts', 'social', 'launch', 'customers', 'sell', 'selling', 'sales', 'offer', 'description', 'title', 'titles', 'keywords'],
  },
  EDUCATION: {
    phrases: ['lesson plan', 'study guide', 'quiz questions', 'explain like', 'learning objectives', 'course outline', 'exam questions', 'practice questions', 'step by step explanation'],
    strong: ['how does', 'how do', 'what is', 'what are', 'why do', 'why does', 'lesson', 'lessons', 'teach', 'teaching', 'student', 'students', 'explain', 'learn', 'learning', 'course', 'curriculum', 'quiz', 'exam', 'tutorial', 'homework', 'syllabus', 'classroom', 'teacher', 'school', 'university', 'worksheet', 'flashcards', 'study', 'beginner', 'beginners', 'eli5', 'kids', 'children', 'grade', 'training'],
    weak: ['understand', 'concept', 'concepts', 'basics', 'introduction', 'guide', 'how', 'why', 'simple', 'examples'],
  },
  DATA_ANALYSIS: {
    phrases: ['data analysis', 'pivot table', 'excel formula', 'google sheets', 'machine learning', 'data set', 'time series', 'a/b test', 'power bi'],
    strong: ['data', 'dataset', 'datasets', 'spreadsheet', 'excel', 'csv', 'statistics', 'statistical', 'regression', 'chart', 'charts', 'dashboard', 'metrics', 'analytics', 'visualization', 'visualisation', 'tableau', 'pandas', 'correlation', 'trend', 'trends', 'survey'],
    weak: ['analyze', 'analyse', 'analysis', 'numbers', 'table', 'graph', 'insights', 'compare', 'measure'],
  },
  RESEARCH: {
    phrases: ['literature review', 'research paper', 'case study', 'white paper', 'fact check', 'pros and cons', 'state of the art'],
    strong: ['research', 'thesis', 'dissertation', 'sources', 'citations', 'citation', 'study', 'studies', 'evidence', 'hypothesis', 'academic', 'scientific', 'journal', 'investigate', 'summarize', 'summarise', 'summary', 'compare', 'comparison', 'history'],
    weak: ['facts', 'findings', 'topic', 'overview', 'review', 'information', 'latest', 'trends'],
  },
};

// Leading-verb bonuses: the first word is a strong hint of intent.
const VERB_BONUS: Record<string, Partial<Record<Category, number>>> = {
  write: { WRITING: 1.5 }, draft: { WRITING: 1.5 }, compose: { WRITING: 1, MUSIC: 1 },
  rewrite: { WRITING: 2 }, proofread: { WRITING: 2 }, edit: { WRITING: 1 },
  debug: { CODING: 3 }, fix: { CODING: 1 }, refactor: { CODING: 3 }, implement: { CODING: 2 }, code: { CODING: 3 },
  draw: { IMAGE: 3 }, paint: { IMAGE: 3 }, illustrate: { IMAGE: 3 }, render: { IMAGE: 2 },
  animate: { VIDEO: 3 }, film: { VIDEO: 3 },
  teach: { EDUCATION: 2 }, explain: { EDUCATION: 1.5 },
  analyze: { DATA_ANALYSIS: 1.5 }, analyse: { DATA_ANALYSIS: 1.5 }, visualize: { DATA_ANALYSIS: 1.5 },
  research: { RESEARCH: 2 }, summarize: { RESEARCH: 1.5 }, summarise: { RESEARCH: 1.5 },
  market: { MARKETING: 2 }, promote: { MARKETING: 2 }, pitch: { BUSINESS: 1.5 },
};

// Tie-break order: earlier = more specific = wins near-ties. Video precedes
// Image because visual words ("cinematic") often describe a requested video.
export const PRIORITY: Category[] = [
  'VIDEO', 'IMAGE', 'MUSIC', 'CODING', 'DATA_ANALYSIS', 'MARKETING',
  'BUSINESS', 'EDUCATION', 'RESEARCH', 'WRITING', 'GENERAL_WRITING',
];

const PHRASE_WEIGHT = 3;
const STRONG_WEIGHT = 2;
const WEAK_WEIGHT = 1;
const MIN_SCORE = 2; // below this the input is too vague to classify
const TIE_MARGIN = 0.5; // scores this close are treated as a tie

export interface CategoryDetection {
  category: Category;
  confidence: number; // 0..1
  scores: Partial<Record<Category, number>>;
  matchedKeywords: string[];
  alternatives: Category[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

function buildMatcher(rule: string): RegExp {
  const isPrefix = rule.endsWith('*');
  const body = escapeRegExp(isPrefix ? rule.slice(0, -1) : rule);
  // Boundaries are "not a letter/number" so rules like "c++" and "ci/cd" work.
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}${isPrefix ? '[\\p{L}\\p{N}-]*' : ''}(?![\\p{L}\\p{N}+#])`, 'u');
}

// Compile once at module load.
const COMPILED = Object.entries(CATEGORY_RULES).map(([category, rules]) => ({
  category: category as Category,
  rules: [
    ...rules.phrases.map((r) => ({ rule: r, weight: PHRASE_WEIGHT, re: buildMatcher(r) })),
    ...rules.strong.map((r) => ({ rule: r, weight: STRONG_WEIGHT, re: buildMatcher(r) })),
    ...rules.weak.map((r) => ({ rule: r, weight: WEAK_WEIGHT, re: buildMatcher(r) })),
  ],
}));

export function scoreCategories(rawInput: string): CategoryDetection {
  const analysis = analyzeInput(rawInput);
  const text = ` ${analysis.task.toLowerCase()} `;
  const scores: Partial<Record<Category, number>> = {};
  const matchedKeywords: string[] = [];

  for (const { category, rules } of COMPILED) {
    let score = 0;
    for (const { rule, weight, re } of rules) {
      if (re.test(text)) {
        score += weight;
        matchedKeywords.push(rule.replace(/\*$/, ''));
      }
    }
    if (score > 0) scores[category] = score;
  }

  const verb = analysis.leadingVerb ?? '';
  for (const [category, bonus] of Object.entries(VERB_BONUS[verb] ?? {})) {
    const cat = category as Category;
    scores[cat] = (scores[cat] ?? 0) + (bonus ?? 0);
  }

  const ranked = (Object.entries(scores) as Array<[Category, number]>).sort((a, b) => {
    if (Math.abs(b[1] - a[1]) > TIE_MARGIN) return b[1] - a[1];
    return PRIORITY.indexOf(a[0]) - PRIORITY.indexOf(b[0]);
  });

  const [top, second] = ranked;
  if (!top || top[1] < MIN_SCORE) {
    return {
      category: 'GENERAL_WRITING',
      confidence: top ? 0.3 : 0.2,
      scores,
      matchedKeywords,
      alternatives: ranked.slice(0, 2).map(([c]) => c),
    };
  }

  const total = ranked.reduce((sum, [, s]) => sum + s, 0);
  const share = top[1] / total; // how dominant the winner is
  const strength = Math.min(1, top[1] / 6); // how much evidence there is
  const confidence = Math.round((0.5 * share + 0.5 * strength) * 100) / 100;

  return {
    category: top[0],
    confidence,
    scores,
    matchedKeywords: [...new Set(matchedKeywords)],
    // Runner-ups worth offering in the UI (at least half the winner's score).
    alternatives: ranked.slice(1, 3).filter(([, s]) => second && s >= top[1] / 2).map(([c]) => c),
  };
}

/** Public API required by the spec: rawInput -> category. */
export function detectCategory(rawInput: string): Category {
  return scoreCategories(rawInput).category;
}
