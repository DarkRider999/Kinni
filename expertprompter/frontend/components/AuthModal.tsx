import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { SpinnerIcon } from './Icons';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    emailRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await (mode === 'login' ? login(email, password) : register(email, password));
      setPassword('');
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setError(Object.values(err.details).flat()[0] ?? err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="card w-full max-w-sm animate-fade-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="auth-title" className="text-lg font-semibold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to save prompts and keep a history. Generating works without an account.</p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="auth-email">Email</label>
            <input ref={emailRef} id="auth-email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={8}
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
      </div>
    </div>
  );
}
