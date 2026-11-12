import type { Metadata } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ANANVI ElectroDeal | Compare Smart. Research Better. Save More.',
    template: '%s | ANANVI ElectroDeal',
  },
  description:
    'UAE\'s AI-powered electronics price comparison platform. Compare prices across Amazon.ae, Noon, Sharaf DG, Jumbo and more. Find the best deals on smartphones, laptops, gaming, and all electronics.',
  keywords: [
    'electronics UAE', 'price comparison UAE', 'best deals electronics Dubai',
    'buy electronics online UAE', 'used electronics UAE', 'refurbished electronics',
    'smartphone deals UAE', 'laptop deals Dubai', 'AI shopping assistant',
  ],
  authors: [{ name: 'ANANVI ElectroDeal' }],
  creator: 'ANANVI',
  openGraph: {
    type: 'website',
    locale: 'en_AE',
    url: 'https://electrodeal.ananvi.com',
    siteName: 'ANANVI ElectroDeal',
    title: 'ANANVI ElectroDeal | UAE\'s Smartest Electronics Marketplace',
    description: 'Compare prices, research with AI, and save more on electronics across UAE\'s top retailers.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ANANVI ElectroDeal | Compare Smart. Research Better. Save More.',
    description: 'UAE\'s AI-powered electronics price comparison — find the best deals instantly.',
  },
  robots: { index: true, follow: true },
  themeColor: '#02050d',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-navy-950 text-silver-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
