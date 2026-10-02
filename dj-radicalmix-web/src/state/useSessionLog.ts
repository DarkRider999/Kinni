import { useCallback, useState } from "react";

export interface SessionLogEntry {
  at: number; // ms epoch
  deck: 0 | 1;
  name: string;
  bpm: number;
  camelot: string;
}

/** An in-memory tracklist of what got loaded to a deck during this session --
 * the "auto-built tracklist" from docs/dj-radicalmix Sec 2 Issue 13, without
 * needing a server: it's exported as a .txt alongside the local recording. */
export function useSessionLog() {
  const [entries, setEntries] = useState<SessionLogEntry[]>([]);

  const log = useCallback((deck: 0 | 1, name: string, bpm: number, camelot: string) => {
    setEntries((prev) => [...prev, { at: Date.now(), deck, name, bpm, camelot }]);
  }, []);

  const toText = useCallback(
    (sessionStartedAt: number) => {
      const lines = [
        "DJ RadicalMix -- set tracklist",
        new Date(sessionStartedAt).toLocaleString(),
        "",
        ...entries.map((e) => {
          const elapsedSec = Math.max(0, Math.round((e.at - sessionStartedAt) / 1000));
          const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
          const ss = String(elapsedSec % 60).padStart(2, "0");
          const bpmText = e.bpm > 0 ? `${e.bpm.toFixed(1)} BPM` : "? BPM";
          return `[${mm}:${ss}] Deck ${e.deck === 0 ? "A" : "B"}: ${e.name} (${bpmText}, ${e.camelot || "?"})`;
        }),
      ];
      return lines.join("\n");
    },
    [entries],
  );

  return { entries, log, toText };
}
