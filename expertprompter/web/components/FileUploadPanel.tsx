import { useId, useRef, useState, type DragEvent } from 'react';
import { ACCEPT, formatBytes, prepareImage, readAttachment, type AttachmentKind } from '@/lib/fileText';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { PhotoDescription } from '@/lib/types';
import { buildLocalDescription, type PixelStats } from '@/lib/imageStats';
import { MODEL_DOWNLOAD_MB, describeOnDevice, giveConsent, hasConsent, isModelCached, photoAiSupported } from '@/lib/photoAi';
import { FileIcon, ImageIcon, PaperclipIcon, SpinnerIcon, XIcon } from './Icons';

export type AttachmentRole = 'source' | 'reference';

export interface UiAttachment {
  id: string;
  name: string;
  size: number;
  role: AttachmentRole;
  /** reading: extracting text; describing: waiting for the AI photo description. */
  status: 'reading' | 'describing' | 'ready';
  kind: AttachmentKind;
  text?: string;
  truncatedFrom?: number;
  note?: string;
  width?: number;
  height?: number;
  description?: PhotoDescription;
  /** On-device AI: offer a one-time download before using it. */
  aiOffer?: boolean;
  /** Model download progress 0..1 while status is 'describing'. */
  aiProgress?: number;
  /** Kept so the on-device AI can run after the user opts in. */
  imageBlob?: Blob;
  pixelStats?: PixelStats;
}

export const MAX_SOURCE_FILES = 3;
export const MAX_REFERENCE_FILES = 5;

interface FileUploadPanelProps {
  value: UiAttachment[];
  onChange: (update: (prev: UiAttachment[]) => UiAttachment[]) => void;
  disabled?: boolean;
  /** Lets a parent (the "+" button) open a file picker. */
  pickerRef?: { current: ((role: AttachmentRole) => void) | null };
}

const ZONES: Array<{ role: AttachmentRole; title: string; hint: string; max: number }> = [
  { role: 'source', title: 'Upload file', hint: 'The document or code to work on (PDF, Word, text, code, images)', max: MAX_SOURCE_FILES },
  { role: 'reference', title: 'Reference files', hint: 'Examples of the style, tone or look you want', max: MAX_REFERENCE_FILES },
];

function statusLine(a: UiAttachment) {
  if (a.status === 'reading') return 'Reading…';
  if (a.status === 'describing') {
    if (a.aiProgress !== undefined && a.aiProgress < 1) return `${Math.round(a.aiProgress * 100)}% · downloading photo AI (one time)`;
    return 'Describing photo with AI…';
  }
  if (a.kind === 'image' && a.description?.prompt) return `Described by AI: ${a.description.subject}`;
  if (a.kind === 'image' && a.description) return a.note ?? `Colours and light measured: ${a.description.colors.slice(0, 3).join(', ')}`;
  if (a.kind === 'image') return a.note ?? `${formatBytes(a.size)} · image · attach in your AI tool`;
  if (a.note && !a.text) return a.note;
  const chars = a.text?.length ?? 0;
  const base = `${formatBytes(a.size)} · ${chars.toLocaleString()} characters read`;
  if (a.truncatedFrom) return `${base} (of ${a.truncatedFrom.toLocaleString()})`;
  return a.note ? `${base} · ${a.note}` : base;
}

export default function FileUploadPanel({ value, onChange, disabled, pickerRef }: FileUploadPanelProps) {
  const { providers, user } = useAuth();
  // Server AI (Gemini/Claude key set) needs a signed-in user when accounts are on;
  // otherwise photos are described by the free on-device AI.
  const useServer = Boolean(providers?.visionEnabled && (!providers.accountsEnabled || user));
  const id = useId();
  const inputs = useRef<Record<AttachmentRole, HTMLInputElement | null>>({ source: null, reference: null });
  const [dragOver, setDragOver] = useState<AttachmentRole | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (pickerRef) pickerRef.current = (role) => inputs.current[role]?.click();

  const update = (id: string, patch: Partial<UiAttachment>) => onChange((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  /** Runs the free on-device AI for one photo (after the user has opted in). */
  const runOnDevice = async (a: Pick<UiAttachment, 'id' | 'imageBlob' | 'pixelStats' | 'width' | 'height'>) => {
    if (!a.imageBlob || !a.pixelStats || !a.width || !a.height) return;
    update(a.id, { status: 'describing', aiOffer: false, aiProgress: undefined, note: undefined });
    try {
      const caption = await describeOnDevice(a.imageBlob, (fraction) => update(a.id, { aiProgress: fraction }));
      update(a.id, {
        status: 'ready',
        aiProgress: undefined,
        description: buildLocalDescription(a.width, a.height, a.pixelStats, caption),
      });
    } catch {
      update(a.id, { status: 'ready', aiProgress: undefined, note: 'The on-device AI couldn’t run here; colours and light were measured instead.' });
    }
  };

  const enableOnDeviceAi = () => {
    giveConsent();
    for (const a of value) if (a.aiOffer) void runOnDevice(a);
  };

  const describe = async (id: string, file: File) => {
    const image = await prepareImage(file);
    if (!image) {
      update(id, { status: 'ready', note: 'This image format can’t be read here. Attach it in your AI tool.' });
      return;
    }
    // Always available, no AI: aspect ratio, colour palette and lighting.
    const measured = buildLocalDescription(image.width, image.height, image.stats);
    const base = { width: image.width, height: image.height, description: measured, imageBlob: image.blob, pixelStats: image.stats };

    if (useServer) {
      update(id, { ...base, status: 'describing' });
      try {
        const { description } = await api.analyzeImage(image.base64, 'image/jpeg');
        update(id, { status: 'ready', description, note: undefined });
      } catch (e) {
        update(id, { status: 'ready', note: e instanceof ApiError ? e.message : 'Could not describe this photo; colours and light were measured instead.' });
      }
      return;
    }

    if (!photoAiSupported()) {
      update(id, { ...base, status: 'ready' });
      return;
    }
    if (hasConsent() || (await isModelCached())) {
      update(id, base);
      await runOnDevice({ id, ...base });
    } else {
      update(id, { ...base, status: 'ready', aiOffer: true });
    }
  };

  const add = (role: AttachmentRole, files: FileList | File[]) => {
    const zone = ZONES.find((z) => z.role === role)!;
    const current = value.filter((a) => a.role === role).length;
    const list = [...files];
    const accepted = list.slice(0, Math.max(0, zone.max - current));
    setMessage(accepted.length < list.length ? `You can attach up to ${zone.max} ${zone.title.toLowerCase()}.` : null);

    for (const file of accepted) {
      const entry: UiAttachment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        role,
        status: 'reading',
        kind: 'other',
      };
      onChange((prev) => [...prev, entry]);
      readAttachment(file)
        .then((result) => {
          if (result.kind === 'image') {
            update(entry.id, { kind: 'image' });
            return describe(entry.id, file);
          }
          update(entry.id, { ...result, status: 'ready' });
        })
        .catch(() =>
          onChange((prev) =>
            prev.map((a) => (a.id === entry.id ? { ...a, status: 'ready', kind: 'other', note: 'Could not read this file. It will be listed so you can attach it in your AI tool.' } : a)),
          ),
        );
    }
  };

  const onDrop = (role: AttachmentRole) => (e: DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    if (!disabled && e.dataTransfer.files.length) add(role, e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        {ZONES.map((zone) => {
          const files = value.filter((a) => a.role === zone.role);
          const full = files.length >= zone.max;
          return (
            <div key={zone.role}>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!disabled && !full) setDragOver(zone.role);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={onDrop(zone.role)}
                className={`rounded-xl border border-dashed p-3 transition ${
                  dragOver === zone.role
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                    : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-2 text-left disabled:opacity-50"
                  onClick={() => inputs.current[zone.role]?.click()}
                  disabled={disabled || full}
                  aria-describedby={`${id}-${zone.role}-hint`}
                >
                  <PaperclipIcon className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" />
                  <span>
                    <span className="block text-sm font-medium">{zone.title}</span>
                    <span id={`${id}-${zone.role}-hint`} className="block text-xs text-slate-500 dark:text-slate-400">
                      {full ? `Maximum ${zone.max} files` : `${zone.hint}. Tap or drop files here.`}
                    </span>
                  </span>
                </button>
                <input
                  ref={(el) => {
                    inputs.current[zone.role] = el;
                  }}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="sr-only"
                  tabIndex={-1}
                  aria-label={zone.title}
                  onChange={(e) => {
                    if (e.target.files?.length) add(zone.role, e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>

              {files.length > 0 && (
                <ul className="mt-2 space-y-1.5" aria-label={`${zone.title} list`}>
                  {files.map((a) => {
                    const Icon = a.kind === 'image' ? ImageIcon : FileIcon;
                    return (
                      <li key={a.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/60">
                        {a.status !== 'ready' ? <SpinnerIcon className="shrink-0 text-slate-400" width={16} height={16} /> : <Icon className="shrink-0 text-slate-400" width={16} height={16} />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{a.name}</span>
                          <span className={`block truncate text-xs ${a.note && !a.text && !a.description ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {statusLine(a)}
                          </span>
                        </span>
                        {a.aiOffer && (
                          <button
                            type="button"
                            className="btn-secondary shrink-0 !px-2 !py-1 text-xs"
                            onClick={enableOnDeviceAi}
                            disabled={disabled}
                            title={`Free and private: the AI runs on your device. One-time ${MODEL_DOWNLOAD_MB} MB download, then it's cached.`}
                          >
                            Describe with AI
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-ghost h-7 w-7 shrink-0 !p-0"
                          onClick={() => onChange((prev) => prev.filter((x) => x.id !== a.id))}
                          aria-label={`Remove ${a.name}`}
                          disabled={disabled}
                        >
                          <XIcon width={14} height={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {value.some((a) => a.aiOffer) && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-slate-600 dark:bg-brand-900/20 dark:text-slate-300">
          <strong>Describe with AI</strong> runs free and privately on your device: your photo never leaves it. The first time it downloads a {MODEL_DOWNLOAD_MB} MB model (use Wi-Fi); after that it&apos;s instant to start. Colours, light and shape are already measured.
        </p>
      )}
      {message && <p className="text-xs text-amber-600 dark:text-amber-400">{message}</p>}
    </div>
  );
}
