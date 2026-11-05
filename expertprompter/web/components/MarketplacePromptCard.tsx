import { useEffect, useState } from 'react';
import { BRAND, CATEGORY_GRADIENTS, formatUses, type MarketplacePrompt } from '@/lib/marketplace';
import { CheckIcon, CopyIcon, StarIcon, XIcon } from './Icons';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers/iframes without clipboard permissions.
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  return { copied, copy: () => void copyText(text).then(() => setCopied(true)) };
}

export function TierBadge({ tier }: { tier: MarketplacePrompt['tier'] }) {
  const premium = tier === 'premium';
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={premium ? { background: 'rgba(255,101,132,0.15)', color: BRAND.accent2 } : { background: 'rgba(67,233,123,0.15)', color: BRAND.accent3 }}
    >
      {premium ? 'Premium' : 'Free'}
    </span>
  );
}

function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: BRAND.text }}>
      <StarIcon filled width={14} height={14} className="text-amber-400" /> {value.toFixed(1)}
    </span>
  );
}

interface CardProps {
  prompt: MarketplacePrompt;
  onOpen: (prompt: MarketplacePrompt) => void;
  hot?: boolean;
}

/** Marketplace listing card: gradient thumbnail, meta, and a copy shortcut. */
export default function MarketplacePromptCard({ prompt, onOpen, hot }: CardProps) {
  const { copied, copy } = useCopy(prompt.prompt);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(prompt)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(prompt);
        }
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2"
      style={{ background: BRAND.bg2, borderColor: BRAND.border }}
    >
      <div className="relative h-28" style={{ background: CATEGORY_GRADIENTS[prompt.category] }}>
        {hot && (
          <span className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase text-white" style={{ background: BRAND.accent2 }}>
            🔥 Hot
          </span>
        )}
        <span className="absolute right-3 top-3"><TierBadge tier={prompt.tier} /></span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <span className="w-fit rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ background: BRAND.bg3, color: BRAND.text2 }}>
          {prompt.category}
        </span>
        <h3 className="mt-2 font-semibold leading-snug" style={{ color: BRAND.text }}>{prompt.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm" style={{ color: BRAND.text2 }}>{prompt.description}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className="flex items-center gap-3">
            <Rating value={prompt.rating} />
            <span className="text-xs" style={{ color: BRAND.text2 }}>{formatUses(prompt.uses)} uses</span>
          </span>
          <button
            type="button"
            aria-label={`Copy prompt: ${prompt.title}`}
            onClick={(e) => {
              e.stopPropagation();
              copy();
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition hover:opacity-80"
            style={{ borderColor: BRAND.border, color: copied ? BRAND.accent3 : BRAND.text }}
          >
            {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Full-prompt view for a marketplace listing. */
export function PromptDetailModal({ prompt, onClose }: { prompt: MarketplacePrompt | null; onClose: () => void }) {
  const { copied, copy } = useCopy(prompt?.prompt ?? '');

  useEffect(() => {
    if (!prompt) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt, onClose]);

  if (!prompt) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-detail-title"
        className="w-full max-w-lg animate-fade-in overflow-hidden rounded-2xl border"
        style={{ background: BRAND.bg2, borderColor: BRAND.border }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative h-24" style={{ background: CATEGORY_GRADIENTS[prompt.category] }}>
          <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 rounded-full bg-black/30 p-1.5 text-white hover:bg-black/50">
            <XIcon width={16} height={16} />
          </button>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ background: BRAND.bg3, color: BRAND.text2 }}>{prompt.category}</span>
            <TierBadge tier={prompt.tier} />
            <Rating value={prompt.rating} />
            <span className="text-xs" style={{ color: BRAND.text2 }}>{prompt.uses.toLocaleString('en-US')} uses</span>
          </div>
          <h2 id="prompt-detail-title" className="mt-3 text-lg font-semibold" style={{ color: BRAND.text }}>{prompt.title}</h2>
          <p className="mt-1 text-sm" style={{ color: BRAND.text2 }}>{prompt.description}</p>
          <pre className="mt-4 whitespace-pre-wrap rounded-xl border p-4 font-mono text-sm leading-relaxed" style={{ background: BRAND.bg, borderColor: BRAND.border, color: BRAND.text }}>
            {prompt.prompt}
          </pre>
          <button
            type="button"
            onClick={copy}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: BRAND.accent }}
          >
            {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />} {copied ? 'Copied to clipboard' : 'Copy prompt'}
          </button>
        </div>
      </div>
    </div>
  );
}
