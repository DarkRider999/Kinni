import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en" data-theme="dark">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Work+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0A0A0F" />
      </Head>
      <body className="bg-ink-950">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
