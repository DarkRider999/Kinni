// Turns attached files into prompt sections.
//
//   Source files    -> "## Source Material": the text itself, fenced, so the AI
//                      works from the user's actual document or code.
//   Reference files -> "## Reference Files": short excerpts to match style and
//                      tone (never to copy), and images to attach alongside.
//
// Long files are trimmed so the prompt stays usable in any AI tool; the prompt
// then tells the user to attach the full file.

import type { Attachment } from '../types';
import type { PromptMode } from './promptTemplates';

export const SOURCE_CHARS_PER_FILE = 12_000;
export const SOURCE_CHARS_TOTAL = 30_000;
export const REFERENCE_CHARS_PER_FILE = 2_000;

const KIND_LABEL: Record<Attachment['kind'], string> = { text: 'document', image: 'image', other: 'file' };

function formatCount(n: number) {
  return n.toLocaleString('en-US');
}

/** A fence longer than any backtick run inside the text, so file content can't close it early. */
function fenceFor(text: string) {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  return '`'.repeat(Math.max(3, longest + 1));
}

function languageHint(name: string) {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx', py: 'python', java: 'java', kt: 'kotlin', swift: 'swift',
    rb: 'ruby', go: 'go', rs: 'rust', php: 'php', cs: 'csharp', cpp: 'cpp', c: 'c', h: 'c', sql: 'sql', sh: 'bash',
    html: 'html', css: 'css', json: 'json', yml: 'yaml', yaml: 'yaml', xml: 'xml', md: 'markdown', csv: 'csv',
  };
  return map[ext] ?? '';
}

function clip(text: string, limit: number) {
  const clean = text.replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  return clean.length > limit ? { text: clean.slice(0, limit).trimEnd(), truncated: clean.length } : { text: clean, truncated: 0 };
}

export function hasAttachments(attachments?: Attachment[]) {
  return Boolean(attachments && attachments.length);
}

/** One sentence for the summary paragraph, e.g. "Base your work on the attached source material (report.pdf)." */
export function attachmentSummary(attachments: Attachment[] = []): string[] {
  const sources = attachments.filter((a) => a.role === 'source').map((a) => a.name);
  const refs = attachments.filter((a) => a.role === 'reference').map((a) => a.name);
  const out: string[] = [];
  if (sources.length) out.push(`Base your work on the attached source material (${sources.join(', ')}).`);
  if (refs.length) out.push(`Use the reference files (${refs.join(', ')}) as a guide for style and tone, without copying them.`);
  return out;
}

export function attachmentSections(attachments: Attachment[] = [], mode: PromptMode): string[] {
  const sources = attachments.filter((a) => a.role === 'source');
  const refs = attachments.filter((a) => a.role === 'reference');
  const out: string[] = [];

  if (sources.length) {
    out.push('## Source Material');
    out.push(
      mode === 'text'
        ? 'The following file content is the primary input for this task. Work from it directly; quote or cite it where useful.'
        : 'Use the following file(s) as the basis for this piece.',
      '',
    );
    let budget = SOURCE_CHARS_TOTAL;
    for (const file of sources) {
      out.push(`### ${file.name}`);
      if (file.kind === 'text' && file.text?.trim()) {
        const { text, truncated } = clip(file.text, Math.max(0, Math.min(SOURCE_CHARS_PER_FILE, budget)));
        budget -= text.length;
        if (text) {
          const fence = fenceFor(text);
          out.push(`${fence}${languageHint(file.name)}`, text, fence);
        }
        if (truncated) {
          out.push(`_[Trimmed: showing the first ${formatCount(text.length)} of ${formatCount(truncated)} characters. Attach the full file too if your AI tool accepts uploads.]_`);
        }
      } else if (file.kind === 'image') {
        const use =
          mode === 'image' ? 'Attach this image and use it as the base image to edit or build on.'
          : mode === 'video' ? 'Attach this image and use it as the first frame (image-to-video).'
          : 'Attach this image when you paste the prompt; it is the subject of the task.';
        out.push(`(${KIND_LABEL.image}) ${use}`);
      } else {
        out.push(`(${KIND_LABEL[file.kind]}) Attach this file when you paste the prompt; its contents are the subject of the task.`);
      }
      out.push('');
    }
  }

  if (refs.length) {
    out.push('## Reference Files');
    out.push('Use these only as references for style, tone, structure or visual direction. Do not copy their content.', '');
    for (const file of refs) {
      if (file.kind === 'text' && file.text?.trim()) {
        const { text, truncated } = clip(file.text, REFERENCE_CHARS_PER_FILE);
        out.push(`- **${file.name}** (${KIND_LABEL.text}${truncated ? ', excerpt' : ''}):`);
        out.push(...text.split('\n').map((line) => `  > ${line}`));
      } else if (file.kind === 'image') {
        out.push(`- **${file.name}** (${KIND_LABEL.image}): attach it alongside this prompt as a visual reference.`);
      } else {
        out.push(`- **${file.name}** (${KIND_LABEL[file.kind]}): attach it alongside this prompt.`);
      }
    }
    out.push('');
  }

  return out;
}

/** Extra tool settings for image/video prompts that have reference or base images. */
export function mediaReferenceParameters(attachments: Attachment[] = [], mode: PromptMode): string[] {
  const images = attachments.filter((a) => a.kind === 'image');
  if (!images.length || (mode !== 'image' && mode !== 'video')) return [];
  const names = images.map((a) => a.name).join(', ');
  if (mode === 'image') {
    return [
      `- Reference images: ${names}`,
      '- Midjourney: upload the image, then add `--sref <image URL>` for its style or put the image URL first for its content.',
      '- ChatGPT / DALL·E: attach the image with this prompt and say which parts to keep.',
    ];
  }
  return [
    `- Reference images: ${names}`,
    '- Runway / Pika / Sora: start from the image (image-to-video) or add it as a style reference.',
  ];
}
