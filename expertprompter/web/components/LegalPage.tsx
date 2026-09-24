import Head from 'next/head';
import type { ReactNode } from 'react';

/** Shared layout for the privacy and terms pages. */
export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Head>
        <title>{`${title} — ExpertPrompter`}</title>
      </Head>
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <a href="/" className="text-sm text-brand-600 hover:underline dark:text-brand-400">← Back to ExpertPrompter</a>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Last updated: September 2026</p>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc dark:text-slate-300 dark:[&_h2]:text-slate-100">
          {children}
        </div>
      </main>
    </>
  );
}

export const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
