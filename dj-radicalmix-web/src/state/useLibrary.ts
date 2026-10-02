import { useCallback, useEffect, useState } from "react";
import { analyzeTrack } from "../engine/analysis";
import { decodeAudioFile } from "../lib/decode";
import { addTrack, deleteTrack, listTracks, newTrackFromAnalysis, updateTrack, type Track } from "../lib/library";

export function useLibrary() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [importing, setImporting] = useState<{ name: string; done: boolean }[]>([]);

  const refresh = useCallback(async () => {
    setTracks(await listTracks());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      setImporting((prev) => [...prev, ...list.map((f) => ({ name: f.name, done: false }))]);
      for (const file of list) {
        try {
          const decoded = await decodeAudioFile(file);
          const analysis = analyzeTrack(decoded.channels, decoded.sampleRate);
          const track = newTrackFromAnalysis(file.name.replace(/\.[^/.]+$/, ""), file, decoded.durationSec, analysis);
          await addTrack(track);
        } catch (e) {
          console.warn(`could not import ${file.name}:`, e);
        } finally {
          setImporting((prev) => prev.map((i) => (i.name === file.name ? { ...i, done: true } : i)));
        }
      }
      await refresh();
      setTimeout(() => setImporting((prev) => prev.filter((i) => !i.done)), 1500);
    },
    [refresh],
  );

  const edit = useCallback(
    async (track: Track) => {
      await updateTrack(track);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteTrack(id);
      await refresh();
    },
    [refresh],
  );

  const markPlayed = useCallback(
    async (id: string) => {
      const t = tracks.find((x) => x.id === id);
      if (!t) return;
      await edit({ ...t, lastPlayedAt: Date.now() });
    },
    [tracks, edit],
  );

  return { tracks, importing, importFiles, edit, remove, markPlayed, refresh };
}
