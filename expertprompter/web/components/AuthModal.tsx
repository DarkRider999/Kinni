import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { FacebookIcon, GitHubIcon, GoogleIcon, SpinnerIcon } from './Icons';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional line explaining why sign-in is needed (e.g. "Sign in to get 5 free prompts"). */
  reason?: string | null;
}

const PROVIDER_ICONS = { google: GoogleIcon, facebook: FacebookIcon, github: GitHubIcon };

export default function AuthModal({ open, onClose, reason }: AuthModalProps) {
  const { login, register, providers } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRedirecting(null);
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const socials = providers?.providers ?? [];
  const freeRuns = providers?.freeRunsLimit ?? 5;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await (mode === 'login' ? login(email, password) : register(email, password));
      setPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.fieldMessage ?? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="card w-full max-w-sm animate-fade-in outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="auth-title" className="text-lg font-semibold">{mode === 'login' ? 'Welcome back' : 'Create your free account'}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {reason ?? `Get ${freeRuns} free expert prompts, then go unlimited with Premium.`}
        </p>

        {socials.length > 0 && (
          <>
            <div className="mt-4 space-y-2">
              {socials.map((p) => {
                const Icon = PROVIDER_ICONS[p.id];
                return (
                  <a
                    key={p.id}
                    href={`/api/auth/oauth/${p.id}`}
                    onClick={() => setRedirecting(p.id)}
                    className="btn-secondary w-full justify-center !py-2.5"
                  >
                    {redirecting === p.id ? <SpinnerIcon /> : <Icon />}
                    Continue with {p.label}
                  </a>
                );
              })}
            </div>
            <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              or use email
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>
          </>
        )}

        <form onSubmit={submit} className={`space-y-3 ${socials.length ? '' : 'mt-4'}`}>
          <div>
            <label className="label" htmlFor="auth-email">{mode === 'login' ? 'Email or username' : 'Email'}</label>
            <input
              id="auth-email"
              type={mode === 'login' ? 'text' : 'email'}
              autoComplete={mode === 'login' ? 'username' : 'email'}
              autoCapitalize="none"
              spellCheck={false}
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'register' && <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>}
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading && <SpinnerIcon />} {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
          <button type="button" className="font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
        <p className="mt-3 text-center text-xs text-slate-400">
          By continuing you agree to the <a href="/terms" className="underline">Terms</a> and <a href="/privacy" className="underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
