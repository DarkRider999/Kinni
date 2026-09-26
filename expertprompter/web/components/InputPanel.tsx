import { type FormEvent } from 'react';
import type { PromptOptions, PromptStyle } from '@/lib/types';
import { STYLE_OPTIONS } from '@/lib/types';
import AdvancedOptionsPanel from './AdvancedOptionsPanel';
import FileUploadPanel, { type UiAttachment } from './FileUploadPanel';
import { SparklesIcon, SpinnerIcon } from './Icons';

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
}

const MAX_CHARS = 5000;
const EXAMPLES = [
  'Create a business plan for a cloud kitchen in Dubai.',
  'Write a resignation letter for a logistics coordinator.',
  'YouTube video script about 5 AI tools for students',
  'Logo for a coffee shop called Bean There',
  'Fix a TypeError in my Python function',
  'Amazon KDP ebook about gardening for beginners',
];

export default function InputPanel({ value, onChange, onAttachmentsChange, onGenerate, loading }: InputPanelProps) {
  const tooShort = value.rawInput.trim().length < 3;
  const reading = value.attachments.some((a) => a.status === 'reading');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!tooShort && !loading && !reading) onGenerate();
  };

  return (
    <form onSubmit={submit} className="card space-y-4" aria-label="Prompt input">
      <div>
        <label htmlFor="raw-input" className="label">Your idea or task</label>
        <textarea
          id="raw-input"
          rows={6}
          className="input resize-y text-base leading-relaxed"
          placeholder="Type your idea or task… e.g. “Summarise the attached report for my manager”"
          value={value.rawInput}
          maxLength={MAX_CHARS}
          onChange={(e) => onChange({ ...value, rawInput: e.target.value })}
          onKeyDown={(e) => {
            // Ctrl/Cmd + Enter generates.
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
          }}
          disabled={loading}
        />
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          <span>Tip: press Ctrl/⌘ + Enter to generate</span>
          <span>{value.rawInput.length}/{MAX_CHARS}</span>
        </div>
      </div>

      <FileUploadPanel value={value.attachments} onChange={onAttachmentsChange} disabled={loading} />

      <div className="flex flex-wrap gap-2" aria-label="Examples">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
            onClick={() => onChange({ ...value, rawInput: ex })}
            disabled={loading}
          >
            {ex}
          </button>
        ))}
      </div>

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

      <button type="submit" className="btn-primary w-full py-3 text-base" disabled={tooShort || loading || reading}>
        {loading || reading ? <SpinnerIcon /> : <SparklesIcon />}
        {loading ? 'Generating…' : reading ? 'Reading files…' : 'Generate expert prompt'}
      </button>
    </form>
  );
}
