import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import ThemeToggle from './ThemeToggle';
import { SparklesIcon, SpinnerIcon } from './Icons';

interface HeaderProps {
  onSignIn: () => void;
  onUpgrade: () => void;
}

function PlanBadge() {
  const { entitlement } = useAuth();
  if (!entitlement) return null;
  if (entitlement.plan === 'MASTER') {
    return (
      <span className="whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
        Master<span className="hidden sm:inline"> · unlimited</span>
      </span>
    );
  }
  if (entitlement.plan === 'PREMIUM') {
    return <span className="whitespace-nowrap rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">Premium</span>;
  }
  const left = entitlement.freeRunsRemaining ?? 0;
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${left === 0 ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
      <span className="sm:hidden">{left}/{entitlement.freeRunsLimit} free</span>
      <span className="hidden sm:inline">{left} of {entitlement.freeRunsLimit} free left</span>
    </span>
  );
}

export default function Header({ onSignIn, onUpgrade }: HeaderProps) {
  const { user, entitlement, logout, ready } = useAuth();
  const [opening, setOpening] = useState(false);

  const manageBilling = async () => {
    setOpening(true);
    try {
      const { url } = await api.billingPortal();
      window.location.assign(url);
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : 'Could not open billing. Please try again.');
      setOpening(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href="/" aria-label="ExpertPrompter home" className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-sm">
            <SparklesIcon />
          </span>
          <span className={`leading-tight ${user ? 'hidden sm:block' : ''}`}>
            <span className="block text-base font-bold tracking-tight">ExpertPrompter</span>
            <span className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">Turn any idea into an expert AI prompt</span>
          </span>
        </a>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {ready && user ? (
            <>
              <PlanBadge />
              <span className="hidden max-w-[14rem] truncate text-sm text-slate-600 lg:inline dark:text-slate-300">{user.email}</span>
              {entitlement?.plan === 'FREE' && (
                <button type="button" className="btn-primary !px-2.5 sm:!px-3" onClick={onUpgrade}>Upgrade</button>
              )}
              {entitlement?.plan === 'PREMIUM' && (
                <button type="button" className="btn-secondary !px-3" onClick={() => void manageBilling()} disabled={opening}>
                  {opening && <SpinnerIcon />} Billing
                </button>
              )}
              <button type="button" className="btn-ghost !px-2 sm:!px-3" onClick={logout}>Sign out</button>
            </>
          ) : (
            <button type="button" className="btn-secondary" onClick={onSignIn} disabled={!ready}>Sign in</button>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
