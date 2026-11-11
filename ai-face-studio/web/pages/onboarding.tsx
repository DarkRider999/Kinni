import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Onboarding() {
  const router = useRouter();

  function start() {
    window.localStorage.setItem('aifs.onboarded.v1', '1');
    router.push('/home');
  }

  return (
    <>
      <Head><title>AI Face Studio</title></Head>
      <div
        className="relative flex flex-1 flex-col items-center justify-between overflow-hidden px-8 py-14"
        style={{ background: 'radial-gradient(120% 90% at 50% 0%, #241B3D 0%, #120F1C 45%, #0A0A0F 100%)' }}
      >
        <div aria-hidden className="absolute -right-20 -top-20 h-72 w-72 rounded-full blur-xl" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.35), transparent 70%)' }} />
        <div aria-hidden className="absolute -left-24 bottom-16 h-64 w-64 rounded-full blur-xl" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)' }} />

        <div className="z-10 mt-10 flex flex-col items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent-purple to-accent-cyan shadow-glow">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#0A0A0F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.9L12 3z" />
            </svg>
          </div>
          <div className="font-display text-[12px] font-bold tracking-[4px] text-white/45">SPLITFIRE PRODUCTION</div>
        </div>

        <div className="z-10 flex flex-col items-center gap-3 text-center">
          <h1 className="bg-gradient-to-r from-white to-[#D9CCFF] bg-clip-text text-[32px] font-bold text-transparent">
            AI Face Studio
          </h1>
          <p className="text-[18px] font-semibold text-white">Transform Your Imagination.</p>
          <p className="text-[13px] text-white/45">One photo. Unlimited possibilities.</p>
        </div>

        <div className="z-10 flex w-full flex-col items-center gap-6">
          <div className="flex gap-2">
            <span className="h-1.5 w-6 rounded-full bg-accent-purple" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
          </div>
          <button type="button" onClick={start} className="btn-primary">Start Creating</button>
          <p className="max-w-[280px] text-center text-[10.5px] leading-relaxed text-white/35">
            By continuing you agree to only upload photos you have the right to edit.
          </p>
        </div>
      </div>
    </>
  );
}
