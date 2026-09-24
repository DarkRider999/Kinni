import { useAuth } from '@/lib/auth';
import ThemeToggle from './ThemeToggle';
import { SparklesIcon } from './Icons';

interface HeaderProps {
  onSignIn: () => void;
}

export default function Header({ onSignIn }: HeaderProps) {
  const { user, logout, ready } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-sm">
            <SparklesIcon />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold tracking-tight">ExpertPrompter</span>
            <span className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">Turn any idea into an expert AI prompt</span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          {ready && user ? (
            <>
              <span className="hidden max-w-[16rem] truncate text-sm text-slate-600 md:inline dark:text-slate-300">{user.email}</span>
              <button type="button" className="btn-secondary" onClick={logout}>Sign out</button>
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
