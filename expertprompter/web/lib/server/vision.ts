// Describes an uploaded photo with Claude so the generated prompt can
// reproduce it. The browser shrinks the photo to 1024px before sending, which
// keeps each request to roughly 1,500 input tokens.

import Anthropic from '@anthropic-ai/sdk';
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

export const visionConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** Default is the current flagship; VISION_MODEL lets the owner choose a cheaper model. */
const visionModel = () => process.env.VISION_MODEL || 'claude-opus-5';

let client: Anthropic | undefined;
function anthropic() {
  if (!visionConfigured()) throw serviceUnavailable('Photo descriptions are not set up yet.');
  return (client ??= new Anthropic());
}

export async function describeImage(base64: string, mediaType: SupportedMediaType): Promise<ImageDescription> {
  let response;
  try {
    response = await anthropic().beta.messages.parse({
      model: visionModel(),
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
            { type: 'text', text: 'Describe this image for recreating it with an AI image generator.' },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'Too many photo descriptions right now. Please try again in a minute.');
    if (err instanceof Anthropic.BadRequestError) throw new HttpError(422, 'This image could not be read. Try a JPEG or PNG.');
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
