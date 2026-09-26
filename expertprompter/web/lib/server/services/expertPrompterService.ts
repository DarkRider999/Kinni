// Orchestrates the pure services into one generation result.
// Kept free of Express and Prisma so it can be unit-tested directly.

import { scoreCategories } from './categoryDetectionService';
import { generatePromptDetailed } from './promptGenerationService';
import { recommendToolDetails } from './aiRecommendationService';
import { CATEGORY_LABELS, type Attachment, type Category, type GeneratePromptResult, type PromptOptions, type PromptStyle } from '../types';

export interface RunGenerationInput {
  rawInput: string;
  promptStyle?: PromptStyle;
  options?: PromptOptions;
  variation?: number;
  /** Lets the UI override detection when the user picks a different category. */
  categoryOverride?: Category;
  attachments?: Attachment[];
}

export function runGeneration(input: RunGenerationInput): GeneratePromptResult & { title: string; templateKey: string } {
  const detection = scoreCategories(input.rawInput);
  const category = input.categoryOverride ?? detection.category;
  const promptStyle = input.promptStyle ?? 'PROFESSIONAL';
  const variation = input.variation ?? 0;

  const generated = generatePromptDetailed({
    rawInput: input.rawInput,
    category,
    promptStyle,
    options: input.options,
    variation,
    attachments: input.attachments,
  });
  const toolDetails = recommendToolDetails(category, {
    rawInput: input.rawInput,
    style: promptStyle,
    templateKey: generated.templateKey,
  });

  return {
    generatedPrompt: generated.prompt,
    detectedCategory: category,
    categoryLabel: CATEGORY_LABELS[category],
    confidence: input.categoryOverride ? 1 : detection.confidence,
    alternativeCategories: detection.alternatives.filter((c) => c !== category),
    recommendedTools: toolDetails.map((t) => t.name),
    toolDetails,
    promptStyle,
    detectedLanguage: generated.detectedLanguage,
    variation,
    title: generated.title,
    templateKey: generated.templateKey,
  };
}
