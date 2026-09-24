// Mirrors the backend contract (backend/src/types).

export type Category =
  | 'WRITING' | 'BUSINESS' | 'CODING' | 'IMAGE' | 'VIDEO' | 'MUSIC'
  | 'MARKETING' | 'EDUCATION' | 'DATA_ANALYSIS' | 'RESEARCH' | 'GENERAL_WRITING';

export type PromptStyle = 'PROFESSIONAL' | 'CREATIVE' | 'TECHNICAL' | 'EDUCATIONAL';

export interface PromptOptions {
  tone?: string;
  length?: string;
  format?: string;
  audience?: string;
  language?: string;
}

export interface RecommendedTool {
  id: string;
  name: string;
  vendor: string;
  description: string;
  url: string;
  reason: string;
  rank: number;
}

export interface GenerateRequest {
  rawInput: string;
  promptStyle?: PromptStyle;
  options?: PromptOptions;
  variation?: number;
  category?: Category;
  /** Logged-in users auto-save unless this is false. */
  save?: boolean;
}

export interface GenerateResponse {
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
  title: string;
  savedPromptId?: string;
  entitlement?: Entitlement | null;
}

export interface SavedPrompt {
  id: string;
  rawInput: string;
  detectedCategory: Category;
  promptStyle: PromptStyle;
  options: PromptOptions;
  generatedPrompt: string;
  recommendedTools: string[];
  title: string | null;
  isFavorite: boolean;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

export type Plan = 'MASTER' | 'PREMIUM' | 'FREE';

export interface Entitlement {
  plan: Plan;
  freeRunsUsed: number;
  freeRunsLimit: number;
  /** null when unlimited (Master / Premium). */
  freeRunsRemaining: number | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
}

export interface ProvidersInfo {
  accountsEnabled: boolean;
  providers: Array<{ id: 'google' | 'facebook' | 'github'; label: string }>;
  billingEnabled: boolean;
  freeRunsLimit: number;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  WRITING: 'Writing', BUSINESS: 'Business', CODING: 'Coding', IMAGE: 'Image', VIDEO: 'Video',
  MUSIC: 'Music', MARKETING: 'Marketing', EDUCATION: 'Education', DATA_ANALYSIS: 'Data Analysis',
  RESEARCH: 'Research', GENERAL_WRITING: 'General Writing',
};

export const STYLE_OPTIONS: Array<{ value: PromptStyle; label: string; hint: string }> = [
  { value: 'PROFESSIONAL', label: 'Professional', hint: 'Polished, clear, business-ready' },
  { value: 'CREATIVE', label: 'Creative', hint: 'Original, vivid, story-driven' },
  { value: 'TECHNICAL', label: 'Technical', hint: 'Precise, exhaustive, structured' },
  { value: 'EDUCATIONAL', label: 'Educational', hint: 'Step-by-step, beginner-friendly' },
];
