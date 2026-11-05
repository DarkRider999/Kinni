import { useState } from 'react';
import Link from 'next/link';
import MarketplaceLayout from '@/components/MarketplaceLayout';
import MarketplacePromptCard, { PromptDetailModal } from '@/components/MarketplacePromptCard';
import PromptGenerator from '@/components/PromptGenerator';
import { BRAND, SAMPLE_PROMPTS, TRENDING_IDS, type MarketplacePrompt } from '@/lib/marketplace';

const STATS = [
  { value: '10,000+', label: 'Prompts' },
  { value: '50,000+', label: 'Users' },
  { value: '500+', label: 'Creators' },
  { value: '4.9★', label: 'Rating' },
];

const CATEGORIES = [
  { icon: '🎨', name: 'Midjourney', href: '/explore?category=Midjourney' },
  { icon: '🤖', name: 'ChatGPT', href: '/explore?category=ChatGPT' },
  { icon: '🖼️', name: 'DALL·E 3', href: `/explore?category=${encodeURIComponent('DALL·E')}` },
  { icon: '⚡', name: 'Stable Diffusion', href: `/explore?category=${encodeURIComponent('Stable Diffusion')}` },
  { icon: '📸', name: 'Lightroom', href: '/explore?category=Lightroom' },
  { icon: '🎬', name: 'Video AI', href: '/explore?q=video' },
];

const FEATURED = SAMPLE_PROMPTS.slice(0, 8);
const TRENDING = TRENDING_IDS.flatMap((id) => SAMPLE_PROMPTS.filter((p) => p.id === id));

function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: BRAND.text }}>{title}</h2>
        {subtitle && <p className="mt-1 text-sm" style={{ color: BRAND.text2 }}>{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="text-sm font-semibold hover:underline" style={{ color: BRAND.accent }}>
          {action.label} →
        </Link>
      )}
    </div>
  );
}

export default function Home() {
  const [open, setOpen] = useState<MarketplacePrompt | null>(null);

  return (
    <MarketplaceLayout>
      {({ openSignIn, openPaywall }) => (
        <main>
          {/* Hero */}
          <section
            className="relative overflow-hidden"
            style={{
              background: `radial-gradient(ellipse at top left, rgba(108,99,255,0.4), transparent 50%), radial-gradient(ellipse at bottom right, rgba(255,101,132,0.3), transparent 50%), ${BRAND.bg}`,
            }}
          >
            <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28">
              <span
                className="inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                style={{ borderColor: BRAND.border, color: BRAND.accent3, background: BRAND.bg2 }}
              >
                ✦ AI Prompt Gallery
              </span>
              <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl" style={{ color: BRAND.text }}>
                See the{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: `linear-gradient(90deg, ${BRAND.accent}, ${BRAND.accent2})` }}
                >
                  Prompt
                </span>{' '}
                Behind Every Image
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg" style={{ color: BRAND.text2 }}>
                Browse stunning AI-generated visuals and copy the exact prompts that created them.
                Midjourney, DALL·E, Stable Diffusion &amp; more — all free to use.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/explore"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-semibold text-white shadow-lg transition hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${BRAND.accent}, #9b59b6)` }}
                >
                  Browse Gallery
                </Link>
                <Link
                  href="/create"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border px-7 py-3.5 font-semibold transition hover:opacity-90"
                  style={{ borderColor: BRAND.border, color: BRAND.text, background: BRAND.bg2 }}
                >
                  Generate Prompt Free
                </Link>
              </div>
            </div>
          </section>

          {/* Stats bar */}
          <section className="border-y" style={{ borderColor: BRAND.border, background: BRAND.bg2 }}>
            <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 py-8 text-center sm:grid-cols-4 sm:px-6">
              {STATS.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-2xl font-extrabold sm:text-3xl" style={{ color: BRAND.text }}>{s.value}</dd>
                  <dd className="mt-1 text-sm" style={{ color: BRAND.text2 }}>{s.label}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="mx-auto max-w-7xl space-y-20 px-4 py-16 sm:px-6">
            {/* Category grid */}
            <section aria-labelledby="categories-heading">
              <SectionHeading title="Browse by AI Tool" subtitle="Find prompts for the tool you use" />
              <div id="categories-heading" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {CATEGORIES.map((c) => (
                  <Link
                    key={c.name}
                    href={c.href}
                    className="flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
                    style={{ background: BRAND.bg2, borderColor: BRAND.border }}
                  >
                    <span className="text-3xl" aria-hidden>{c.icon}</span>
                    <span className="text-xs font-semibold" style={{ color: BRAND.text }}>{c.name}</span>
                  </Link>
                ))}
              </div>
            </section>

            {/* Featured gallery — image grid */}
            <section>
              <SectionHeading
                title="Featured Prompts"
                subtitle="Copy the prompt, recreate the magic"
                action={{ href: '/explore', label: 'View all' }}
              />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURED.map((p) => (
                  <MarketplacePromptCard key={p.id} prompt={p} onOpen={setOpen} />
                ))}
              </div>
            </section>

            {/* Trending — horizontal scroll on mobile, grid on desktop */}
            <section>
              <SectionHeading
                title="Trending This Week"
                subtitle="Most copied prompts right now"
                action={{ href: '/explore?filter=Trending', label: 'See trending' }}
              />
              <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
                {TRENDING.map((p) => (
                  <div key={p.id} className="w-64 shrink-0 snap-start sm:w-auto">
                    <MarketplacePromptCard prompt={p} onOpen={setOpen} hot />
                  </div>
                ))}
              </div>
            </section>

            {/* How it works */}
            <section className="rounded-3xl border p-8 sm:p-10" style={{ background: BRAND.bg2, borderColor: BRAND.border }}>
              <div className="text-center mb-10">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: BRAND.text }}>How It Works</h2>
                <p className="mt-2 text-sm" style={{ color: BRAND.text2 }}>Three steps to recreate any AI image</p>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {[
                  { step: '01', title: 'Browse the Gallery', desc: 'Explore thousands of AI-generated images across every style and category.' },
                  { step: '02', title: 'Copy the Prompt', desc: 'Click any image to reveal and copy the exact prompt that generated it.' },
                  { step: '03', title: 'Create Your Own', desc: 'Paste into Midjourney, DALL·E, or Stable Diffusion and generate your version.' },
                ].map((s) => (
                  <div key={s.step} className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white" style={{ background: `linear-gradient(135deg, ${BRAND.accent}, #9b59b6)` }}>
                      {s.step}
                    </div>
                    <h3 className="font-semibold mb-1" style={{ color: BRAND.text }}>{s.title}</h3>
                    <p className="text-sm" style={{ color: BRAND.text2 }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Generator section */}
            <section id="generator" className="scroll-mt-20">
              <div
                className="mb-8 rounded-3xl border p-8 text-center sm:p-10"
                style={{
                  background: `linear-gradient(135deg, rgba(108,99,255,0.18), rgba(67,233,123,0.08)), ${BRAND.bg2}`,
                  borderColor: BRAND.border,
                }}
              >
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: BRAND.text }}>
                  ✦ AI Prompt Generator
                </h2>
                <p className="mx-auto mt-2 max-w-2xl text-sm" style={{ color: BRAND.text2 }}>
                  Describe your vision and get a detailed, expert-crafted prompt plus the best AI tool for the job.
                </p>
              </div>
              <div className="rounded-3xl border p-4 sm:p-6" style={{ background: BRAND.bg2, borderColor: BRAND.border }}>
                <PromptGenerator onSignIn={openSignIn} onPaywall={openPaywall} />
              </div>
            </section>

            {/* Creator CTA */}
            <section
              className="relative overflow-hidden rounded-3xl border p-8 sm:p-12"
              style={{
                background: `radial-gradient(circle at top right, rgba(255,101,132,0.25), transparent 50%), ${BRAND.bg3}`,
                borderColor: BRAND.border,
              }}
            >
              <div className="max-w-2xl">
                <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: BRAND.text }}>
                  Share Your Prompts,{' '}
                  <span style={{ color: BRAND.accent3 }}>Earn 70%</span>
                </h2>
                <p className="mt-3 text-lg" style={{ color: BRAND.text2 }}>
                  Turn your best AI prompts into income. List them on the gallery, reach thousands of creators, and keep 70% of every sale.
                </p>
                <Link
                  href="/create"
                  className="mt-6 inline-block rounded-xl px-6 py-3 font-semibold text-white transition hover:opacity-90"
                  style={{ background: BRAND.accent2 }}
                >
                  Start Sharing Free
                </Link>
              </div>
            </section>
          </div>

          <PromptDetailModal prompt={open} onClose={() => setOpen(null)} />
        </main>
      )}
    </MarketplaceLayout>
  );
}
