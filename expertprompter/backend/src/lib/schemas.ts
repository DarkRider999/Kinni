import { z } from 'zod';
import { CATEGORIES, PROMPT_STYLES } from '../types';

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const PromptOptionsSchema = z
  .object({
    tone: optionalText(80),
    length: optionalText(40),
    format: optionalText(120),
    audience: optionalText(120),
    language: optionalText(40),
  })
  .prefault({});

// Accept "professional", "Professional" or "PROFESSIONAL".
const StyleSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.enum(PROMPT_STYLES));

export const GenerateSchema = z.object({
  rawInput: z.string().trim().min(3, 'Please describe your task (at least 3 characters)').max(5000),
  promptStyle: StyleSchema.optional(),
  options: PromptOptionsSchema,
  variation: z.number().int().min(0).max(10_000).optional(),
  category: z.string().transform((s) => s.trim().toUpperCase().replace(/\s+/g, '_')).pipe(z.enum(CATEGORIES)).optional(),
  /** Logged-in users auto-save by default; pass false to skip. */
  save: z.boolean().optional(),
});
export type GenerateBody = z.infer<typeof GenerateSchema>;

export const SavePromptSchema = z.object({
  rawInput: z.string().trim().min(1).max(5000),
  generatedPrompt: z.string().trim().min(1).max(50_000),
  detectedCategory: z.enum(CATEGORIES),
  promptStyle: StyleSchema.default('PROFESSIONAL'),
  recommendedTools: z.array(z.string().max(80)).max(20).default([]),
  options: PromptOptionsSchema,
  title: z.string().trim().max(160).optional(),
});
export type SavePromptBody = z.infer<typeof SavePromptSchema>;

export const CredentialsSchema = z.object({
  email: z.email('Enter a valid email').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  category: z.enum(CATEGORIES).optional(),
  q: z.string().trim().max(200).optional(),
});
