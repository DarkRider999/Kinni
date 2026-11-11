import { useRef, useState } from 'react';
import { useRouter } from 'next/router';
import type { UploadedFile } from './UploadDropzone';
import { SmartEditLocks } from './SmartEditLocks';
import { LabeledSlider } from './LabeledSlider';
import { Icon } from './Icon';
import { aiProvider } from '../lib/aiProvider';
import { buildZip } from '../lib/zip';
import { newId, saveProject } from '../lib/storage';
import type { BatchItem, Locks, ToolDef } from '../lib/types';

export function BatchRunner({ tool, files }: { tool: ToolDef; files: UploadedFile[] }) {
  const router = useRouter();
  const [items, setItems] = useState<BatchItem[]>(
    files.map((f) => ({ id: f.id, fileName: f.fileName, originalDataUrl: f.dataUrl, status: 'queued' })),
  );
  const [locks, setLocks] = useState<Locks>(tool.defaultLocks);
  const [identity, setIdentity] = useState(90);
  const [running, setRunning] = useState(false);
  const pausedRef = useRef(false);

  function updateItem(id: string, patch: Partial<BatchItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function processOne(item: BatchItem) {
    updateItem(item.id, { status: 'processing' });
    try {
      const { resultDataUrl } = await aiProvider.runTransform({
        sourceDataUrl: item.originalDataUrl, toolId: tool.id, studio: tool.studio, locks, identityStrength: identity,
      });
      const qc = await aiProvider.runQualityCheck(false);
      if (qc.verdict === 'pass') {
        updateItem(item.id, { status: 'done', resultDataUrl });
      } else {
        updateItem(item.id, { status: 'failed' });
      }
    } catch {
      updateItem(item.id, { status: 'failed' });
    }
  }

  async function runQueue(queue: BatchItem[]) {
    setRunning(true);
    pausedRef.current = false;
    for (const item of queue) {
      if (pausedRef.current) break;
      await processOne(item);
    }
    setRunning(false);
  }

  function start() {
    runQueue(items.filter((i) => i.status === 'queued'));
  }

  function pause() {
    pausedRef.current = true;
    setRunning(false);
  }

  function retry(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    updateItem(id, { status: 'queued' });
    runQueue([{ ...item, status: 'queued' }]);
  }

  function cancel(id: string) {
    updateItem(id, { status: 'canceled' });
  }

  const doneItems = items.filter((i) => i.status === 'done' && i.resultDataUrl);
  const allSettled = items.every((i) => i.status === 'done' || i.status === 'failed' || i.status === 'canceled');

  function saveAllToProjects() {
    doneItems.forEach((item) => {
      saveProject({
        id: newId(), toolId: tool.id, toolName: tool.name, studio: tool.studio,
        originalDataUrl: item.originalDataUrl, resultDataUrl: item.resultDataUrl!, locks,
        identityStrength: identity, createdAt: Date.now(), favorite: false,
      });
    });
  }

  function downloadZip() {
    const zip = buildZip(doneItems.map((item, i) => ({ name: `result-${i + 1}-${item.fileName.replace(/\.[^.]+$/, '')}.png`, dataUrl: item.resultDataUrl! })));
    const url = URL.createObjectURL(zip);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-face-studio-batch.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const statusColor: Record<BatchItem['status'], string> = {
    queued: 'text-white/40', processing: 'text-accent-cyanSoft', done: 'text-accent-green',
    failed: 'text-accent-red', canceled: 'text-white/30',
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-6">
      <p className="mb-4 text-[12.5px] text-white/45">{items.length} photos queued. Each is processed independently — a failure doesn&apos;t block the rest.</p>

      <SmartEditLocks locks={locks} onChange={setLocks} />
      <div className="mt-4"><LabeledSlider label="Identity strength" value={identity} onChange={setIdentity} /></div>

      <div className="mt-5 flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.03] p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.resultDataUrl ?? item.originalDataUrl} alt="" className="h-11 w-11 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-white">{item.fileName}</div>
              <div className={`text-[11px] font-semibold ${statusColor[item.status]}`}>
                {item.status === 'processing' ? 'Processing…' : item.status[0].toUpperCase() + item.status.slice(1)}
              </div>
            </div>
            {item.status === 'queued' && (
              <button type="button" onClick={() => cancel(item.id)} aria-label="Cancel" className="text-white/35">
                <Icon name="x" size={16} />
              </button>
            )}
            {item.status === 'failed' && (
              <button type="button" onClick={() => retry(item.id)} aria-label="Retry" className="text-accent-cyanSoft">
                <Icon name="refresh" size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        {!running ? (
          <button type="button" onClick={start} disabled={!items.some((i) => i.status === 'queued')} className="btn-primary">
            {items.some((i) => i.status === 'done' || i.status === 'failed') ? 'Resume remaining' : 'Start batch'}
          </button>
        ) : (
          <button type="button" onClick={pause} className="btn-secondary flex items-center justify-center gap-2">
            <Icon name="pause" size={14} /> Pause
          </button>
        )}
        {allSettled && doneItems.length > 0 && (
          <div className="flex gap-2.5">
            <button type="button" onClick={saveAllToProjects} className="btn-secondary flex items-center justify-center gap-2">
              <Icon name="folder" size={14} /> Save all ({doneItems.length})
            </button>
            <button type="button" onClick={downloadZip} className="btn-secondary flex items-center justify-center gap-2">
              <Icon name="download" size={14} /> Download ZIP
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
