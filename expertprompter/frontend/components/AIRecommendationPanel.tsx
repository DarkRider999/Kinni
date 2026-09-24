import type { RecommendedTool } from '@/lib/types';
import { ExternalIcon } from './Icons';

interface AIRecommendationPanelProps {
  tools: RecommendedTool[];
}

export default function AIRecommendationPanel({ tools }: AIRecommendationPanelProps) {
  if (tools.length === 0) return null;
  return (
    <section className="card animate-fade-in" aria-labelledby="tools-heading">
      <h2 id="tools-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Recommended AI tools
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <li key={tool.id}>
            <a
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full flex-col rounded-xl border border-slate-200 p-3 transition hover:border-brand-400 hover:shadow-sm dark:border-slate-800 dark:hover:border-brand-500"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${tool.rank === 1 ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {tool.rank}
                  </span>
                  <span className="font-semibold">{tool.name}</span>
                </span>
                <ExternalIcon className="text-slate-400 transition group-hover:text-brand-600" width={14} height={14} />
              </span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tool.vendor}</span>
              <span className="mt-2 text-sm text-slate-700 dark:text-slate-300">{tool.reason}</span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tool.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
