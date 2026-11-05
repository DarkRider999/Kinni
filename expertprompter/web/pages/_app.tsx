import type { AppProps } from 'next/app';
import Head from 'next/head';
import { AuthProvider } from '@/lib/auth';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Ananvi PromptMaster — AI Prompt Marketplace</title>
        <meta name="description" content="Turn any idea into a detailed, expert-level AI prompt and find the best AI tool for the job." />
      </Head>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
