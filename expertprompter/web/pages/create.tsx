import Head from 'next/head';
import MarketplaceLayout from '@/components/MarketplaceLayout';
import PromptGenerator from '@/components/PromptGenerator';

export default function CreatePage() {
  return (
    <MarketplaceLayout dark={false}>
      {({ openSignIn, openPaywall }) => (
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Head>
            <title>AI Prompt Generator — Ananvi PromptMaster</title>
          </Head>
          <div className="mb-8 max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              AI Prompt <span className="bg-gradient-to-r from-brand-600 to-fuchsia-500 bg-clip-text text-transparent">Generator</span>
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Describe your task in plain words. Ananvi PromptMaster detects what kind of task it is, writes a detailed, structured prompt, and tells you which AI tool to use.
            </p>
          </div>
          <PromptGenerator onSignIn={openSignIn} onPaywall={openPaywall} />
          <p className="mt-10 text-xs text-slate-400">
            Ananvi PromptMaster writes prompts with its own rule-based logic. Photos you attach are described by an AI running on your own device.
          </p>
        </main>
      )}
    </MarketplaceLayout>
  );
}
