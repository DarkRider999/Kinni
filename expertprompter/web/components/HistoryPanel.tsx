import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { SavedPrompt } from '@/lib/types';
import CategoryBadge from './CategoryBadge';
import { SpinnerIcon, StarIcon, TrashIcon } from './Icons';

interface HistoryPanelProps {
  /** Bump to force a reload (e.g. after a new prompt is saved). */
  refreshKey: number;
  onSelect: (prompt: SavedPrompt) => void;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function HistoryPanel({ refreshKey, onSelect }: HistoryPanelProps) {
  const [items, setItems] = useState<SavedPrompt[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async (opts: { append?: boolean; cursor?: string | null; q?: string } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listPrompts({ cursor: opts.cursor ?? undefined, limit: 10, q: opts.q || undefined });
      setItems((prev) => (opts.append ? [...prev, ...res.items] : res.items));
      setCursor(res.nextCursor);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load history');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload on new saves; debounce search typing.
  useEffect(() => {
    const t = setTimeout(() => void load({ q: query }), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, refreshKey, query]);

  const toggleFavorite = async (id: string) => {
    try {
      const updated = await api.toggleFavorite(id);
      setItems((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update favourite');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this prompt from your history?')) return;
    try {
      await api.deletePrompt(id);
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete prompt');
    }
  };

  return (
    <section className="card" aria-labelledby="history-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="history-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">History</h2>
        {loading && <SpinnerIcon className="text-slate-400" />}
      </div>
      <input
        type="search"
        className="input mb-3"
        placeholder="Search your prompts…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search history"
      />

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {query ? 'No prompts match your search.' : 'Your generated prompts will appear here.'}
        </p>
      )}

      <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {items.map((p) => (
          <li key={p.id} className="group rounded-xl border border-slate-200 p-3 transition hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-700">
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => onSelect(p)} className="min-w-0 flex-1 text-left">
                <span className="line-clamp-2 text-sm font-medium">{p.title || p.rawInput}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2">
                  <CategoryBadge category={p.detectedCategory} size="sm" />
                  <span className="text-xs text-slate-400">{timeAgo(p.createdAt)}</span>
                </span>
              </button>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className={`btn-ghost h-8 w-8 !p-0 ${p.isFavorite ? 'text-amber-500' : ''}`}
                  onClick={() => void toggleFavorite(p.id)}
                  aria-label={p.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <StarIcon filled={p.isFavorite} width={16} height={16} />
                </button>
                <button type="button" className="btn-ghost h-8 w-8 !p-0 hover:text-red-600" onClick={() => void remove(p.id)} aria-label="Delete prompt">
                  <TrashIcon width={16} height={16} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {cursor && (
        <button type="button" className="btn-ghost mt-2 w-full" onClick={() => void load({ append: true, cursor, q: query })} disabled={loading}>
          Load more
        </button>
      )}
    </section>
  );
}
