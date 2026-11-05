import Link from 'next/link';

const steps = [
  { title: 'Paste any URL', body: 'YouTube, Twitch, podcasts — drop a link to any long-form video.' },
  { title: 'AI finds the best moments', body: 'Transcription and scoring pick the most engaging segments.' },
  { title: 'Download ready clips', body: 'Vertical 9:16 clips with animated captions, ready to post.' },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="flex items-center justify-between bg-black px-6 py-4">
        <span className="text-lg font-bold text-white">
          Ananvi <span className="text-[#f5c518]">Studio</span>
        </span>
        <nav className="flex gap-3">
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm text-white hover:bg-[#222]">
            Log in
          </Link>
          <Link href="/register" className="rounded-lg bg-[#f5c518] px-4 py-2 text-sm font-semibold text-black hover:bg-[#ffd740]">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight">Ten clips from one link.</h1>
        <p className="mt-4 text-lg text-[#666]">
          AI-powered clipping turns long videos into short, captioned, viral-ready clips in minutes.
        </p>
        <Link href="/register" className="mt-8 inline-block rounded-lg bg-[#f5c518] px-6 py-3 font-semibold text-black hover:bg-[#ffd740]">
          Start clipping free
        </Link>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-xl border border-black/10 p-6">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-bold text-[#f5c518]">
              {i + 1}
            </div>
            <h4 className="font-semibold">{s.title}</h4>
            <p className="mt-2 text-sm text-[#666]">{s.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
