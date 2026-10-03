import type { UploadedFile } from '../components/UploadDropzone';

/**
 * Passes uploaded images from the Upload step to the Editor step without stuffing data: URLs into
 * the page URL. sessionStorage is per-tab and cleared on tab close — fine for a short-lived handoff.
 */
const PREFIX = 'aifs.staged.';

export function setStaged(id: string, files: UploadedFile[]): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PREFIX + id, JSON.stringify(files));
}

export function getStaged(id: string): UploadedFile[] | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(PREFIX + id);
  return raw ? (JSON.parse(raw) as UploadedFile[]) : null;
}

export function clearStaged(id: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PREFIX + id);
}
