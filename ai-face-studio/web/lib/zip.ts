/**
 * Minimal "stored" (uncompressed) ZIP writer — no dependency needed, and images are already
 * compressed (PNG/JPEG) so the stored method is standard practice for a batch-of-images ZIP.
 * Used by the Batch Face Swap "Download all" button.
 */

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}
function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

export interface ZipEntryInput {
  name: string;
  dataUrl: string;
}

export function buildZip(entries: ZipEntryInput[]): Blob {
  const encoder = new TextEncoder();
  const fileChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = dataUrlToBytes(entry.dataUrl);
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    writeUint32(lv, 0, 0x04034b50);
    writeUint16(lv, 4, 20);
    writeUint16(lv, 6, 0);
    writeUint16(lv, 8, 0); // stored, no compression
    writeUint16(lv, 10, 0);
    writeUint16(lv, 12, 0);
    writeUint32(lv, 14, crc);
    writeUint32(lv, 18, data.length);
    writeUint32(lv, 22, data.length);
    writeUint16(lv, 26, nameBytes.length);
    writeUint16(lv, 28, 0);
    localHeader.set(nameBytes, 30);

    fileChunks.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    writeUint32(cv, 0, 0x02014b50);
    writeUint16(cv, 4, 20);
    writeUint16(cv, 6, 20);
    writeUint16(cv, 8, 0);
    writeUint16(cv, 10, 0);
    writeUint16(cv, 12, 0);
    writeUint16(cv, 14, 0);
    writeUint32(cv, 16, crc);
    writeUint32(cv, 20, data.length);
    writeUint32(cv, 24, data.length);
    writeUint16(cv, 28, nameBytes.length);
    writeUint16(cv, 30, 0);
    writeUint16(cv, 32, 0);
    writeUint16(cv, 34, 0);
    writeUint16(cv, 36, 0);
    writeUint32(cv, 38, 0);
    writeUint32(cv, 42, offset);
    centralHeader.set(nameBytes, 46);

    centralChunks.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of centralChunks) centralSize += c.length;

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  writeUint32(ev, 0, 0x06054b50);
  writeUint16(ev, 4, 0);
  writeUint16(ev, 6, 0);
  writeUint16(ev, 8, entries.length);
  writeUint16(ev, 10, entries.length);
  writeUint32(ev, 12, centralSize);
  writeUint32(ev, 16, centralStart);
  writeUint16(ev, 20, 0);

  const parts = [...fileChunks, ...centralChunks, end] as unknown as BlobPart[];
  return new Blob(parts, { type: 'application/zip' });
}
