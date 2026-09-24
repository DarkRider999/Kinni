import type { Category } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';

const COLORS: Record<Category, string> = {
  WRITING: 'bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-800',
  BUSINESS: 'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-800',
  CODING: 'bg-slate-200 text-slate-800 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700',
  IMAGE: 'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200 dark:bg-fuchsia-900/40 dark:text-fuchsia-200 dark:ring-fuchsia-800',
  VIDEO: 'bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:ring-rose-800',
  MUSIC: 'bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-900/40 dark:text-violet-200 dark:ring-violet-800',
  MARKETING: 'bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-900/40 dark:text-orange-200 dark:ring-orange-800',
  EDUCATION: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-800',
  DATA_ANALYSIS: 'bg-cyan-100 text-cyan-800 ring-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-200 dark:ring-cyan-800',
  RESEARCH: 'bg-teal-100 text-teal-800 ring-teal-200 dark:bg-teal-900/40 dark:text-teal-200 dark:ring-teal-800',
  GENERAL_WRITING: 'bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:ring-indigo-800',
};

const EMOJI: Record<Category, string> = {
  WRITING: '✍️', BUSINESS: '📈', CODING: '💻', IMAGE: '🎨', VIDEO: '🎬', MUSIC: '🎵',
  MARKETING: '📣', EDUCATION: '🎓', DATA_ANALYSIS: '📊', RESEARCH: '🔎', GENERAL_WRITING: '📝',
};

interface CategoryBadgeProps {
  category: Category;
  confidence?: number;
  size?: 'sm' | 'md';
}

export default function CategoryBadge({ category, confidence, size = 'md' }: CategoryBadgeProps) {
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${pad} ${COLORS[category]}`}>
      <span aria-hidden>{EMOJI[category]}</span>
      {CATEGORY_LABELS[category]}
      {confidence !== undefined && (
        <span className="opacity-70" title="Detection confidence">· {Math.round(confidence * 100)}%</span>
      )}
    </span>
  );
}
