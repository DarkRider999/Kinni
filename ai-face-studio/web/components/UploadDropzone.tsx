import { useCallback, useRef, useState } from 'react';
import { Icon } from './Icon';

export interface UploadedFile {
  id: string;
  fileName: string;
  dataUrl: string;
  width: number;
  height: number;
}

const ACCEPTED = 'image/png,image/jpeg,image/webp';
const MAX_BYTES = 20 * 1024 * 1024;

function readFile(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function UploadDropzone({
  files,
  onFilesChange,
  maxFiles,
}: {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles: number;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setError(null);
      const incoming = Array.from(fileList);
      const room = maxFiles - files.length;
      if (room <= 0) {
        setError(maxFiles === 1 ? 'Remove the current photo before adding a new one.' : `You can upload up to ${maxFiles} photos.`);
        return;
      }
      const toProcess = incoming.slice(0, room);
      const oversized = toProcess.find((f) => f.size > MAX_BYTES);
      if (oversized) {
        setError(`"${oversized.name}" is over 20MB — try a smaller file.`);
        return;
      }
      const nonImage = toProcess.find((f) => !f.type.startsWith('image/'));
      if (nonImage) {
        setError(`"${nonImage.name}" isn't an image.`);
        return;
      }
      try {
        const read = await Promise.all(
          toProcess.map(async (file) => {
            const { dataUrl, width, height } = await readFile(file);
            return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, fileName: file.name, dataUrl, width, height };
          }),
        );
        onFilesChange([...files, ...read]);
      } catch {
        setError('Could not read that file — try again.');
      }
    },
    [files, maxFiles, onFilesChange],
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl2 border-2 border-dashed px-6 py-10 text-center transition ${
          dragOver ? 'border-accent-purple bg-accent-purple/10' : 'border-white/15 bg-white/[0.03]'
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent-purple to-accent-cyan">
          <Icon name="upload" size={22} className="text-ink-950" />
        </div>
        <div className="text-[13px] font-medium text-white">Drag a photo here, or choose one below</div>
        <div className="text-[11px] text-white/45">JPG, PNG or WEBP · up to 20MB{maxFiles > 1 ? ` · up to ${maxFiles} photos` : ''}</div>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-[12.5px] font-semibold text-white"
          >
            <Icon name="image" size={15} /> Choose photo
          </button>
          <label className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-[12.5px] font-semibold text-white">
            <Icon name="camera" size={15} /> Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </label>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple={maxFiles > 1}
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-accent-red/10 px-3 py-2.5 text-[12px] text-accent-red">
          <Icon name="alert" size={15} /> {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {files.map((f) => (
            <div key={f.id} className="group relative aspect-square overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.dataUrl} alt={f.fileName} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`Remove ${f.fileName}`}
                onClick={() => onFilesChange(files.filter((x) => x.id !== f.id))}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
