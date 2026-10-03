import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icon';
import type { Project } from '../lib/types';
import { listProjects } from '../lib/storage';

const QUICK = [
  { studio: 'face', label: 'Face', icon: 'face' as const },
  { studio: 'hair', label: 'Hair', icon: 'hair' as const },
  { studio: 'fashion', label: 'Clothes', icon: 'clothing' as const },
  { studio: 'body', label: 'Body', icon: 'body' as const },
  { studio: 'character', label: 'Character', icon: 'character' as const },
  { studio: 'photo', label: 'Photo', icon: 'photo' as const },
];

const TRENDING = [
  { toolId: 'character-swap', label: 'Cyberpunk Hero', sub: 'Character Studio', from: '#2A2140', to: '#161326' },
  { toolId: 'ai-portrait', label: 'CEO Portrait', sub: 'Face Studio', from: '#17333A', to: '#0F1F24' },
  { toolId: 'clothes-changer', label: 'Luxury Suit', sub: 'Fashion Studio', from: '#302330', to: '#1C1420' },
];

export default function Home() {
  const [recent, setRecent] = useState<Project | null>(null);

  useEffect(() => {
    const all = listProjects();
    setRecent(all[0] ?? null);
  }, []);

  return (
    <>
      <Head><title>AI Face Studio — Home</title></Head>
      <div className="flex-1 overflow-y-auto px-5 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px] text-white/45">Good to see you</div>
            <h1 className="mt-0.5 text-[22px] font-bold text-white">Create anything.</h1>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-purple to-accent-blue font-display text-[15px] font-bold">R</div>
        </div>

        <Link href="/tools" className="mt-5 flex items-center gap-2.5 rounded-2xl border border-line bg-white/[0.05] px-4 py-3.5 text-white/45">
          <Icon name="search" size={17} />
          <span className="text-[13.5px]">What do you want to transform?</span>
        </Link>

        <div className="mt-6 flex gap-3.5 overflow-x-auto pb-1">
          {QUICK.map((q) => (
            <Link key={q.studio} href={`/tools?studio=${q.studio}`} className="flex shrink-0 flex-col items-center gap-1.5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-purple/40 bg-accent-purple/15 text-accent-purpleSoft">
                <Icon name={q.icon} size={22} />
              </div>
              <span className="text-[10px] font-semibold text-white">{q.label}</span>
            </Link>
          ))}
        </div>

        <div className="mt-7 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white">Trending AI</h2>
          <Link href="/tools" className="text-[11.5px] text-white/40">See all</Link>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {TRENDING.map((t) => (
            <Link
              key={t.toolId}
              href={`/upload/${t.toolId}`}
              className="flex h-[170px] w-[132px] shrink-0 flex-col justify-end rounded-2xl border border-line p-2.5"
              style={{ background: `linear-gradient(160deg, ${t.from}, ${t.to})` }}
            >
              <span className="text-[12px] font-semibold text-white">{t.label}</span>
              <span className="text-[10px] text-white/45">{t.sub}</span>
            </Link>
          ))}
        </div>

        <div className="mt-7 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white">Continue creating</h2>
        </div>
        {recent ? (
          <Link href="/projects" className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-white/[0.04] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recent.resultDataUrl} alt="" className="rounded-xl object-cover" style={{ width: 52, height: 52 }} />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-white">{recent.toolName}</div>
              <div className="text-[11px] text-white/40">{new Date(recent.createdAt).toLocaleString()}</div>
            </div>
            <Icon name="chevron-right" size={17} className="text-white/35" />
          </Link>
        ) : (
          <Link href="/tools" className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-white/45">
            <Icon name="sparkle" size={17} />
            <span className="text-[12.5px]">No projects yet — pick a tool to make your first one.</span>
          </Link>
        )}
        <div className="h-6" />
      </div>
      <BottomNav />
    </>
  );
}
