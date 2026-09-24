// Shared domain types. String unions mirror the Prisma enums so the pure
// services can be used (and unit-tested) without a database.

export const CATEGORIES = [
  'WRITING',
  'BUSINESS',
  'CODING',
  'IMAGE',
  'VIDEO',
  'MUSIC',
  'MARKETING',
  'EDUCATION',
  'DATA_ANALYSIS',
  'RESEARCH',
  'GENERAL_WRITING',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PROMPT_STYLES = ['PROFESSIONAL', 'CREATIVE', 'TECHNICAL', 'EDUCATIONAL'] as const;
export type PromptStyle = (typeof PROMPT_STYLES)[number];

export const LENGTHS = ['short', 'medium', 'long', 'detailed'] as const;
export type LengthOption = (typeof LENGTHS)[number];

export interface PromptOptions {
  tone?: string;
  length?: LengthOption | string;
  format?: string;
  audience?: string;
  language?: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  WRITING: 'Writing',
  BUSINESS: 'Business',
  CODING: 'Coding',
  IMAGE: 'Image',
  VIDEO: 'Video',
  MUSIC: 'Music',
  MARKETING: 'Marketing',
  EDUCATION: 'Education',
  DATA_ANALYSIS: 'Data Analysis',
  RESEARCH: 'Research',
  GENERAL_WRITING: 'General Writing',
};

export interface AITool {
  id: string;
  name: string;
  vendor: string;
  description: string;
  url: string;
}

export interface RecommendedTool extends AITool {
  /** Why this tool fits this particular request. */
  reason: string;
  rank: number;
}

export interface GeneratePromptResult {
  generatedPrompt: string;
  detectedCategory: Category;
  categoryLabel: string;
  confidence: number;
  alternativeCategories: Category[];
  recommendedTools: string[];
  toolDetails: RecommendedTool[];
  promptStyle: PromptStyle;
  detectedLanguage: string;
  variation: number;
  savedPromptId?: string;
}
