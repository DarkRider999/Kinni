// Describes an uploaded photo with an AI model so the generated prompt can
// reproduce it. The browser shrinks the photo to 1024px before sending.
//
// Providers (first match wins, or force one with VISION_PROVIDER):
//   gemini    - GEMINI_API_KEY. Google AI Studio has a free tier (rate-limited;
//               Google may use free-tier data to improve its products).
//   anthropic - ANTHROPIC_API_KEY. Pay-as-you-go Claude API.

import Anthropic from '@anthropic-ai/sdk';
import { ApiError as GeminiApiError, GoogleGenAI } from '@google/genai';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { HttpError, serviceUnavailable } from './httpError';

/** What Claude returns for a photo. Every field is plain text so it can go straight into a prompt. */
export const ImageDescriptionSchema = z.object({
  subject: z.string().describe('The main subject, e.g. "a smiling woman in her 30s holding a coffee cup"'),
  details: z.string().describe('Appearance: clothing, hair, pose, expression, materials, notable objects'),
  setting: z.string().describe('Location and background'),
  composition: z.string().describe('Framing, shot type, subject placement, perspective'),
  camera: z.string().describe('Likely camera angle, lens and focal length, depth of field'),
  lighting: z.string().describe('Light source, direction, quality, time of day'),
  colors: z.array(z.string()).describe('3 to 6 dominant colours as short names, e.g. "warm beige"'),
  style: z.string().describe('Medium and visual style, e.g. "candid lifestyle photography, film look"'),
  mood: z.string().describe('The emotional tone'),
  text: z.string().describe('Any readable text in the image, or an empty string'),
  prompt: z.string().describe('One detailed image-generation prompt (60-120 words) that would recreate this image as closely as possible'),
});
export type ImageDescription = z.infer<typeof ImageDescriptionSchema>;

export const SUPPORTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

const SYSTEM = `You describe photos so an image generator (Midjourney, DALL·E, Stable Diffusion) can recreate them.
Describe only what is visible. Be concrete and specific: name colours, materials, lighting direction, lens feel and composition.
Do not guess anyone's identity or name real people, and do not infer sensitive traits (ethnicity, religion, health). Describe people by visible appearance only.
The "prompt" field is a single paragraph written as an image-generation prompt, not as a description of a photo ("a photo of…" is fine; "this image shows…" is not).`;

const USER_TEXT = 'Describe this image for recreating it with an AI image generator.';

export type VisionProvider = 'gemini' | 'anthropic';

export function visionProvider(): VisionProvider | null {
  const forced = process.env.VISION_PROVIDER?.toLowerCase();
  if (forced === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
  if (forced === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

export const visionConfigured = () => visionProvider() !== null;

export async function describeImage(base64: string, mediaType: SupportedMediaType): Promise<ImageDescription> {
  const provider = visionProvider();
  if (provider === 'gemini') return describeWithGemini(base64, mediaType);
  if (provider === 'anthropic') return describeWithClaude(base64, mediaType);
  throw serviceUnavailable('Photo descriptions are not set up yet.');
}

// ------------------------------------------------------------------ Gemini

let gemini: GoogleGenAI | undefined;

// Gemini accepts JSON Schema; the $schema marker is not in its supported subset.
const { $schema: _unused, ...GEMINI_SCHEMA } = z.toJSONSchema(ImageDescriptionSchema) as Record<string, unknown>;

async function describeWithGemini(base64: string, mediaType: SupportedMediaType): Promise<ImageDescription> {
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let text: string | undefined;
  try {
    const response = await gemini.models.generateContent({
      // The alias follows Google's current Flash model, which has a free tier.
      model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mediaType, data: base64 } }, { text: USER_TEXT }] }],
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: 'application/json',
        responseJsonSchema: GEMINI_SCHEMA,
      },
    });
    if (response.promptFeedback?.blockReason) {
      throw new HttpError(422, 'This photo can’t be described. It will be listed so you can attach it in your AI tool.');
    }
    text = response.text;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof GeminiApiError) {
      if (err.status === 429) throw new HttpError(429, 'The free photo-description limit was reached. Please try again later.');
      console.error(`Gemini API error ${err.status}:`, err.message);
      throw serviceUnavailable('Photo descriptions are temporarily unavailable.');
    }
    throw err;
  }

  const parsed = (() => {
    try {
      return ImageDescriptionSchema.safeParse(JSON.parse(text ?? ''));
    } catch {
      return null;
    }
  })();
  if (!parsed?.success) {
    console.error('Gemini response did not match the schema:', (text ?? '').slice(0, 300));
    throw serviceUnavailable('Could not describe this photo. Please try again.');
  }
  return parsed.data;
}

// ------------------------------------------------------------------ Claude

let client: Anthropic | undefined;

async function describeWithClaude(base64: string, mediaType: SupportedMediaType): Promise<ImageDescription> {
  client ??= new Anthropic();
  let response;
  try {
    response = await client.beta.messages.parse({
      // Default is the current flagship; VISION_MODEL lets the owner choose a cheaper model.
      model: process.env.VISION_MODEL || 'claude-opus-5',
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: 'low', format: betaZodOutputFormat(ImageDescriptionSchema) },
      // If a safety classifier declines, retry on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: USER_TEXT },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'Too many photo descriptions right now. Please try again in a minute.');
    // A 400 can mean a bad image, or an account problem such as an empty credit balance.
    // Only blame the image when the API says so; otherwise log the real reason for the owner.
    if (err instanceof Anthropic.BadRequestError && /image/i.test(err.message) && !/credit|billing|balance/i.test(err.message)) {
      throw new HttpError(422, 'This image could not be read. Try a JPEG or PNG.');
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('Anthropic API key rejected');
      throw serviceUnavailable('Photo descriptions are temporarily unavailable.');
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${err.status}:`, err.message);
      throw serviceUnavailable('Photo descriptions are temporarily unavailable.');
    }
    throw err;
  }

  if (response.stop_reason === 'refusal') {
    throw new HttpError(422, 'This photo can’t be described. It will be listed so you can attach it in your AI tool.');
  }
  if (!response.parsed_output) {
    console.error('Vision response did not match the schema; stop_reason:', response.stop_reason);
    throw serviceUnavailable('Could not describe this photo. Please try again.');
  }
  return response.parsed_output;
}
