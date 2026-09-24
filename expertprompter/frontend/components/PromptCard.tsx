import { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon, DownloadIcon, RefreshIcon, SaveIcon, SpinnerIcon } from './Icons';

interface PromptCardProps {
  prompt: string;
  onRegenerate: () => void;
  regenerating: boolean;
  /** Shown only when a save is possible (logged in and not yet saved). */
  onSave?: () => Promise<void>;
  saved?: boolean;
}

export default function PromptCard({ prompt, onRegenerate, regenerating, onSave, saved }: PromptCardProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // Fallback for browsers/iframes without clipboard permissions.
      const ta = document.createElement('textarea');
      ta.value = prompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([prompt], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'expertprompter-prompt.txt' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const save = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave();
    } catch {
      window.alert('Could not save this prompt. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const [summary, ...rest] = prompt.split('\n---\n');

  return (
    <section className="card animate-fade-in" aria-labelledby="prompt-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="prompt-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Generated prompt</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary !py-1.5" onClick={onRegenerate} disabled={regenerating} title="Generate a variation">
            {regenerating ? <SpinnerIcon /> : <RefreshIcon />} Regenerate
          </button>
          <button type="button" className="btn-secondary !py-1.5" onClick={download} title="Download as .txt">
            <DownloadIcon /> <span className="sr-only sm:not-sr-only">.txt</span>
          </button>
          {onSave && (
            <button type="button" className="btn-secondary !py-1.5" onClick={save} disabled={saving || saved}>
              {saving ? <SpinnerIcon /> : saved ? <CheckIcon /> : <SaveIcon />} {saved ? 'Saved' : 'Save'}
            </button>
          )}
          <button type="button" className="btn-primary !py-1.5" onClick={copy} aria-live="polite">
            {copied ? <CheckIcon /> : <CopyIcon />} {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Summary paragraph: the quick-use version of the prompt. */}
      <p className="rounded-xl bg-brand-50 p-4 text-[15px] leading-relaxed text-slate-800 dark:bg-brand-900/20 dark:text-slate-100">
        {summary.trim()}
      </p>

      {rest.length > 0 && (
        <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-[13px] leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          {rest.join('\n---\n').trim()}
        </pre>
      )}
    </section>
  );
}
