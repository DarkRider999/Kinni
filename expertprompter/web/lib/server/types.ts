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

/**
 * A file the user attached. Files are read in the browser; only their text
 * (and basic metadata) reaches the server, and nothing is stored separately.
 *   source    - the material the task is about ("summarise this report")
 *   reference - examples to match for style, tone or visual direction
 */
export interface Attachment {
  name: string;
  role: 'source' | 'reference';
  kind: 'text' | 'image' | 'other';
  size?: number;
  text?: string;
  /** Pixel size of images, used to match the aspect ratio. */
  width?: number;
  height?: number;
  /** AI description of an image (see lib/server/vision.ts). */
  description?: PhotoDescription;
}

export interface PhotoDescription {
  subject: string;
  details: string;
  setting: string;
  composition: string;
  camera: string;
  lighting: string;
  colors: string[];
  style: string;
  mood: string;
  text: string;
  prompt: string;
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
