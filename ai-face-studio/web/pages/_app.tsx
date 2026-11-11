import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Installability just won't be offered — nothing else in the app depends on this.
      });
    }
  }, []);

  return (
    <div className="phone-shell">
      <Component {...pageProps} />
    </div>
  );
}
