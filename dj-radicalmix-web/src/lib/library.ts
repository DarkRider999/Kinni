// A small, local-only library store (IndexedDB). No cloud sync in this build
// -- see docs/dj-radicalmix/SPEC.md Sec 0.1 for why (that needs a deployed
// backend this environment can't stand up). Everything here works fully
// offline, which is itself one of the blueprint's 30 pain points addressed.
import type { AnalysisResult } from "../engine/analysis";

export interface Track {
  id: string;
  name: string;
  file: Blob;
  durationSec: number;
  bpm: number;
  bpmConfidence: number;
  firstBeatSec: number;
  keyPitchClass: number;
  keyIsMinor: boolean;
  keyConfidence: number;
  camelot: string;
  energy: number; // 0..10, user-editable (no trained classifier in this build)
  genre: string;
  addedAt: number;
  lastPlayedAt: number | null; // ms epoch, null = never played
  userBias: number; // -1..1, nudged by accept/skip of AI suggestions
}

// A crate's filter, when it's a "smart" (rule-based) crate rather than a
// manual list of track ids -- RadicalSort from docs/dj-radicalmix Sec 2 Issue 3.
// Every field is optional; an unset field doesn't filter on that axis.
export interface CrateRule {
  bpmMin?: number;
  bpmMax?: number;
  energyMin?: number;
  energyMax?: number;
  genre?: string; // exact match, case-insensitive
  mode?: "major" | "minor"; // filters by the Camelot letter
  notPlayedWithinDays?: number; // excludes tracks played more recently than this
}

export interface Crate {
  id: string;
  name: string;
  kind: "manual" | "smart";
  trackIds: string[]; // manual crates only
  rule: CrateRule; // smart crates only
  createdAt: number;
}

const DB_NAME = "dj-radicalmix";
const TRACK_STORE = "tracks";
const CRATE_STORE = "crates";
const DB_VERSION = 2;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TRACK_STORE)) db.createObjectStore(TRACK_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CRATE_STORE)) db.createObjectStore(CRATE_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function newTrackFromAnalysis(name: string, file: Blob, durationSec: number, a: AnalysisResult): Track {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    file,
    durationSec,
    bpm: a.bpm,
    bpmConfidence: a.bpmConfidence,
    firstBeatSec: a.firstBeatSec,
    keyPitchClass: a.keyPitchClass,
    keyIsMinor: a.keyIsMinor,
    keyConfidence: a.keyConfidence,
    camelot: a.camelot,
    energy: 5,
    genre: "",
    addedAt: Date.now(),
    lastPlayedAt: null,
    userBias: 0,
  };
}

export async function addTrack(track: Track): Promise<void> {
  await withStore(TRACK_STORE, "readwrite", (s) => s.put(track));
}

export async function updateTrack(track: Track): Promise<void> {
  await withStore(TRACK_STORE, "readwrite", (s) => s.put(track));
}

export async function deleteTrack(id: string): Promise<void> {
  await withStore(TRACK_STORE, "readwrite", (s) => s.delete(id));
}

export async function listTracks(): Promise<Track[]> {
  const tracks = await withStore<Track[]>(TRACK_STORE, "readonly", (s) => s.getAll());
  return tracks.sort((a, b) => b.addedAt - a.addedAt);
}

export function secondsSincePlayed(track: Track): number {
  return track.lastPlayedAt === null ? -1 : (Date.now() - track.lastPlayedAt) / 1000;
}

export function newManualCrate(name: string): Crate {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, name, kind: "manual", trackIds: [], rule: {}, createdAt: Date.now() };
}

export function newSmartCrate(name: string, rule: CrateRule): Crate {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, name, kind: "smart", trackIds: [], rule, createdAt: Date.now() };
}

export async function addCrate(crate: Crate): Promise<void> {
  await withStore(CRATE_STORE, "readwrite", (s) => s.put(crate));
}

export async function updateCrate(crate: Crate): Promise<void> {
  await withStore(CRATE_STORE, "readwrite", (s) => s.put(crate));
}

export async function deleteCrate(id: string): Promise<void> {
  await withStore(CRATE_STORE, "readwrite", (s) => s.delete(id));
}

export async function listCrates(): Promise<Crate[]> {
  const crates = await withStore<Crate[]>(CRATE_STORE, "readonly", (s) => s.getAll());
  return crates.sort((a, b) => a.createdAt - b.createdAt);
}

/** Whether a track belongs to a crate -- by membership (manual) or by matching every set rule field (smart). */
export function trackInCrate(track: Track, crate: Crate): boolean {
  if (crate.kind === "manual") return crate.trackIds.includes(track.id);
  const r = crate.rule;
  if (r.bpmMin !== undefined && track.bpm < r.bpmMin) return false;
  if (r.bpmMax !== undefined && track.bpm > r.bpmMax) return false;
  if (r.energyMin !== undefined && track.energy < r.energyMin) return false;
  if (r.energyMax !== undefined && track.energy > r.energyMax) return false;
  if (r.genre && track.genre.trim().toLowerCase() !== r.genre.trim().toLowerCase()) return false;
  if (r.mode) {
    if (track.keyPitchClass < 0) return false;
    if (r.mode === "major" && track.keyIsMinor) return false;
    if (r.mode === "minor" && !track.keyIsMinor) return false;
  }
  if (r.notPlayedWithinDays !== undefined) {
    const since = secondsSincePlayed(track);
    if (since >= 0 && since < r.notPlayedWithinDays * 86400) return false;
  }
  return true;
}
