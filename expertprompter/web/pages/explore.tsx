import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import MarketplaceLayout from '@/components/MarketplaceLayout';
import MarketplacePromptCard, { PromptDetailModal } from '@/components/MarketplacePromptCard';
import { BRAND, SAMPLE_PROMPTS, TRENDING_IDS, type MarketplacePrompt } from '@/lib/marketplace';

const FILTERS = ['All', 'Midjourney', 'ChatGPT', 'DALL·E', 'Stable Diffusion', 'Lightroom', 'Free Only', 'Trending'] as const;
type Filter = (typeof FILTERS)[number];

const isFilter = (v: unknown): v is Filter => typeof v === 'string' && (FILTERS as readonly string[]).includes(v);

function matchesFilter(p: MarketplacePrompt, filter: Filter) {
  if (filter === 'All') return true;
  if (filter === 'Free Only') return p.tier === 'free';
  if (filter === 'Trending') return TRENDING_IDS.includes(p.id);
  return p.category === filter;
}

function matchesQuery(p: MarketplacePrompt, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [p.title, p.description, p.category, p.prompt].some((field) => field.toLowerCase().includes(q));
}

const SearchIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
  </svg>
);

export default function ExplorePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [open, setOpen] = useState<MarketplacePrompt | null>(null);

  // Homepage category cards link here with ?category= or ?q=.
  useEffect(() => {
    if (!router.isReady) return;
    const { category, q } = router.query;
    if (isFilter(category)) setFilter(category);
    if (typeof q === 'string') setQuery(q);
  }, [router.isReady, router.query]);

  const results = useMemo(() => SAMPLE_PROMPTS.filter((p) => matchesFilter(p, filter) && matchesQuery(p, query)), [filter, query]);

  return (
    <MarketplaceLayout>
      {() => (
        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <Head>
            <title>Explore Prompts — Ananvi PromptMaster</title>
          </Head>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: BRAND.text }}>Explore Prompts</h1>
          <p className="mt-2" style={{ color: BRAND.text2 }}>Expert-crafted prompts for Midjourney, ChatGPT, DALL·E, Stable Diffusion and more.</p>

          <label className="relative mt-6 block">
            <span className="sr-only">Search prompts</span>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: BRAND.text2 }}><SearchIcon /></span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prompts, styles, tools..."
              className="w-full rounded-2xl border py-4 pl-12 pr-4 text-base focus:outline-none focus:ring-2"
              style={{ background: BRAND.bg2, borderColor: BRAND.border, color: BRAND.text }}
            />
          </label>

          <div role="group" aria-label="Filter prompts" className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = f === filter;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f)}
                  className="rounded-full border px-4 py-1.5 text-sm font-medium transition hover:opacity-90"
                  style={active ? { background: BRAND.accent, borderColor: BRAND.accent, color: '#fff' } : { background: BRAND.bg2, borderColor: BRAND.border, color: BRAND.text2 }}
                >
                  {f}
                </button>
              );
            })}
          </div>

          <p className="mt-6 text-sm" style={{ color: BRAND.text2 }}>{results.length} {results.length === 1 ? 'prompt' : 'prompts'}</p>
          {results.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((p) => (
                <MarketplacePromptCard key={p.id} prompt={p} onOpen={setOpen} hot={TRENDING_IDS.includes(p.id)} />
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border p-10 text-center" style={{ background: BRAND.bg2, borderColor: BRAND.border, color: BRAND.text2 }}>
              No prompts match. Try another search or filter.
            </div>
          )}

          <PromptDetailModal prompt={open} onClose={() => setOpen(null)} />
        </main>
      )}
    </MarketplaceLayout>
  );
}
