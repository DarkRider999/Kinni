import { useCallback, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Header from './Header';
import AuthModal from './AuthModal';
import PaywallModal from './PaywallModal';
import { BRAND } from '@/lib/marketplace';

export interface ModalControls {
  openSignIn: (reason?: string | null) => void;
  openPaywall: () => void;
}

const FOOTER_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/create', label: 'Create' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

export function MarketplaceFooter() {
  return (
    <footer className="border-t" style={{ borderColor: BRAND.border, background: BRAND.bg }}>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p style={{ color: BRAND.text2 }}>© {new Date().getFullYear()} Ananvi PromptMaster. Discover, create and sell AI prompts.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:opacity-80" style={{ color: BRAND.text2 }}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

/**
 * Page shell for the marketplace pages: header, footer, and the sign-in and
 * upgrade modals. Children get the controls to open either modal.
 */
export default function MarketplaceLayout({ children, dark = true }: { children: (controls: ModalControls) => ReactNode; dark?: boolean }) {
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const openSignIn = useCallback((reason: string | null = null) => {
    setAuthReason(reason);
    setAuthOpen(true);
  }, []);
  const openPaywall = useCallback(() => setPaywallOpen(true), []);

  return (
    <div className="flex min-h-screen flex-col" style={dark ? { background: BRAND.bg, color: BRAND.text } : undefined}>
      <Header onSignIn={() => openSignIn()} onUpgrade={openPaywall} />
      <div className="flex-1">{children({ openSignIn, openPaywall })}</div>
      <MarketplaceFooter />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} reason={authReason} />
      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </div>
  );
}
