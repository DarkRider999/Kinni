import { useId, useState } from 'react';
import type { PromptOptions } from '@/lib/types';
import { ChevronIcon } from './Icons';

interface AdvancedOptionsPanelProps {
  value: PromptOptions;
  onChange: (next: PromptOptions) => void;
  disabled?: boolean;
}

const TONES = ['Polite', 'Friendly', 'Formal', 'Confident', 'Persuasive', 'Humorous', 'Empathetic', 'Inspirational', 'Neutral'];
const LENGTHS = [
  { value: '', label: 'Auto' },
  { value: 'short', label: 'Short (~200 words)' },
  { value: 'medium', label: 'Medium (~500 words)' },
  { value: 'long', label: 'Long (~1,200 words)' },
  { value: 'detailed', label: 'Detailed (1,500+ words)' },
];
const FORMATS = ['Formal letter', 'Email', 'Bullet points', 'Markdown with headings', 'Table', 'Step-by-step guide', 'JSON', 'Slide outline', 'Essay', 'Code with comments', 'Square image', 'Portrait 9:16', 'Landscape 16:9'];
const LANGUAGES = ['', 'English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Hindi', 'Arabic', 'Chinese', 'Japanese', 'Tamil', 'Malayalam'];

export default function AdvancedOptionsPanel({ value, onChange, disabled }: AdvancedOptionsPanelProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const set = (key: keyof PromptOptions) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...value, [key]: e.target.value });
  const activeCount = Object.values(value).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200"
      >
        <span>
          Advanced options
          {activeCount > 0 && (
            <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">{activeCount} set</span>
          )}
        </span>
        <ChevronIcon className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div id={`${id}-panel`} className="grid animate-fade-in gap-4 border-t border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-800">
          <div>
            <label className="label" htmlFor={`${id}-tone`}>Tone</label>
            <input id={`${id}-tone`} className="input" list={`${id}-tones`} placeholder="e.g. polite, confident" value={value.tone ?? ''} onChange={set('tone')} disabled={disabled} maxLength={80} />
            <datalist id={`${id}-tones`}>{TONES.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div>
            <label className="label" htmlFor={`${id}-length`}>Length</label>
            <select id={`${id}-length`} className="input" value={value.length ?? ''} onChange={set('length')} disabled={disabled}>
              {LENGTHS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`${id}-format`}>Format</label>
            <input id={`${id}-format`} className="input" list={`${id}-formats`} placeholder="e.g. formal letter, table" value={value.format ?? ''} onChange={set('format')} disabled={disabled} maxLength={120} />
            <datalist id={`${id}-formats`}>{FORMATS.map((f) => <option key={f} value={f} />)}</datalist>
          </div>
          <div>
            <label className="label" htmlFor={`${id}-audience`}>Audience</label>
            <input id={`${id}-audience`} className="input" placeholder="e.g. investors, beginners, kids" value={value.audience ?? ''} onChange={set('audience')} disabled={disabled} maxLength={120} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor={`${id}-language`}>Output language</label>
            <select id={`${id}-language`} className="input" value={value.language ?? ''} onChange={set('language')} disabled={disabled}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l || 'Auto-detect from input'}</option>)}
            </select>
          </div>
          {activeCount > 0 && (
            <button type="button" className="btn-ghost justify-self-start !px-2 text-xs sm:col-span-2" onClick={() => onChange({})} disabled={disabled}>
              Reset options
            </button>
          )}
        </div>
      )}
    </div>
  );
}
