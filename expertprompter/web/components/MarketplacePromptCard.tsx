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
      style={premium ? { background: 'rgba(255,101,132,0.2)', color: BRAND.accent2, border: '1px solid rgba(255,101,132,0.3)' } : { background: 'rgba(67,233,123,0.15)', color: BRAND.accent3, border: '1px solid rgba(67,233,123,0.3)' }}
    >
      {premium ? '★ Premium' : '✦ Free'}
    </span>
  );
}

interface CardProps {
  prompt: MarketplacePrompt;
  onOpen: (prompt: MarketplacePrompt) => void;
  hot?: boolean;
}

/** Image-first prompt card with hover overlay showing the prompt text. */
export default function MarketplacePromptCard({ prompt, onOpen, hot }: CardProps) {
  const { copied, copy } = useCopy(prompt.prompt);
  const [imgError, setImgError] = useState(false);

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
      className="group relative flex flex-col overflow-hidden rounded-2xl border cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
      style={{ background: BRAND.bg2, borderColor: BRAND.border }}
    >
      {/* Image area */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '3/2' }}>
        {imgError ? (
          <div className="absolute inset-0" style={{ background: CATEGORY_GRADIENTS[prompt.category] }} />
        ) : (
          <img
            src={prompt.imageUrl}
            alt={prompt.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        )}

        {/* Gradient overlay always visible at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Hover overlay — shows prompt text */}
        <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/70 backdrop-blur-[2px]">
          <p className="text-xs text-white/90 leading-relaxed line-clamp-5 font-mono">
            {prompt.prompt}
          </p>
        </div>

        {/* Badges top */}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {hot && (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: BRAND.accent2 }}>
              🔥 Hot
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3">
          <TierBadge tier={prompt.tier} />
        </div>

        {/* Category tag at bottom-left over gradient */}
        <div className="absolute bottom-3 left-3">
          <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-white/90 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}>
            {prompt.category}
          </span>
        </div>
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold leading-tight" style={{ color: BRAND.text }}>{prompt.title}</h3>
          <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: BRAND.text2 }}>
            <span className="inline-flex items-center gap-0.5"><StarIcon filled width={11} height={11} className="text-amber-400" /> {prompt.rating.toFixed(1)}</span>
            <span>·</span>
            <span>{formatUses(prompt.uses)} uses</span>
          </div>
        </div>
        <button
          type="button"
          aria-label={`Copy prompt: ${prompt.title}`}
          onClick={(e) => { e.stopPropagation(); copy(); }}
          onKeyDown={(e) => e.stopPropagation()}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all hover:scale-105"
          style={copied
            ? { background: 'rgba(67,233,123,0.15)', color: BRAND.accent3, border: `1px solid ${BRAND.accent3}` }
            : { background: 'rgba(108,99,255,0.15)', color: BRAND.accent, border: `1px solid rgba(108,99,255,0.4)` }
          }
        >
          {copied ? <CheckIcon width={13} height={13} /> : <CopyIcon width={13} height={13} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

/** Full-prompt detail modal. */
export function PromptDetailModal({ prompt, onClose }: { prompt: MarketplacePrompt | null; onClose: () => void }) {
  const { copied, copy } = useCopy(prompt?.prompt ?? '');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!prompt) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt, onClose]);

  // Reset imgError when prompt changes
  useEffect(() => { setImgError(false); }, [prompt?.id]);

  if (!prompt) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-detail-title"
        className="w-full max-w-2xl animate-fade-in overflow-hidden rounded-2xl border"
        style={{ background: BRAND.bg2, borderColor: BRAND.border }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Image header */}
        <div className="relative overflow-hidden" style={{ height: 220 }}>
          {imgError ? (
            <div className="absolute inset-0" style={{ background: CATEGORY_GRADIENTS[prompt.category] }} />
          ) : (
            <img
              src={prompt.imageUrl}
              alt={prompt.title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors">
            <XIcon width={16} height={16} />
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-white/90" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}>{prompt.category}</span>
              <TierBadge tier={prompt.tier} />
            </div>
            <h2 id="prompt-detail-title" className="mt-1.5 text-xl font-bold text-white drop-shadow">{prompt.title}</h2>
          </div>
        </div>

        <div className="p-5">
          <p className="text-sm mb-4" style={{ color: BRAND.text2 }}>{prompt.description}</p>

          {/* Stats */}
          <div className="flex items-center gap-4 mb-4 text-sm" style={{ color: BRAND.text2 }}>
            <span className="inline-flex items-center gap-1"><StarIcon filled width={14} height={14} className="text-amber-400" /> {prompt.rating.toFixed(1)} rating</span>
            <span>·</span>
            <span>{prompt.uses.toLocaleString('en-US')} uses</span>
          </div>

          {/* Prompt text */}
          <div className="relative">
            <pre className="whitespace-pre-wrap rounded-xl border p-4 font-mono text-sm leading-relaxed" style={{ background: BRAND.bg, borderColor: BRAND.border, color: BRAND.text }}>
              {prompt.prompt}
            </pre>
          </div>

          <button
            type="button"
            onClick={copy}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.01]"
            style={{ background: copied ? `linear-gradient(135deg, #43e97b, #10a37f)` : `linear-gradient(135deg, ${BRAND.accent}, #9b59b6)` }}
          >
            {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
            {copied ? 'Copied to clipboard!' : 'Copy Prompt'}
          </button>
        </div>
      </div>
    </div>
  );
}
