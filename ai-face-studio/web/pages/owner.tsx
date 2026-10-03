import Head from 'next/head';
import { useEffect, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Icon } from '../components/Icon';
import { demoOwnerConfigured, isDemoOwnerEmail } from '../lib/owner';
import { getOwnerSession, listProjects, setOwnerSession } from '../lib/storage';
import type { Project } from '../lib/types';

export default function Owner() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ email: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [unlimited, setUnlimited] = useState(false);

  useEffect(() => {
    setSession(getOwnerSession());
    setProjects(listProjects());
    setUnlimited(window.localStorage.getItem('aifs.unlimitedDemo.v1') === '1');
  }, []);

  function signIn() {
    setError(null);
    if (!demoOwnerConfigured()) {
      setError('No NEXT_PUBLIC_OWNER_EMAIL is set in this environment — see .env.example.');
      return;
    }
    if (!isDemoOwnerEmail(email)) {
      setError("That email doesn't match the configured demo owner email.");
      return;
    }
    setOwnerSession(email);
    setSession({ email });
  }

  function signOut() {
    setOwnerSession(null);
    setSession(null);
  }

  function toggleUnlimited() {
    const next = !unlimited;
    setUnlimited(next);
    window.localStorage.setItem('aifs.unlimitedDemo.v1', next ? '1' : '0');
  }

  const byTool = projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.toolName] = (acc[p.toolName] ?? 0) + 1;
    return acc;
  }, {});
  const topTools = Object.entries(byTool).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCount = topTools[0]?.[1] ?? 1;

  if (!session) {
    return (
      <>
        <Head><title>Owner sign-in</title></Head>
        <TopBar title="Owner Command Center" />
        <div className="flex-1 px-5 pt-4">
          <div className="mb-4 flex items-start gap-2 rounded-xl2 border border-accent-amber/25 bg-accent-amber/10 p-3.5 text-[11.5px] leading-relaxed text-accent-amber">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
            Demo gate only — this check happens in your browser and proves nothing to a server. Real
            owner entitlement must be verified server-side (SPEC §15). No real email or password is
            committed to this repo.
          </div>
          <label className="mb-2 block text-[11px] font-semibold tracking-wide text-white/45">OWNER EMAIL</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@example.com"
            className="w-full rounded-xl border border-line bg-white/[0.05] px-3.5 py-3 text-[13.5px] text-white placeholder-white/35 outline-none"
          />
          {error && <p className="mt-2 text-[11.5px] text-accent-red">{error}</p>}
          <button type="button" onClick={signIn} className="btn-primary mt-4">Sign in</button>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>Owner Command Center</title></Head>
      <TopBar title="Owner Command Center" right={
        <button type="button" onClick={signOut} className="text-[11px] font-semibold text-white/40">Sign out</button>
      } />
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-full bg-accent-amber/15 px-2.5 py-1 text-[10.5px] font-bold text-accent-amber">OWNER</span>
          <span className="text-[11.5px] text-white/40">{session.email}</span>
        </div>

        <div className="surface mb-4 flex items-center justify-between p-4">
          <div>
            <div className="text-[13px] font-semibold text-white">Unlimited Free Mode</div>
            <div className="text-[11px] text-white/40">Demo toggle only — no real billing effect (SPEC §15.2)</div>
          </div>
          <button type="button" onClick={toggleUnlimited} className={`h-6 w-11 rounded-full transition ${unlimited ? 'bg-accent-green' : 'bg-white/15'}`}>
            <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${unlimited ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="surface p-4">
            <div className="text-[11px] text-white/45">Total generations (this browser)</div>
            <div className="mt-1 font-display text-[22px] font-bold text-white">{projects.length}</div>
          </div>
          <div className="surface p-4">
            <div className="text-[11px] text-white/45">Favorited</div>
            <div className="mt-1 font-display text-[22px] font-bold text-white">{projects.filter((p) => p.favorite).length}</div>
          </div>
        </div>

        <div className="surface mt-3 p-4">
          <div className="mb-3 flex items-center justify-between text-[11px] text-white/45">
            <span>Most-used tools</span>
            <span>real data, this browser only</span>
          </div>
          {topTools.length === 0 ? (
            <p className="text-[12px] text-white/35">No generations saved yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {topTools.map(([name, count]) => (
                <div key={name}>
                  <div className="flex justify-between text-[12px] text-white"><span>{name}</span><span className="text-white/45">{count}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10">
                    <div className="h-1.5 rounded-full bg-gradient-to-r from-accent-purple to-accent-cyan" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="surface mt-3 p-4">
          <div className="mb-2 text-[11px] text-white/45">Actual AI cost</div>
          <p className="text-[12.5px] leading-relaxed text-white/55">
            Simulated — this build uses an in-browser mock provider with no per-call cost. Wire real
            provider billing/webhooks here per SPEC §15.4 once a paid model is connected.
          </p>
        </div>
      </div>
    </>
  );
}
