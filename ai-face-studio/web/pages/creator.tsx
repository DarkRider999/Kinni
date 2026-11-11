import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Icon } from '../components/Icon';
import { UploadDropzone, type UploadedFile } from '../components/UploadDropzone';
import { ConsentNotice } from '../components/ConsentNotice';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { parsePrompt, planToPasses } from '../lib/editPlan';
import { aiProvider } from '../lib/aiProvider';
import { newId, saveProject } from '../lib/storage';
import type { EditPlanField } from '../lib/types';

const EXAMPLE = 'Change my hair to silver and put me in a cyberpunk city.';
const FIELD_LABEL: Record<EditPlanField['field'], string> = {
  face: 'Face', hair: 'Hair', clothing: 'Clothing', background: 'Background', lighting: 'Lighting',
};

type Step = 'prompt' | 'plan' | 'result';

export default function Creator() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('prompt');
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<EditPlanField[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [consent, setConsent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function buildPlan() {
    if (!prompt.trim()) return;
    setPlan(parsePrompt(prompt));
    setStep('plan');
  }

  function toggleField(field: EditPlanField['field']) {
    setPlan((prev) => prev.map((f) => (f.field === field ? { ...f, enabled: !f.enabled } : f)));
  }

  async function generate() {
    if (files.length === 0 || !consent) return;
    setGenerating(true);
    const passes = planToPasses(plan);
    let current = files[0].dataUrl;
    for (const pass of passes) {
      const { resultDataUrl } = await aiProvider.runTransform({ sourceDataUrl: current, toolId: pass.toolId, studio: pass.studio, preset: pass.preset, intensity: 60 });
      current = resultDataUrl;
    }
    setResultUrl(current);
    setGenerating(false);
    setStep('result');
  }

  function handleSave() {
    if (!resultUrl || files.length === 0) return;
    saveProject({
      id: newId(), toolId: 'ai-creator', toolName: 'AI Creator', studio: 'creator',
      originalDataUrl: files[0].dataUrl, resultDataUrl: resultUrl, locks: {}, createdAt: Date.now(), favorite: false,
    });
    setSaved(true);
  }

  function handleDownload() {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = 'ai-creator-result.png';
    a.click();
  }

  return (
    <>
      <Head><title>AI Creator</title></Head>
      <TopBar title="AI Creator" onBack={() => router.push('/home')} />
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {step === 'prompt' && (
          <>
            <div className="surface p-4">
              <div className="mb-2 text-[11px] font-semibold tracking-wide text-white/45">WHAT DO YOU WANT TO CHANGE?</div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={EXAMPLE}
                rows={4}
                className="w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-white placeholder-white/30 outline-none"
              />
            </div>
            <button type="button" onClick={() => setPrompt(EXAMPLE)} className="mt-2 text-[11.5px] text-accent-purpleSoft">
              Try the example
            </button>
            <button type="button" onClick={buildPlan} disabled={!prompt.trim()} className="btn-primary mt-5">
              Build edit plan
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-white/35">
              This parses your text for known keywords (hair colors, scenes, lighting, outfits) — it&apos;s a
              placeholder for the real LLM-based plan compiler in SPEC §5.2, not a model call.
            </p>
          </>
        )}

        {step === 'plan' && (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Icon name="sparkle" size={15} className="text-accent-purpleSoft" />
              <span className="text-[12.5px] font-bold tracking-wide text-accent-purpleSoft">AI EDIT PLAN</span>
              <span className="ml-auto text-[11px] text-white/40">Review before generating</span>
            </div>
            <div className="flex flex-col gap-2">
              {plan.map((f) => (
                <label
                  key={f.field}
                  className={`flex items-center justify-between rounded-xl border p-3 ${
                    f.action === 'change' ? 'border-accent-cyan/30 bg-accent-cyan/[0.07]' : 'border-line bg-white/[0.03]'
                  }`}
                >
                  <div>
                    <div className="text-[13px] font-semibold text-white">{FIELD_LABEL[f.field]}</div>
                    {f.value && <div className="text-[11px] text-white/45">{f.value}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11.5px] font-semibold ${f.action === 'change' ? 'text-accent-cyanSoft' : 'text-white/40'}`}>
                      {f.enabled ? (f.action === 'change' ? 'Change' : 'Preserve') : 'Off'}
                    </span>
                    <input type="checkbox" checked={f.enabled} onChange={() => toggleField(f.field)} className="h-4 w-4 accent-accent-cyan" />
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-5">
              <div className="mb-2 text-[11px] font-semibold tracking-wide text-white/45">YOUR PHOTO</div>
              <UploadDropzone files={files} onFilesChange={setFiles} maxFiles={1} />
            </div>
            <div className="mt-4"><ConsentNotice checked={consent} onChange={setConsent} /></div>

            <button type="button" onClick={generate} disabled={files.length === 0 || !consent || generating} className="btn-primary mt-5">
              {generating ? 'Generating…' : 'Generate'}
            </button>
            <button type="button" onClick={() => setStep('prompt')} className="mt-2 w-full py-1 text-center text-[11.5px] text-white/35">
              Edit the prompt
            </button>
          </>
        )}

        {step === 'result' && resultUrl && (
          <>
            <BeforeAfterSlider originalSrc={files[0].dataUrl} resultSrc={resultUrl} />
            <div className="mt-5 flex gap-2.5">
              <button type="button" onClick={handleSave} className="btn-secondary flex items-center justify-center gap-2">
                <Icon name={saved ? 'check' : 'folder'} size={14} /> {saved ? 'Saved' : 'Save'}
              </button>
              <button type="button" onClick={handleDownload} className="btn-secondary flex items-center justify-center gap-2">
                <Icon name="download" size={14} /> Download
              </button>
            </div>
            <button type="button" onClick={() => { setStep('prompt'); setPrompt(''); setFiles([]); setResultUrl(null); setSaved(false); }} className="mt-3 w-full py-1 text-center text-[11.5px] text-white/35">
              Start a new creation
            </button>
          </>
        )}
      </div>
    </>
  );
}
