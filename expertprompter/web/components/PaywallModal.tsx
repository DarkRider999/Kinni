import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CheckIcon, SparklesIcon, SpinnerIcon } from './Icons';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
}

const PERKS = ['Unlimited expert prompts', 'Saved, searchable history', 'Every category, style and template', 'Cancel anytime'];

/** Shown when a free user has used all their runs. Sends them to Stripe Checkout. */
export default function PaywallModal({ open, onClose }: PaywallModalProps) {
  const { providers, entitlement } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const upgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await api.checkout();
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start checkout. Please try again.');
      setLoading(false);
    }
  };

  const limit = entitlement?.freeRunsLimit ?? providers?.freeRunsLimit ?? 5;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="paywall-title" className="card w-full max-w-sm animate-fade-in text-center" onMouseDown={(e) => e.stopPropagation()}>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white">
          <SparklesIcon width={24} height={24} />
        </span>
        <h2 id="paywall-title" className="mt-3 text-lg font-semibold">Go Premium</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {entitlement?.freeRunsRemaining
            ? `You have ${entitlement.freeRunsRemaining} of ${limit} free prompts left. Go unlimited for $10/month.`
            : `You've used your ${limit} free prompts. Upgrade to keep creating.`}
        </p>

        <p className="mt-4 text-3xl font-bold">
          $10<span className="text-base font-medium text-slate-500 dark:text-slate-400">/month</span>
        </p>
        <ul className="mx-auto mt-4 max-w-xs space-y-2 text-left text-sm">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-center gap-2">
              <CheckIcon className="shrink-0 text-emerald-500" width={16} height={16} /> {perk}
            </li>
          ))}
        </ul>

        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

        <button type="button" className="btn-primary mt-5 w-full py-3" onClick={() => void upgrade()} disabled={loading || providers?.billingEnabled === false}>
          {loading && <SpinnerIcon />} {providers?.billingEnabled === false ? 'Premium is coming soon' : 'Upgrade to Premium'}
        </button>
        <button type="button" className="btn-ghost mt-2 w-full" onClick={onClose}>Maybe later</button>
        <p className="mt-2 text-xs text-slate-400">Secure payment by Stripe.</p>
      </div>
    </div>
  );
}
