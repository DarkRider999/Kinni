import { useRef, useState, type FormEvent } from 'react';
import type { PromptOptions, PromptStyle, SavedPrompt } from '@/lib/types';
import { STYLE_OPTIONS } from '@/lib/types';
import AdvancedOptionsPanel from './AdvancedOptionsPanel';
import FileUploadPanel, { type FilePicker, type UiAttachment } from './FileUploadPanel';
import { PlusIcon, SparklesIcon, SpinnerIcon } from './Icons';

export interface InputState {
  rawInput: string;
  promptStyle: PromptStyle;
  options: PromptOptions;
  attachments: UiAttachment[];
}

interface InputPanelProps {
  value: InputState;
  onChange: (next: InputState) => void;
  /** Functional updates, because file reads finish after later edits. */
  onAttachmentsChange: (update: (prev: UiAttachment[]) => UiAttachment[]) => void;
  onGenerate: () => void;
  loading: boolean;
  /** The signed-in user's last few requests, newest first. */
  recent?: SavedPrompt[];
  onPickRecent?: (prompt: SavedPrompt) => void;
}

const MAX_CHARS = 5000;

export default function InputPanel({ value, onChange, onAttachmentsChange, onGenerate, loading, recent = [], onPickRecent }: InputPanelProps) {
  const tooShort = value.rawInput.trim().length < 3;
  const reading = value.attachments.some((a) => a.status === 'reading');
  const describing = value.attachments.some((a) => a.status === 'describing');
  const busyFiles = reading || describing;
  const picker = useRef<FilePicker | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!tooShort && !loading && !busyFiles) onGenerate();
  };

  return (
    <form onSubmit={submit} className="card space-y-4" aria-label="Prompt input">
      <div>
        <label htmlFor="raw-input" className="label">Your idea or task</label>
        <div
          className={`relative rounded-xl ${dragOver ? 'ring-2 ring-brand-500' : ''}`}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            if (!loading) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            setDragOver(false);
            if (!loading) picker.current?.add(e.dataTransfer.files);
          }}
        >
        <textarea
          id="raw-input"
          rows={6}
          className="input resize-y pb-12 text-base leading-relaxed"
          placeholder="Type your idea or task… e.g. “Give me a prompt to recreate the attached photo”"
          value={value.rawInput}
          maxLength={MAX_CHARS}
          onChange={(e) => onChange({ ...value, rawInput: e.target.value })}
          onKeyDown={(e) => {
            // Ctrl/Cmd + Enter generates.
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
          }}
          disabled={loading}
        />
          {/* Attach photos, PDFs, documents or code; files can also be dropped on the box. */}
          <button
            type="button"
            onClick={() => picker.current?.open()}
            disabled={loading}
            className="absolute bottom-3 left-3 inline-flex h-8 items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-brand-500 hover:text-brand-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-brand-300"
            aria-label="Attach a photo or file"
            title="Attach a photo or file"
          >
            <PlusIcon width={16} height={16} /> Photo or file
          </button>
        </div>
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          <span>Tip: press Ctrl/⌘ + Enter to generate</span>
          <span>{value.rawInput.length}/{MAX_CHARS}</span>
        </div>
      </div>

      <FileUploadPanel value={value.attachments} onChange={onAttachmentsChange} disabled={loading} pickerRef={picker} />

      {recent.length > 0 && (
        <div>
          <p className="label">Recent prompts</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((p) => (
              <button
                key={p.id}
                type="button"
                className="max-w-full truncate rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                onClick={() => onPickRecent?.(p)}
                disabled={loading}
                title={p.rawInput}
              >
                {p.rawInput}
              </button>
            ))}
          </div>
        </div>
      )}

      <fieldset>
        <legend className="label">Prompt style</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STYLE_OPTIONS.map((s) => {
            const active = value.promptStyle === s.value;
            return (
              <label
                key={s.value}
                className={`cursor-pointer rounded-xl border px-3 py-2 text-sm transition ${
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-500 dark:bg-brand-900/30 dark:text-brand-100'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="promptStyle"
                  value={s.value}
                  checked={active}
                  onChange={() => onChange({ ...value, promptStyle: s.value })}
                  className="sr-only"
                  disabled={loading}
                />
                <span className="block font-medium">{s.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{s.hint}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <AdvancedOptionsPanel value={value.options} onChange={(options) => onChange({ ...value, options })} disabled={loading} />

      <button type="submit" className="btn-primary w-full py-3 text-base" disabled={tooShort || loading || busyFiles}>
        {loading || busyFiles ? <SpinnerIcon /> : <SparklesIcon />}
        {loading ? 'Generating…' : describing ? 'Describing photos…' : reading ? 'Reading files…' : 'Generate expert prompt'}
      </button>
    </form>
  );
}
