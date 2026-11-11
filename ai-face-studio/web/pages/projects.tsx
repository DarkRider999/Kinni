import Head from 'next/head';
import { useEffect, useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { TopBar } from '../components/TopBar';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { Icon } from '../components/Icon';
import { deleteProject, listProjects, toggleFavorite } from '../lib/storage';
import type { Project } from '../lib/types';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');

  useEffect(() => {
    setProjects(listProjects());
  }, []);

  function refresh() {
    setProjects(listProjects());
  }

  const visible = filter === 'favorites' ? projects.filter((p) => p.favorite) : projects;
  const open = projects.find((p) => p.id === openId) ?? null;

  function remove(id: string) {
    deleteProject(id);
    if (openId === id) setOpenId(null);
    refresh();
  }

  function download(p: Project) {
    const a = document.createElement('a');
    a.href = p.resultDataUrl;
    a.download = `${p.toolId}-${p.id}.png`;
    a.click();
  }

  if (open) {
    return (
      <>
        <Head><title>{open.toolName}</title></Head>
        <TopBar title={open.toolName} onBack={() => setOpenId(null)} />
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          <BeforeAfterSlider originalSrc={open.originalDataUrl} resultSrc={open.resultDataUrl} />
          <div className="mt-3 text-[11.5px] text-white/40">{new Date(open.createdAt).toLocaleString()}</div>
          <div className="mt-5 flex gap-2.5">
            <button type="button" onClick={() => { toggleFavorite(open.id); refresh(); }} className="btn-secondary flex items-center justify-center gap-2">
              <Icon name="star" size={14} className={open.favorite ? 'text-accent-amber' : ''} /> {open.favorite ? 'Favorited' : 'Favorite'}
            </button>
            <button type="button" onClick={() => download(open)} className="btn-secondary flex items-center justify-center gap-2">
              <Icon name="download" size={14} /> Download
            </button>
          </div>
          <button type="button" onClick={() => remove(open.id)} className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-[12px] font-semibold text-accent-red">
            <Icon name="trash" size={14} /> Delete project
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>Projects</title></Head>
      <TopBar title="Projects" />
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="mb-4 flex gap-2">
          {(['all', 'favorites'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold ${filter === f ? 'bg-accent-purple/20 text-accent-purpleSoft' : 'bg-white/[0.05] text-white/45'}`}
            >
              {f === 'all' ? 'All' : 'Favorites'}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-white/40">
            <Icon name="folder" size={28} />
            <p className="text-[12.5px]">{filter === 'favorites' ? 'No favorites yet.' : 'No projects yet — generate something in Tools.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visible.map((p) => (
              <button key={p.id} type="button" onClick={() => setOpenId(p.id)} className="overflow-hidden rounded-xl2 border border-line text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.resultDataUrl} alt={p.toolName} className="aspect-square w-full object-cover" />
                <div className="p-2.5">
                  <div className="truncate text-[12px] font-semibold text-white">{p.toolName}</div>
                  <div className="text-[10.5px] text-white/40">{new Date(p.createdAt).toLocaleDateString()}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </>
  );
}
