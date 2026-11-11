import { useEffect, useState } from 'react';
import type { UploadedFile } from './UploadDropzone';
import { Icon } from './Icon';
import {
  analyzeFaceShape, analyzePhotoQuality, analyzeStyle, analyzeSymmetry, type AnalysisReport,
} from '../lib/analysis';

async function runFor(toolId: string, file: UploadedFile): Promise<AnalysisReport> {
  switch (toolId) {
    case 'face-shape-detector':
      return analyzeFaceShape(file.dataUrl, file.width, file.height);
    case 'symmetry-analysis':
      return analyzeSymmetry(file.dataUrl);
    case 'photo-quality-analysis':
      return analyzePhotoQuality(file.dataUrl, file.width, file.height);
    default:
      return analyzeStyle(file.dataUrl);
  }
}

export function AnalysisRunner({ toolId, toolName, file }: { toolId: string; toolName: string; file: UploadedFile }) {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    runFor(toolId, file).then((r) => { setReport(r); setLoading(false); });
  }, [toolId, file]);

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-8">
      <div className="overflow-hidden rounded-xl2 border border-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={file.dataUrl} alt="" className="max-h-[320px] w-full object-cover" />
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-[13px] text-white/50">
          <Icon name="refresh" size={15} className="animate-spin" /> Running {toolName.toLowerCase()}…
        </div>
      ) : report ? (
        <div className="mt-5 flex flex-col gap-4">
          <div className="surface flex items-center justify-between p-4">
            <span className="text-[14px] font-semibold text-white">{report.headline}</span>
            <span className="rounded-full bg-accent-cyan/15 px-2.5 py-1 text-[10.5px] font-bold text-accent-cyanSoft">
              {report.confidence}% confidence
            </span>
          </div>
          {report.rows.length > 0 && (
            <div className="surface flex flex-col divide-y divide-white/[0.06] p-1">
              {report.rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-[12.5px] text-white/55">{row.label}</span>
                  <span className="text-[12.5px] font-semibold text-white">{row.value}</span>
                </div>
              ))}
            </div>
          )}
          {report.suggestion && (
            <div className="flex items-start gap-2 rounded-xl2 border border-accent-cyan/20 bg-accent-cyan/[0.06] p-3.5 text-[12px] text-accent-cyanSoft">
              <Icon name="sparkle" size={14} className="mt-0.5 shrink-0" /> {report.suggestion}
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-white/35">
            This is an AI estimate from a simple heuristic placeholder, not a verified fact — see SPEC §21.
          </p>
        </div>
      ) : null}
    </div>
  );
}
