import { useState } from 'react';
import { useRouter } from 'next/router';
import type { UploadedFile } from './UploadDropzone';
import { SmartEditLocks } from './SmartEditLocks';
import { LabeledSlider } from './LabeledSlider';
import { StylePresetPicker } from './StylePresetPicker';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { Icon } from './Icon';
import { aiProvider } from '../lib/aiProvider';
import { newId, saveProject } from '../lib/storage';
import type { Locks, ToolDef } from '../lib/types';

type Phase = 'idle' | 'generating' | 'retrying' | 'done' | 'failed';

export function SingleEditor({ tool, file }: { tool: ToolDef; file: UploadedFile }) {
  const router = useRouter();
  const [locks, setLocks] = useState<Locks>(tool.defaultLocks);
  const [identity, setIdentity] = useState(90);
  const [intensity, setIntensity] = useState(60);
  const [preset, setPreset] = useState<string | undefined>(tool.presetOptions?.[0]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [simulateFail, setSimulateFail] = useState(false);
  const [saved, setSaved] = useState(false);

  async function generate() {
    setSaved(false);
    setFailReason(null);
    setPhase('generating');

    for (let attempt = 0; attempt <= 2; attempt++) {
      if (attempt > 0) setPhase('retrying');
      const { resultDataUrl } = await aiProvider.runTransform({
        sourceDataUrl: file.dataUrl, toolId: tool.id, studio: tool.studio,
        locks, identityStrength: identity, intensity, preset,
      });
      const qc = await aiProvider.runQualityCheck(simulateFail && attempt === 0);
      if (qc.verdict === 'pass') {
        setResultUrl(resultDataUrl);
        setPhase('done');
        return;
      }
      if (attempt === 2) {
        setFailReason(qc.reason ?? 'Quality check did not pass.');
        setPhase('failed');
        return;
      }
    }
  }

  function handleSave() {
    if (!resultUrl) return;
    saveProject({
      id: newId(), toolId: tool.id, toolName: tool.name, studio: tool.studio,
      originalDataUrl: file.dataUrl, resultDataUrl: resultUrl, locks, identityStrength: identity,
      preset, createdAt: Date.now(), favorite: false,
    });
    setSaved(true);
  }

  function handleDownload() {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `${tool.id}-result.png`;
    a.click();
  }

  async function handleShare() {
    if (!resultUrl) return;
    try {
      const blob = await (await fetch(resultUrl)).blob();
      const shareFile = new File([blob], `${tool.id}-result.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [shareFile] })) {
        await navigator.share({ files: [shareFile], title: tool.name });
        return;
      }
    } catch {
      // fall through to download
    }
    handleDownload();
  }

  const hasLocks = Object.keys(tool.defaultLocks).length > 0;

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-6">
      <div className="flex flex-col gap-5">
        {phase === 'done' && resultUrl ? (
          <BeforeAfterSlider originalSrc={file.dataUrl} resultSrc={resultUrl} />
        ) : (
          <div className="relative overflow-hidden rounded-xl2 border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={file.dataUrl} alt="" className="max-h-[360px] w-full object-cover" />
            {(phase === 'generating' || phase === 'retrying') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55">
                <Icon name="refresh" size={22} className="animate-spin text-accent-cyanSoft" />
                <span className="text-[12.5px] font-medium text-white">
                  {phase === 'retrying' ? 'AI detected an issue and is improving your result…' : 'Generating…'}
                </span>
              </div>
            )}
          </div>
        )}

        {phase === 'failed' && (
          <div className="flex items-start gap-2 rounded-xl2 border border-accent-red/30 bg-accent-red/10 p-3.5 text-[12px] text-accent-red">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Still not right after retrying.</div>
              <div className="mt-0.5 text-white/60">{failReason} No credit was used for this attempt.</div>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex items-center gap-2 rounded-xl border border-accent-green/25 bg-accent-green/10 px-3 py-2 text-[11.5px] font-semibold text-accent-green">
            <Icon name="check" size={13} /> Quality check passed
          </div>
        )}

        {hasLocks && <SmartEditLocks locks={locks} onChange={setLocks} />}
        {tool.controls.includes('identity') && <LabeledSlider label="Identity strength" value={identity} onChange={setIdentity} />}
        {tool.controls.includes('intensity') && <LabeledSlider label="Intensity" value={intensity} onChange={setIntensity} />}
        {tool.controls.includes('colorPicker') && tool.presetOptions && (
          <StylePresetPicker label="Color" options={tool.presetOptions} value={preset} onChange={setPreset} />
        )}
        {tool.controls.includes('stylePreset') && tool.presetOptions && !tool.controls.includes('colorPicker') && (
          <StylePresetPicker label="Style" options={tool.presetOptions} value={preset} onChange={setPreset} />
        )}

        <label className="flex items-center gap-2 text-[11px] text-white/35">
          <input type="checkbox" checked={simulateFail} onChange={(e) => setSimulateFail(e.target.checked)} className="accent-accent-purple" />
          Dev: simulate a QC failure on the first attempt
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <button type="button" onClick={generate} disabled={phase === 'generating' || phase === 'retrying'} className="btn-primary">
          {phase === 'idle' || phase === 'failed' ? 'Generate' : phase === 'done' ? 'Regenerate' : 'Working…'}
        </button>
        {phase === 'done' && (
          <div className="flex gap-2.5">
            <button type="button" onClick={handleSave} className="btn-secondary flex items-center justify-center gap-2">
              <Icon name={saved ? 'check' : 'folder'} size={14} /> {saved ? 'Saved' : 'Save'}
            </button>
            <button type="button" onClick={handleDownload} className="btn-secondary flex items-center justify-center gap-2">
              <Icon name="download" size={14} /> Download
            </button>
            <button type="button" onClick={handleShare} className="btn-secondary flex items-center justify-center gap-2">
              <Icon name="share" size={14} /> Share
            </button>
          </div>
        )}
        <button type="button" onClick={() => router.push('/tools')} className="py-1 text-center text-[11.5px] text-white/35">
          Choose a different tool
        </button>
      </div>
    </div>
  );
}
