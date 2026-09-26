import { useCallback, useEffect, useRef, useState } from 'react';
import Header from '@/components/Header';
import InputPanel, { type InputState } from '@/components/InputPanel';
import type { UiAttachment } from '@/components/FileUploadPanel';
import CategoryBadge from '@/components/CategoryBadge';
import PromptCard from '@/components/PromptCard';
import AIRecommendationPanel from '@/components/AIRecommendationPanel';
import HistoryPanel from '@/components/HistoryPanel';
import AuthModal from '@/components/AuthModal';
import PaywallModal from '@/components/PaywallModal';
import { SparklesIcon } from '@/components/Icons';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AttachmentPayload, Category, GenerateRequest, GenerateResponse, PromptOptions, RecommendedTool, SavedPrompt } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';

/** Ready files only, reduced to what the API needs. */
function toPayload(attachments: UiAttachment[]): AttachmentPayload[] {
  return attachments
    .filter((a) => a.status === 'ready')
    .map(({ name, role, kind, size, text, width, height, description }) => ({
      name, role, kind, size,
      ...(text ? { text } : {}),
      ...(width && height ? { width, height } : {}),
      ...(description ? { description } : {}),
    }));
}

/** Drops empty option fields so the request stays clean. */
function compactOptions(options: PromptOptions): PromptOptions {
  return Object.fromEntries(Object.entries(options).filter(([, v]) => v && String(v).trim())) as PromptOptions;
}

export default function Home() {
  const { user, entitlement, providers, setEntitlement, refresh, oauthError, clearOauthError } = useAuth();
  const [input, setInput] = useState<InputState>({ rawInput: '', promptStyle: 'PROFESSIONAL', options: {}, attachments: [] });
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [lastRequest, setLastRequest] = useState<GenerateRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const freeLimit = providers?.freeRunsLimit ?? 5;
  const openSignIn = useCallback((reason: string | null = null) => {
    setAuthReason(reason);
    setAuthOpen(true);
  }, []);

  // Surface a failed Google/Facebook/GitHub sign-in.
  useEffect(() => {
    if (oauthError) {
      setError(oauthError);
      clearOauthError();
    }
  }, [oauthError, clearOauthError]);

  // Back from Stripe Checkout: the webhook may land a moment after the redirect,
  // so re-check the plan a few times.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get('billing');
    if (!billing) return;
    window.history.replaceState(null, '', window.location.pathname);
    if (billing === 'cancelled') {
      setNotice('Checkout cancelled. You can upgrade any time.');
      return;
    }
    setNotice('Payment received. Activating Premium…');
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      void refresh();
      if (tries >= 6) clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (notice?.startsWith('Payment received') && entitlement?.plan === 'PREMIUM') {
      setNotice('Welcome to Premium! Enjoy unlimited prompts.');
    }
  }, [notice, entitlement]);

  const run = useCallback(async (payload: GenerateRequest, mode: 'generate' | 'regenerate') => {
    if (providers?.accountsEnabled && !user) {
      openSignIn(`Sign in to get ${freeLimit} free expert prompts.`);
      return;
    }
    if (entitlement?.plan === 'FREE' && entitlement.freeRunsRemaining === 0) {
      setPaywallOpen(true);
      return;
    }
    const setBusy = mode === 'generate' ? setLoading : setRegenerating;
    setBusy(true);
    setError(null);
    try {
      const res = await api.generate(payload);
      if (res.entitlement) setEntitlement(res.entitlement);
      setResult(res);
      setLastRequest(payload);
      setSavedId(res.savedPromptId ?? null);
      if (res.savedPromptId) setHistoryKey((k) => k + 1);
      if (mode === 'generate') {
        // On mobile the output is below the form; bring it into view.
        requestAnimationFrame(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'AUTH_REQUIRED') openSignIn(e.message);
      else if (e instanceof ApiError && e.code === 'PAYWALL') {
        setPaywallOpen(true);
        void refresh();
      } else setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [providers, user, entitlement, freeLimit, openSignIn, setEntitlement, refresh]);

  const generate = () =>
    run(
      {
        rawInput: input.rawInput.trim(),
        promptStyle: input.promptStyle,
        options: compactOptions(input.options),
        variation: 0,
        attachments: toPayload(input.attachments),
      },
      'generate',
    );

  // Same request, next variation: different phrasing/lighting/structure choices.
  const regenerate = () => {
    if (!lastRequest) return;
    void run({ ...lastRequest, variation: (lastRequest.variation ?? 0) + 1 }, 'regenerate');
  };

  // User disagrees with the detected category: regenerate with an override.
  const switchCategory = (category: Category) => {
    if (!lastRequest) return;
    void run({ ...lastRequest, category, variation: 0 }, 'regenerate');
  };

  const saveCurrent = async () => {
    if (!result || !lastRequest) return;
    const saved = await api.savePrompt({
      rawInput: lastRequest.rawInput,
      generatedPrompt: result.generatedPrompt,
      detectedCategory: result.detectedCategory,
      promptStyle: result.promptStyle,
      recommendedTools: result.recommendedTools,
      options: lastRequest.options ?? {},
      title: result.title,
    });
    setSavedId(saved.id);
    setHistoryKey((k) => k + 1);
  };

  // Re-open a saved prompt without generating again (which would use a free run):
  // tool cards come from the catalog by name.
  const openSaved = async (p: SavedPrompt) => {
    const request: GenerateRequest = { rawInput: p.rawInput, promptStyle: p.promptStyle, options: p.options, category: p.detectedCategory, variation: 0 };
    setInput({ rawInput: p.rawInput, promptStyle: p.promptStyle, options: p.options ?? {}, attachments: [] });
    setError(null);
    const catalog = await api.meta().then((m) => m.tools).catch(() => []);
    const toolDetails: RecommendedTool[] = p.recommendedTools.flatMap((name, i) => {
      const tool = catalog.find((t) => t.name === name);
      return tool ? [{ ...tool, reason: tool.description, rank: i + 1 }] : [];
    });
    setResult({
      generatedPrompt: p.generatedPrompt,
      detectedCategory: p.detectedCategory,
      categoryLabel: CATEGORY_LABELS[p.detectedCategory],
      confidence: 1,
      alternativeCategories: [],
      recommendedTools: p.recommendedTools,
      toolDetails,
      promptStyle: p.promptStyle,
      detectedLanguage: p.options?.language || 'English',
      variation: 0,
      title: p.title ?? p.rawInput,
    });
    setLastRequest(request);
    setSavedId(p.id);
    outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen">
      <Header onSignIn={() => openSignIn()} onUpgrade={() => setPaywallOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Turn any idea into an <span className="bg-gradient-to-r from-brand-600 to-fuchsia-500 bg-clip-text text-transparent">expert AI prompt</span>
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Describe your task in plain words. ExpertPrompter detects what kind of task it is, writes a detailed, structured prompt, and tells you which AI tool to use.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          {/* Left column: input + history */}
          <div className="space-y-6">
            <InputPanel
              value={input}
              // Files are owned by onAttachmentsChange, so a keystroke can't undo a file that just finished reading.
              onChange={(next) => setInput((prev) => ({ ...next, attachments: prev.attachments }))}
              onAttachmentsChange={(update) => setInput((prev) => ({ ...prev, attachments: update(prev.attachments) }))}
              onGenerate={generate}
              loading={loading}
            />
            {user ? (
              <HistoryPanel refreshKey={historyKey} onSelect={(p) => void openSaved(p)} />
            ) : (
              <div className="card text-sm text-slate-600 dark:text-slate-400">
                <p>
                  <button type="button" className="font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={() => openSignIn()}>
                    Sign in with Google, Facebook or email
                  </button>{' '}
                  to get {freeLimit} free expert prompts and a searchable history.
                </p>
              </div>
            )}
          </div>

          {/* Right column: output */}
          <div ref={outputRef} className="scroll-mt-24 space-y-6" aria-live="polite">
            {notice && (
              <div role="status" className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span>{notice}</span>
                <button type="button" className="text-xs underline" onClick={() => setNotice(null)}>Dismiss</button>
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            )}

            {loading && !result && (
              <div className="card space-y-3" aria-busy="true">
                <div className="h-6 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/60" />
                <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/60" />
              </div>
            )}

            {!result && !loading && (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                  <SparklesIcon width={28} height={28} />
                </span>
                <h2 className="mt-4 font-semibold">Your expert prompt will appear here</h2>
                <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">Try one of the examples, or type anything, from a resignation letter to a YouTube script.</p>
              </div>
            )}

            {result && (
              <>
                <div className="card flex flex-wrap items-center gap-3 !py-4">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Detected category</span>
                  <CategoryBadge category={result.detectedCategory} confidence={result.confidence} />
                  <span className="text-xs text-slate-400">
                    {result.promptStyle.charAt(0) + result.promptStyle.slice(1).toLowerCase()} · {result.detectedLanguage}
                    {result.variation > 0 && ` · variation ${result.variation}`}
                  </span>
                  {result.alternativeCategories.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 sm:ml-auto dark:text-slate-400">
                      Not right? Try
                      {result.alternativeCategories.map((c) => (
                        <button key={c} type="button" onClick={() => switchCategory(c)} className="rounded-full border border-slate-300 px-2 py-0.5 hover:border-brand-500 hover:text-brand-700 dark:border-slate-700 dark:hover:text-brand-300">
                          {CATEGORY_LABELS[c]}
                        </button>
                      ))}
                    </span>
                  )}
                </div>

                <PromptCard
                  prompt={result.generatedPrompt}
                  onRegenerate={regenerate}
                  regenerating={regenerating}
                  onSave={user ? saveCurrent : undefined}
                  saved={Boolean(savedId)}
                />
                <AIRecommendationPanel tools={result.toolDetails} />
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-slate-400 sm:px-6">
        ExpertPrompter writes prompts with its own rule-based logic. Photos you attach are described by an AI running on your own device.
        {' · '}<a href="/privacy" className="underline">Privacy</a>{' · '}<a href="/terms" className="underline">Terms</a>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} reason={authReason} />
      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </div>
  );
}
