import Head from 'next/head';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { TopBar } from '../components/TopBar';
import { ToolCard } from '../components/ToolCard';
import { Icon } from '../components/Icon';
import { STUDIOS, TOOLS } from '../lib/tools';

export default function Tools() {
  const router = useRouter();
  const studioFilter = typeof router.query.studio === 'string' ? router.query.studio : null;
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOLS.filter((t) => {
      if (studioFilter && t.studio !== studioFilter) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.studio.includes(q);
    });
  }, [query, studioFilter]);

  return (
    <>
      <Head><title>AI Face Studio — Tools</title></Head>
      <TopBar title={studioFilter ? (STUDIOS.find((s) => s.id === studioFilter)?.name ?? 'Tools') : 'Tools'} onBack={() => router.push('/home')} />
      <div className="flex-1 overflow-y-auto px-5">
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-line bg-white/[0.05] px-4 py-3">
          <Icon name="search" size={16} className="text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anything..."
            className="w-full bg-transparent text-[13.5px] text-white placeholder-white/35 outline-none"
          />
        </div>

        {studioFilter && (
          <button
            type="button"
            onClick={() => router.push('/tools')}
            className="mb-4 flex items-center gap-1 text-[11.5px] font-semibold text-accent-purpleSoft"
          >
            <Icon name="x" size={12} /> Clear studio filter
          </button>
        )}

        <div className="grid grid-cols-2 gap-3 pb-8">
          {filtered.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-2 py-10 text-center text-[12.5px] text-white/40">No tools match &ldquo;{query}&rdquo;.</p>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
}
