import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icon';
import { deleteCharacter, getOwnerSession, listCharacters, listProjects } from '../lib/storage';
import type { CharacterProfile } from '../lib/types';

export default function Profile() {
  const router = useRouter();
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [privateMode, setPrivateMode] = useState(true);
  const [projectCount, setProjectCount] = useState(0);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);

  useEffect(() => {
    setCharacters(listCharacters());
    setProjectCount(listProjects().length);
    setOwnerEmail(getOwnerSession()?.email ?? null);
    setJustCreated(router.query.created === '1');
    const stored = window.localStorage.getItem('aifs.privateMode.v1');
    if (stored !== null) setPrivateMode(stored === '1');
  }, [router.query.created]);

  function togglePrivate() {
    const next = !privateMode;
    setPrivateMode(next);
    window.localStorage.setItem('aifs.privateMode.v1', next ? '1' : '0');
  }

  return (
    <>
      <Head><title>Profile</title></Head>
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-purple to-accent-blue font-display text-[20px] font-bold">R</div>
          <div>
            <div className="text-[16px] font-bold text-white">Roshan</div>
            <div className="text-[11.5px] text-white/40">{projectCount} projects · SplitFire Production</div>
          </div>
        </div>

        {justCreated && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-accent-green/25 bg-accent-green/10 px-3 py-2.5 text-[12px] font-semibold text-accent-green">
            <Icon name="check" size={14} /> Character saved — use it from any tool&apos;s Upload step.
          </div>
        )}

        <div className="mt-6 surface flex items-center justify-between p-4">
          <div className="flex items-center gap-2.5">
            <Icon name="shield" size={17} className="text-accent-cyanSoft" />
            <div>
              <div className="text-[13px] font-semibold text-white">Private Processing</div>
              <div className="text-[11px] text-white/40">Clears temp uploads after each job (SPEC §13)</div>
            </div>
          </div>
          <button
            type="button"
            onClick={togglePrivate}
            aria-pressed={privateMode}
            className={`h-6 w-11 rounded-full transition ${privateMode ? 'bg-accent-green' : 'bg-white/15'}`}
          >
            <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${privateMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-white">My Characters</h2>
          <Link href="/upload/create-character" className="text-[11.5px] font-semibold text-accent-purpleSoft">+ New</Link>
        </div>
        {characters.length === 0 ? (
          <p className="mt-2 text-[12px] text-white/40">No saved characters yet — upload once, reuse everywhere.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-3">
            {characters.map((c) => (
              <div key={c.id} className="relative flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.sourceDataUrl} alt={c.name} className="h-16 w-16 rounded-2xl border border-line object-cover" />
                <span className="max-w-[64px] truncate text-[10.5px] text-white/55">{c.name}</span>
                <button
                  type="button"
                  aria-label={`Delete ${c.name}`}
                  onClick={() => { deleteCharacter(c.id); setCharacters(listCharacters()); }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                >
                  <Icon name="x" size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-2">
          <Link href="/owner" className="surface flex items-center justify-between p-4">
            <div className="flex items-center gap-2.5">
              <Icon name="cpu" size={17} className="text-accent-amber" />
              <div className="text-[13px] font-semibold text-white">Owner Command Center</div>
            </div>
            <Icon name="chevron-right" size={16} className="text-white/35" />
          </Link>
          {ownerEmail && <div className="px-1 text-[11px] text-accent-green">Signed in as owner — {ownerEmail}</div>}
        </div>

        <p className="mt-8 text-center text-[10.5px] text-white/25">AI Face Studio by SplitFire Production · demo build</p>
      </div>
      <BottomNav />
    </>
  );
}
