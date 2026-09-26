// Reads attached files in the browser. Only extracted text (plus name and
// size) is sent to the API; the files themselves never leave the device.

export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_TEXT_CHARS = 40_000; // matches the API limit
const MAX_PDF_PAGES = 60;

export type AttachmentKind = 'text' | 'image' | 'other';

export interface ReadResult {
  kind: AttachmentKind;
  text?: string;
  /** Original text length when it was cut to MAX_TEXT_CHARS. */
  truncatedFrom?: number;
  /** A human note, e.g. "No readable text found (scanned PDF?)". */
  note?: string;
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'rtf', 'csv', 'tsv', 'json', 'xml', 'html', 'htm', 'css', 'yml', 'yaml', 'log', 'srt', 'vtt', 'ini', 'toml', 'env',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'java', 'kt', 'swift', 'rb', 'go', 'rs', 'php', 'cs', 'cpp', 'cc', 'c', 'h', 'hpp',
  'sql', 'sh', 'bash', 'zsh', 'ps1', 'r', 'dart', 'vue', 'svelte', 'scss', 'less', 'gradle', 'properties', 'tex',
]);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif', 'avif', 'tif', 'tiff']);

/** File types offered in the picker (anything else can still be dropped and is attached by name). */
export const ACCEPT = [
  '.pdf', '.docx', ...[...TEXT_EXTENSIONS].map((e) => `.${e}`), 'image/*', 'text/*', 'application/json',
].join(',');

export function extensionOf(name: string) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function finish(raw: string, kind: AttachmentKind = 'text'): ReadResult {
  const text = raw.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim();
  if (!text) return { kind, note: 'No readable text found in this file.' };
  if (text.length > MAX_TEXT_CHARS) return { kind, text: text.slice(0, MAX_TEXT_CHARS), truncatedFrom: text.length };
  return { kind, text };
}

async function readPdf(file: File): Promise<ReadResult> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const pages: string[] = [];
  const totalPages = doc.numPages;
  const count = Math.min(totalPages, MAX_PDF_PAGES);
  let length = 0;
  for (let n = 1; n <= count && length < MAX_TEXT_CHARS; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let line = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = '';
      } else if (item.str && !item.str.endsWith(' ')) {
        line += ' ';
      }
    }
    if (line.trim()) lines.push(line);
    const text = lines.map((l) => l.trimEnd()).join('\n');
    pages.push(text);
    length += text.length;
  }
  await task.destroy(); // frees the worker
  const result = finish(pages.join('\n\n'));
  if (!result.text) result.note = 'No selectable text found (scanned PDF?). It will be listed so you can attach it in your AI tool.';
  if (totalPages > count && result.text) result.note = `Read the first ${count} of ${totalPages} pages.`;
  return result;
}

async function readDocx(file: File): Promise<ReadResult> {
  const mammoth = await import('mammoth');
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return finish(value);
}

export async function readAttachment(file: File): Promise<ReadResult> {
  const ext = extensionOf(file.name);
  if (file.type.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) return { kind: 'image' };
  if (file.size > MAX_FILE_BYTES) {
    return { kind: 'other', note: 'Too large to read (over 15 MB). It will be listed so you can attach it in your AI tool.' };
  }
  if (ext === 'pdf' || file.type === 'application/pdf') return readPdf(file);
  if (ext === 'docx') return readDocx(file);
  if (TEXT_EXTENSIONS.has(ext) || file.type.startsWith('text/') || file.type === 'application/json') {
    return finish(await file.text());
  }
  return { kind: 'other', note: 'This file type can’t be read here. It will be listed so you can attach it in your AI tool.' };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Longest side sent for AI description: enough detail, ~1,500 input tokens. */
const ANALYSIS_MAX_SIDE = 1024;

export interface PreparedImage {
  width: number;
  height: number;
  /** JPEG, base64 without the data: prefix. */
  base64: string;
}

/**
 * Reads an image's size and makes a small JPEG copy for AI description.
 * Returns null when the browser can't decode the format (e.g. HEIC outside Safari).
 */
export async function prepareImage(file: File): Promise<PreparedImage | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const { width, height } = bitmap;
  const scale = Math.min(1, ANALYSIS_MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fff'; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { width, height, base64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}
