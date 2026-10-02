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

const DB_NAME = "dj-radicalmix";
const STORE = "tracks";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
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
  await withStore("readwrite", (s) => s.put(track));
}

export async function updateTrack(track: Track): Promise<void> {
  await withStore("readwrite", (s) => s.put(track));
}

export async function deleteTrack(id: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(id));
}

export async function listTracks(): Promise<Track[]> {
  const tracks = await withStore<Track[]>("readonly", (s) => s.getAll());
  return tracks.sort((a, b) => b.addedAt - a.addedAt);
}

export function secondsSincePlayed(track: Track): number {
  return track.lastPlayedAt === null ? -1 : (Date.now() - track.lastPlayedAt) / 1000;
}
