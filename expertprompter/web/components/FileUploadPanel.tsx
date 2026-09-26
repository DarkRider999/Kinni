import { useId, useRef, useState, type DragEvent } from 'react';
import { ACCEPT, formatBytes, readAttachment, type AttachmentKind } from '@/lib/fileText';
import { FileIcon, ImageIcon, PaperclipIcon, SpinnerIcon, XIcon } from './Icons';

export type AttachmentRole = 'source' | 'reference';

export interface UiAttachment {
  id: string;
  name: string;
  size: number;
  role: AttachmentRole;
  status: 'reading' | 'ready';
  kind: AttachmentKind;
  text?: string;
  truncatedFrom?: number;
  note?: string;
}

export const MAX_SOURCE_FILES = 3;
export const MAX_REFERENCE_FILES = 5;

interface FileUploadPanelProps {
  value: UiAttachment[];
  onChange: (update: (prev: UiAttachment[]) => UiAttachment[]) => void;
  disabled?: boolean;
}

const ZONES: Array<{ role: AttachmentRole; title: string; hint: string; max: number }> = [
  { role: 'source', title: 'Upload file', hint: 'The document or code to work on (PDF, Word, text, code, images)', max: MAX_SOURCE_FILES },
  { role: 'reference', title: 'Reference files', hint: 'Examples of the style, tone or look you want', max: MAX_REFERENCE_FILES },
];

function statusLine(a: UiAttachment) {
  if (a.status === 'reading') return 'Reading…';
  if (a.kind === 'image') return `${formatBytes(a.size)} · image · attach in your AI tool`;
  if (a.note && !a.text) return a.note;
  const chars = a.text?.length ?? 0;
  const base = `${formatBytes(a.size)} · ${chars.toLocaleString()} characters read`;
  if (a.truncatedFrom) return `${base} (of ${a.truncatedFrom.toLocaleString()})`;
  return a.note ? `${base} · ${a.note}` : base;
}

export default function FileUploadPanel({ value, onChange, disabled }: FileUploadPanelProps) {
  const id = useId();
  const inputs = useRef<Record<AttachmentRole, HTMLInputElement | null>>({ source: null, reference: null });
  const [dragOver, setDragOver] = useState<AttachmentRole | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        .then((result) => onChange((prev) => prev.map((a) => (a.id === entry.id ? { ...a, ...result, status: 'ready' } : a))))
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
                        {a.status === 'reading' ? <SpinnerIcon className="shrink-0 text-slate-400" width={16} height={16} /> : <Icon className="shrink-0 text-slate-400" width={16} height={16} />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{a.name}</span>
                          <span className={`block truncate text-xs ${a.note && !a.text && a.kind !== 'image' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {statusLine(a)}
                          </span>
                        </span>
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
      {message && <p className="text-xs text-amber-600 dark:text-amber-400">{message}</p>}
    </div>
  );
}
